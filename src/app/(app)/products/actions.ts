'use server'

import { createClient } from '@/lib/supabase/server'

const normalizeSkuPart = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^0-9A-ZА-ЯЁ_-]/g, '')
    .replace(/-+/g, '-')

const buildSku = (name: string, color: string, size: string) =>
  [normalizeSkuPart(name), normalizeSkuPart(color), normalizeSkuPart(size)]
    .filter(Boolean)
    .join('-')

export async function createModel(values: {
  name: string
  unit_price: number
  unit_cost: number
  color: string
  sizes: string[]
  main_image_url?: string | null
}) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('product_models')
    .insert({
      user_id: user.id,
      name: values.name,
      brand: null,
      category: null,
      description: null,
      main_image_url: values.main_image_url ?? null,
      is_active: true
    })
    .select('id')
    .single()

  if (error) {
    return { error: error.message }
  }

  const variantsPayload = values.sizes.map((size) => ({
    user_id: user.id,
    model_id: data.id,
    sku: buildSku(values.name, values.color, size),
    size,
    color: values.color,
    unit_price: values.unit_price,
    unit_cost: values.unit_cost,
    is_marked: false,
    image_url: values.main_image_url ?? null
  }))

  if (variantsPayload.length) {
    const { error: variantsError } = await supabase
      .from('product_variants')
      .insert(variantsPayload)
    if (variantsError) {
      return { error: variantsError.message }
    }
  }

  return { id: data.id }
}

export async function updateModel(
  id: string,
  values: {
    name: string
    description?: string | null
    main_image_url?: string | null
    is_active?: boolean
  }
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('product_models')
    .update({
      name: values.name,
      description: values.description ?? null,
      main_image_url: values.main_image_url ?? null,
      is_active: values.is_active ?? true
    })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  return { id }
}

export async function deleteModel(id: string) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase.from('product_models').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  return { ok: true }
}

export async function archiveModel(id: string) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('product_models')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  return { ok: true }
}

export async function updateVariantPrice(
  variantId: string,
  unitPrice: number
) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return { error: 'Invalid price' }
  }

  const { error } = await supabase
    .from('product_variants')
    .update({ unit_price: unitPrice })
    .eq('id', variantId)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  return { ok: true }
}

export async function updateVariantDetails(
  variantId: string,
  values: {
    size?: string | null
    color?: string | null
    unit_price: number
    unit_cost: number
  }
) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  if (!Number.isFinite(values.unit_price) || values.unit_price < 0) {
    return { error: 'Invalid price' }
  }

  if (!Number.isFinite(values.unit_cost) || values.unit_cost < 0) {
    return { error: 'Invalid cost' }
  }

  const { error } = await supabase
    .from('product_variants')
    .update({
      size: values.size ?? null,
      color: values.color ?? null,
      unit_price: values.unit_price,
      unit_cost: values.unit_cost
    })
    .eq('id', variantId)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  return { ok: true }
}

export async function bulkUpdateVariantPrices(
  modelId: string,
  unitPrice: number
) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return { error: 'Invalid price' }
  }

  const { error } = await supabase
    .from('product_variants')
    .update({ unit_price: unitPrice })
    .eq('model_id', modelId)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  return { ok: true }
}

export async function createVariant(
  modelId: string,
  values: {
    sku: string
    size?: string | null
    color?: string | null
    barcode?: string | null
    unit_price: number
    unit_cost: number
    is_marked?: boolean
    image_url?: string | null
  }
) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('product_variants')
    .insert({
      user_id: user.id,
      model_id: modelId,
      sku: values.sku,
      size: values.size ?? null,
      color: values.color ?? null,
      barcode: values.barcode ?? null,
      unit_price: values.unit_price,
      unit_cost: values.unit_cost,
      is_marked: values.is_marked ?? false,
      image_url: values.image_url ?? null
    })
    .select('id')
    .single()

  if (error) {
    return { error: error.message }
  }

  return { id: data.id }
}

export async function upsertTechCard(
  modelId: string,
  values: {
    sketch_url?: string | null
    name?: string | null
    color?: string | null
    sizes?: string[] | null
    lines?: Array<{
      name?: string | null
      article?: string | null
      composition?: string | null
      purchase_place?: string | null
      usage?: number | null
      unit_price?: number | null
    }> | null
  }
) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Prevent cross-user references by validating ownership under RLS.
  const { data: model } = await supabase
    .from('product_models')
    .select('id')
    .eq('id', modelId)
    .maybeSingle()

  if (!model) {
    return { error: 'Model not found' }
  }

  const normalizeText = (value?: string | null) => {
    const trimmed = (value ?? '').trim()
    return trimmed.length ? trimmed : null
  }

  const payload = {
    user_id: user.id,
    model_id: modelId,
    sketch_url: normalizeText(values.sketch_url),
    name: normalizeText(values.name),
    color: normalizeText(values.color),
    sizes: values.sizes ?? null,
    lines: values.lines ?? []
  }

  const { data, error } = await supabase
    .from('product_tech_cards')
    .upsert(payload, { onConflict: 'model_id' })
    .select('id')
    .single()

  if (error) {
    return { error: error.message }
  }

  return { id: data.id }
}

export async function deleteTechCard(modelId: string) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('product_tech_cards')
    .delete()
    .eq('model_id', modelId)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  return { ok: true }
}

