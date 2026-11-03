-- Reporter privacy tiers, photos out of the incident row, retention, student bell.

-- 1. Confidential reporting: `identified` reports show the reporter to command
-- and the assigned responder; `confidential` ones to command only (src/lib/access.ts).
alter table incidents add column if not exists visibility text not null default 'identified';
alter table incidents drop constraint if exists incidents_visibility_check;
alter table incidents
  add constraint incidents_visibility_check check (visibility in ('identified', 'confidential'));

-- 2. Photos: stored as binary in their own table instead of base64 text on the
-- incident (a third smaller, and never read by the queries that scan incidents).
-- Served only through the signed-in /api/photos/incident/$id route.
create table if not exists incident_photos (
  incident_id text primary key references incidents (id) on delete cascade,
  mime text not null check (mime in ('image/png', 'image/jpeg', 'image/webp')),
  data bytea not null,
  created_at timestamptz not null default now()
);

insert into incident_photos (incident_id, mime, data)
select id,
       case substring(photo_data from '^data:image/([a-z]+);')
         when 'png' then 'image/png'
         when 'webp' then 'image/webp'
         else 'image/jpeg'
       end,
       decode(substring(photo_data from ',(.*)$'), 'base64')
from incidents
where photo_data is not null
on conflict (incident_id) do nothing;

-- The old column stays (nullable, unused) so an older deploy can still start.
update incidents set photo_data = null where photo_data is not null;

-- 3. Retention: when a closed report was de-identified (see /api/cron/retention).
alter table incidents add column if not exists redacted_at timestamptz;
create index if not exists incidents_retention_idx
  on incidents (updated_at) where status in ('resolved', 'closed') and redacted_at is null;

-- 4. Student notification bell: updates on a student's own cases, newest first.
-- Reuses profiles.notifications_seen_at (0006) as the student's "seen up to" mark.
create index if not exists threads_kind_created_idx on threads (kind, created_at);
