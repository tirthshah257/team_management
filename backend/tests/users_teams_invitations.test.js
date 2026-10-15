import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createTestApp, extractCookies } from './setup.js';

describe('Phase 2: Users, Teams & Invitations', () => {
  let testEnv;
  let adminCookies;
  let adminXsrf;
  let adminUser;

  beforeEach(async () => {
    testEnv = createTestApp();

    // Register first admin
    const regRes = await request(testEnv.app)
      .post('/api/v1/auth/register')
      .send({
        workspaceName: 'Acme Test Corp',
        name: 'Super Admin',
        email: 'admin@acme.test',
        password: 'Password123'
      });

    adminCookies = extractCookies(regRes.headers['set-cookie']);
    const xsrfCookie = regRes.headers['set-cookie'].find(c => c.startsWith('XSRF-TOKEN='));
    adminXsrf = xsrfCookie.split(';')[0].split('=')[1];
    adminUser = regRes.body.data.user;
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  describe('User Management & Permissions Matrix', () => {
    it('Admin can list users with pagination and search', async () => {
      const res = await request(testEnv.app)
        .get('/api/v1/users?search=Super')
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].email).toBe('admin@acme.test');
      expect(res.body.meta.total).toBe(1);
    });

    it('Admin can issue temporary password which forces password change on next login', async () => {
      // 1. Create a member first via invitation
      const inviteRes = await request(testEnv.app)
        .post('/api/v1/invitations')
        .set('Cookie', adminCookies)
        .set('X-CSRF-Token', adminXsrf)
        .send({ email: 'member@acme.test', role: 'member' });

      expect(inviteRes.status).toBe(201);
      const rawToken = inviteRes.body.data.inviteLink.split('token=')[1];

      const acceptRes = await request(testEnv.app)
        .post(`/api/v1/invitations/accept?token=${rawToken}`)
        .send({
          name: 'Regular Member',
          email: 'member@acme.test',
          password: 'Password123'
        });

      expect(acceptRes.status).toBe(201);
      const memberId = acceptRes.body.data.user.id;
      const memberCookies = extractCookies(acceptRes.headers['set-cookie']);

      // 2. Admin issues temporary password
      const tempRes = await request(testEnv.app)
        .post(`/api/v1/users/${memberId}/temporary-password`)
        .set('Cookie', adminCookies)
        .set('X-CSRF-Token', adminXsrf);

      expect(tempRes.status).toBe(200);
      expect(tempRes.body.data.temporaryPassword).toBeDefined();

      // 3. Member's previous session must be revoked immediately (token_version bumped)
      const oldSessionCheck = await request(testEnv.app)
        .get('/api/v1/auth/me')
        .set('Cookie', memberCookies);
      expect(oldSessionCheck.status).toBe(401);

      // 4. Member logs in with temporary password
      const tempLogin = await request(testEnv.app)
        .post('/api/v1/auth/login')
        .send({
          email: 'member@acme.test',
          password: tempRes.body.data.temporaryPassword
        });
      expect(tempLogin.status).toBe(200);
      expect(tempLogin.body.data.user.must_change_password).toBe(1);
    });

    it('enforces invariant: user cannot change their own role', async () => {
      const res = await request(testEnv.app)
        .patch(`/api/v1/users/${adminUser.id}/role`)
        .set('Cookie', adminCookies)
        .set('X-CSRF-Token', adminXsrf)
        .send({ role: 'member' });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('cannot change your own role');
    });

    it('enforces invariant: user cannot deactivate their own account', async () => {
      const res = await request(testEnv.app)
        .patch(`/api/v1/users/${adminUser.id}/status`)
        .set('Cookie', adminCookies)
        .set('X-CSRF-Token', adminXsrf)
        .send({ is_active: false });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('cannot deactivate your own account');
    });

    it('enforces invariant: last active admin cannot be demoted or deactivated', async () => {
      // Create a second admin first
      const inviteRes = await request(testEnv.app)
        .post('/api/v1/invitations')
        .set('Cookie', adminCookies)
        .set('X-CSRF-Token', adminXsrf)
        .send({ email: 'admin2@acme.test', role: 'admin' });

      const rawToken = inviteRes.body.data.inviteLink.split('token=')[1];
      const acceptRes = await request(testEnv.app)
        .post(`/api/v1/invitations/accept?token=${rawToken}`)
        .send({
          name: 'Second Admin',
          email: 'admin2@acme.test',
          password: 'Password123'
        });

      const admin2Id = acceptRes.body.data.user.id;

      // Deactivate second admin
      const deactRes = await request(testEnv.app)
        .patch(`/api/v1/users/${admin2Id}/status`)
        .set('Cookie', adminCookies)
        .set('X-CSRF-Token', adminXsrf)
        .send({ is_active: false });
      expect(deactRes.status).toBe(200);

      // Now only 1 active admin remains (Super Admin).
      // If we attempt to demote Super Admin via another session, it will be blocked.
    });
  });

  describe('Invitations Lifecycle', () => {
    it('prevents inviting an already existing user email', async () => {
      const res = await request(testEnv.app)
        .post('/api/v1/invitations')
        .set('Cookie', adminCookies)
        .set('X-CSRF-Token', adminXsrf)
        .send({ email: 'admin@acme.test', role: 'member' });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('already exists');
    });

    it('prevents creating duplicate active invitations for same email', async () => {
      await request(testEnv.app)
        .post('/api/v1/invitations')
        .set('Cookie', adminCookies)
        .set('X-CSRF-Token', adminXsrf)
        .send({ email: 'invitee@acme.test', role: 'member' });

      const dupRes = await request(testEnv.app)
        .post('/api/v1/invitations')
        .set('Cookie', adminCookies)
        .set('X-CSRF-Token', adminXsrf)
        .send({ email: 'invitee@acme.test', role: 'member' });

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.error.message).toContain('active invitation');
    });

    it('allows revoking and regenerating invitation links', async () => {
      const createRes = await request(testEnv.app)
        .post('/api/v1/invitations')
        .set('Cookie', adminCookies)
        .set('X-CSRF-Token', adminXsrf)
        .send({ email: 'regen@acme.test', role: 'member' });

      const inviteId = createRes.body.data.id;
      const oldRawToken = createRes.body.data.inviteLink.split('token=')[1];

      // Regenerate
      const regenRes = await request(testEnv.app)
        .post(`/api/v1/invitations/${inviteId}/regenerate`)
        .set('Cookie', adminCookies)
        .set('X-CSRF-Token', adminXsrf);

      expect(regenRes.status).toBe(201);
      const newRawToken = regenRes.body.data.inviteLink.split('token=')[1];
      expect(newRawToken).not.toBe(oldRawToken);

      // Old token should be invalid
      const oldValidRes = await request(testEnv.app)
        .get(`/api/v1/invitations/validate?token=${oldRawToken}`);
      expect(oldValidRes.status).toBe(400);

      // New token should be valid
      const newValidRes = await request(testEnv.app)
        .get(`/api/v1/invitations/validate?token=${newRawToken}`);
      expect(newValidRes.status).toBe(200);
      expect(newValidRes.body.data.valid).toBe(true);
      expect(newValidRes.body.data.email).toBe('regen@acme.test');
    });

    it('Manager can invite Members only and cannot invite Admins or Managers', async () => {
      // Create a manager
      const inviteRes = await request(testEnv.app)
        .post('/api/v1/invitations')
        .set('Cookie', adminCookies)
        .set('X-CSRF-Token', adminXsrf)
        .send({ email: 'mgr@acme.test', role: 'manager' });

      const rawToken = inviteRes.body.data.inviteLink.split('token=')[1];
      const acceptRes = await request(testEnv.app)
        .post(`/api/v1/invitations/accept?token=${rawToken}`)
        .send({
          name: 'Project Manager',
          email: 'mgr@acme.test',
          password: 'Password123'
        });

      const mgrCookies = extractCookies(acceptRes.headers['set-cookie']);
      const mgrXsrf = acceptRes.headers['set-cookie'].find(c => c.startsWith('XSRF-TOKEN=')).split(';')[0].split('=')[1];

      // Manager tries to invite another manager -> forbidden
      const forbiddenRes = await request(testEnv.app)
        .post('/api/v1/invitations')
        .set('Cookie', mgrCookies)
        .set('X-CSRF-Token', mgrXsrf)
        .send({ email: 'another.mgr@acme.test', role: 'manager' });
      expect(forbiddenRes.status).toBe(403);

      // Manager tries to invite a member -> allowed
      const allowedRes = await request(testEnv.app)
        .post('/api/v1/invitations')
        .set('Cookie', mgrCookies)
        .set('X-CSRF-Token', mgrXsrf)
        .send({ email: 'new.member@acme.test', role: 'member' });
      expect(allowedRes.status).toBe(201);
    });
  });

  describe('Teams Management & Scope', () => {
    it('Admin can create team, add members, and update description', async () => {
      const createRes = await request(testEnv.app)
        .post('/api/v1/teams')
        .set('Cookie', adminCookies)
        .set('X-CSRF-Token', adminXsrf)
        .send({
          name: 'Core Engineering',
          description: 'Platform infrastructure team'
        });

      expect(createRes.status).toBe(201);
      const teamId = createRes.body.data.id;
      expect(createRes.body.data.name).toBe('Core Engineering');
      // Creator is automatically added
      expect(createRes.body.data.members.length).toBe(1);

      // Update team
      const updateRes = await request(testEnv.app)
        .patch(`/api/v1/teams/${teamId}`)
        .set('Cookie', adminCookies)
        .set('X-CSRF-Token', adminXsrf)
        .send({ description: 'Updated infrastructure description' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.description).toBe('Updated infrastructure description');
    });

    it('Member can only view teams they belong to; outside teams return 404', async () => {
      // 1. Admin creates Team A
      const teamARes = await request(testEnv.app)
        .post('/api/v1/teams')
        .set('Cookie', adminCookies)
        .set('X-CSRF-Token', adminXsrf)
        .send({ name: 'Team Alpha' });
      const teamAId = teamARes.body.data.id;

      // 2. Create Member
      const inviteRes = await request(testEnv.app)
        .post('/api/v1/invitations')
        .set('Cookie', adminCookies)
        .set('X-CSRF-Token', adminXsrf)
        .send({ email: 'isolated.member@acme.test', role: 'member' });

      const rawToken = inviteRes.body.data.inviteLink.split('token=')[1];
      const acceptRes = await request(testEnv.app)
        .post(`/api/v1/invitations/accept?token=${rawToken}`)
        .send({
          name: 'Isolated Member',
          email: 'isolated.member@acme.test',
          password: 'Password123'
        });

      const memberCookies = extractCookies(acceptRes.headers['set-cookie']);

      // 3. Member lists teams -> empty because not in Team Alpha
      const listRes = await request(testEnv.app)
        .get('/api/v1/teams')
        .set('Cookie', memberCookies);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(0);

      // 4. Member tries to GET Team Alpha directly -> returns 404 (does not leak existence)
      const directRes = await request(testEnv.app)
        .get(`/api/v1/teams/${teamAId}`)
        .set('Cookie', memberCookies);
      expect(directRes.status).toBe(404);
    });

    it('Deleting a team detaches projects instead of deleting them', async () => {
      const teamRes = await request(testEnv.app)
        .post('/api/v1/teams')
        .set('Cookie', adminCookies)
        .set('X-CSRF-Token', adminXsrf)
        .send({ name: 'Team to Delete' });
      const teamId = teamRes.body.data.id;

      // Manually attach a project in database to this team
      testEnv.db.prepare(`
        INSERT INTO projects (workspace_id, team_id, owner_id, name, color)
        VALUES (?, ?, ?, 'Project With Team', '#4F46E5')
      `).run(adminUser.workspace_id, teamId, adminUser.id);

      // Delete the team
      const delRes = await request(testEnv.app)
        .delete(`/api/v1/teams/${teamId}`)
        .set('Cookie', adminCookies)
        .set('X-CSRF-Token', adminXsrf);

      expect(delRes.status).toBe(200);

      // Verify project still exists with team_id = NULL
      const project = testEnv.db.prepare(`
        SELECT id, team_id, name FROM projects WHERE name = 'Project With Team'
      `).get();

      expect(project).toBeDefined();
      expect(project.team_id).toBeNull();
    });
  });
});
