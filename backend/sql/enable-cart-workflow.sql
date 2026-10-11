-- Run after enable-cart-add-item.sql and enable-cart-update-quantity.sql.
-- Install the remaining Customer cart RPCs in the same Supabase project as the API.
begin;

create or replace function public.cart_snapshot(p_customer_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_stage text;
  v_order_id uuid;
  v_coupon text;
  v_lines jsonb;
  v_count bigint;
  v_subtotal bigint;
begin
  select stage, current_order_id, coupon_code into v_stage, v_order_id, v_coupon
    from public.customer_state where customer_id = p_customer_id;
  select coalesce(jsonb_agg(jsonb_build_object(
      'productId', c.product_id, 'name', p.name, 'unitPrice', p.price,
      'weightGram', p.weight_gram, 'quantity', c.quantity,
      'available', p.status = 'onSale' and p.available_stock >= 1
    ) order by c.product_id), '[]'::jsonb), count(*), coalesce(sum(p.price::bigint * c.quantity), 0)
    into v_lines, v_count, v_subtotal
    from public.cart_lines c join public.products p on p.product_id = c.product_id
    where c.customer_id = p_customer_id;
  return jsonb_build_object('stage', coalesce(v_stage, 'cart'), 'currentOrderId', v_order_id,
    'couponCode', v_coupon, 'lineCount', v_count,
    'checkoutEnabled', v_count > 0 and coalesce(v_stage, 'cart') = 'cart',
    'subtotal', v_subtotal, 'lines', v_lines);
end;
$$;

create or replace function public.cart_order_snapshot(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_lines jsonb;
begin
  select * into v_order from public.orders where order_id = p_order_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'productId', product_id, 'name', name_snapshot, 'unitPrice', unit_price,
    'quantity', quantity, 'weightGram', weight_gram
  ) order by product_id), '[]'::jsonb) into v_lines
    from public.order_lines where order_id = p_order_id;
  return jsonb_build_object('orderId', v_order.order_id, 'createdAt', v_order.created_at,
    'status', v_order.status, 'subtotal', v_order.subtotal, 'discount', v_order.discount,
    'shippingFee', v_order.shipping_fee, 'netTotal', v_order.net_total,
    'zone', v_order.zone, 'speed', v_order.speed, 'couponCode', v_order.coupon_code,
    'discountSource', v_order.discount_source, 'totalWeightGram', v_order.total_weight_gram,
    'lines', v_lines);
end;
$$;

create or replace function public.cart_view()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_customer_id uuid := auth.uid();
  v_role text;
begin
  if v_customer_id is null then return jsonb_build_object('error', 'AUTH_FORBIDDEN'); end if;
  select role into v_role from public.app_users where id = v_customer_id;
  if v_role is distinct from 'Customer' then
    return jsonb_build_object('error', 'AUTH_FORBIDDEN');
  end if;
  return public.cart_snapshot(v_customer_id);
end;
$$;

create or replace function public.cart_remove_item(p_product_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_customer_id uuid := auth.uid();
  v_role text;
  v_stage text;
  v_count bigint;
begin
  if v_customer_id is null then return jsonb_build_object('error', 'AUTH_FORBIDDEN'); end if;
  select role into v_role from public.app_users where id = v_customer_id;
  if v_role is distinct from 'Customer' then return jsonb_build_object('error', 'AUTH_FORBIDDEN'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_customer_id::text, 0));
  select stage into v_stage from public.customer_state
    where customer_id = v_customer_id for update;
  if found and v_stage <> 'cart' then return jsonb_build_object('error', 'OPERATION_NOT_ALLOWED'); end if;
  if p_product_id is null or p_product_id = '' then return jsonb_build_object('error', 'VALIDATION_ERROR'); end if;
  select count(*) into v_count from public.cart_lines where customer_id = v_customer_id;
  if v_count = 0 then return jsonb_build_object('error', 'CART_EMPTY'); end if;
  delete from public.cart_lines where customer_id = v_customer_id and product_id = p_product_id;
  if not found then return jsonb_build_object('error', 'ITEM_NOT_IN_CART'); end if;
  return public.cart_snapshot(v_customer_id);
end;
$$;

