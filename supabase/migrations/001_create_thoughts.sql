-- Thoughts table
create table thoughts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  body text not null check (char_length(body) between 1 and 200),
  nickname text not null check (char_length(nickname) between 1 and 20),
  t float8 not null check (t >= 0 and t <= 1),
  ox float8 not null,
  oy float8 not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Index for fetching active thoughts
create index idx_thoughts_active on thoughts(created_at)
  where deleted_at is null;

-- Index for rate limit checks
create index idx_thoughts_user_recent on thoughts(user_id, created_at desc);

-- Enable RLS
alter table thoughts enable row level security;

-- Anyone can read non-deleted thoughts from the last 24h
create policy "thoughts_select" on thoughts
  for select using (
    deleted_at is null
    and created_at > now() - interval '24 hours'
  );

-- Authenticated users can insert their own thoughts
create policy "thoughts_insert" on thoughts
  for insert with check (
    auth.uid() = user_id
  );

-- Enable realtime
alter publication supabase_realtime add table thoughts;

-- Server-side rate limit function
create or replace function insert_thought(
  _body text,
  _nickname text,
  _t float8,
  _ox float8,
  _oy float8
) returns uuid
language plpgsql security definer
as $$
declare
  _user_id uuid := auth.uid();
  _today_start timestamptz;
  _count int;
  _id uuid;
begin
  -- Compute today's start at 00:00 in GMT-3 (Argentina)
  _today_start := date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires')
                   at time zone 'America/Argentina/Buenos_Aires';

  -- Check rate limit
  select count(*) into _count
  from thoughts
  where user_id = _user_id
    and created_at >= _today_start
    and deleted_at is null;

  if _count > 0 then
    raise exception 'already_posted_today'
      using hint = 'You can only post one thought per day';
  end if;

  -- Insert
  insert into thoughts (user_id, body, nickname, t, ox, oy)
  values (_user_id, _body, _nickname, _t, _ox, _oy)
  returning id into _id;

  return _id;
end;
$$;

-- Hourly cleanup of old thoughts (requires pg_cron extension)
-- Run this manually or via Supabase Dashboard > Database > Extensions > pg_cron:
-- select cron.schedule('cleanup-thoughts', '0 * * * *', $$
--   delete from thoughts where created_at < now() - interval '24 hours';
-- $$);
