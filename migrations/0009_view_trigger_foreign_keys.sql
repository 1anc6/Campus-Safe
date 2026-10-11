-- DBMS features: referential integrity, a trigger and a view.

-- 1. Foreign keys (referential integrity).
-- Added NOT VALID first: from now on every insert/update is checked, but
-- existing rows are not scanned yet, so an old bad row can never block a
-- deploy. The block at the end then validates each constraint against the
-- existing data, and simply leaves it NOT VALID if an old row doesn't match.
alter table incidents drop constraint if exists incidents_category_fk;
alter table incidents add constraint incidents_category_fk
  foreign key (category_id) references incident_categories (id) not valid;

alter table incidents drop constraint if exists incidents_location_fk;
alter table incidents add constraint incidents_location_fk
  foreign key (location_id) references campus_locations (id) not valid;

alter table incidents drop constraint if exists incidents_assigned_fk;
alter table incidents add constraint incidents_assigned_fk
  foreign key (assigned_to) references responders (id) on delete set null not valid;

alter table anonymous_reports drop constraint if exists anonymous_category_fk;
alter table anonymous_reports add constraint anonymous_category_fk
  foreign key (category_id) references incident_categories (id) not valid;

alter table anonymous_reports drop constraint if exists anonymous_location_fk;
alter table anonymous_reports add constraint anonymous_location_fk
  foreign key (location_id) references campus_locations (id) not valid;

alter table sos_alerts drop constraint if exists sos_alerts_assigned_fk;
alter table sos_alerts add constraint sos_alerts_assigned_fk
  foreign key (assigned_to) references responders (id) on delete set null not valid;

do $$
declare
  c record;
begin
  for c in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where conname in ('incidents_category_fk', 'incidents_location_fk', 'incidents_assigned_fk',
                      'anonymous_category_fk', 'anonymous_location_fk', 'sos_alerts_assigned_fk')
      and not convalidated
  loop
    begin
      execute format('alter table %s validate constraint %I', c.tbl, c.conname);
    exception when foreign_key_violation then
      raise notice 'kept % NOT VALID: existing rows reference missing data', c.conname;
    end;
  end loop;
end $$;

-- 2. Trigger: keep `updated_at` correct on every change to a report, so no
-- application code has to remember to set it.
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists incidents_set_updated_at on incidents;
create trigger incidents_set_updated_at
  before update on incidents
  for each row execute function set_updated_at();

drop trigger if exists anonymous_reports_set_updated_at on anonymous_reports;
create trigger anonymous_reports_set_updated_at
  before update on anonymous_reports
  for each row execute function set_updated_at();

-- 3. View (virtual table): every open case from both report tables, in one
-- shape. The admin console counts open critical cases from it.
create or replace view open_cases as
  select 'incident'::text as kind, id, category_id, location_id, severity, status,
         created_at, updated_at
  from incidents
  where status not in ('resolved', 'closed')
  union all
  select 'anonymous'::text, id, category_id, location_id, severity, status,
         created_at, updated_at
  from anonymous_reports
  where status not in ('resolved', 'closed');
