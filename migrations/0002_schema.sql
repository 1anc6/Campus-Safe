-- AEGIS campus safety schema (Postgres / Neon / PGLite)

create table if not exists profiles (
  user_id text primary key,
  name text not null,
  email text,
  phone text,
  role text not null default 'citizen' check (role in ('citizen', 'responder', 'admin')),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists campus_locations (
  id text primary key,
  name text not null,
  zone text not null,
  lat double precision not null,
  lng double precision not null
);

create table if not exists incident_categories (
  id text primary key,
  name text not null,
  icon text not null
);

create table if not exists responders (
  id text primary key,
  name text not null,
  unit text not null,
  phone text,
  user_id text,
  status text not null default 'available' check (status in ('available', 'on_duty', 'off_duty')),
  created_at timestamptz not null default now()
);

create table if not exists sos_alerts (
  id text primary key,
  user_id text not null,
  status text not null default 'sent'
    check (status in ('sent', 'received', 'assigned', 'arrived', 'resolved', 'cancelled')),
  lat double precision,
  lng double precision,
  accuracy_m integer,
  is_approximate boolean not null default false,
  assigned_to text,
  notes text,
  started_at timestamptz not null default now(),
  received_at timestamptz,
  assigned_at timestamptz,
  arrived_at timestamptz,
  resolved_at timestamptz
);
create index if not exists sos_alerts_user_id_idx on sos_alerts (user_id);
create index if not exists sos_alerts_status_idx on sos_alerts (status);
create index if not exists sos_alerts_started_idx on sos_alerts (started_at);

create table if not exists sos_locations (
  id text primary key,
  alert_id text not null references sos_alerts (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy_m integer,
  recorded_at timestamptz not null default now()
);
create index if not exists sos_locations_alert_idx on sos_locations (alert_id, recorded_at);

create table if not exists incidents (
  id text primary key,
  user_id text not null,
  category_id text not null,
  location_id text,
  lat double precision,
  lng double precision,
  description text not null,
  severity text not null check (severity in ('P1', 'P2', 'P3', 'P4')),
  status text not null default 'reported'
    check (status in ('reported', 'under_review', 'in_progress', 'resolved', 'closed')),
  occurred_at timestamptz not null,
  photo_data text,
  assigned_to text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists incidents_user_id_idx on incidents (user_id);
create index if not exists incidents_status_idx on incidents (status);
create index if not exists incidents_created_idx on incidents (created_at);

create table if not exists anonymous_reports (
  id text primary key,
  tracking_code text not null unique,
  category_id text not null,
  location_id text not null,
  role text not null check (role in ('victim', 'witness', 'heard')),
  time_range text not null,
  description text not null,
  severity text not null check (severity in ('P1', 'P2', 'P3', 'P4')),
  status text not null default 'reported'
    check (status in ('reported', 'under_review', 'in_progress', 'resolved', 'closed')),
  photo_stripped boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists anonymous_code_idx on anonymous_reports (tracking_code);

create table if not exists threads (
  id text primary key,
  kind text not null check (kind in ('sos', 'incident', 'anonymous')),
  subject_id text not null,
  author_role text not null check (author_role in ('reporter', 'admin', 'responder', 'system')),
  author_id text,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists threads_subject_idx on threads (kind, subject_id, created_at);

create table if not exists audit_log (
  id text primary key,
  actor_id text,
  action text not null,
  subject_kind text,
  subject_id text,
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists app_meta (
  key text primary key,
  value text not null
);

insert into campus_locations (id, name, zone, lat, lng) values
  ('gate', 'Main Gate', 'Entry', 13.0168, 77.567),
  ('library', 'Central Library', 'Academic', 13.0219, 77.5665),
  ('hostel-a', 'Hostel Block A', 'Residence', 13.0235, 77.571),
  ('science', 'Science Complex', 'Academic', 13.021, 77.5648),
  ('sports', 'Sports Ground', 'Recreation', 13.0185, 77.5705),
  ('cafe', 'Cafeteria', 'Commons', 13.0205, 77.5682),
  ('admin', 'Admin Building', 'Admin', 13.0215, 77.5678),
  ('parking', 'Parking Lot', 'Entry', 13.0172, 77.5655),
  ('medical', 'Medical Center', 'Health', 13.0228, 77.5688),
  ('lh3', 'Lecture Hall 3', 'Academic', 13.02, 77.5658)
on conflict (id) do nothing;

insert into incident_categories (id, name, icon) values
  ('harassment', 'Harassment', 'shield-alert'),
  ('theft', 'Theft', 'briefcase'),
  ('medical', 'Medical', 'heart-pulse'),
  ('fire', 'Fire', 'flame'),
  ('infra', 'Infrastructure', 'construction'),
  ('ragging', 'Ragging', 'user-x'),
  ('suspicious', 'Suspicious', 'eye'),
  ('accident', 'Accident', 'car-front'),
  ('other', 'Other', 'circle-dot')
on conflict (id) do nothing;

insert into responders (id, name, unit, phone, status) values
  ('sec-a', 'Kavya Nair', 'Campus Security A', '+91 80 4450 1101', 'available'),
  ('med-1', 'Dr. Arjun Mehta', 'Medical Unit 1', '+91 80 4450 1188', 'available'),
  ('night', 'Night Patrol', 'Night Patrol', '+91 80 4450 1199', 'on_duty'),
  ('fire', 'Fire Response', 'Fire & Rescue', '+91 80 4450 1122', 'available')
on conflict (id) do nothing;
