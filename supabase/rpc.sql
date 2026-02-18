create or replace function public.create_operation(payload jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_user uuid;
  v_operation_id uuid;
  v_type operation_type;
  v_occurred_at timestamptz;
  v_from_location uuid;
  v_to_location uuid;
  v_counterparty uuid;
  v_promo uuid;
  v_sale_channel text;
  v_city text;
  v_delivery_cost integer;
  v_delivery_service text;
  v_tracking text;
  v_note text;
  v_promo_code text;
  v_discount_type text;
  v_discount_value integer;
  v_line jsonb;
  v_variant_id uuid;
  v_variant_cost integer;
  v_variant_price integer;
  v_variant_marked boolean;
  v_qty integer;
  v_price integer;
  v_cost integer;
  v_line_id uuid;
  v_codes text[];
  v_marking_not_handled boolean;
  v_line_note text;
  v_status mark_status;
  v_target_location uuid;
  v_has_duplicates boolean;
  v_adj_delta integer;
  v_loc_for_adjustment uuid;
  v_code text;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  v_type := (payload->>'type')::operation_type;
  v_occurred_at := coalesce((payload->>'occurred_at')::timestamptz, now());
  v_from_location := nullif(payload->>'from_location_id', '')::uuid;
  v_to_location := nullif(payload->>'to_location_id', '')::uuid;
  v_counterparty := nullif(payload->>'counterparty_id', '')::uuid;
  v_promo := nullif(payload->>'promo_code_id', '')::uuid;
  v_sale_channel := payload->>'sale_channel';
  v_city := payload->>'city';
  v_delivery_cost := nullif(payload->>'delivery_cost','')::int;
  v_delivery_service := payload->>'delivery_service';
  v_tracking := payload->>'tracking_number';
  v_note := payload->>'note';

  if v_promo is not null then
    select code, discount_type::text, discount_value
      into v_promo_code, v_discount_type, v_discount_value
    from public.promo_codes
    where id = v_promo and user_id = v_user;
  end if;

  if v_type = 'ship_blogger' and v_to_location is null then
    select id into v_to_location
    from public.locations
    where user_id = v_user and type = 'blogger'
    limit 1;

    if v_to_location is null then
      insert into public.locations (user_id, name, type)
      values (v_user, 'Блогер', 'blogger')
      returning id into v_to_location;
    end if;
  end if;

  if v_type = 'return_blogger' and v_from_location is null then
    select id into v_from_location
    from public.locations
    where user_id = v_user and type = 'blogger'
    limit 1;

    if v_from_location is null then
      insert into public.locations (user_id, name, type)
      values (v_user, 'Блогер', 'blogger')
      returning id into v_from_location;
    end if;
  end if;

  if v_type = 'sale' and v_to_location is null then
    select id into v_to_location from public.locations where user_id = v_user and type = 'sold' limit 1;
  end if;
  if v_type = 'writeoff' and v_to_location is null then
    select id into v_to_location from public.locations where user_id = v_user and type = 'scrap' limit 1;
  end if;
  if v_type = 'sale_return' and v_to_location is null then
    select id into v_to_location from public.locations where user_id = v_user and type = 'sales' limit 1;
  end if;
  if v_type = 'sale_return' and v_from_location is null then
    select id into v_from_location from public.locations where user_id = v_user and type = 'sold' limit 1;
  end if;

  insert into public.operations (
    user_id,
    type,
    occurred_at,
    from_location_id,
    to_location_id,
    counterparty_id,
    promo_code_id,
    promo_code_snapshot,
    discount_type_snapshot,
    discount_value_snapshot,
    sale_channel,
    city,
    delivery_cost,
    delivery_service,
    tracking_number,
    note
  ) values (
    v_user,
    v_type,
    v_occurred_at,
    v_from_location,
    v_to_location,
    v_counterparty,
    v_promo,
    v_promo_code,
    v_discount_type,
    v_discount_value,
    v_sale_channel,
    v_city,
    v_delivery_cost,
    v_delivery_service,
    v_tracking,
    v_note
  ) returning id into v_operation_id;

  if jsonb_typeof(payload->'lines') is distinct from 'array' then
    raise exception 'lines must be an array';
  end if;

  for v_line in select * from jsonb_array_elements(payload->'lines')
  loop
    v_variant_id := (v_line->>'variant_id')::uuid;
    v_qty := coalesce((v_line->>'qty')::int, 0);
    if v_qty <= 0 then
      raise exception 'qty must be > 0';
    end if;

    select unit_cost, unit_price, is_marked
      into v_variant_cost, v_variant_price, v_variant_marked
    from public.product_variants
    where id = v_variant_id and user_id = v_user;

    if not found then
      raise exception 'variant not found';
    end if;

    v_cost := v_variant_cost;
    v_price := coalesce(
      (v_line->>'unit_price_snapshot')::int,
      (
        select h.unit_price
        from public.product_variant_price_history h
        where h.user_id = v_user
          and h.variant_id = v_variant_id
          and h.effective_at <= v_occurred_at
        order by h.effective_at desc
        limit 1
      ),
      v_variant_price
    );
    v_line_note := v_line->>'line_note';
    v_marking_not_handled := coalesce((v_line->>'marking_not_handled')::boolean, false);

    if v_marking_not_handled then
      v_line_note := trim(both ' ' from coalesce(v_line_note, '') || ' [MARKING_NOT_HANDLED]');
    end if;

    insert into public.operation_lines (
      operation_id,
      variant_id,
      qty,
      unit_price_snapshot,
      unit_cost_snapshot,
      line_note
    ) values (
      v_operation_id,
      v_variant_id,
      v_qty,
      v_price,
      v_cost,
      v_line_note
    ) returning id into v_line_id;

    if v_type = 'inbound' then
      if v_to_location is null then
        raise exception 'to_location_id is required for inbound';
      end if;
      insert into public.stock_movements (
        user_id, occurred_at, operation_id, operation_line_id,
        variant_id, location_id, qty_delta, unit_cost_snapshot, unit_price_snapshot
      ) values (
        v_user, v_occurred_at, v_operation_id, v_line_id,
        v_variant_id, v_to_location, v_qty, v_cost, v_price
      );
    elsif v_type in ('transfer','ship_blogger','return_blogger','sale','sale_return','writeoff') then
      if v_from_location is null or v_to_location is null then
        raise exception 'from_location_id and to_location_id are required for this operation type';
      end if;
      insert into public.stock_movements (
        user_id, occurred_at, operation_id, operation_line_id,
        variant_id, location_id, qty_delta, unit_cost_snapshot, unit_price_snapshot
      ) values (
        v_user, v_occurred_at, v_operation_id, v_line_id,
        v_variant_id, v_from_location, -v_qty, v_cost, v_price
      );
      insert into public.stock_movements (
        user_id, occurred_at, operation_id, operation_line_id,
        variant_id, location_id, qty_delta, unit_cost_snapshot, unit_price_snapshot
      ) values (
        v_user, v_occurred_at, v_operation_id, v_line_id,
        v_variant_id, v_to_location, v_qty, v_cost, v_price
      );
    elsif v_type = 'adjustment' then
      v_adj_delta := coalesce((v_line->>'qty_delta')::int, v_qty);
      if v_adj_delta = 0 then
        raise exception 'qty_delta must not be 0 for adjustment';
      end if;
      v_loc_for_adjustment := coalesce(v_to_location, v_from_location);
      if v_loc_for_adjustment is null then
        raise exception 'location_id is required for adjustment';
      end if;
      insert into public.stock_movements (
        user_id, occurred_at, operation_id, operation_line_id,
        variant_id, location_id, qty_delta, unit_cost_snapshot, unit_price_snapshot
      ) values (
        v_user, v_occurred_at, v_operation_id, v_line_id,
        v_variant_id, v_loc_for_adjustment, v_adj_delta, v_cost, v_price
      );
    end if;

    if v_variant_marked then
      v_codes := array(
        select jsonb_array_elements_text(coalesce(v_line->'mark_codes', '[]'::jsonb))
      );

      if not v_marking_not_handled then
        if coalesce(array_length(v_codes, 1), 0) <> v_qty then
          raise exception 'mark codes count must equal qty';
        end if;

        select count(*) <> count(distinct c)
          into v_has_duplicates
        from unnest(v_codes) as c;

        if v_has_duplicates then
          raise exception 'mark codes must be unique';
        end if;

        if v_type = 'ship_blogger' then
          v_status := 'at_blogger';
          v_target_location := v_to_location;
        elsif v_type = 'return_blogger' then
          v_status := 'in_stock';
          v_target_location := v_to_location;
        elsif v_type = 'sale' then
          v_status := 'sold';
          v_target_location := v_to_location;
        elsif v_type = 'writeoff' then
          v_status := 'written_off';
          v_target_location := v_to_location;
        else
          v_status := 'in_stock';
          v_target_location := coalesce(v_to_location, v_from_location);
        end if;

        foreach v_code in array v_codes
        loop
          insert into public.mark_codes (
            user_id,
            code,
            variant_id,
            current_location_id,
            status,
            last_operation_id
          ) values (
            v_user,
            v_code,
            v_variant_id,
            v_target_location,
            v_status,
            v_operation_id
          )
          on conflict (user_id, code) do update set
            variant_id = excluded.variant_id,
            current_location_id = excluded.current_location_id,
            status = excluded.status,
            last_operation_id = excluded.last_operation_id,
            updated_at = now();
        end loop;
      end if;
    end if;
  end loop;

  return v_operation_id;
end;
$$;

create or replace function public.update_operation(p_operation_id uuid, payload jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_user uuid;
  v_operation_id uuid := p_operation_id;
  v_type operation_type;
  v_occurred_at timestamptz;
  v_from_location uuid;
  v_to_location uuid;
  v_counterparty uuid;
  v_promo uuid;
  v_sale_channel text;
  v_city text;
  v_delivery_cost integer;
  v_delivery_service text;
  v_tracking text;
  v_note text;
  v_promo_code text;
  v_discount_type text;
  v_discount_value integer;
  v_line jsonb;
  v_variant_id uuid;
  v_variant_cost integer;
  v_variant_price integer;
  v_variant_marked boolean;
  v_qty integer;
  v_price integer;
  v_cost integer;
  v_line_id uuid;
  v_codes text[];
  v_marking_not_handled boolean;
  v_line_note text;
  v_status mark_status;
  v_target_location uuid;
  v_has_duplicates boolean;
  v_adj_delta integer;
  v_loc_for_adjustment uuid;
  v_code text;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.operations where id = p_operation_id and user_id = v_user
  ) then
    raise exception 'operation not found';
  end if;

  v_type := (payload->>'type')::operation_type;
  v_occurred_at := coalesce((payload->>'occurred_at')::timestamptz, now());
  v_from_location := nullif(payload->>'from_location_id', '')::uuid;
  v_to_location := nullif(payload->>'to_location_id', '')::uuid;
  v_counterparty := nullif(payload->>'counterparty_id', '')::uuid;
  v_promo := nullif(payload->>'promo_code_id', '')::uuid;
  v_sale_channel := payload->>'sale_channel';
  v_city := payload->>'city';
  v_delivery_cost := nullif(payload->>'delivery_cost','')::int;
  v_delivery_service := payload->>'delivery_service';
  v_tracking := payload->>'tracking_number';
  v_note := payload->>'note';

  if v_promo is not null then
    select code, discount_type::text, discount_value
      into v_promo_code, v_discount_type, v_discount_value
    from public.promo_codes
    where id = v_promo and user_id = v_user;
  end if;

  if v_type = 'ship_blogger' and v_to_location is null then
    select id into v_to_location
    from public.locations
    where user_id = v_user and type = 'blogger'
    limit 1;

    if v_to_location is null then
      insert into public.locations (user_id, name, type)
      values (v_user, 'Блогер', 'blogger')
      returning id into v_to_location;
    end if;
  end if;

  if v_type = 'return_blogger' and v_from_location is null then
    select id into v_from_location
    from public.locations
    where user_id = v_user and type = 'blogger'
    limit 1;

    if v_from_location is null then
      insert into public.locations (user_id, name, type)
      values (v_user, 'Блогер', 'blogger')
      returning id into v_from_location;
    end if;
  end if;

  if v_type = 'sale' and v_to_location is null then
    select id into v_to_location from public.locations where user_id = v_user and type = 'sold' limit 1;
  end if;
  if v_type = 'writeoff' and v_to_location is null then
    select id into v_to_location from public.locations where user_id = v_user and type = 'scrap' limit 1;
  end if;
  if v_type = 'sale_return' and v_to_location is null then
    select id into v_to_location from public.locations where user_id = v_user and type = 'sales' limit 1;
  end if;
  if v_type = 'sale_return' and v_from_location is null then
    select id into v_from_location from public.locations where user_id = v_user and type = 'sold' limit 1;
  end if;

  update public.operations
  set
    type = v_type,
    occurred_at = v_occurred_at,
    from_location_id = v_from_location,
    to_location_id = v_to_location,
    counterparty_id = v_counterparty,
    promo_code_id = v_promo,
    promo_code_snapshot = v_promo_code,
    discount_type_snapshot = v_discount_type,
    discount_value_snapshot = v_discount_value,
    sale_channel = v_sale_channel,
    city = v_city,
    delivery_cost = v_delivery_cost,
    delivery_service = v_delivery_service,
    tracking_number = v_tracking,
    note = v_note
  where id = p_operation_id and user_id = v_user;

  delete from public.stock_movements where operation_id = p_operation_id;
  delete from public.operation_lines where operation_id = p_operation_id;
  delete from public.mark_codes where last_operation_id = p_operation_id;

  if jsonb_typeof(payload->'lines') is distinct from 'array' then
    raise exception 'lines must be an array';
  end if;

  for v_line in select * from jsonb_array_elements(payload->'lines')
  loop
    v_variant_id := (v_line->>'variant_id')::uuid;
    v_qty := coalesce((v_line->>'qty')::int, 0);
    if v_qty <= 0 then
      raise exception 'qty must be > 0';
    end if;

    select unit_cost, unit_price, is_marked
      into v_variant_cost, v_variant_price, v_variant_marked
    from public.product_variants
    where id = v_variant_id and user_id = v_user;

    if not found then
      raise exception 'variant not found';
    end if;

    v_cost := v_variant_cost;
    v_price := coalesce(
      (v_line->>'unit_price_snapshot')::int,
      (
        select h.unit_price
        from public.product_variant_price_history h
        where h.user_id = v_user
          and h.variant_id = v_variant_id
          and h.effective_at <= v_occurred_at
        order by h.effective_at desc
        limit 1
      ),
      v_variant_price
    );
    v_line_note := v_line->>'line_note';
    v_marking_not_handled := coalesce((v_line->>'marking_not_handled')::boolean, false);

    if v_variant_marked and not v_marking_not_handled then
      raise exception 'editing marked operations is not supported; enable marking_not_handled';
    end if;

    if v_marking_not_handled then
      v_line_note := trim(both ' ' from coalesce(v_line_note, '') || ' [MARKING_NOT_HANDLED]');
    end if;

    insert into public.operation_lines (
      operation_id,
      variant_id,
      qty,
      unit_price_snapshot,
      unit_cost_snapshot,
      line_note
    ) values (
      v_operation_id,
      v_variant_id,
      v_qty,
      v_price,
      v_cost,
      v_line_note
    ) returning id into v_line_id;

    if v_type = 'inbound' then
      if v_to_location is null then
        raise exception 'to_location_id is required for inbound';
      end if;
      insert into public.stock_movements (
        user_id, occurred_at, operation_id, operation_line_id,
        variant_id, location_id, qty_delta, unit_cost_snapshot, unit_price_snapshot
      ) values (
        v_user, v_occurred_at, v_operation_id, v_line_id,
        v_variant_id, v_to_location, v_qty, v_cost, v_price
      );
    elsif v_type in ('transfer','ship_blogger','return_blogger','sale','sale_return','writeoff') then
      if v_from_location is null or v_to_location is null then
        raise exception 'from_location_id and to_location_id are required for this operation type';
      end if;
      insert into public.stock_movements (
        user_id, occurred_at, operation_id, operation_line_id,
        variant_id, location_id, qty_delta, unit_cost_snapshot, unit_price_snapshot
      ) values (
        v_user, v_occurred_at, v_operation_id, v_line_id,
        v_variant_id, v_from_location, -v_qty, v_cost, v_price
      );
      insert into public.stock_movements (
        user_id, occurred_at, operation_id, operation_line_id,
        variant_id, location_id, qty_delta, unit_cost_snapshot, unit_price_snapshot
      ) values (
        v_user, v_occurred_at, v_operation_id, v_line_id,
        v_variant_id, v_to_location, v_qty, v_cost, v_price
      );
    elsif v_type = 'adjustment' then
      v_adj_delta := coalesce((v_line->>'qty_delta')::int, v_qty);
      if v_adj_delta = 0 then
        raise exception 'qty_delta must not be 0 for adjustment';
      end if;
      v_loc_for_adjustment := coalesce(v_to_location, v_from_location);
      if v_loc_for_adjustment is null then
        raise exception 'location_id is required for adjustment';
      end if;
      insert into public.stock_movements (
        user_id, occurred_at, operation_id, operation_line_id,
        variant_id, location_id, qty_delta, unit_cost_snapshot, unit_price_snapshot
      ) values (
        v_user, v_occurred_at, v_operation_id, v_line_id,
        v_variant_id, v_loc_for_adjustment, v_adj_delta, v_cost, v_price
      );
    end if;

    if v_variant_marked and not v_marking_not_handled then
      v_codes := array(
        select jsonb_array_elements_text(coalesce(v_line->'mark_codes', '[]'::jsonb))
      );

      if coalesce(array_length(v_codes, 1), 0) <> v_qty then
        raise exception 'mark codes count must equal qty';
      end if;

      select count(*) <> count(distinct c)
        into v_has_duplicates
      from unnest(v_codes) as c;

      if v_has_duplicates then
        raise exception 'mark codes must be unique';
      end if;

      if v_type = 'ship_blogger' then
        v_status := 'at_blogger';
        v_target_location := v_to_location;
      elsif v_type = 'return_blogger' then
        v_status := 'in_stock';
        v_target_location := v_to_location;
      elsif v_type = 'sale' then
        v_status := 'sold';
        v_target_location := v_to_location;
      elsif v_type = 'writeoff' then
        v_status := 'written_off';
        v_target_location := v_to_location;
      else
        v_status := 'in_stock';
        v_target_location := coalesce(v_to_location, v_from_location);
      end if;

      foreach v_code in array v_codes
      loop
        insert into public.mark_codes (
          user_id,
          code,
          variant_id,
          current_location_id,
          status,
          last_operation_id
        ) values (
          v_user,
          v_code,
          v_variant_id,
          v_target_location,
          v_status,
          v_operation_id
        )
        on conflict (user_id, code) do update set
          variant_id = excluded.variant_id,
          current_location_id = excluded.current_location_id,
          status = excluded.status,
          last_operation_id = excluded.last_operation_id,
          updated_at = now();
      end loop;
    end if;
  end loop;

  return v_operation_id;
end;
$$;

create or replace function public.apply_variant_price_from_date(
  p_variant_id uuid,
  p_unit_price integer,
  p_effective_at timestamptz
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_user uuid;
  v_effective_at timestamptz := p_effective_at;
  v_current_variant_price integer;
  v_now_effective_price integer;
  v_recalculated_lines integer := 0;
  v_recalculated_movements integer := 0;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if p_variant_id is null then
    raise exception 'variant_id is required';
  end if;

  if p_unit_price is null or p_unit_price < 0 then
    raise exception 'unit_price must be >= 0';
  end if;

  if v_effective_at is null then
    raise exception 'effective_at is required';
  end if;

  select unit_price
    into v_current_variant_price
  from public.product_variants
  where id = p_variant_id
    and user_id = v_user;

  if not found then
    raise exception 'variant not found';
  end if;

  if not exists (
    select 1
    from public.product_variant_price_history h
    where h.user_id = v_user
      and h.variant_id = p_variant_id
  ) then
    insert into public.product_variant_price_history (
      user_id,
      variant_id,
      unit_price,
      effective_at
    ) values (
      v_user,
      p_variant_id,
      v_current_variant_price,
      '1900-01-01 00:00:00+00'::timestamptz
    )
    on conflict (user_id, variant_id, effective_at) do nothing;
  end if;

  insert into public.product_variant_price_history (
    user_id,
    variant_id,
    unit_price,
    effective_at
  ) values (
    v_user,
    p_variant_id,
    p_unit_price,
    v_effective_at
  )
  on conflict (user_id, variant_id, effective_at) do update set
    unit_price = excluded.unit_price;

  update public.operation_lines ol
  set unit_price_snapshot = hp.unit_price
  from public.operations o
  join lateral (
    select h.unit_price
    from public.product_variant_price_history h
    where h.user_id = v_user
      and h.variant_id = p_variant_id
      and h.effective_at <= o.occurred_at
    order by h.effective_at desc
    limit 1
  ) hp on true
  where ol.operation_id = o.id
    and ol.variant_id = p_variant_id
    and o.user_id = v_user
    and o.occurred_at >= v_effective_at;

  get diagnostics v_recalculated_lines = row_count;

  update public.stock_movements sm
  set unit_price_snapshot = hp.unit_price
  from public.operations o
  join lateral (
    select h.unit_price
    from public.product_variant_price_history h
    where h.user_id = v_user
      and h.variant_id = p_variant_id
      and h.effective_at <= o.occurred_at
    order by h.effective_at desc
    limit 1
  ) hp on true
  where sm.operation_id = o.id
    and sm.variant_id = p_variant_id
    and sm.user_id = v_user
    and o.user_id = v_user
    and o.occurred_at >= v_effective_at;

  get diagnostics v_recalculated_movements = row_count;

  select h.unit_price
    into v_now_effective_price
  from public.product_variant_price_history h
  where h.user_id = v_user
    and h.variant_id = p_variant_id
    and h.effective_at <= now()
  order by h.effective_at desc
  limit 1;

  update public.product_variants
  set unit_price = coalesce(v_now_effective_price, unit_price)
  where id = p_variant_id
    and user_id = v_user;

  return jsonb_build_object(
    'variant_id', p_variant_id,
    'unit_price', p_unit_price,
    'effective_at', v_effective_at,
    'recalculated_lines', v_recalculated_lines,
    'recalculated_movements', v_recalculated_movements
  );
end;
$$;
