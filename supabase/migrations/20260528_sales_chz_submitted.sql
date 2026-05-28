alter table public.sales_orders
  add column if not exists chz_submitted boolean not null default false;
