-- Admin users table
create table admin_users (
  user_id uuid primary key references auth.users(id)
);

-- Helper function to check admin status
create or replace function is_admin() returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from admin_users where user_id = auth.uid()
  );
$$;

-- Only admins can soft-delete thoughts
create policy "thoughts_admin_update" on thoughts
  for update using (is_admin())
  with check (is_admin());
