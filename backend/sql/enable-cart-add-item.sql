-- Run after enable-own-profile-read.sql. This RPC keeps validation and the cart
-- write in one PostgreSQL transaction. It grants no direct table access.
begin;

-- The deferred workflow trigger fires at transaction commit, after this RPC's
-- SECURITY DEFINER context has ended. Its own function must run as its owner
-- to read the private domain tables. All relations in its body are qualified.
alter function public.check_customer_workflow() security definer;
alter function public.check_customer_workflow() set search_path = '';
revoke all on function public.check_customer_workflow() from public, anon, authenticated;

create or replace function public.cart_add_item(p_product_id text, p_quantity jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := auth.uid();
  v_role text;
  v_stage text;
  v_current_order_id uuid;
  v_coupon_code text;
  v_quantity integer;
  v_existing_quantity integer;
  v_product public.products%rowtype;
  v_lines jsonb;
  v_line_count bigint;
  v_subtotal numeric;
begin
  if v_customer_id is null then
    return jsonb_build_object('error', 'AUTH_FORBIDDEN');
  end if;
  select role into v_role from public.app_users where id = v_customer_id;
  if v_role is distinct from 'Customer' then
    return jsonb_build_object('error', 'AUTH_FORBIDDEN');
  end if;

  -- Serialize commands from the same customer, including the first cart insert.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_customer_id::text, 0));
  select stage, current_order_id, coupon_code
    into v_stage, v_current_order_id, v_coupon_code
    from public.customer_state where customer_id = v_customer_id for update;
  if found and v_stage <> 'cart' then
    return jsonb_build_object('error', 'OPERATION_NOT_ALLOWED');
  end if;

  if p_quantity is null or jsonb_typeof(p_quantity) <> 'number' then
    return jsonb_build_object('error', 'VALIDATION_ERROR');
  end if;
  if (p_quantity::text)::numeric <> trunc((p_quantity::text)::numeric) then
    return jsonb_build_object('error', 'VALIDATION_ERROR');
  end if;
  if (p_quantity::text)::numeric < 1 or (p_quantity::text)::numeric > 10 then
    return jsonb_build_object('error', 'QTY_OUT_OF_RANGE');
  end if;
  v_quantity := (p_quantity::text)::integer;

  if p_product_id is null or p_product_id = '' then
    return jsonb_build_object('error', 'VALIDATION_ERROR');
  end if;
  select * into v_product from public.products
    where product_id = p_product_id for share;
  if not found then
    return jsonb_build_object('error', 'PRODUCT_NOT_FOUND');
  end if;
  if v_product.status <> 'onSale' or v_product.available_stock < 1 then
    return jsonb_build_object('error', 'PRODUCT_UNAVAILABLE');
  end if;

  select quantity into v_existing_quantity from public.cart_lines
    where customer_id = v_customer_id and product_id = p_product_id;
  v_existing_quantity := coalesce(v_existing_quantity, 0);
  if v_existing_quantity + v_quantity > 10 then
    return jsonb_build_object('error', 'QTY_OUT_OF_RANGE');
  end if;
  if v_existing_quantity + v_quantity > v_product.available_stock then
    return jsonb_build_object('error', 'INSUFFICIENT_STOCK');
  end if;

  if v_stage is null then
    insert into public.customer_state(customer_id, stage, coupon_code, current_order_id)
      values (v_customer_id, 'cart', null, null);
    v_stage := 'cart';
  end if;
  insert into public.cart_lines(customer_id, product_id, quantity)
    values (v_customer_id, p_product_id, v_existing_quantity + v_quantity)
    on conflict (customer_id, product_id) do update set quantity = excluded.quantity;

  select coalesce(jsonb_agg(jsonb_build_object(
      'productId', c.product_id, 'name', p.name, 'unitPrice', p.price,
      'weightGram', p.weight_gram, 'quantity', c.quantity,
      'available', p.status = 'onSale' and p.available_stock >= 1
    ) order by c.product_id), '[]'::jsonb),
    count(*), coalesce(sum(p.price::numeric * c.quantity), 0)
    into v_lines, v_line_count, v_subtotal
    from public.cart_lines c join public.products p on p.product_id = c.product_id
    where c.customer_id = v_customer_id;

  return jsonb_build_object(
    'stage', v_stage, 'currentOrderId', v_current_order_id,
    'couponCode', v_coupon_code, 'lineCount', v_line_count,
    'checkoutEnabled', v_line_count > 0 and v_stage = 'cart',
    'subtotal', v_subtotal, 'lines', v_lines
  );
end;
$$;

revoke all on function public.cart_add_item(text, jsonb) from public, anon;
grant execute on function public.cart_add_item(text, jsonb) to authenticated;

commit;
