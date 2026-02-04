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
create table if not exists public.product_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
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

-- Triggers
drop trigger if exists trg_product_models_updated_at on public.product_models;
create trigger trg_product_models_updated_at before update on public.product_models
for each row execute procedure set_updated_at();

drop trigger if exists trg_product_variants_updated_at on public.product_variants;
create trigger trg_product_variants_updated_at before update on public.product_variants
for each row execute procedure set_updated_at();

drop trigger if exists trg_mark_codes_updated_at on public.mark_codes;
create trigger trg_mark_codes_updated_at before update on public.mark_codes
for each row execute procedure set_updated_at();

-- Indexes
create index if not exists idx_product_models_user on public.product_models(user_id);
create index if not exists idx_product_variants_user on public.product_variants(user_id);
create index if not exists idx_locations_user on public.locations(user_id);
create index if not exists idx_operations_user_occurred on public.operations(user_id, occurred_at desc);
create index if not exists idx_stock_movements_user_occurred on public.stock_movements(user_id, occurred_at desc);
create index if not exists idx_mark_codes_user on public.mark_codes(user_id);

-- RLS enable
alter table public.product_models enable row level security;
alter table public.product_variants enable row level security;
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

-- RLS policies (owner-only)
-- For each table: select/insert/update/delete with user_id = auth.uid()
do $$
declare
  t text;
begin
  foreach t in array array[
    'product_models','product_variants','counterparties','locations','promo_codes',
    'operations','stock_movements','mark_codes','legal_entities','payment_sources',
    'expense_categories','finance_transactions'
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
