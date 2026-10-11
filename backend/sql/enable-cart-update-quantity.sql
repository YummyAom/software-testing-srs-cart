-- Run after enable-cart-add-item.sql and the project schema.
-- Customer-only RPC; no direct authenticated table grants are added.
begin;

create or replace function public.cart_update_quantity(p_product_id text, p_quantity jsonb)
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

revoke all on function public.cart_update_quantity(text, jsonb) from public, anon;
grant execute on function public.cart_update_quantity(text, jsonb) to authenticated;

commit;

notify pgrst, 'reload schema';