create or replace function public.cart_apply_coupon(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_customer_id uuid := auth.uid();
  v_role text;
  v_stage text;
  v_status text;
begin
  if v_customer_id is null then return jsonb_build_object('error', 'AUTH_FORBIDDEN'); end if;
  select role into v_role from public.app_users where id = v_customer_id;
  if v_role is distinct from 'Customer' then return jsonb_build_object('error', 'AUTH_FORBIDDEN'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_customer_id::text, 0));
  select stage into v_stage from public.customer_state
    where customer_id = v_customer_id for update;
  if found and v_stage <> 'cart' then return jsonb_build_object('error', 'OPERATION_NOT_ALLOWED'); end if;
  if p_code is null or p_code = '' then return jsonb_build_object('error', 'VALIDATION_ERROR'); end if;
  select status into v_status from public.coupons where code = p_code for share;
  if v_status is distinct from 'active' then return jsonb_build_object('error', 'COUPON_INVALID'); end if;
  if v_stage is null then
    insert into public.customer_state(customer_id, stage, coupon_code, current_order_id)
      values (v_customer_id, 'cart', p_code, null);
  else
    update public.customer_state set coupon_code = p_code where customer_id = v_customer_id;
  end if;
  return public.cart_snapshot(v_customer_id);
end;
$$;

create or replace function public.cart_press_checkout(p_zone jsonb, p_speed jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_customer_id uuid := auth.uid();
  v_username text;
  v_role text;
  v_tier text;
  v_stage text;
  v_coupon_code text;
  v_zone text;
  v_speed text;
  v_coupon public.coupons%rowtype;
  v_line record;
  v_count bigint := 0;
  v_subtotal bigint := 0;
  v_weight bigint := 0;
  v_bad_ids jsonb := '[]'::jsonb;
  v_discount bigint := 0;
  v_discount_source text := 'none';
  v_coupon_removed boolean := false;
  v_used_coupon text;
  v_base bigint;
  v_shipping bigint;
  v_order_id uuid;
begin
  if v_customer_id is null then return jsonb_build_object('error', 'AUTH_FORBIDDEN'); end if;
  select username, role, member_tier into v_username, v_role, v_tier
    from public.app_users where id = v_customer_id;
  if v_role is distinct from 'Customer' then return jsonb_build_object('error', 'AUTH_FORBIDDEN'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_customer_id::text, 0));
  select stage, coupon_code into v_stage, v_coupon_code from public.customer_state
    where customer_id = v_customer_id for update;
  if found and v_stage <> 'cart' then return jsonb_build_object('error', 'OPERATION_NOT_ALLOWED'); end if;
  if p_zone is null or p_speed is null or jsonb_typeof(p_zone) <> 'string'
    or jsonb_typeof(p_speed) <> 'string' then
    return jsonb_build_object('error', 'VALIDATION_ERROR');
  end if;
  v_zone := p_zone #>> '{}';
  v_speed := p_speed #>> '{}';
  if v_zone not in ('inCity', 'upcountry', 'remote')
    or v_speed not in ('standard', 'express') then
    return jsonb_build_object('error', 'VALIDATION_ERROR');
  end if;
  for v_line in
    select c.product_id, c.quantity, p.name, p.price, p.weight_gram,
      p.available_stock, p.status from public.cart_lines c
      join public.products p on p.product_id = c.product_id
      where c.customer_id = v_customer_id order by c.product_id for update of c, p
  loop
    v_count := v_count + 1;
    v_subtotal := v_subtotal + v_line.price::bigint * v_line.quantity;
    v_weight := v_weight + v_line.weight_gram::bigint * v_line.quantity;
    if v_line.status <> 'onSale' or v_line.available_stock < v_line.quantity then
      v_bad_ids := v_bad_ids || to_jsonb(v_line.product_id);
    end if;
  end loop;
  if v_count = 0 then return jsonb_build_object('error', 'CART_EMPTY'); end if;
  if jsonb_array_length(v_bad_ids) > 0 then
    return jsonb_build_object('error', 'ITEMS_UNAVAILABLE', 'productIds', v_bad_ids);
  end if;
  if v_weight > 20000 then return jsonb_build_object('error', 'WEIGHT_LIMIT_EXCEEDED'); end if;

  if v_coupon_code is not null then
    select * into v_coupon from public.coupons where code = v_coupon_code for share;
    if found and v_coupon.status = 'active' and v_subtotal >= v_coupon.min_spend then
      v_discount := floor(v_subtotal * v_coupon.percent / 100.0)::bigint;
      v_discount_source := 'coupon';
      v_used_coupon := v_coupon_code;
    else
      v_coupon_removed := true;
    end if;
  end if;
  if v_discount_source <> 'coupon' and v_tier = 'prime' then
    v_discount := floor(v_subtotal * 0.05)::bigint;
    v_discount_source := 'member';
  end if;
  v_base := case
    when v_weight <= 1000 then case v_zone when 'inCity' then 30 when 'upcountry' then 50 else 80 end
    when v_weight <= 5000 then case v_zone when 'inCity' then 50 when 'upcountry' then 80 else 120 end
    else case v_zone when 'inCity' then 80 when 'upcountry' then 120 else 180 end
  end;
  v_shipping := case
    when v_tier = 'prime' and v_speed = 'standard' then 0
    when v_tier = 'prime' then floor(v_base / 2.0)::bigint
    when v_speed = 'express' then floor(v_base * 1.5)::bigint
    else v_base end;
  insert into public.orders(owner_id, status, subtotal, discount, shipping_fee, net_total,
    zone, speed, coupon_code, discount_source, total_weight_gram)
    values (v_customer_id, 'pending', v_subtotal, v_discount, v_shipping,
      v_subtotal - v_discount + v_shipping, v_zone, v_speed, v_used_coupon,
      v_discount_source, v_weight) returning order_id into v_order_id;
  insert into public.order_lines(order_id, product_id, name_snapshot, unit_price, quantity, weight_gram)
    select v_order_id, c.product_id, p.name, p.price, c.quantity, p.weight_gram
    from public.cart_lines c join public.products p on p.product_id = c.product_id
    where c.customer_id = v_customer_id;
  update public.products p set available_stock = p.available_stock - c.quantity
    from public.cart_lines c where c.customer_id = v_customer_id and p.product_id = c.product_id;
  update public.customer_state set stage = 'checkout', current_order_id = v_order_id,
    coupon_code = case when v_coupon_removed then null else coupon_code end
    where customer_id = v_customer_id;
  return jsonb_build_object('customer', jsonb_build_object('userId', v_customer_id,
      'username', v_username, 'role', v_role, 'memberTier', v_tier,
      'stage', 'checkout', 'currentOrderId', v_order_id),
    'order', public.cart_order_snapshot(v_order_id), 'couponRemoved', v_coupon_removed);
