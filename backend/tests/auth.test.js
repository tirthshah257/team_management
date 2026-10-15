import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createTestApp, extractCookies } from './setup.js';

describe('Authentication & Security', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = createTestApp();
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  it('GET /api/v1/auth/status returns canRegister: true on empty database', async () => {
    const res = await request(testEnv.app).get('/api/v1/auth/status');
    expect(res.status).toBe(200);
    expect(res.body.data.canRegister).toBe(true);
  });

  it('POST /api/v1/auth/register allows the first user to register as Admin', async () => {
    const res = await request(testEnv.app)
      .post('/api/v1/auth/register')
      .send({
        workspaceName: 'Acme Test Corp',
        name: 'First Admin',
        email: 'admin@acme.test',
        password: 'Password123'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('admin');
    expect(res.body.data.user.email).toBe('admin@acme.test');
    expect(res.body.data.user.password_hash).toBeUndefined();
    expect(res.body.data.workspace.name).toBe('Acme Test Corp');

    // Verify cookies set
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some(c => c.startsWith('token='))).toBe(true);
    expect(cookies.some(c => c.startsWith('XSRF-TOKEN='))).toBe(true);

    // Verify database state: canRegister is now false
    const statusRes = await request(testEnv.app).get('/api/v1/auth/status');
    expect(statusRes.body.data.canRegister).toBe(false);
  });

  it('POST /api/v1/auth/register rejects subsequent registrations with 403 Forbidden', async () => {
    // Register first user
    await request(testEnv.app)
      .post('/api/v1/auth/register')
      .send({
        workspaceName: 'Acme Test Corp',
        name: 'First Admin',
        email: 'admin@acme.test',
        password: 'Password123'
      });

    // Try second registration
    const secondRes = await request(testEnv.app)
      .post('/api/v1/auth/register')
      .send({
        workspaceName: 'Another Corp',
        name: 'Second User',
        email: 'second@acme.test',
        password: 'Password123'
      });

    expect(secondRes.status).toBe(403);
    expect(secondRes.body.error.code).toBe('FORBIDDEN');
  });

  it('POST /api/v1/auth/login validates credentials and rejects invalid email/password with 401', async () => {
    await request(testEnv.app)
      .post('/api/v1/auth/register')
      .send({
        workspaceName: 'Acme Corp',
        name: 'Admin',
        email: 'admin@acme.test',
        password: 'Password123'
      });

    // Wrong password
    const wrongPass = await request(testEnv.app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@acme.test',
        password: 'WrongPassword999'
      });
    expect(wrongPass.status).toBe(401);
    expect(wrongPass.body.error.message).toBe('Invalid email or password');

    // Unknown email
    const wrongEmail = await request(testEnv.app)
      .post('/api/v1/auth/login')
      .send({
        email: 'unknown@acme.test',
        password: 'Password123'
      });
    expect(wrongEmail.status).toBe(401);
    expect(wrongEmail.body.error.message).toBe('Invalid email or password');

    // Correct credentials
    const correct = await request(testEnv.app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@acme.test',
        password: 'Password123'
      });
    expect(correct.status).toBe(200);
    expect(correct.body.data.user.email).toBe('admin@acme.test');
  });

  it('GET /api/v1/auth/me returns current authenticated user and workspace', async () => {
    const regRes = await request(testEnv.app)
      .post('/api/v1/auth/register')
      .send({
        workspaceName: 'Acme Corp',
        name: 'Admin User',
        email: 'admin@acme.test',
        password: 'Password123'
      });

    const cookieHeader = extractCookies(regRes.headers['set-cookie']);

    const meRes = await request(testEnv.app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookieHeader);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.name).toBe('Admin User');
    expect(meRes.body.data.workspace.name).toBe('Acme Corp');
    expect(meRes.body.data.preferences).toBeDefined();
  });

  it('rejects unauthenticated requests to protected endpoints with 401', async () => {
    const res = await request(testEnv.app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('enforces CSRF token check on state-changing authenticated requests', async () => {
    const regRes = await request(testEnv.app)
      .post('/api/v1/auth/register')
      .send({
        workspaceName: 'Acme Corp',
        name: 'Admin User',
        email: 'admin@acme.test',
        password: 'Password123'
      });

    const setCookies = regRes.headers['set-cookie'];
    const cookieHeader = extractCookies(setCookies);

    // Send change-password without X-CSRF-Token header
    const noCsrfRes = await request(testEnv.app)
      .post('/api/v1/auth/change-password')
      .set('Cookie', cookieHeader)
      .send({
        currentPassword: 'Password123',
        newPassword: 'NewPassword456'
      });

    expect(noCsrfRes.status).toBe(403);
    expect(noCsrfRes.body.error.code).toBe('FORBIDDEN');
    expect(noCsrfRes.body.error.message).toContain('CSRF');

    // Extract CSRF cookie value
    const xsrfCookie = setCookies.find(c => c.startsWith('XSRF-TOKEN='));
    const xsrfToken = xsrfCookie.split(';')[0].split('=')[1];

    // Send with matching X-CSRF-Token header
    const withCsrfRes = await request(testEnv.app)
      .post('/api/v1/auth/change-password')
      .set('Cookie', cookieHeader)
      .set('X-CSRF-Token', xsrfToken)
      .send({
        currentPassword: 'Password123',
        newPassword: 'NewPassword456'
      });

    expect(withCsrfRes.status).toBe(200);
  });

  it('invalidates active session when token_version is incremented', async () => {
    const regRes = await request(testEnv.app)
      .post('/api/v1/auth/register')
      .send({
        workspaceName: 'Acme Corp',
        name: 'Admin User',
        email: 'admin@acme.test',
        password: 'Password123'
      });

    const setCookies = regRes.headers['set-cookie'];
    const oldCookieHeader = extractCookies(setCookies);
    const xsrfCookie = setCookies.find(c => c.startsWith('XSRF-TOKEN='));
    const xsrfToken = xsrfCookie.split(';')[0].split('=')[1];

    // Change password (increments token_version)
    const changeRes = await request(testEnv.app)
      .post('/api/v1/auth/change-password')
      .set('Cookie', oldCookieHeader)
      .set('X-CSRF-Token', xsrfToken)
      .send({
        currentPassword: 'Password123',
        newPassword: 'NewPassword456'
      });
    expect(changeRes.status).toBe(200);

    // Try using old cookie -> should be rejected with 401
    const oldSessionRes = await request(testEnv.app)
      .get('/api/v1/auth/me')
      .set('Cookie', oldCookieHeader);

    expect(oldSessionRes.status).toBe(401);
    expect(oldSessionRes.body.error.message).toContain('expired or been revoked');
  });
});
