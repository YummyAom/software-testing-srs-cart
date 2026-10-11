-- Run in Supabase SQL Editor after creating public.coupons.
-- min_spend is the cart subtotal before discount, in THB.
insert into public.coupons (code, percent, min_spend, status)
values
  ('SAVE5_300',   5,  300, 'active'),
  ('SAVE7_500',   7,  500, 'active'),
  ('SAVE8_800',   8,  800, 'active'),
  ('SAVE10',     10, 1000, 'active'),
  ('SAVE12_1500',12, 1500, 'active'),
  ('SAVE15_2000',15, 2000, 'active'),
  ('SAVE20_5000',20, 5000, 'active')
on conflict (code) do nothing;

select code, percent, min_spend, status
from public.coupons
where code in ('SAVE5_300', 'SAVE7_500', 'SAVE8_800', 'SAVE10',
               'SAVE12_1500', 'SAVE15_2000', 'SAVE20_5000')
order by min_spend, code;
