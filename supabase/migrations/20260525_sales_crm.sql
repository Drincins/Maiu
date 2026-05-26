-- CRM sales orders, statuses, and operation backfill.

do $$ begin
  if not exists (select 1 from pg_type where typname = 'sales_order_source') then
    create type sales_order_source as enum ('manual','operation','tilda');
  end if;
  if not exists (select 1 from pg_type where typname = 'sales_order_status') then
    create type sales_order_status as enum (
      'imported',
      'needs_confirmation',
      'confirmed',
      'packed',
      'shipped',
      'delivered',
      'return_requested',
      'returned_to_stock',
      'refund_pending',
      'refunded',
      'cancelled',
      'problem'
    );
  end if;
end $$;

create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source sales_order_source not null default 'manual',
  source_external_id text,
  source_payload jsonb not null default '{}'::jsonb,
  operation_id uuid references public.operations(id) on delete set null,
  status sales_order_status not null default 'needs_confirmation',
  status_changed_at timestamptz not null default now(),
  ordered_at timestamptz not null default now(),
  customer_name text,
  customer_phone text,
  customer_email text,
  city text,
  delivery_service text,
  tracking_number text,
  delivery_cost integer not null default 0 check (delivery_cost >= 0),
  total_amount integer not null default 0 check (total_amount >= 0),
  paid_amount integer not null default 0 check (paid_amount >= 0),
  confirmed_at timestamptz,
  packed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  returned_at timestamptz,
  refunded_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  operation_line_id uuid references public.operation_lines(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name_snapshot text,
  sku_snapshot text,
  qty integer not null check (qty > 0),
  unit_price_snapshot integer not null default 0 check (unit_price_snapshot >= 0),
  unit_cost_snapshot integer not null default 0 check (unit_cost_snapshot >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.sales_status_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  from_status sales_order_status,
  to_status sales_order_status not null,
  changed_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

drop trigger if exists trg_sales_orders_updated_at on public.sales_orders;
create trigger trg_sales_orders_updated_at before update on public.sales_orders
for each row execute procedure set_updated_at();

create index if not exists idx_sales_orders_user_ordered
  on public.sales_orders(user_id, ordered_at desc);
create index if not exists idx_sales_orders_user_status
  on public.sales_orders(user_id, status, ordered_at desc);
create unique index if not exists idx_sales_orders_source_external
  on public.sales_orders(user_id, source, source_external_id)
  where source_external_id is not null;
create index if not exists idx_sales_order_items_order
  on public.sales_order_items(user_id, sales_order_id);
create unique index if not exists idx_sales_order_items_operation_line
  on public.sales_order_items(sales_order_id, operation_line_id)
  where operation_line_id is not null;
create index if not exists idx_sales_status_history_order
  on public.sales_status_history(user_id, sales_order_id, changed_at desc);

alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.sales_status_history enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'sales_orders',
    'sales_order_items',
    'sales_status_history'
  ]
  loop
    execute format('drop policy if exists "select_own" on public.%I;', t);
    execute format('drop policy if exists "insert_own" on public.%I;', t);
    execute format('drop policy if exists "update_own" on public.%I;', t);
    execute format('drop policy if exists "delete_own" on public.%I;', t);

    execute format('create policy "select_own" on public.%I for select using (user_id = auth.uid());', t);
    execute format('create policy "insert_own" on public.%I for insert with check (user_id = auth.uid());', t);
    execute format('create policy "update_own" on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid());', t);
    execute format('create policy "delete_own" on public.%I for delete using (user_id = auth.uid());', t);
  end loop;
end $$;

insert into public.sales_orders (
  user_id,
  source,
  source_external_id,
  source_payload,
  operation_id,
  status,
  status_changed_at,
  ordered_at,
  city,
  delivery_service,
  tracking_number,
  delivery_cost,
  total_amount,
  paid_amount,
  note
)
select
  o.user_id,
  'operation'::sales_order_source,
  o.id::text,
  jsonb_build_object('operation_type', o.type),
  o.id,
  case
    when o.type = 'sale_return' then 'returned_to_stock'::sales_order_status
    else 'delivered'::sales_order_status
  end,
  o.occurred_at,
  o.occurred_at,
  o.city,
  o.delivery_service,
  o.tracking_number,
  coalesce(o.delivery_cost, 0),
  coalesce(sum(coalesce(ol.unit_price_snapshot, 0) * ol.qty), 0)::int,
  coalesce(sum(coalesce(ol.unit_price_snapshot, 0) * ol.qty), 0)::int,
  o.note
from public.operations o
left join public.operation_lines ol on ol.operation_id = o.id
where o.type in ('sale', 'sale_return')
group by o.id
on conflict (user_id, source, source_external_id)
where source_external_id is not null
do nothing;

insert into public.sales_order_items (
  user_id,
  sales_order_id,
  operation_line_id,
  variant_id,
  product_name_snapshot,
  sku_snapshot,
  qty,
  unit_price_snapshot,
  unit_cost_snapshot
)
select
  so.user_id,
  so.id,
  ol.id,
  ol.variant_id,
  pm.name,
  pv.sku,
  ol.qty,
  coalesce(ol.unit_price_snapshot, 0),
  coalesce(ol.unit_cost_snapshot, 0)
from public.sales_orders so
join public.operation_lines ol on ol.operation_id = so.operation_id
join public.product_variants pv on pv.id = ol.variant_id
left join public.product_models pm on pm.id = pv.model_id
where so.source = 'operation'
on conflict (sales_order_id, operation_line_id)
where operation_line_id is not null
do nothing;