end;
$$;

create or replace function public.cart_cancel_checkout()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_customer_id uuid := auth.uid();
  v_role text;
  v_stage text;
  v_order_id uuid;
  v_status text;
  v_line record;
begin
  if v_customer_id is null then return jsonb_build_object('error', 'AUTH_FORBIDDEN'); end if;
  select role into v_role from public.app_users where id = v_customer_id;
  if v_role is distinct from 'Customer' then return jsonb_build_object('error', 'AUTH_FORBIDDEN'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_customer_id::text, 0));
  select stage, current_order_id into v_stage, v_order_id from public.customer_state
    where customer_id = v_customer_id for update;
  if v_stage is distinct from 'checkout' or v_order_id is null then
    return jsonb_build_object('error', 'OPERATION_NOT_ALLOWED');
  end if;
  select status into v_status from public.orders
    where order_id = v_order_id and owner_id = v_customer_id for update;
  if v_status is distinct from 'pending' then return jsonb_build_object('error', 'OPERATION_NOT_ALLOWED'); end if;
  for v_line in select product_id, quantity from public.order_lines
    where order_id = v_order_id order by product_id
  loop
    update public.products set available_stock = available_stock + v_line.quantity
      where product_id = v_line.product_id;
  end loop;
  update public.orders set status = 'cancelled' where order_id = v_order_id;
  update public.customer_state set stage = 'cart', current_order_id = null
    where customer_id = v_customer_id;
  return jsonb_build_object('cart', public.cart_snapshot(v_customer_id),
    'order', public.cart_order_snapshot(v_order_id));
end;
$$;

-- Internal helpers retain owner privileges but cannot be invoked through the API.
revoke all on function public.cart_snapshot(uuid), public.cart_order_snapshot(uuid)
  from public, anon, authenticated;
revoke all on function public.cart_view(), public.cart_remove_item(text),
  public.cart_apply_coupon(text), public.cart_press_checkout(jsonb,jsonb),
  public.cart_cancel_checkout() from public, anon;
grant execute on function public.cart_view(), public.cart_remove_item(text),
  public.cart_apply_coupon(text), public.cart_press_checkout(jsonb,jsonb),
  public.cart_cancel_checkout() to authenticated;
commit;

notify pgrst, 'reload schema';
