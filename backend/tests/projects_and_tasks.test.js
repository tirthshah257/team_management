import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createTestApp, extractCookies } from './setup.js';
import { seedDatabase } from '../src/db/seed.js';

describe('Phase 3: Projects, Tasks, Kanban, Templates & Recurrence', () => {
  let app;
  let db;
  let cleanup;
  let adminCookies;
  let managerCookies;
  let memberCookies;

  beforeEach(async () => {
    const testApp = createTestApp();
    app = testApp.app;
    db = testApp.db;
    cleanup = testApp.cleanup;

    // Seed database
    await seedDatabase(db);

    // Login Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@teamflow.local', password: 'Admin123!' });
    adminCookies = extractCookies(adminRes.headers['set-cookie']);

    // Login Manager (Sarah Connor)
    const mgrRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'sarah.manager@teamflow.local', password: 'Manager123!' });
    managerCookies = extractCookies(mgrRes.headers['set-cookie']);

    // Login Member (David Chen)
    const memRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'dev1.chen@teamflow.local', password: 'Member123!' });
    memberCookies = extractCookies(memRes.headers['set-cookie']);
  });

  afterEach(() => {
    cleanup();
  });

  describe('Project Management & Access Scoping', () => {
    it('Admin and Manager can create projects; creator is automatically added to project_members', async () => {
      const res = await request(app)
        .post('/api/v1/projects')
        .set('Cookie', managerCookies)
        .send({
          name: 'Mobile Client v2',
          description: 'Next gen mobile experience',
          color: '#0D9488',
          start_date: '2026-10-15',
          due_date: '2026-12-31'
        });

      expect(res.status).toBe(201);
      expect(res.body.project.name).toBe('Mobile Client v2');
      expect(res.body.project.members.length).toBeGreaterThanOrEqual(1);

      // Verify creator is in project_members
      const isMember = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?')
        .get(res.body.project.id, 2); // Sarah is ID 2
      expect(isMember).toBeTruthy();
    });

    it('Member cannot create a project (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/projects')
        .set('Cookie', memberCookies)
        .send({ name: 'Unauthorized Project' });

      expect(res.status).toBe(403);
    });

    it('Non-member receives 404 for inaccessible project (never leaks existence)', async () => {
      // Create a private project where dev2 is owner and dev1 is NOT added
      const proj = db.prepare(`
        INSERT INTO projects (workspace_id, owner_id, name, color, status)
        VALUES (1, 5, 'Secret R&D Project', '#4F46E5', 'active')
      `).run();
      const secretProjId = proj.lastInsertRowid;

      // Member (dev1.chen) tries to view secret project
      const res = await request(app)
        .get(`/api/v1/projects/${secretProjId}`)
        .set('Cookie', memberCookies);

      expect(res.status).toBe(404);
    });

    it('Project archive marks status as archived and prevents new tasks (read-only)', async () => {
      // Archive project 1 (TeamFlow Platform v1.0)
      const archiveRes = await request(app)
        .post('/api/v1/projects/1/archive')
        .set('Cookie', adminCookies);

      expect(archiveRes.status).toBe(200);

      // Attempting to create a task in an archived project should fail with 400
      const taskRes = await request(app)
        .post('/api/v1/projects/1/tasks')
        .set('Cookie', adminCookies)
        .send({ title: 'Task in archived project' });

      expect(taskRes.status).toBe(400);
      expect(taskRes.body.error).toContain('archived');

      // Restoring the project allows task creation again
      const restoreRes = await request(app)
        .post('/api/v1/projects/1/restore')
        .set('Cookie', adminCookies);

      expect(restoreRes.status).toBe(200);

      const taskRes2 = await request(app)
        .post('/api/v1/projects/1/tasks')
        .set('Cookie', adminCookies)
        .send({ title: 'Task in restored project' });

      expect(taskRes2.status).toBe(201);
    });
  });

  describe('Task Operations & Consistency', () => {
    it('Creates task and enforces assignee project membership', async () => {
      // Create task with assignee that is in project 1 (dev1 id=4 is a member)
      const res = await request(app)
        .post('/api/v1/projects/1/tasks')
        .set('Cookie', adminCookies)
        .send({
          title: 'Implement OAuth Token Refresh',
          description: 'Handle sliding window expiry',
          priority: 'high',
          start_date: '2026-10-15',
          due_date: '2026-10-20',
          estimated_minutes: 240,
          assignee_ids: [4]
        });

      expect(res.status).toBe(201);
      expect(res.body.task.title).toBe('Implement OAuth Token Refresh');
      expect(res.body.task.assignees.some(a => a.id === 4)).toBe(true);
    });

    it('Rejects task assignee if user is not a member of the project', async () => {
      // Create an isolated user who is NOT in project 3
      const isolatedUser = db.prepare(`
        INSERT INTO users (workspace_id, name, email, password_hash, role)
        VALUES (1, 'Outsider User', 'outsider@teamflow.local', 'hash', 'member')
      `).run();

      const res = await request(app)
        .post('/api/v1/projects/3/tasks')
        .set('Cookie', adminCookies)
        .send({
          title: 'Test Task with Non-Member',
          assignee_ids: [isolatedUser.lastInsertRowid]
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('must be a project member');
    });

    it('Enforces completed_at consistency when status transitions to and from done', async () => {
      // Create task
      const createRes = await request(app)
        .post('/api/v1/projects/1/tasks')
        .set('Cookie', adminCookies)
        .send({ title: 'Status check task', status: 'todo' });

      const taskId = createRes.body.task.id;
      expect(createRes.body.task.completed_at).toBeNull();

      // Update to done -> completed_at must be populated
      const doneRes = await request(app)
        .patch(`/api/v1/tasks/${taskId}`)
        .set('Cookie', adminCookies)
        .send({ status: 'done' });

      expect(doneRes.status).toBe(200);
      expect(doneRes.body.task.completed_at).toBeTruthy();

      // Update back to in_progress -> completed_at must become null
      const inProgRes = await request(app)
        .patch(`/api/v1/tasks/${taskId}`)
        .set('Cookie', adminCookies)
        .send({ status: 'in_progress' });

      expect(inProgRes.status).toBe(200);
      expect(inProgRes.body.task.completed_at).toBeNull();
    });

    it('Soft deletes task and restores it', async () => {
      const createRes = await request(app)
        .post('/api/v1/projects/1/tasks')
        .set('Cookie', adminCookies)
        .send({ title: 'Deletable Task' });

      const taskId = createRes.body.task.id;

      // Soft delete
      const delRes = await request(app)
        .delete(`/api/v1/tasks/${taskId}`)
        .set('Cookie', adminCookies);

      expect(delRes.status).toBe(200);

      // Verify task is excluded from active project list
      const listRes = await request(app)
        .get('/api/v1/projects/1/tasks')
        .set('Cookie', adminCookies);

      expect(listRes.body.tasks.some(t => t.id === taskId)).toBe(false);

      // Restore task
      const restoreRes = await request(app)
        .post(`/api/v1/tasks/${taskId}/restore`)
        .set('Cookie', adminCookies);

      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body.task.deleted_at).toBeNull();
    });
  });

  describe('Kanban Move & Fractional Positioning', () => {
    it('Moves task to a new status with fractional positioning', async () => {
      const t1 = await request(app)
        .post('/api/v1/projects/1/tasks')
        .set('Cookie', adminCookies)
        .send({ title: 'Task 1', status: 'todo' });

      const t2 = await request(app)
        .post('/api/v1/projects/1/tasks')
        .set('Cookie', adminCookies)
        .send({ title: 'Task 2', status: 'in_progress' });

      const t3 = await request(app)
        .post('/api/v1/projects/1/tasks')
        .set('Cookie', adminCookies)
        .send({ title: 'Task 3', status: 'in_progress' });

      // Move Task 1 between Task 2 and Task 3 in in_progress column
      const moveRes = await request(app)
        .patch(`/api/v1/tasks/${t1.body.task.id}/move`)
        .set('Cookie', adminCookies)
        .send({
          status: 'in_progress',
          previous_task_id: t2.body.task.id,
          next_task_id: t3.body.task.id
        });

      expect(moveRes.status).toBe(200);
      expect(moveRes.body.task.status).toBe('in_progress');
      expect(moveRes.body.task.position).toBeGreaterThan(t2.body.task.position);
      expect(moveRes.body.task.position).toBeLessThan(t3.body.task.position);
    });
  });

  describe('Subtasks & Labels', () => {
    it('Performs CRUD on subtasks and toggles is_completed', async () => {
      const taskRes = await request(app)
        .post('/api/v1/projects/1/tasks')
        .set('Cookie', adminCookies)
        .send({ title: 'Task with Subtasks' });
      const taskId = taskRes.body.task.id;

      // Add subtask
      const st1 = await request(app)
        .post(`/api/v1/tasks/${taskId}/subtasks`)
        .set('Cookie', adminCookies)
        .send({ title: 'Step 1: Design DB Schema' });

      expect(st1.status).toBe(201);
      expect(st1.body.subtask.is_completed).toBe(0);

      // Toggle completed
      const updateSt = await request(app)
        .patch(`/api/v1/subtasks/${st1.body.subtask.id}`)
        .set('Cookie', adminCookies)
        .send({ is_completed: 1 });

      expect(updateSt.status).toBe(200);
      expect(updateSt.body.subtask.is_completed).toBe(1);

      // Delete subtask
      const delSt = await request(app)
        .delete(`/api/v1/subtasks/${st1.body.subtask.id}`)
        .set('Cookie', adminCookies);

      expect(delSt.status).toBe(200);
    });

    it('Creates labels and associates them with tasks', async () => {
      // Create label
      const lblRes = await request(app)
        .post('/api/v1/labels')
        .set('Cookie', adminCookies)
        .send({ name: 'Security-Audit', color: '#DC2626' });

      expect(lblRes.status).toBe(201);
      const labelId = lblRes.body.label.id;

      // Create task and assign label
      const taskRes = await request(app)
        .post('/api/v1/projects/1/tasks')
        .set('Cookie', adminCookies)
        .send({ title: 'Verify CSRF defenses' });
      const taskId = taskRes.body.task.id;

      const setLblRes = await request(app)
        .put(`/api/v1/tasks/${taskId}/labels`)
        .set('Cookie', adminCookies)
        .send({ label_ids: [labelId] });

      expect(setLblRes.status).toBe(200);
      expect(setLblRes.body.task.labels.some(l => l.id === labelId)).toBe(true);
    });
  });

  describe('Recurring Tasks & Successor Generation', () => {
    it('Automatically generates next occurrence successor when recurring task is marked done', async () => {
      // 1. Create a task with due date
      const taskRes = await request(app)
        .post('/api/v1/projects/1/tasks')
        .set('Cookie', adminCookies)
        .send({
          title: 'Weekly Standup & Retrospective',
          start_date: '2026-10-15',
          due_date: '2026-10-22',
          priority: 'medium'
        });
      const taskId = taskRes.body.task.id;

      // 2. Set weekly recurrence
      const recRes = await request(app)
        .post(`/api/v1/tasks/${taskId}/recurrence`)
        .set('Cookie', adminCookies)
        .send({
          frequency: 'weekly',
          interval_value: 1,
          starts_on: '2026-10-15'
        });

      expect(recRes.status).toBe(201);
      expect(recRes.body.rule.frequency).toBe('weekly');

      // 3. Mark the task as done
      const doneRes = await request(app)
        .patch(`/api/v1/tasks/${taskId}`)
        .set('Cookie', adminCookies)
        .send({ status: 'done' });

      expect(doneRes.status).toBe(200);

      // 4. Verify successor task was generated in SQLite
      const successor = db.prepare(`
        SELECT * FROM tasks
        WHERE recurrence_rule_id = ? AND recurrence_sequence = 2
      `).get(recRes.body.rule.id);

      expect(successor).toBeTruthy();
      expect(successor.title).toBe('Weekly Standup & Retrospective');
      expect(successor.status).toBe('todo');
      expect(successor.due_date).toBe('2026-10-29'); // 7 days after 2026-10-22
    });
  });

  describe('Project Templates', () => {
    it('Creates a new project from an existing template transactionally', async () => {
      // Template ID 1 seeded in seedDatabase: 'Standard Sprint Template'
      const res = await request(app)
        .post('/api/v1/project-templates/1/create-project')
        .set('Cookie', adminCookies)
        .send({
          name: 'Sprint 42 - Core Features',
          start_date: '2026-11-01',
          color: '#2563EB'
        });

      expect(res.status).toBe(201);
      const newProjectId = res.body.projectId;

      // Verify tasks were created for the new project
      const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ?').all(newProjectId);
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks[0].title).toBe('Sprint Planning & Scope Lock');

      // Verify subtasks were cloned
      const subtasks = db.prepare(`
        SELECT st.* FROM subtasks st
        JOIN tasks t ON st.task_id = t.id
        WHERE t.project_id = ?
      `).all(newProjectId);

      expect(subtasks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Global Search Palette', () => {
    it('Returns accessible projects, tasks, and members matching query term', async () => {
      const res = await request(app)
        .get('/api/v1/search?q=Platform')
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.projects.some(p => p.name.includes('Platform'))).toBe(true);
    });
  });
});
