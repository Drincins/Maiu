'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signIn(values: { email: string; password: string }) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: values.email,
    password: values.password
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}

export async function signUp(values: { email: string; password: string }) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password: values.password
  })

  if (error) {
    return { error: error.message }
  }

  if (!data.session) {
    return { error: 'Проверьте почту и подтвердите email, затем войдите.' }
  }

  redirect('/dashboard')
}
