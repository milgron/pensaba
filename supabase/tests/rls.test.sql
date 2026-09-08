-- Security invariants for the thoughts schema.
-- Run with supabase/tests/run.sh

-- Fixtures: four anonymous users and one admin.
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'),
  ('00000000-0000-0000-0000-00000000000d'),
  ('00000000-0000-0000-0000-0000000000ad');
insert into admin_users (user_id) values ('00000000-0000-0000-0000-0000000000ad');

-- ---------------------------------------------------------------------------
-- 1. The only write path is insert_thought(): the rate limit lives there.
-- ---------------------------------------------------------------------------
select test.expect_error('direct insert into thoughts is rejected',
  'authenticated', '00000000-0000-0000-0000-00000000000a',
  $$ insert into thoughts (user_id, body, nickname, t, ox, oy)
     values ('00000000-0000-0000-0000-00000000000a', 'hola', 'a', 0.5, 0, 0) $$);

select test.expect_error('direct insert cannot forge created_at (immortal thought)',
  'authenticated', '00000000-0000-0000-0000-00000000000a',
  $$ insert into thoughts (user_id, body, nickname, t, ox, oy, created_at)
     values ('00000000-0000-0000-0000-00000000000a', 'hola', 'a', 0.5, 0, 0, now() + interval '100 years') $$);

select test.expect_error('unauthenticated caller cannot use insert_thought',
  'anon', null,
  $$ select insert_thought('hola', 'a', 0.5, 0, 0) $$);

select test.expect_ok('authenticated user can post via insert_thought',
  'authenticated', '00000000-0000-0000-0000-00000000000a',
  $$ select insert_thought('primer pensamiento', 'a', 0.5, 1, -1) $$);

select test.expect_error('second post the same day is rejected',
  'authenticated', '00000000-0000-0000-0000-00000000000a',
  $$ select insert_thought('segundo', 'a', 0.6, 0, 0) $$);

-- ---------------------------------------------------------------------------
-- 2. Input bounds: nothing that breaks other clients' renderers gets stored.
-- ---------------------------------------------------------------------------
select test.expect_error('t outside [0,1] is rejected',
  'authenticated', '00000000-0000-0000-0000-00000000000b',
  $$ select insert_thought('x', 'b', 1.5, 0, 0) $$);

select test.expect_error('ox outside the tube radius is rejected',
  'authenticated', '00000000-0000-0000-0000-00000000000b',
  $$ select insert_thought('x', 'b', 0.5, 1e6, 0) $$);

select test.expect_error('NaN offset is rejected',
  'authenticated', '00000000-0000-0000-0000-00000000000b',
  $$ select insert_thought('x', 'b', 0.5, 0, 'NaN'::float8) $$);

select test.expect_error('Infinity offset is rejected',
  'authenticated', '00000000-0000-0000-0000-00000000000b',
  $$ select insert_thought('x', 'b', 0.5, 'Infinity'::float8, 0) $$);

select test.expect_error('blank body is rejected',
  'authenticated', '00000000-0000-0000-0000-00000000000b',
  $$ select insert_thought('    ', 'b', 0.5, 0, 0) $$);

select test.expect_error('body over 200 chars is rejected',
  'authenticated', '00000000-0000-0000-0000-00000000000b',
  $$ select insert_thought(repeat('a', 201), 'b', 0.5, 0, 0) $$);

select test.expect_error('nickname over 20 chars is rejected',
  'authenticated', '00000000-0000-0000-0000-00000000000b',
  $$ select insert_thought('x', repeat('n', 21), 0.5, 0, 0) $$);

select test.expect_ok('rejected attempts do not consume the daily quota',
  'authenticated', '00000000-0000-0000-0000-00000000000b',
  $$ select insert_thought('ahora sí', 'b', 0.5, 0, 0) $$);

-- ---------------------------------------------------------------------------
-- 3. Reads: public, but only live thoughts from the last 24h.
-- ---------------------------------------------------------------------------
select test.expect_scalar('anon can read live thoughts',
  'anon', null, $$ select count(*) from thoughts $$, 2);

-- Owner-level fixture: an old thought and a soft-deleted one.
insert into thoughts (user_id, body, nickname, t, ox, oy, created_at)
  values ('00000000-0000-0000-0000-00000000000c', 'viejo', 'c', 0.5, 0, 0, now() - interval '25 hours');
insert into thoughts (user_id, body, nickname, t, ox, oy, deleted_at)
  values ('00000000-0000-0000-0000-00000000000c', 'borrado', 'c', 0.5, 0, 0, now());

select test.expect_scalar('expired and deleted thoughts are invisible',
  'anon', null, $$ select count(*) from thoughts $$, 2);

-- ---------------------------------------------------------------------------
-- 4. Moderation: only admins can soft-delete; nobody can hard-delete via API.
-- ---------------------------------------------------------------------------
select test.expect_scalar('non-admin update affects no rows',
  'authenticated', '00000000-0000-0000-0000-00000000000b',
  $$ with u as (update thoughts set deleted_at = now() returning 1) select count(*) from u $$, 0);

select test.expect_scalar('hard delete affects no rows',
  'authenticated', '00000000-0000-0000-0000-00000000000b',
  $$ with d as (delete from thoughts returning 1) select count(*) from d $$, 0);

-- No RETURNING here: a soft-deleted row no longer passes the SELECT policy,
-- so RETURNING would be refused. supabase-js update() without select() matches this.
select test.expect_ok('admin can soft-delete a thought',
  'authenticated', '00000000-0000-0000-0000-0000000000ad',
  $$ update thoughts set deleted_at = now() where body = 'ahora sí' $$);

select test.expect_scalar('soft-deleted thought disappears for readers',
  'anon', null, $$ select count(*) from thoughts $$, 1);

-- ---------------------------------------------------------------------------
-- 5. Privilege escalation: admin_users must not be reachable through the API.
-- ---------------------------------------------------------------------------
select test.expect_error('user cannot make themselves admin',
  'authenticated', '00000000-0000-0000-0000-00000000000d',
  $$ insert into admin_users (user_id) values ('00000000-0000-0000-0000-00000000000d') $$);

select test.expect_scalar('user is still not admin after the attempt',
  'authenticated', '00000000-0000-0000-0000-00000000000d',
  $$ with u as (update thoughts set deleted_at = now() returning 1) select count(*) from u $$, 0);

select test.expect_scalar('admin list is not readable through the API',
  'anon', null, $$ select count(*) from admin_users $$, 0);
