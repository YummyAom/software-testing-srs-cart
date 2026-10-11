-- Apply in Supabase SQL Editor for the current Supabase Auth flow.
-- app_users.id must equal auth.users.id; run enable-own-profile-read.sql first.
begin;

alter table public.products enable row level security;
grant select (product_id, name, price, weight_gram, available_stock, status)
  on public.products to authenticated;

create policy products_select_by_app_role
  on public.products for select to authenticated
  using (
    exists (
      select 1 from public.app_users
      where id = (select auth.uid())
        and (role = 'Admin' or (role = 'Customer'
          and public.products.status = 'onSale' and public.products.available_stock >= 1))
    )
  );

commit;
