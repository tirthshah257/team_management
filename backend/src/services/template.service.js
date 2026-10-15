import { getDatabase } from '../db/connection.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';

export class TemplateService {
  constructor(db) {
    this.db = db || getDatabase();
  }

  listTemplates(workspaceId) {
    const templates = this.db.prepare(`
      SELECT pt.*, u.name as creator_name,
        (SELECT COUNT(*) FROM project_template_tasks ptt WHERE ptt.template_id = pt.id AND ptt.parent_template_task_id IS NULL) as task_count,
        (SELECT COUNT(*) FROM project_template_tasks ptt WHERE ptt.template_id = pt.id AND ptt.parent_template_task_id IS NOT NULL) as subtask_count
      FROM project_templates pt
      JOIN users u ON pt.created_by = u.id
      WHERE pt.workspace_id = ?
      ORDER BY pt.name ASC
    `).all(workspaceId);

    return templates;
  }

  getTemplate(templateId, workspaceId) {
    const template = this.db.prepare(`
      SELECT pt.*, u.name as creator_name
      FROM project_templates pt
      JOIN users u ON pt.created_by = u.id
      WHERE pt.id = ? AND pt.workspace_id = ?
    `).get(templateId, workspaceId);

    if (!template) throw new NotFoundError('Template not found');

    const tasks = this.db.prepare(`
      SELECT ptt.*
      FROM project_template_tasks ptt
      WHERE ptt.template_id = ? AND ptt.parent_template_task_id IS NULL
      ORDER BY ptt.sort_order ASC, ptt.id ASC
    `).all(templateId);

    const subtasks = this.db.prepare(`
      SELECT ptt.*
      FROM project_template_tasks ptt
      WHERE ptt.template_id = ? AND ptt.parent_template_task_id IS NOT NULL
      ORDER BY ptt.sort_order ASC, ptt.id ASC
    `).all(templateId);

    const subtasksByParent = new Map();
    for (const st of subtasks) {
      if (!subtasksByParent.has(st.parent_template_task_id)) {
        subtasksByParent.set(st.parent_template_task_id, []);
      }
      subtasksByParent.get(st.parent_template_task_id).push(st);
    }

    const tasksWithSubtasks = tasks.map(t => ({
      ...t,
      subtasks: subtasksByParent.get(t.id) || []
    }));

    return {
      ...template,
      tasks: tasksWithSubtasks
    };
  }

  saveProjectAsTemplate({ projectId, user, data, workspaceId }) {
    const wsId = workspaceId || user.workspace_id;
    const project = this.db.prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?').get(projectId, wsId);
    if (!project) throw new NotFoundError('Project not found');

    const tasks = this.db.prepare(`
      SELECT * FROM tasks
      WHERE project_id = ? AND deleted_at IS NULL
      ORDER BY position ASC, id ASC
    `).all(projectId);

    const tx = this.db.transaction(() => {
      const templateRes = this.db.prepare(`
        INSERT INTO project_templates (workspace_id, name, description, created_by)
        VALUES (?, ?, ?, ?)
      `).run(wsId, data.name, data.description || project.description, user.id);

      const templateId = templateRes.lastInsertRowid;

      const insertTask = this.db.prepare(`
        INSERT INTO project_template_tasks (
          template_id, parent_template_task_id, title, description,
          priority, estimated_minutes, due_offset_days, sort_order
        ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)
      `);

      const insertSubtask = this.db.prepare(`
        INSERT INTO project_template_tasks (
          template_id, parent_template_task_id, title, sort_order
        ) VALUES (?, ?, ?, ?)
      `);

      const insertLabel = this.db.prepare(`
        INSERT INTO project_template_task_labels (template_task_id, label_id)
        VALUES (?, ?)
      `);

      tasks.forEach((task, idx) => {
        let dueOffset = 0;
        if (project.start_date && task.due_date) {
          const pStart = new Date(project.start_date);
          const tDue = new Date(task.due_date);
          dueOffset = Math.max(0, Math.round((tDue - pStart) / 86400000));
        }

        const tplTaskRes = insertTask.run(
          templateId,
          task.title,
          task.description,
          task.priority,
          task.estimated_minutes,
          dueOffset,
          idx + 1
        );
        const tplTaskId = tplTaskRes.lastInsertRowid;

        // Copy labels
        const labels = this.db.prepare('SELECT label_id FROM task_labels WHERE task_id = ?').all(task.id);
        for (const l of labels) {
          insertLabel.run(tplTaskId, l.label_id);
        }

        // Copy subtasks
        const subtasks = this.db.prepare('SELECT title, sort_order FROM subtasks WHERE task_id = ? ORDER BY sort_order ASC').all(task.id);
        for (const st of subtasks) {
          insertSubtask.run(templateId, tplTaskId, st.title, st.sort_order);
        }
      });

      return templateId;
    });

    const templateId = tx();
    return this.getTemplate(templateId, wsId);
  }

