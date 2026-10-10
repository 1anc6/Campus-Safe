-- Operating-System concepts enforced by the database (see docs/ARCHITECTURE.md §5).

-- 1. Race condition fix: at most ONE open SOS per student.
-- Two simultaneous "send SOS" requests used to be able to both pass the
-- "is one already open?" check and insert twice (check-then-act race). A
-- partial unique index makes the second insert fail atomically instead.
-- Close any duplicates that already exist (keep each student's newest) so the
-- index can be built.
update sos_alerts set status = 'cancelled', resolved_at = now()
where id in (
  select id from (
    select id, row_number() over (partition by user_id order by started_at desc) as rn
    from sos_alerts
    where status not in ('resolved', 'cancelled')
  ) t
  where rn > 1
);
create unique index if not exists sos_alerts_one_open_idx
  on sos_alerts (user_id) where status not in ('resolved', 'cancelled');

-- 2. Counting semaphore: live SOS alerts each responder unit is holding.
-- Assigning does an atomic "increment if below the limit" (P / wait);
-- resolving decrements it (V / signal). The CHECK means it can never go negative.
alter table responders
  add column if not exists active_sos integer not null default 0 check (active_sos >= 0);
update responders r set active_sos = (
  select count(*) from sos_alerts s
  where s.assigned_to = r.id and s.status not in ('resolved', 'cancelled')
);

-- Responder suggestion (least-loaded, then round-robin) looks up each unit's
-- most recent assignment.
create index if not exists sos_alerts_assigned_to_idx on sos_alerts (assigned_to, assigned_at);
