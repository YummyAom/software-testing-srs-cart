-- For the current Supabase Auth login flow. Run once in Supabase SQL Editor.
-- Not applied remotely by this implementation.
-- Requires app_users.id to equal the corresponding auth.users.id.
-- This changes the initial schema's deny-all read permissions for authenticated users.
-- No password_hash access and no INSERT/UPDATE/DELETE grants are added.
begin;

alter table public.app_users enable row level security;
grant usage on schema public to authenticated;
grant select (id, username, role, member_tier) on public.app_users to authenticated;

create policy app_users_select_own_profile
  on public.app_users
  for select
  to authenticated
  using ((select auth.uid()) = id);

commit;
