-- Shared role model: `student` replaces the original `citizen` role name.
-- Roles: student (campus member app), responder (field staff), admin (command console).

alter table profiles drop constraint if exists profiles_role_check;
update profiles set role = 'student' where role = 'citizen';
alter table profiles alter column role set default 'student';
alter table profiles
  add constraint profiles_role_check check (role in ('student', 'responder', 'admin'));