  createProjectFromTemplate({ templateId, user, data, workspaceId }) {
    if (user.role === 'member') {
      throw new ForbiddenError('Members cannot create projects');
    }

    const wsId = workspaceId || user.workspace_id;
    const template = this.getTemplate(templateId, wsId);

    const startDate = data.start_date || new Date().toISOString().split('T')[0];

    // Find max due offset among tasks to estimate project due date
    let maxOffset = 30; // default 30 days
    for (const t of template.tasks) {
      if (t.due_offset_days && t.due_offset_days > maxOffset) {
        maxOffset = t.due_offset_days;
      }
    }

    const startObj = new Date(startDate);
    const dueDate = new Date(startObj.getTime() + maxOffset * 86400000).toISOString().split('T')[0];

    const tx = this.db.transaction(() => {
      // 1. Create project
      const projRes = this.db.prepare(`
        INSERT INTO projects (workspace_id, team_id, owner_id, name, description, color, status, start_date, due_date)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
      `).run(
        wsId,
        data.team_id || null,
        user.id,
        data.name,
        template.description,
        data.color || '#4F46E5',
        startDate,
        dueDate
      );

      const projectId = projRes.lastInsertRowid;

      // 2. Add owner to project members
      this.db.prepare(`
        INSERT INTO project_members (project_id, user_id, added_by)
        VALUES (?, ?, ?)
      `).run(projectId, user.id, user.id);

      // Add extra members if provided
      if (Array.isArray(data.member_ids)) {
        const addMemberStmt = this.db.prepare(`
          INSERT OR IGNORE INTO project_members (project_id, user_id, added_by)
          VALUES (?, ?, ?)
        `);
        for (const mId of data.member_ids) {
          if (mId !== user.id) {
            addMemberStmt.run(projectId, mId, user.id);
          }
        }
      }

      // 3. Create tasks and subtasks
      const insertTask = this.db.prepare(`
        INSERT INTO tasks (
          workspace_id, project_id, created_by, title, description,
          status, priority, start_date, due_date, estimated_minutes, position
        ) VALUES (?, ?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?)
      `);

      const insertSubtask = this.db.prepare(`
        INSERT INTO subtasks (task_id, title, sort_order, created_by, is_completed)
        VALUES (?, ?, ?, ?, 0)
      `);

      const insertLabel = this.db.prepare(`
        INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)
      `);

      template.tasks.forEach((tplTask, idx) => {
        const offset = tplTask.due_offset_days || 0;
        const taskDue = new Date(startObj.getTime() + offset * 86400000).toISOString().split('T')[0];

        const taskRes = insertTask.run(
          wsId,
          projectId,
          user.id,
          tplTask.title,
          tplTask.description,
          tplTask.priority,
          startDate,
          taskDue,
          tplTask.estimated_minutes,
          (idx + 1) * 1000
        );
        const taskId = taskRes.lastInsertRowid;

        // Subtasks
        if (Array.isArray(tplTask.subtasks)) {
          tplTask.subtasks.forEach(st => {
            insertSubtask.run(taskId, st.title, st.sort_order, user.id);
          });
        }

        // Labels
        const tplLabels = this.db.prepare('SELECT label_id FROM project_template_task_labels WHERE template_task_id = ?').all(tplTask.id);
        tplLabels.forEach(l => {
          insertLabel.run(taskId, l.label_id);
        });
      });

      return projectId;
    });

    const projectId = tx();
    return { projectId, message: 'Project created from template successfully' };
  }

  deleteTemplate(templateId, user, workspaceId) {
    if (user.role !== 'admin') {
      throw new ForbiddenError('Only Admins can delete templates');
    }

    const wsId = workspaceId || user.workspace_id;
    const template = this.db.prepare('SELECT id FROM project_templates WHERE id = ? AND workspace_id = ?').get(templateId, wsId);
    if (!template) throw new NotFoundError('Template not found');

    this.db.prepare('DELETE FROM project_templates WHERE id = ?').run(templateId);
    return { message: 'Template deleted successfully' };
  }
}
