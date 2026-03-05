import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProductDetailClient from '../ProductDetailClient'

const computeTechCardTotal = (techCard: any) => {
  if (typeof techCard?.total_cost === 'number' && Number.isFinite(techCard.total_cost)) {
    return techCard.total_cost
  }

  const lines = Array.isArray(techCard?.lines) ? techCard.lines : []
  return lines.reduce((sum: number, line: any) => {
    const usage =
      typeof line?.usage === 'number' && Number.isFinite(line.usage)
        ? line.usage
        : null
    const unitPrice =
      typeof line?.unit_price === 'number' && Number.isFinite(line.unit_price)
        ? line.unit_price
        : null

    if (usage === null || unitPrice === null) return sum
    return sum + Math.round(usage * unitPrice)
  }, 0)
}

export default async function ProductDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: model }, { data: variants }, { data: techCard }, { data: collections }] =
    await Promise.all([
      supabase
        .from('product_models')
        .select('id, name, description, main_image_url, is_active, collection_id')
        .eq('id', id)
        .single(),
      supabase
        .from('product_variants')
        .select('*')
        .eq('model_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('product_tech_cards')
        .select('id, name, color, sizes, lines, total_cost, updated_at')
        .eq('model_id', id)
        .maybeSingle(),
      supabase.from('product_collections').select('id, name').order('name')
    ])

  if (!model) {
    notFound()
  }

  if (!techCard) {
    redirect(`/products/${id}/tech-card?returnToProduct=1`)
  }

  return (
    <ProductDetailClient
      model={model}
      variants={variants ?? []}
      collections={collections ?? []}
      techCard={{
        id: techCard.id,
        name: techCard.name ?? model.name,
        color: techCard.color ?? null,
        sizes: Array.isArray(techCard.sizes) ? techCard.sizes : [],
        total_cost: computeTechCardTotal(techCard),
        line_count: Array.isArray(techCard.lines) ? techCard.lines.length : 0,
        updated_at: techCard.updated_at ?? null
      }}
    />
  )
}
