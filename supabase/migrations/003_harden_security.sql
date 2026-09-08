-- Security hardening. Invariants covered by supabase/tests/rls.test.sql.
--
-- 1. admin_users was created without RLS. Supabase grants anon/authenticated
--    full access to new tables in public, so any anonymous user could insert
--    their own id and become an admin. Enabling RLS with no policies closes the
--    table to the API entirely (service_role and the owner still bypass RLS,
--    which is how is_admin() keeps working).
alter table admin_users enable row level security;

-- 2. The thoughts_insert policy let clients insert directly, bypassing the
--    one-per-day rate limit in insert_thought() and letting them pick their
--    own created_at (an immortal thought) or id. insert_thought() is
--    security definer and runs as the table owner, so it needs no policy.
drop policy if exists thoughts_insert on thoughts;

-- 3. Bounds for the geometry columns. abs(x) <= r is false for NaN and
--    Infinity too, so these also reject values that would break Three.js
--    on every other client. 4 = TUBE_RADIUS in src/tunnel/tube.ts.
--    NOT VALID keeps the migration from failing on rows already stored;
--    new rows are always checked.
alter table thoughts add constraint thoughts_ox_range check (abs(ox) <= 4) not valid;
alter table thoughts add constraint thoughts_oy_range check (abs(oy) <= 4) not valid;
alter table thoughts add constraint thoughts_body_not_blank check (btrim(body) <> '') not valid;
alter table thoughts add constraint thoughts_nickname_not_blank check (btrim(nickname) <> '') not valid;

-- 4. Harden the two security-definer functions: pin search_path (a
--    security-definer function with a mutable search_path can be hijacked
--    by objects created in a schema earlier on the path), refuse
--    unauthenticated callers explicitly, and normalise input.
create or replace function insert_thought(
  _body text,
  _nickname text,
  _t float8,
  _ox float8,
  _oy float8
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  _user_id uuid := auth.uid();
  _today_start timestamptz;
  _count int;
  _id uuid;
begin
  if _user_id is null then
    raise exception 'not_authenticated';
  end if;

  _body := btrim(_body);
  _nickname := btrim(_nickname);

  -- Today's start at 00:00 in GMT-3 (Argentina)
  _today_start := date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires')
                   at time zone 'America/Argentina/Buenos_Aires';

  select count(*) into _count
  from thoughts
  where user_id = _user_id
    and created_at >= _today_start
    and deleted_at is null;

  if _count > 0 then
    raise exception 'already_posted_today'
      using hint = 'You can only post one thought per day';
  end if;

  insert into thoughts (user_id, body, nickname, t, ox, oy)
  values (_user_id, _body, _nickname, _t, _ox, _oy)
  returning id into _id;

  return _id;
end;
$$;

revoke execute on function insert_thought(text, text, float8, float8, float8) from public, anon;
grant execute on function insert_thought(text, text, float8, float8, float8) to authenticated, service_role;

create or replace function is_admin() returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from admin_users where user_id = auth.uid()
  );
$$;

-- 5. Postgres also checks the SELECT policy against the *new* row of an
--    UPDATE. A soft-deleted row (deleted_at set) fails "deleted_at is null",
--    so the admin's UPDATE was rejected and moderation silently didn't work.
--    Let admins see every row; everyone else keeps the 24h live window.
drop policy if exists thoughts_select on thoughts;
create policy "thoughts_select" on thoughts
  for select using (
    is_admin()
    or (deleted_at is null and created_at > now() - interval '24 hours')
  );
