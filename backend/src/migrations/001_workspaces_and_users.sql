-- 001_workspaces_and_users.sql
CREATE TABLE workspaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE workspace_settings (
  workspace_id INTEGER PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  working_days TEXT NOT NULL DEFAULT '1,2,3,4,5',          -- Mon=1 .. Sun=7
  default_capacity_hours_per_week REAL NOT NULL DEFAULT 40 CHECK (default_capacity_hours_per_week > 0),
  default_casual_leave_days REAL NOT NULL DEFAULT 12 CHECK (default_casual_leave_days >= 0),
  default_sick_leave_days REAL NOT NULL DEFAULT 6 CHECK (default_sick_leave_days >= 0),
  default_other_leave_days REAL NOT NULL DEFAULT 0 CHECK (default_other_leave_days >= 0),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,                -- globally unique (documented decision)
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','manager','member')),
  avatar_color TEXT NOT NULL DEFAULT '#4F46E5',
  capacity_hours_per_week REAL NOT NULL DEFAULT 40 CHECK (capacity_hours_per_week > 0 AND capacity_hours_per_week <= 168),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0,1)),
  token_version INTEGER NOT NULL DEFAULT 0,                 -- bump to invalidate JWTs
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE user_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light','dark')),
  timezone TEXT,                                             -- NULL = use workspace timezone
  onboarding_dismissed INTEGER NOT NULL DEFAULT 0 CHECK (onboarding_dismissed IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
