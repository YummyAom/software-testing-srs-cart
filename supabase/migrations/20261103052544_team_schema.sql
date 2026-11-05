-- Schema-only snapshot of the team database public schema (supabase db dump --schema public).
-- Contains no data. Lets `supabase db reset` recreate the same tables locally.
-- app_users.id references auth.users(id); app_users also has auth_email (NOT NULL, unique).



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."cart_add_item"("p_product_id" "text", "p_quantity" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."cart_add_item"("p_product_id" "text", "p_quantity" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cart_apply_coupon"("p_code" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."cart_apply_coupon"("p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cart_cancel_checkout"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."cart_cancel_checkout"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cart_order_snapshot"("p_order_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."cart_order_snapshot"("p_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cart_press_checkout"("p_zone" "jsonb", "p_speed" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."cart_press_checkout"("p_zone" "jsonb", "p_speed" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cart_remove_item"("p_product_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."cart_remove_item"("p_product_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cart_snapshot"("p_customer_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."cart_snapshot"("p_customer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cart_update_quantity"("p_product_id" "text", "p_quantity" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

  select quantity into v_existing_quantity from public.cart_lines
    where customer_id = v_customer_id and product_id = p_product_id for update;
  if not found then
    return jsonb_build_object('error', 'ITEM_NOT_IN_CART');
  end if;

  select * into v_product from public.products
    where product_id = p_product_id for share;
  if not found or v_product.status <> 'onSale' or v_product.available_stock < 1 then
    return jsonb_build_object('error', 'PRODUCT_UNAVAILABLE');
  end if;
  if v_quantity > v_product.available_stock then
    return jsonb_build_object('error', 'INSUFFICIENT_STOCK');
  end if;

  update public.cart_lines set quantity = v_quantity
    where customer_id = v_customer_id and product_id = p_product_id;

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


ALTER FUNCTION "public"."cart_update_quantity"("p_product_id" "text", "p_quantity" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cart_view"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."cart_view"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_customer_workflow"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."check_customer_workflow"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_order_line"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  raise exception 'Order line snapshot is immutable';
end;
$$;


ALTER FUNCTION "public"."protect_order_line"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_order_snapshot"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."protect_order_snapshot"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."app_users" (
    "id" "uuid" NOT NULL,
    "username" "text" NOT NULL COLLATE "pg_catalog"."C",
    "auth_email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "member_tier" "text",
    CONSTRAINT "app_users_check" CHECK (((("role" = 'Customer'::"text") AND ("member_tier" IS NOT NULL) AND ("member_tier" = ANY (ARRAY['normal'::"text", 'prime'::"text"]))) OR (("role" = 'Admin'::"text") AND ("member_tier" IS NULL)))),
    CONSTRAINT "app_users_role_check" CHECK (("role" = ANY (ARRAY['Customer'::"text", 'Admin'::"text"])))
);


ALTER TABLE "public"."app_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cart_lines" (
    "customer_id" "uuid" NOT NULL,
    "product_id" "text" NOT NULL,
    "quantity" integer NOT NULL,
    CONSTRAINT "cart_lines_quantity_check" CHECK ((("quantity" >= 1) AND ("quantity" <= 10)))
);


ALTER TABLE "public"."cart_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coupons" (
    "code" "text" NOT NULL COLLATE "pg_catalog"."C",
    "percent" integer NOT NULL,
    "min_spend" integer NOT NULL,
    "status" "text" NOT NULL,
    CONSTRAINT "coupons_min_spend_check" CHECK (("min_spend" >= 0)),
    CONSTRAINT "coupons_percent_check" CHECK ((("percent" >= 0) AND ("percent" <= 100))),
    CONSTRAINT "coupons_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."coupons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_state" (
    "customer_id" "uuid" NOT NULL,
    "stage" "text" DEFAULT 'cart'::"text" NOT NULL,
    "coupon_code" "text" COLLATE "pg_catalog"."C",
    "current_order_id" "uuid",
    CONSTRAINT "customer_state_check" CHECK (((("stage" = 'cart'::"text") AND ("current_order_id" IS NULL)) OR (("stage" = ANY (ARRAY['checkout'::"text", 'success'::"text"])) AND ("current_order_id" IS NOT NULL)))),
    CONSTRAINT "customer_state_stage_check" CHECK (("stage" = ANY (ARRAY['cart'::"text", 'checkout'::"text", 'success'::"text"])))
);


ALTER TABLE "public"."customer_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_lines" (
    "order_id" "uuid" NOT NULL,
    "product_id" "text" NOT NULL,
    "name_snapshot" "text" NOT NULL,
    "unit_price" integer NOT NULL,
    "quantity" integer NOT NULL,
    "weight_gram" integer NOT NULL,
    CONSTRAINT "order_lines_quantity_check" CHECK ((("quantity" >= 1) AND ("quantity" <= 10))),
    CONSTRAINT "order_lines_unit_price_check" CHECK ((("unit_price" >= 1) AND ("unit_price" <= 50000))),
    CONSTRAINT "order_lines_weight_gram_check" CHECK (("weight_gram" > 0))
);


ALTER TABLE "public"."order_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "order_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sequence" bigint NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "status" "text" NOT NULL,
    "subtotal" bigint NOT NULL,
    "discount" bigint NOT NULL,
    "shipping_fee" bigint NOT NULL,
    "net_total" bigint NOT NULL,
    "zone" "text" NOT NULL,
    "speed" "text" NOT NULL,
    "coupon_code" "text",
    "discount_source" "text" NOT NULL,
    "total_weight_gram" bigint NOT NULL,
    CONSTRAINT "orders_check" CHECK ((("discount" >= 0) AND ("discount" <= "subtotal"))),
    CONSTRAINT "orders_check1" CHECK (("net_total" = (("subtotal" - "discount") + "shipping_fee"))),
    CONSTRAINT "orders_check2" CHECK (((("discount_source" = 'coupon'::"text") AND ("coupon_code" IS NOT NULL)) OR (("discount_source" <> 'coupon'::"text") AND ("coupon_code" IS NULL)))),
    CONSTRAINT "orders_discount_source_check" CHECK (("discount_source" = ANY (ARRAY['coupon'::"text", 'member'::"text", 'none'::"text"]))),
    CONSTRAINT "orders_shipping_fee_check" CHECK (("shipping_fee" >= 0)),
    CONSTRAINT "orders_speed_check" CHECK (("speed" = ANY (ARRAY['standard'::"text", 'express'::"text"]))),
    CONSTRAINT "orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "orders_subtotal_check" CHECK (("subtotal" >= 0)),
    CONSTRAINT "orders_total_weight_gram_check" CHECK ((("total_weight_gram" >= 1) AND ("total_weight_gram" <= 20000))),
    CONSTRAINT "orders_zone_check" CHECK (("zone" = ANY (ARRAY['inCity'::"text", 'upcountry'::"text", 'remote'::"text"])))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


ALTER TABLE "public"."orders" ALTER COLUMN "sequence" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."orders_sequence_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."products" (
    "product_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "price" integer NOT NULL,
    "weight_gram" integer NOT NULL,
    "available_stock" bigint NOT NULL,
    "status" "text" NOT NULL,
    CONSTRAINT "products_available_stock_check" CHECK (("available_stock" >= 0)),
    CONSTRAINT "products_price_check" CHECK ((("price" >= 1) AND ("price" <= 50000))),
    CONSTRAINT "products_status_check" CHECK (("status" = ANY (ARRAY['onSale'::"text", 'offSale'::"text"]))),
    CONSTRAINT "products_weight_gram_check" CHECK (("weight_gram" > 0))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_auth_email_key" UNIQUE ("auth_email");



ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."cart_lines"
    ADD CONSTRAINT "cart_lines_pkey" PRIMARY KEY ("customer_id", "product_id");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."customer_state"
    ADD CONSTRAINT "customer_state_current_order_id_key" UNIQUE ("current_order_id");



ALTER TABLE ONLY "public"."customer_state"
    ADD CONSTRAINT "customer_state_pkey" PRIMARY KEY ("customer_id");



ALTER TABLE ONLY "public"."order_lines"
    ADD CONSTRAINT "order_lines_pkey" PRIMARY KEY ("order_id", "product_id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("order_id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_sequence_key" UNIQUE ("sequence");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("product_id");



CREATE UNIQUE INDEX "one_pending_order_per_customer" ON "public"."orders" USING "btree" ("owner_id") WHERE ("status" = 'pending'::"text");



CREATE INDEX "orders_owner_created_idx" ON "public"."orders" USING "btree" ("owner_id", "created_at" DESC, "sequence" DESC);



CREATE CONSTRAINT TRIGGER "customer_workflow_lines" AFTER INSERT ON "public"."order_lines" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."check_customer_workflow"();



CREATE CONSTRAINT TRIGGER "customer_workflow_orders" AFTER INSERT OR DELETE OR UPDATE ON "public"."orders" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."check_customer_workflow"();



CREATE CONSTRAINT TRIGGER "customer_workflow_state" AFTER INSERT OR DELETE OR UPDATE ON "public"."customer_state" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."check_customer_workflow"();



CREATE OR REPLACE TRIGGER "immutable_order_lines" BEFORE DELETE OR UPDATE ON "public"."order_lines" FOR EACH ROW EXECUTE FUNCTION "public"."protect_order_line"();



CREATE OR REPLACE TRIGGER "immutable_order_snapshot" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."protect_order_snapshot"();



ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."cart_lines"
    ADD CONSTRAINT "cart_lines_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_state"("customer_id");



ALTER TABLE ONLY "public"."cart_lines"
    ADD CONSTRAINT "cart_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("product_id");



ALTER TABLE ONLY "public"."customer_state"
    ADD CONSTRAINT "customer_state_coupon_code_fkey" FOREIGN KEY ("coupon_code") REFERENCES "public"."coupons"("code");



ALTER TABLE ONLY "public"."customer_state"
    ADD CONSTRAINT "customer_state_current_order_id_fkey" FOREIGN KEY ("current_order_id") REFERENCES "public"."orders"("order_id");



ALTER TABLE ONLY "public"."customer_state"
    ADD CONSTRAINT "customer_state_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."app_users"("id");



ALTER TABLE ONLY "public"."order_lines"
    ADD CONSTRAINT "order_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("order_id");



ALTER TABLE ONLY "public"."order_lines"
    ADD CONSTRAINT "order_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("product_id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."app_users"("id");



ALTER TABLE "public"."app_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_users_select_own_profile" ON "public"."app_users" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



ALTER TABLE "public"."cart_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coupons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_select_by_app_role" ON "public"."products" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."app_users"
  WHERE (("app_users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND (("app_users"."role" = 'Admin'::"text") OR (("app_users"."role" = 'Customer'::"text") AND ("products"."status" = 'onSale'::"text") AND ("products"."available_stock" >= 1)))))));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."cart_add_item"("p_product_id" "text", "p_quantity" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cart_add_item"("p_product_id" "text", "p_quantity" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cart_add_item"("p_product_id" "text", "p_quantity" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cart_apply_coupon"("p_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cart_apply_coupon"("p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cart_apply_coupon"("p_code" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cart_cancel_checkout"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cart_cancel_checkout"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cart_cancel_checkout"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cart_order_snapshot"("p_order_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cart_order_snapshot"("p_order_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cart_press_checkout"("p_zone" "jsonb", "p_speed" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cart_press_checkout"("p_zone" "jsonb", "p_speed" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cart_press_checkout"("p_zone" "jsonb", "p_speed" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cart_remove_item"("p_product_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cart_remove_item"("p_product_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cart_remove_item"("p_product_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cart_snapshot"("p_customer_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cart_snapshot"("p_customer_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cart_update_quantity"("p_product_id" "text", "p_quantity" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cart_update_quantity"("p_product_id" "text", "p_quantity" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cart_update_quantity"("p_product_id" "text", "p_quantity" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cart_view"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cart_view"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cart_view"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_customer_workflow"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_customer_workflow"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."protect_order_line"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."protect_order_line"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."protect_order_snapshot"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."protect_order_snapshot"() TO "service_role";



GRANT ALL ON TABLE "public"."app_users" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."app_users" TO "authenticated";



GRANT SELECT("username") ON TABLE "public"."app_users" TO "authenticated";



GRANT SELECT("role") ON TABLE "public"."app_users" TO "authenticated";



GRANT SELECT("member_tier") ON TABLE "public"."app_users" TO "authenticated";



GRANT ALL ON TABLE "public"."cart_lines" TO "service_role";



GRANT ALL ON TABLE "public"."coupons" TO "service_role";



GRANT ALL ON TABLE "public"."customer_state" TO "service_role";



GRANT ALL ON TABLE "public"."order_lines" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON SEQUENCE "public"."orders_sequence_seq" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT SELECT("product_id") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("name") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("price") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("weight_gram") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("available_stock") ON TABLE "public"."products" TO "authenticated";



GRANT SELECT("status") ON TABLE "public"."products" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







