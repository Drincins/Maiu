-- Extensions
create extension if not exists "pgcrypto";

-- Enums (через DO блоки)
do $$ begin
  if not exists (select 1 from pg_type where typname = 'location_type') then
    create type location_type as enum ('sales','promo','blogger','sold','scrap','other');
  end if;
  if not exists (select 1 from pg_type where typname = 'counterparty_type') then
    create type counterparty_type as enum ('blogger','customer','supplier','other');
  end if;
  if not exists (select 1 from pg_type where typname = 'discount_type') then
    create type discount_type as enum ('percent','fixed');
  end if;
  if not exists (select 1 from pg_type where typname = 'operation_type') then
    create type operation_type as enum ('inbound','transfer','ship_blogger','return_blogger','sale','sale_return','writeoff','adjustment');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_source_type') then
    create type payment_source_type as enum ('cash','personal_card','legal_entity_account','other');
  end if;
  if not exists (select 1 from pg_type where typname = 'finance_type') then
    create type finance_type as enum ('income','expense');
  end if;
  if not exists (select 1 from pg_type where typname = 'category_kind') then
    create type category_kind as enum ('income','expense');
  end if;
  if not exists (select 1 from pg_type where typname = 'mark_status') then
    create type mark_status as enum ('in_stock','at_blogger','sold','returned','written_off','unknown');
  end if;
  if not exists (select 1 from pg_type where typname = 'sales_revenue_source') then
    create type sales_revenue_source as enum ('operations','finance');
  end if;
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

-- Updated_at trigger
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Tables
create table if not exists public.product_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.product_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  collection_id uuid references public.product_collections(id) on delete set null,
  brand text,
  category text,
  description text,
  main_image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  model_id uuid not null references public.product_models(id) on delete cascade,
  sku text not null,
  size text,
  color text,
  barcode text,
  unit_price integer not null default 0,
  unit_cost integer not null default 0,
  is_marked boolean not null default false,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sku)
);

create table if not exists public.product_variant_price_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  unit_price integer not null check (unit_price >= 0),
  effective_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, variant_id, effective_at)
);

create table if not exists public.product_tech_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  model_id uuid not null references public.product_models(id) on delete cascade,
  sketch_url text,
  name text,
  color text,
  sizes text[],
  lines jsonb not null default '[]'::jsonb,
  total_cost integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (model_id)
);

alter table public.product_models
  add column if not exists collection_id uuid references public.product_collections(id) on delete set null;

alter table public.product_tech_cards
  add column if not exists total_cost integer not null default 0;

create table if not exists public.counterparties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type counterparty_type not null default 'other',
  name text not null,
  phone text,
  social_link text,
  address text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  type location_type not null default 'other',
  counterparty_id uuid references public.counterparties(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  code text not null,
  discount_type discount_type not null default 'percent',
  discount_value integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  blogger_id uuid references public.counterparties(id) on delete set null,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, code)
);

create table if not exists public.operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type operation_type not null,
  occurred_at timestamptz not null default now(),
  from_location_id uuid references public.locations(id) on delete set null,
  to_location_id uuid references public.locations(id) on delete set null,
  counterparty_id uuid references public.counterparties(id) on delete set null,
  promo_code_id uuid references public.promo_codes(id) on delete set null,
  promo_code_snapshot text,
  discount_type_snapshot text,
  discount_value_snapshot integer,
  sale_channel text,
  city text,
  delivery_cost integer,
  delivery_service text,
  tracking_number text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.operation_lines (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  qty integer not null check (qty > 0),
  unit_price_snapshot integer,
  unit_cost_snapshot integer,
  line_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  occurred_at timestamptz not null,
  operation_id uuid not null references public.operations(id) on delete cascade,
  operation_line_id uuid not null references public.operation_lines(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  location_id uuid not null references public.locations(id) on delete restrict,
  qty_delta integer not null,
  unit_cost_snapshot integer,
  unit_price_snapshot integer,
  created_at timestamptz not null default now()
);

create table if not exists public.mark_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  code text not null,
  variant_id uuid references public.product_variants(id) on delete set null,
  current_location_id uuid references public.locations(id) on delete set null,
  status mark_status not null default 'unknown',
  last_operation_id uuid references public.operations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);

