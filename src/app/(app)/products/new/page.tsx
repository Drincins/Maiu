import { createClient } from '@/lib/supabase/server'
import NewProductFormClient from './NewProductFormClient'

export default async function NewProductPage() {
  const supabase = await createClient()
  const { data: collections } = await supabase
    .from('product_collections')
    .select('id, name')
    .order('name')

  return <NewProductFormClient collections={collections ?? []} />
}
