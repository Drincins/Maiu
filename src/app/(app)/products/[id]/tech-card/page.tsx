import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/Button'
import { createClient } from '@/lib/supabase/server'
import TechCardClient from './tech-card-client'

export default async function TechCardPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: model } = await supabase
    .from('product_models')
    .select('id, name, main_image_url')
    .eq('id', id)
    .single()

  if (!model) {
    notFound()
  }

  const { data: variants } = await supabase
    .from('product_variants')
    .select('id, size, color')
    .eq('model_id', id)
    .order('created_at')

  const { data: techCard } = await supabase
    .from('product_tech_cards')
    .select('*')
    .eq('model_id', id)
    .maybeSingle()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Техкарта</h1>
          <p className="text-sm text-slate-500">{model.name}</p>
        </div>
        <Link href={`/products/${id}`}>
          <Button type="button" variant="secondary">
            Назад к товару
          </Button>
        </Link>
      </div>

      <TechCardClient model={model} variants={variants ?? []} initial={techCard} />
    </div>
  )
}

