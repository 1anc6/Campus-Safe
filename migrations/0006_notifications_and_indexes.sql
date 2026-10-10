-- Admin notification bell: each admin's "seen up to" mark, so opening the bell
-- clears the badge for that admin only (other admins still see it as new).
alter table profiles add column if not exists notifications_seen_at timestamptz;

-- Indexes for the queries every open console/field screen polls every few seconds.
-- Partial indexes stay small because they only cover open (unresolved) rows.
create index if not exists sos_alerts_open_assigned_idx
  on sos_alerts (assigned_to) where status not in ('resolved', 'cancelled');
create index if not exists incidents_open_idx
  on incidents (severity, created_at) where status not in ('resolved', 'closed');
create index if not exists anonymous_status_idx on anonymous_reports (status);
create index if not exists anonymous_open_idx
  on anonymous_reports (severity, created_at) where status not in ('resolved', 'closed');

-- The audit log is the evidence trail; look-ups are by case or by actor.
create index if not exists audit_subject_idx on audit_log (subject_kind, subject_id, created_at);
create index if not exists audit_actor_idx on audit_log (actor_id, created_at);
