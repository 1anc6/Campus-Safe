-- Phone push notifications (Web Push). One row per browser/device that turned
-- notifications on. The endpoint is the push service URL for that device and is
-- unique: if someone else signs in on the same phone and turns them on, the row
-- moves to them. Rows are deleted when the person turns notifications off or
-- signs out, when the push service answers 404/410 (expired), and with the user.
create table if not exists push_subscriptions (
  id text primary key,
  user_id text not null references "user" (id) on delete cascade,
  endpoint text not null unique,
  -- The browser's public encryption key and auth secret (base64url). Messages
  -- are encrypted to these, so the push service cannot read them.
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "All of this person's devices" and the role joins (admins, students) start here.
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);
