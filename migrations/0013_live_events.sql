-- Real-time updates: a change log that triggers append to, and that the
-- `/api/live` Server-Sent Events stream tails (src/backend/core/live.ts).
--
-- Why a table and not LISTEN/NOTIFY: production talks to Neon through its
-- pooled (PgBouncer, transaction mode) endpoint, where LISTEN does not work,
-- and Vercel functions are short-lived. A small append-only log works on every
-- connection type, and its ids let a reconnecting stream resume exactly where
-- it stopped (SSE `Last-Event-ID`).
--
-- Each row says only "this case changed" plus who may hear about it: the
-- student it belongs to (owner_id) and the responder unit working it
-- (responder_id). Screens re-fetch through the normal server functions, which
-- apply the full access rules again. Rows are pruned after an hour.
create table if not exists live_events (
  id bigserial primary key,
  kind text not null
    check (kind in ('sos', 'incident', 'anonymous', 'alert', 'alert_ack', 'responder')),
  subject_id text not null,
  owner_id text,
  responder_id text,
  created_at timestamptz not null default now()
);
create index if not exists live_events_created_idx on live_events (created_at);

-- SOS alerts: new alert, status change, assignment, closing. When the alert is
-- moved to another unit, the previous unit hears about it too (it leaves their list).
create or replace function live_sos_changed() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old is not distinct from new then
    return null;
  end if;
  insert into live_events (kind, subject_id, owner_id, responder_id)
  values ('sos', new.id, new.user_id, new.assigned_to);
  if tg_op = 'UPDATE' and old.assigned_to is not null
     and old.assigned_to is distinct from new.assigned_to then
    insert into live_events (kind, subject_id, owner_id, responder_id)
    values ('sos', new.id, new.user_id, old.assigned_to);
  end if;
  return null;
end;
$$;

drop trigger if exists sos_alerts_live on sos_alerts;
create trigger sos_alerts_live
  after insert or update on sos_alerts
  for each row execute function live_sos_changed();

-- Live GPS points of an SOS.
create or replace function live_sos_location_added() returns trigger
language plpgsql as $$
begin
  insert into live_events (kind, subject_id, owner_id, responder_id)
  select 'sos', s.id, s.user_id, s.assigned_to from sos_alerts s where s.id = new.alert_id;
  return null;
end;
$$;

drop trigger if exists sos_locations_live on sos_locations;
create trigger sos_locations_live
  after insert on sos_locations
  for each row execute function live_sos_location_added();

-- Incidents filed by signed-in students.
create or replace function live_incident_changed() returns trigger
language plpgsql as $$
begin
  insert into live_events (kind, subject_id, owner_id, responder_id)
  values ('incident', new.id, new.user_id, new.assigned_to);
  if tg_op = 'UPDATE' and old.assigned_to is not null
     and old.assigned_to is distinct from new.assigned_to then
    insert into live_events (kind, subject_id, owner_id, responder_id)
    values ('incident', new.id, new.user_id, old.assigned_to);
  end if;
  return null;
end;
$$;

drop trigger if exists incidents_live on incidents;
create trigger incidents_live
  after insert or update on incidents
  for each row execute function live_incident_changed();

-- Anonymous reports: no owner, command only.
create or replace function live_anonymous_changed() returns trigger
language plpgsql as $$
begin
  insert into live_events (kind, subject_id) values ('anonymous', new.id);
  return null;
end;
$$;

drop trigger if exists anonymous_reports_live on anonymous_reports;
create trigger anonymous_reports_live
  after insert or update on anonymous_reports
  for each row execute function live_anonymous_changed();

-- A message on a case thread is a change to that case, heard by the same people.
create or replace function live_thread_added() returns trigger
language plpgsql as $$
begin
  if new.kind = 'sos' then
    insert into live_events (kind, subject_id, owner_id, responder_id)
    select 'sos', s.id, s.user_id, s.assigned_to from sos_alerts s where s.id = new.subject_id;
  elsif new.kind = 'incident' then
    insert into live_events (kind, subject_id, owner_id, responder_id)
    select 'incident', i.id, i.user_id, i.assigned_to from incidents i where i.id = new.subject_id;
  else
    insert into live_events (kind, subject_id) values ('anonymous', new.subject_id);
  end if;
  return null;
end;
$$;

drop trigger if exists threads_live on threads;
create trigger threads_live
  after insert on threads
  for each row execute function live_thread_added();

-- Campus broadcasts reach everyone; acknowledgements only matter to command.
create or replace function live_campus_alert_changed() returns trigger
language plpgsql as $$
begin
  insert into live_events (kind, subject_id) values ('alert', new.id);
  return null;
end;
$$;

drop trigger if exists campus_alerts_live on campus_alerts;
create trigger campus_alerts_live
  after insert or update on campus_alerts
  for each row execute function live_campus_alert_changed();

create or replace function live_alert_acked() returns trigger
language plpgsql as $$
begin
  insert into live_events (kind, subject_id) values ('alert_ack', new.alert_id);
  return null;
end;
$$;

drop trigger if exists alert_acks_live on alert_acks;
create trigger alert_acks_live
  after insert on alert_acks
  for each row execute function live_alert_acked();

-- Responder units: status and live-SOS load (the dispatch picker shows both).
create or replace function live_responder_changed() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    insert into live_events (kind, subject_id, responder_id) values ('responder', old.id, old.id);
  elsif tg_op = 'INSERT' or old is distinct from new then
    insert into live_events (kind, subject_id, responder_id) values ('responder', new.id, new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists responders_live on responders;
create trigger responders_live
  after insert or update or delete on responders
  for each row execute function live_responder_changed();
