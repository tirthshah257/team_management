import { getDatabase } from '../db/connection.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.js';

export class RecurrenceService {
  constructor(db) {
    this.db = db || getDatabase();
  }

  setTaskRecurrence(taskId, user, data, workspaceId) {
    const wsId = workspaceId || user.workspace_id;
    const task = this.db.prepare('SELECT * FROM tasks WHERE id = ? AND workspace_id = ?').get(taskId, wsId);
    if (!task) throw new NotFoundError('Task not found');

    const nextDueDate = this.calculateNextDate({
      frequency: data.frequency,
      interval_value: data.interval_value || 1,
      custom_unit: data.custom_unit,
      days_of_week: data.days_of_week,
      day_of_month: data.day_of_month,
      currentDate: task.due_date || data.starts_on
    });

    const tx = this.db.transaction(() => {
      // If task already has a rule, delete previous
      if (task.recurrence_rule_id) {
        this.db.prepare('DELETE FROM recurring_task_rules WHERE id = ?').run(task.recurrence_rule_id);
      }

      const stmt = this.db.prepare(`
        INSERT INTO recurring_task_rules (
          workspace_id, frequency, interval_value, custom_unit,
          days_of_week, day_of_month, starts_on, ends_on,
          next_due_date, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        wsId,
        data.frequency,
        data.interval_value || 1,
        data.custom_unit || null,
        data.days_of_week || null,
        data.day_of_month || null,
        data.starts_on,
        data.ends_on || null,
        nextDueDate,
        user.id
      );

      const ruleId = result.lastInsertRowid;

      this.db.prepare(`
        UPDATE tasks
        SET recurrence_rule_id = ?, recurrence_sequence = 1, updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        WHERE id = ?
      `).run(ruleId, taskId);

      return ruleId;
    });

    const ruleId = tx();
    return this.db.prepare('SELECT * FROM recurring_task_rules WHERE id = ?').get(ruleId);
  }

  deleteRecurrenceRule(ruleId, user, workspaceId) {
    const wsId = workspaceId || user.workspace_id;
    const rule = this.db.prepare('SELECT * FROM recurring_task_rules WHERE id = ? AND workspace_id = ?').get(ruleId, wsId);
    if (!rule) throw new NotFoundError('Recurrence rule not found');

    const tx = this.db.transaction(() => {
      this.db.prepare('UPDATE tasks SET recurrence_rule_id = NULL WHERE recurrence_rule_id = ?').run(ruleId);
      this.db.prepare('DELETE FROM recurring_task_rules WHERE id = ?').run(ruleId);
    });

    tx();
    return { message: 'Recurrence rule deleted successfully' };
  }

  generateSuccessor(completedTask) {
    if (!completedTask.recurrence_rule_id) return null;

    const rule = this.db.prepare('SELECT * FROM recurring_task_rules WHERE id = ?').get(completedTask.recurrence_rule_id);
    if (!rule || !rule.is_active) return null;

    const nextSequence = (completedTask.recurrence_sequence || 1) + 1;

    // Idempotency check: don't create duplicate successor
    const existing = this.db.prepare(`
      SELECT id FROM tasks WHERE recurrence_rule_id = ? AND recurrence_sequence = ?
    `).get(rule.id, nextSequence);
    if (existing) return existing;

    const baseDate = completedTask.due_date || new Date().toISOString().split('T')[0];
    const nextDue = this.calculateNextDate({
      frequency: rule.frequency,
      interval_value: rule.interval_value,
      custom_unit: rule.custom_unit,
      days_of_week: rule.days_of_week,
      day_of_month: rule.day_of_month,
      currentDate: baseDate
    });

    // Check if beyond end date
    if (rule.ends_on && nextDue > rule.ends_on) {
      this.db.prepare("UPDATE recurring_task_rules SET is_active = 0, updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = ?").run(rule.id);
      return null;
    }

    const tx = this.db.transaction(() => {
      // Get max position in todo column
      const maxPosRow = this.db.prepare(`
        SELECT MAX(position) as max_pos
        FROM tasks
        WHERE project_id = ? AND status = 'todo' AND deleted_at IS NULL
      `).get(completedTask.project_id);
      const position = (maxPosRow?.max_pos || 0) + 1000;

      // Clone task
      const insertTask = this.db.prepare(`
        INSERT INTO tasks (
          workspace_id, project_id, created_by, title, description,
          status, priority, start_date, due_date, estimated_minutes,
          position, completed_at, recurrence_rule_id, recurrence_sequence
        ) VALUES (?, ?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?, NULL, ?, ?)
      `);

      const res = insertTask.run(
        completedTask.workspace_id,
        completedTask.project_id,
        completedTask.created_by,
        completedTask.title,
        completedTask.description,
        completedTask.priority,
        nextDue, // start_date can match nextDue or null
        nextDue,
        completedTask.estimated_minutes,
        position,
        rule.id,
        nextSequence
      );

      const newTaskId = res.lastInsertRowid;

      // Clone assignees
      const assignees = this.db.prepare('SELECT user_id, assigned_by FROM task_assignees WHERE task_id = ?').all(completedTask.id);
      const assignStmt = this.db.prepare('INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (?, ?, ?)');
      for (const a of assignees) {
        assignStmt.run(newTaskId, a.user_id, a.assigned_by);
      }

      // Clone labels
      const labels = this.db.prepare('SELECT label_id FROM task_labels WHERE task_id = ?').all(completedTask.id);
      const labelStmt = this.db.prepare('INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)');
      for (const l of labels) {
        labelStmt.run(newTaskId, l.label_id);
      }

      // Clone subtasks with is_completed = 0
      const subtasks = this.db.prepare('SELECT title, sort_order, created_by FROM subtasks WHERE task_id = ?').all(completedTask.id);
      const subtaskStmt = this.db.prepare('INSERT INTO subtasks (task_id, title, sort_order, created_by, is_completed) VALUES (?, ?, ?, ?, 0)');
      for (const st of subtasks) {
        subtaskStmt.run(newTaskId, st.title, st.sort_order, st.created_by);
      }

      // Update next_due_date on rule
      const futureDue = this.calculateNextDate({
        frequency: rule.frequency,
        interval_value: rule.interval_value,
        custom_unit: rule.custom_unit,
        days_of_week: rule.days_of_week,
        day_of_month: rule.day_of_month,
        currentDate: nextDue
      });

      this.db.prepare(`
        UPDATE recurring_task_rules
        SET next_due_date = ?, updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        WHERE id = ?
      `).run(futureDue, rule.id);

      return newTaskId;
    });

    const newId = tx();
    return this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(newId);
  }

  calculateNextDate({ frequency, interval_value = 1, custom_unit, days_of_week, day_of_month, currentDate }) {
    const d = new Date(currentDate);

    if (frequency === 'daily' || (frequency === 'custom' && custom_unit === 'day')) {
      d.setDate(d.getDate() + interval_value);
    } else if (frequency === 'weekly' || (frequency === 'custom' && custom_unit === 'week')) {
      d.setDate(d.getDate() + interval_value * 7);
    } else if (frequency === 'monthly' || (frequency === 'custom' && custom_unit === 'month')) {
      d.setMonth(d.getMonth() + interval_value);
      if (day_of_month) {
        d.setDate(Math.min(day_of_month, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
      }
    } else {
      d.setDate(d.getDate() + 7);
    }

    return d.toISOString().split('T')[0];
  }
}
