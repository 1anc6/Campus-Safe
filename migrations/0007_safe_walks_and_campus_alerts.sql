-- "Walk with me": a student starts a timed walk; if they don't check in as safe
-- before `due_at` (plus a short grace period) it escalates into an SOS.
create table if not exists safe_walks (
  id text primary key,
  user_id text not null,
  destination text not null,
  status text not null default 'active'
    check (status in ('active', 'completed', 'escalated', 'cancelled')),
  started_at timestamptz not null default now(),
  due_at timestamptz not null,
  ended_at timestamptz,
  -- Last known position while walking (start point, then periodic pings).
  lat double precision,
  lng double precision,
  accuracy_m integer,
  last_ping_at timestamptz,
  -- The SOS raised when the walk escalated.
  sos_id text references sos_alerts (id)
);
-- At most one active walk per student.
create unique index if not exists safe_walks_one_active_idx
  on safe_walks (user_id) where status = 'active';
-- The server-side watchdog scans active walks by due time.
create index if not exists safe_walks_due_idx on safe_walks (due_at) where status = 'active';

-- Campus-wide broadcasts from command (e.g. "Avoid Gate 2 — fire drill").
create table if not exists campus_alerts (
  id text primary key,
  title text not null,
  body text not null,
  level text not null default 'info' check (level in ('info', 'warning', 'critical')),
  created_by text not null,
  created_at timestamptz not null default now(),
  -- null = until an admin ends it
  expires_at timestamptz,
  ended_at timestamptz
);
create index if not exists campus_alerts_live_idx on campus_alerts (created_at) where ended_at is null;

-- Who has seen each alert (one row per student per alert).
create table if not exists alert_acks (
  alert_id text not null references campus_alerts (id) on delete cascade,
  user_id text not null,
  acked_at timestamptz not null default now(),
  primary key (alert_id, user_id)
);
