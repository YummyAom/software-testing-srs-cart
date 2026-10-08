-- DESIGN: proposed Supabase PostgreSQL initial migration.
-- Supabase PostgreSQL only; backend-owned auth, no auth.users dependency.
-- Review before deploying; this design artifact was not applied remotely.
begin;
create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text collate "C" not null unique,
  password_hash text not null check (length(password_hash) > 0),
  role text not null check (role in ('Customer','Admin')),
  member_tier text,
  check ((role='Customer' and member_tier is not null and member_tier in ('normal','prime'))
      or (role='Admin' and member_tier is null))
);
create table public.products (
  product_id text primary key,
  name text not null,
  price integer not null check (price between 1 and 50000),
  weight_gram integer not null check (weight_gram > 0),
  available_stock bigint not null check (available_stock >= 0),
  status text not null check (status in ('onSale','offSale'))
);
create table public.coupons (
  code text collate "C" primary key,
  percent integer not null check (percent between 0 and 100),
  min_spend integer not null check (min_spend >= 0),
  status text not null check (status in ('active','inactive'))
);
create table public.orders (
  order_id uuid primary key default gen_random_uuid(),
  sequence bigint generated always as identity unique,
  owner_id uuid not null references public.app_users(id),
  created_at timestamptz not null default clock_timestamp(),
  status text not null check (status in ('pending','paid','cancelled')),
  subtotal bigint not null check (subtotal >= 0),
  discount bigint not null check (discount >= 0 and discount <= subtotal),
  shipping_fee bigint not null check (shipping_fee >= 0),
  net_total bigint not null check (net_total = subtotal - discount + shipping_fee),
  zone text not null check (zone in ('inCity','upcountry','remote')),
  speed text not null check (speed in ('standard','express')),
  coupon_code text,
  discount_source text not null check (discount_source in ('coupon','member','none')),
  total_weight_gram bigint not null check (total_weight_gram between 1 and 20000),
  check ((discount_source='coupon' and coupon_code is not null)
      or (discount_source<>'coupon' and coupon_code is null))
);
create index orders_owner_created_idx on public.orders(owner_id,created_at desc,sequence desc);
create unique index one_pending_order_per_customer on public.orders(owner_id) where status='pending';
create table public.customer_state (
  customer_id uuid primary key references public.app_users(id),
  stage text not null default 'cart' check (stage in ('cart','checkout','success')),
  coupon_code text collate "C" references public.coupons(code),
  current_order_id uuid unique references public.orders(order_id),
  check ((stage='cart' and current_order_id is null)
      or (stage in ('checkout','success') and current_order_id is not null))
);
create table public.cart_lines (
  customer_id uuid not null references public.customer_state(customer_id),
  product_id text not null references public.products(product_id),
  quantity integer not null check (quantity between 1 and 10),
  primary key (customer_id,product_id)
);
create table public.order_lines (
  order_id uuid not null references public.orders(order_id),
  product_id text not null references public.products(product_id),
  name_snapshot text not null,
  unit_price integer not null check (unit_price between 1 and 50000),
  quantity integer not null check (quantity between 1 and 10),
  weight_gram integer not null check (weight_gram > 0),
  primary key (order_id,product_id)
);

-- Trigger functions have no SECURITY DEFINER privilege elevation.
create function public.protect_order_snapshot() returns trigger language plpgsql as $$
begin
  if (to_jsonb(new)-'status') is distinct from (to_jsonb(old)-'status') then
    raise exception 'Order snapshot is immutable';
  end if;
  if new.status is distinct from old.status and
     not (old.status='pending' and new.status in ('paid','cancelled')) then
    raise exception 'Invalid order status transition';
  end if;
  return new;
end;
$$;
create trigger immutable_order_snapshot before update on public.orders
for each row execute function public.protect_order_snapshot();
create function public.protect_order_line() returns trigger language plpgsql as $$
begin
  raise exception 'Order line snapshot is immutable';
end;
$$;
create trigger immutable_order_lines before update or delete on public.order_lines
for each row execute function public.protect_order_line();

-- Deferred check sees the complete transaction, not transient checkout/cancel states.
-- Global scan intentionally acceptable for this small term project; not a scale claim.
create function public.check_customer_workflow() returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from public.customer_state s
    join public.app_users u on u.id=s.customer_id
    left join public.orders o on o.order_id=s.current_order_id
    where u.role<>'Customer'
       or (s.stage='checkout' and (o.owner_id is distinct from s.customer_id or o.status is distinct from 'pending'))
       or (s.stage='success' and (o.owner_id is distinct from s.customer_id or o.status is distinct from 'paid'))
  ) then raise exception 'Invalid customer workflow'; end if;
  if exists (
    select 1 from public.orders o
    join public.app_users u on u.id=o.owner_id
    left join public.customer_state s on s.customer_id=o.owner_id
    where u.role<>'Customer'
       or (o.status='pending' and (s.stage is distinct from 'checkout' or s.current_order_id is distinct from o.order_id))
       or not exists (select 1 from public.order_lines l where l.order_id=o.order_id)
  ) then raise exception 'Order owner, pending reference or lines invalid'; end if;
  return null;
end;
$$;
create constraint trigger customer_workflow_state after insert or update or delete on public.customer_state
  deferrable initially deferred for each row execute function public.check_customer_workflow();
create constraint trigger customer_workflow_orders after insert or update or delete on public.orders
  deferrable initially deferred for each row execute function public.check_customer_workflow();
create constraint trigger customer_workflow_lines after insert on public.order_lines
  deferrable initially deferred for each row execute function public.check_customer_workflow();

alter table public.app_users enable row level security;
alter table public.customer_state enable row level security;
alter table public.products enable row level security;
alter table public.coupons enable row level security;
alter table public.cart_lines enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
-- No anon/authenticated policies. Backend uses trusted server-only DB credentials.
revoke all on public.app_users,public.customer_state,public.products,public.coupons,
  public.cart_lines,public.orders,public.order_lines from anon,authenticated;
revoke all on sequence public.orders_sequence_seq from anon,authenticated;
revoke all on function public.protect_order_snapshot(),public.protect_order_line(),
  public.check_customer_workflow() from public,anon,authenticated;
commit;

-- Seed app_users with own UUIDs and library-generated Argon2id hashes.
-- Hash configured passwords before the seed transaction; never seed plaintext here.
-- No Supabase Auth provisioning, email mapping or token/session tables.
-- Seed products/coupons in a separate controlled seeder transaction:
-- P1: Coffee Beans 250g,450,300,20,onSale
-- P2: Drip Kettle,1200,900,3,onSale
-- P3: Espresso Machine,15000,8000,5,onSale
-- SAVE10:10,1000,active
