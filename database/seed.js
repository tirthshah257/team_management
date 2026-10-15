import bcrypt from 'bcryptjs';
import { getDatabase } from './connection.js';
import { runMigrations } from './migrate.js';

export async function seedDatabase(customDb) {
  const db = customDb || getDatabase();
  runMigrations(db);

  console.log('[Seed] Seeding database...');

  // Check if already seeded
  const existingWs = db.prepare('SELECT id FROM workspaces WHERE slug = ?').get('acme-corp');
  if (existingWs) {
    console.log('[Seed] Database is already seeded. Skipping.');
    return;
  }

  const hashAdmin = await bcrypt.hash('Admin123!', 12);
  const hashManager = await bcrypt.hash('Manager123!', 12);
  const hashMember = await bcrypt.hash('Member123!', 12);

  const seedTx = db.transaction(() => {
    // 1. Workspace & settings
    const ws = db.prepare(`
      INSERT INTO workspaces (name, slug)
      VALUES ('Acme Corp', 'acme-corp')
    `).run();
    const wsId = ws.lastInsertRowid;

    db.prepare(`
      INSERT INTO workspace_settings (workspace_id, timezone, working_days, default_capacity_hours_per_week, default_casual_leave_days, default_sick_leave_days, default_other_leave_days)
      VALUES (?, 'UTC', '1,2,3,4,5', 40, 12, 6, 2)
    `).run(wsId);

    // 2. Users
    const insertUser = db.prepare(`
      INSERT INTO users (workspace_id, name, email, password_hash, role, avatar_color, capacity_hours_per_week, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const admin = insertUser.run(wsId, 'Alice Johnson (Admin)', 'admin@teamflow.local', hashAdmin, 'admin', '#4F46E5', 40);
    const adminId = admin.lastInsertRowid;
    db.prepare('UPDATE workspaces SET created_by = ? WHERE id = ?').run(adminId, wsId);

    const mgr1 = insertUser.run(wsId, 'Sarah Connor (Engineering Lead)', 'sarah.manager@teamflow.local', hashManager, 'manager', '#0D9488', 40);
    const mgr2 = insertUser.run(wsId, 'Alex Morgan (Product Lead)', 'alex.manager@teamflow.local', hashManager, 'manager', '#D97706', 40);

    const dev1 = insertUser.run(wsId, 'David Chen (Senior Backend)', 'dev1.chen@teamflow.local', hashMember, 'member', '#2563EB', 40);
    const dev2 = insertUser.run(wsId, 'Marcus Brody (Full-Stack)', 'dev2.marcus@teamflow.local', hashMember, 'member', '#7C3AED', 40);
    const designer = insertUser.run(wsId, 'Elena Rostova (UI/UX Designer)', 'designer.elena@teamflow.local', hashMember, 'member', '#DB2777', 40);
    const qa = insertUser.run(wsId, 'Priya Patel (QA Engineer)', 'qa.priya@teamflow.local', hashMember, 'member', '#059669', 40);
    const dev3 = insertUser.run(wsId, 'Jordan Lee (Frontend)', 'dev3.jordan@teamflow.local', hashMember, 'member', '#EA580C', 35);

    const userIds = [adminId, mgr1.lastInsertRowid, mgr2.lastInsertRowid, dev1.lastInsertRowid, dev2.lastInsertRowid, designer.lastInsertRowid, qa.lastInsertRowid, dev3.lastInsertRowid];

    // User preferences & initial leave balances
    const insertPref = db.prepare('INSERT INTO user_preferences (user_id) VALUES (?)');
    const insertBalance = db.prepare(`
      INSERT INTO leave_balances (workspace_id, user_id, leave_type, year, allocated_days)
      VALUES (?, ?, ?, 2026, ?)
    `);

    const notifTypes = [
      'task_assigned', 'mentioned', 'comment_added', 'status_changed',
      'deadline_upcoming', 'task_overdue', 'project_member_added',
      'project_member_removed', 'team_member_added', 'team_member_removed',
      'invitation_accepted', 'leave_requested', 'leave_decided'
    ];
    const insertNotifSetting = db.prepare('INSERT INTO notification_settings (user_id, notification_type, in_app_enabled) VALUES (?, ?, 1)');

    for (const uid of userIds) {
      insertPref.run(uid);
      insertBalance.run(wsId, uid, 'casual', 12);
      insertBalance.run(wsId, uid, 'sick', 6);
      insertBalance.run(wsId, uid, 'other', 2);
      for (const t of notifTypes) {
        insertNotifSetting.run(uid, t);
      }
    }

    // 3. Teams
    const insertTeam = db.prepare(`
      INSERT INTO teams (workspace_id, name, description, created_by)
      VALUES (?, ?, ?, ?)
    `);
    const insertTeamMember = db.prepare(`
      INSERT INTO team_members (team_id, user_id, added_by)
      VALUES (?, ?, ?)
    `);

    const tEng = insertTeam.run(wsId, 'Engineering', 'Core platform & backend infrastructure', adminId).lastInsertRowid;
    const tProd = insertTeam.run(wsId, 'Product & Design', 'UX research, UI systems and product roadmap', adminId).lastInsertRowid;
    const tQA = insertTeam.run(wsId, 'Quality & Testing', 'Automated QA and integration testing', adminId).lastInsertRowid;

    // Team members
    [adminId, mgr1.lastInsertRowid, dev1.lastInsertRowid, dev2.lastInsertRowid, dev3.lastInsertRowid].forEach(u => insertTeamMember.run(tEng, u, adminId));
    [adminId, mgr2.lastInsertRowid, designer.lastInsertRowid, dev3.lastInsertRowid].forEach(u => insertTeamMember.run(tProd, u, adminId));
    [adminId, mgr1.lastInsertRowid, qa.lastInsertRowid].forEach(u => insertTeamMember.run(tQA, u, adminId));

    // 4. Labels
    const insertLabel = db.prepare('INSERT INTO labels (workspace_id, name, color) VALUES (?, ?, ?)');
    insertLabel.run(wsId, 'Bug', '#EF4444');
    insertLabel.run(wsId, 'Feature', '#3B82F6');
    insertLabel.run(wsId, 'Enhancement', '#10B981');
    insertLabel.run(wsId, 'Design', '#EC4899');
    insertLabel.run(wsId, 'DevOps', '#8B5CF6');

    // 5. Projects
    const insertProject = db.prepare(`
      INSERT INTO projects (workspace_id, team_id, owner_id, name, description, color, status, start_date, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertProjectMember = db.prepare('INSERT INTO project_members (project_id, user_id, added_by) VALUES (?, ?, ?)');

    const p1 = insertProject.run(wsId, tEng, mgr1.lastInsertRowid, 'TeamFlow Platform v1.0', 'Primary web application and API foundation', '#4F46E5', 'active', '2026-09-01', '2026-11-30').lastInsertRowid;
    const p2 = insertProject.run(wsId, tProd, mgr2.lastInsertRowid, 'Design System Evolution', 'Tailwind tokens, accessible UI components, and Figma sync', '#D97706', 'active', '2026-09-15', '2026-10-31').lastInsertRowid;
    const p3 = insertProject.run(wsId, tEng, dev1.lastInsertRowid, 'Database & Performance Audit', 'WAL optimization, indexing review, and query execution plans', '#0D9488', 'active', '2026-10-01', '2026-10-25').lastInsertRowid;
    const p4 = insertProject.run(wsId, tQA, qa.lastInsertRowid, 'Automated Test Suite', 'End-to-end integration tests and security regression coverage', '#059669', 'active', '2026-10-05', '2026-11-15').lastInsertRowid;
    const pArchived = insertProject.run(wsId, tEng, adminId, 'Legacy Architecture Migration', 'Deprecated monolith migration to lightweight modular structure', '#64748B', 'archived', '2026-01-01', '2026-06-30').lastInsertRowid;
    db.prepare("UPDATE projects SET archived_at = '2026-07-01T00:00:00.000Z' WHERE id = ?").run(pArchived);

    // Add members to projects
    [adminId, mgr1.lastInsertRowid, dev1.lastInsertRowid, dev2.lastInsertRowid, dev3.lastInsertRowid, designer.lastInsertRowid, qa.lastInsertRowid].forEach(u => insertProjectMember.run(p1, u, adminId));
    [adminId, mgr2.lastInsertRowid, designer.lastInsertRowid, dev3.lastInsertRowid].forEach(u => insertProjectMember.run(p2, u, mgr2.lastInsertRowid));
    [adminId, mgr1.lastInsertRowid, dev1.lastInsertRowid].forEach(u => insertProjectMember.run(p3, u, mgr1.lastInsertRowid));
    [adminId, qa.lastInsertRowid, dev1.lastInsertRowid, dev2.lastInsertRowid].forEach(u => insertProjectMember.run(p4, u, qa.lastInsertRowid));
    [adminId].forEach(u => insertProjectMember.run(pArchived, u, adminId));

    // 6. Project Templates
    const tpl = db.prepare(`
      INSERT INTO project_templates (workspace_id, name, description, created_by)
      VALUES (?, 'Standard Sprint Template', 'Ready-to-go sprint with research, dev, testing, and release checklists', ?)
    `).run(wsId, adminId).lastInsertRowid;

    const tplTask1 = db.prepare(`
      INSERT INTO project_template_tasks (template_id, title, description, priority, estimated_minutes, due_offset_days, sort_order)
      VALUES (?, 'Sprint Planning & Scope Lock', 'Finalize user stories and estimate story points', 'high', 120, 2, 1)
    `).run(tpl).lastInsertRowid;

    db.prepare(`
      INSERT INTO project_template_tasks (template_id, parent_template_task_id, title, sort_order)
      VALUES (?, ?, 'Draft technical RFC', 1)
    `).run(tpl, tplTask1);

    db.prepare(`
      INSERT INTO project_template_tasks (template_id, parent_template_task_id, title, sort_order)
      VALUES (?, ?, 'Team review and signoff', 2)
    `).run(tpl, tplTask1);

    console.log('[Seed] Core foundation seeded successfully.');
  });

  seedTx();
  console.log('[Seed] Database seed completed successfully.');
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  try {
    await seedDatabase();
    process.exit(0);
  } catch (err) {
    console.error('[Seed] Error:', err);
    process.exit(1);
  }
}
