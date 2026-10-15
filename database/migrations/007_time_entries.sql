-- 007_time_entries.sql
CREATE TABLE time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,   -- time history is never silently lost
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('timer','manual')),
  entry_date TEXT NOT NULL,                                          -- day in the user's timezone (timesheet grid)
  started_at TEXT,                                                   -- required for timers
  ended_at TEXT,                                                     -- NULL while a timer is running
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),   -- NULL while running
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (entry_type = 'manual' OR started_at IS NOT NULL),
  CHECK (entry_type = 'timer' OR duration_seconds > 0),
  CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);
CREATE UNIQUE INDEX ux_time_one_running_timer
  ON time_entries(user_id) WHERE entry_type = 'timer' AND ended_at IS NULL;
