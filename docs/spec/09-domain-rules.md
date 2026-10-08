# Pure domain rules — implementation contract

Authority: SRS section 6.1 (DC-1). รายชื่อทั้ง10และ TypeScript signatures ต้องคัดลอก **verbatim จาก SRS** ตอน implement. เอกสารนี้สรุป behavior ไม่เปลี่ยน signature. ไม่มี implementation code ที่นี่

| Function | Input/preconditions | Observable result / ordering | Trace |
|---|---|---|---|
| isProductAvailable | isOnSale boolean, availableStock number | true iff isOnSale && availableStock>=1 | FR-1.3/2.2/2.5/2.9/5.2 |
| validateQuantityChange | operation add/update, quantity unknown, existence/inCart/available/currentQty/stock facts | integer -> input1..10 -> productExists/add or inCart/update -> available -> combined<=10/add -> resulting<=stock; return first code or OK | FR-2.6 |
| calculateSubtotal | lines price/quantity integers from current products | sum(price*quantity), empty =>0 | FR-4.1 |
| calculateTotalWeight | lines weightGram/quantity from current products | sum(weightGram*quantity), empty =>0 | Definitions / FR-4.5/5.2 |
| calculateDiscount | subtotal, normal/prime, coupon metadata or null | valid active eligible coupon: floor(subtotal*percent/100), source coupon, couponRemoved false; invalid attached coupon: couponRemoved true + member fallback; no coupon: false + fallback. Prime fallback floor5% source member; normal0 source none | FR-4.2–4.4 |
| classifyWeight | totalWeightGram positive integer | 1..1000 light;1001..5000 medium;5001..20000 heavy;>20000 overLimit; 0/negative unspecified (SOI-06) | FR-4.5 |
| calculateShippingFee | valid non-overLimit tier, defined zone/speed/memberTier | base table and factor, floor result; no discount/coupon dependency | FR-4.6/4.7 |
| calculateNetTotal | subtotal,discount,shippingFee integers | subtotal-discount+shippingFee | FR-4.8 |
| validateCheckout | unknown zone/speed, lines availability/stock/quantity, calculated weight | validate zone/speed -> nonempty -> all bad productIds -> weight<=20000 ->OK; do not evaluate coupon | FR-5.2.1 |
| validateProductUpdate | price?/stock? unknown | return all invalid specified fields; price integer1..50000,stock integer0..9999. Missing product handled BEFORE calling. Empty input fields choice SOI-05 | FR-9.1.1 |

## Price rules without ambiguity

- Coupon threshold uses **subtotal before any discount**, inclusive >=minSpend; discount eligibility doesn't depend on shipping.
- Coupons are unlimited reuse; never consume or decrement coupon usage.
- Prime shipping entitlement applies even if coupon used; only price discounts do not stack.
- Evaluate invalid attached coupon only after successful checkout prevalidation, not on apply/viewCart/cart mutation.
- floor when fractional; prime subtotal1650 has discount82, not83. No floating currency storage; integers in THB.
- Existing order snapshot totals never recalculated by these functions for display or callback.
- `quantity=1.0` is an integer number; `"1"` is not. `Number.isInteger` semantics, no coercion.
- For add currentQty+input is compared against10 before stock; for update input alone replaces existing quantity.
- Availability depends on stock>=1, not requested quantity; request greater than positive stock gets INSUFFICIENT_STOCK after availability.

## Base shipping table

| tier | inCity | upcountry | remote |
|---|---:|---:|---:|
| light |30|50|80|
| medium |50|80|120|
| heavy |80|120|180|

normal standard=base, normal express=floor(base*3/2), prime standard=0, prime express=floor(base/2). No weight0 shipping quote required. Checkout net examples AC4=1485, AC5=1568, AC6=880, AC7=1230, AC8=15270

## Testing obligations

Unit tests call exported functions without DB/time/network. Do not test non-domain numeric inputs to pricing functions as if specified; only quantity/zone/speed/Admin validation explicitly accept unknown. Domain data facts must be assembled by route orchestration first. Route integration must prove correct observable outcomes, not mock-count verify each function call. Static review can verify DC-1 route use/signature compliance