create table if not exists public.legal_entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  inn text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type payment_source_type not null default 'other',
  legal_entity_id uuid references public.legal_entities(id) on delete set null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  kind category_kind not null default 'expense',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  occurred_at timestamptz not null default now(),
  type finance_type not null,
  amount integer not null check (amount >= 0),
  payment_source_id uuid references public.payment_sources(id) on delete set null,
  legal_entity_id uuid references public.legal_entities(id) on delete set null,
  category_id uuid references public.expense_categories(id) on delete set null,
  counterparty_id uuid references public.counterparties(id) on delete set null,
  operation_id uuid references public.operations(id) on delete set null,
  note text,
  attachment_url text,
  created_at timestamptz not null default now()
);

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

create table if not exists public.dashboard_settings (
  user_id uuid primary key,
  sales_revenue_source sales_revenue_source not null default 'operations',
  include_finance_income boolean not null default true,
  include_finance_expense boolean not null default true,
  include_sales_revenue boolean not null default true,
  include_sale_returns boolean not null default true,
  include_sales_delivery boolean not null default true,
  include_sales_discounts boolean not null default true,
  include_sales_cogs boolean not null default false,
  include_sales_return_cost_recovery boolean not null default false,
  include_blogger_ship_cost boolean not null default true,
  include_blogger_delivery boolean not null default true,
  include_blogger_return_recovery boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dashboard_settings
  alter column include_sales_cogs set default false;

alter table public.dashboard_settings
  alter column include_sales_return_cost_recovery set default false;

-- Backfill existing users to the new default behavior:
-- sales COGS is analytics by default (not a management minus).
-- Applies only to untouched settings rows to avoid overriding explicit custom choices.
update public.dashboard_settings
set
  include_sales_cogs = false,
  include_sales_return_cost_recovery = false
where
  include_sales_cogs = true
  and include_sales_return_cost_recovery = true
  and updated_at = created_at;

-- Triggers
drop trigger if exists trg_product_models_updated_at on public.product_models;
create trigger trg_product_models_updated_at before update on public.product_models
for each row execute procedure set_updated_at();

drop trigger if exists trg_product_collections_updated_at on public.product_collections;
create trigger trg_product_collections_updated_at before update on public.product_collections
for each row execute procedure set_updated_at();

drop trigger if exists trg_product_variants_updated_at on public.product_variants;
create trigger trg_product_variants_updated_at before update on public.product_variants
for each row execute procedure set_updated_at();

drop trigger if exists trg_product_tech_cards_updated_at on public.product_tech_cards;
create trigger trg_product_tech_cards_updated_at before update on public.product_tech_cards
for each row execute procedure set_updated_at();

drop trigger if exists trg_mark_codes_updated_at on public.mark_codes;
create trigger trg_mark_codes_updated_at before update on public.mark_codes
for each row execute procedure set_updated_at();

drop trigger if exists trg_dashboard_settings_updated_at on public.dashboard_settings;
create trigger trg_dashboard_settings_updated_at before update on public.dashboard_settings
for each row execute procedure set_updated_at();

drop trigger if exists trg_sales_orders_updated_at on public.sales_orders;
create trigger trg_sales_orders_updated_at before update on public.sales_orders
for each row execute procedure set_updated_at();

-- Indexes
create index if not exists idx_product_models_user on public.product_models(user_id);
create index if not exists idx_product_models_collection on public.product_models(collection_id);
create index if not exists idx_product_collections_user on public.product_collections(user_id);
create index if not exists idx_product_variants_user on public.product_variants(user_id);
create index if not exists idx_price_history_user_variant_effective
  on public.product_variant_price_history(user_id, variant_id, effective_at desc);
create index if not exists idx_product_tech_cards_user on public.product_tech_cards(user_id);
create index if not exists idx_locations_user on public.locations(user_id);
create index if not exists idx_operations_user_occurred on public.operations(user_id, occurred_at desc);
create index if not exists idx_stock_movements_user_occurred on public.stock_movements(user_id, occurred_at desc);
create index if not exists idx_mark_codes_user on public.mark_codes(user_id);
create index if not exists idx_sales_orders_user_ordered on public.sales_orders(user_id, ordered_at desc);
create index if not exists idx_sales_orders_user_status on public.sales_orders(user_id, status, ordered_at desc);
create unique index if not exists idx_sales_orders_source_external
  on public.sales_orders(user_id, source, source_external_id)
  where source_external_id is not null;
create index if not exists idx_sales_order_items_order on public.sales_order_items(user_id, sales_order_id);
create unique index if not exists idx_sales_order_items_operation_line
  on public.sales_order_items(sales_order_id, operation_line_id)
  where operation_line_id is not null;
create index if not exists idx_sales_status_history_order on public.sales_status_history(user_id, sales_order_id, changed_at desc);

-- RLS enable
alter table public.product_collections enable row level security;
alter table public.product_models enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_variant_price_history enable row level security;
alter table public.product_tech_cards enable row level security;
alter table public.counterparties enable row level security;
alter table public.locations enable row level security;
alter table public.promo_codes enable row level security;
alter table public.operations enable row level security;
alter table public.operation_lines enable row level security;
alter table public.stock_movements enable row level security;
alter table public.mark_codes enable row level security;
alter table public.legal_entities enable row level security;
alter table public.payment_sources enable row level security;
alter table public.expense_categories enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.sales_status_history enable row level security;
alter table public.dashboard_settings enable row level security;

-- RLS policies (owner-only)
-- For each table: select/insert/update/delete with user_id = auth.uid()
do $$
declare
  t text;
begin
  foreach t in array array[
    'product_collections','product_models','product_variants','product_variant_price_history','product_tech_cards','counterparties','locations','promo_codes',
    'operations','stock_movements','mark_codes','legal_entities','payment_sources',
    'expense_categories','finance_transactions','sales_orders','sales_order_items','sales_status_history','dashboard_settings'
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

-- operation_lines: через join к operations (нет user_id)
alter table public.operation_lines enable row level security;
drop policy if exists "select_own" on public.operation_lines;
drop policy if exists "insert_own" on public.operation_lines;
drop policy if exists "update_own" on public.operation_lines;
drop policy if exists "delete_own" on public.operation_lines;

create policy "select_own" on public.operation_lines
for select using (
  exists (select 1 from public.operations o where o.id = operation_lines.operation_id and o.user_id = auth.uid())
);

create policy "insert_own" on public.operation_lines
for insert with check (
  exists (select 1 from public.operations o where o.id = operation_lines.operation_id and o.user_id = auth.uid())
);

create policy "update_own" on public.operation_lines
for update using (
  exists (select 1 from public.operations o where o.id = operation_lines.operation_id and o.user_id = auth.uid())
) with check (
  exists (select 1 from public.operations o where o.id = operation_lines.operation_id and o.user_id = auth.uid())
);

create policy "delete_own" on public.operation_lines
for delete using (
  exists (select 1 from public.operations o where o.id = operation_lines.operation_id and o.user_id = auth.uid())
);

-- Backfill CRM sales orders from existing sale operations.
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

-- View for stock on hand
create or replace view public.v_stock_on_hand as
select
  sm.user_id,
  sm.variant_id,
  sm.location_id,
  sum(sm.qty_delta)::int as qty
from public.stock_movements sm
group by sm.user_id, sm.variant_id, sm.location_id;

-- Storage buckets and policies (images/attachments)
-- In some environments current role is not owner of storage.objects.
-- Keep schema bootstrap resilient: skip storage setup if privileges are insufficient.
do $$
declare
  v_storage_objects_owner text;
begin
  select pg_catalog.pg_get_userbyid(c.relowner)
    into v_storage_objects_owner
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'storage'
    and c.relname = 'objects'
    and c.relkind = 'r';

  if v_storage_objects_owner is distinct from current_user then
    raise notice 'Skipping storage setup: current_user (%) is not owner of storage.objects (%)',
      current_user,
      coalesce(v_storage_objects_owner, 'unknown');
    return;
  end if;

  alter table storage.objects enable row level security;

  insert into storage.buckets (id, name, public)
  values
    ('product-images', 'product-images', true),
    ('finance-attachments', 'finance-attachments', true)
  on conflict (id) do nothing;

  drop policy if exists "product_images_insert" on storage.objects;
  create policy "product_images_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images');

  drop policy if exists "product_images_select" on storage.objects;
  create policy "product_images_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'product-images');

  drop policy if exists "finance_attachments_insert" on storage.objects;
  create policy "finance_attachments_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'finance-attachments');

  drop policy if exists "finance_attachments_select" on storage.objects;
  create policy "finance_attachments_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'finance-attachments');
exception
  when insufficient_privilege then
    raise notice 'Skipping storage setup: insufficient privilege for current_user (%)', current_user;
end $$;
