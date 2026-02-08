import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProductDetailClient from '../ProductDetailClient'

export default async function ProductDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: model } = await supabase
    .from('product_models')
    .select('*')
    .eq('id', id)
    .single()

  if (!model) {
    notFound()
  }

  const { data: variants } = await supabase
    .from('product_variants')
    .select('*')
    .eq('model_id', id)
    .order('created_at', { ascending: false })

  return (
    <ProductDetailClient model={model} variants={variants ?? []} />
  )
}

