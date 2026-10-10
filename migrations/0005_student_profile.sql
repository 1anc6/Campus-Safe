-- Student profile & medical ID: details a student keeps up to date from the
-- profile panel. Emergency/medical fields are shown to command and the assigned
-- responder during an SOS, only while `share_medical` is on.

alter table profiles add column if not exists course text;
alter table profiles add column if not exists student_id text;
alter table profiles add column if not exists blood_group text;
alter table profiles add column if not exists emergency_name text;
alter table profiles add column if not exists emergency_phone text;
alter table profiles add column if not exists medical_notes text;
alter table profiles add column if not exists share_medical boolean not null default true;

alter table profiles drop constraint if exists profiles_blood_group_check;
alter table profiles
  add constraint profiles_blood_group_check
  check (blood_group is null or blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'));
