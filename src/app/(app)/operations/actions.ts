'use server'

import { createClient } from '@/lib/supabase/server'

export async function createOperation(payload: Record<string, any>) {
  const supabase = await createClient()

  const normalized = {
    ...payload,
    lines: (payload.lines ?? []).map((line: Record<string, any>) => ({
      ...line,
      mark_codes: line.mark_codes ?? [],
      line_note: line.line_note ?? null
    }))
  }

  try {
    const { data, error } = await supabase.rpc('create_operation', {
      payload: normalized
    })

    if (error) {
      return { error: error.message }
    }

    return { id: data }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unexpected error' }
  }
}

export async function updateOperation(operationId: string, payload: Record<string, any>) {
  const supabase = await createClient()

  const normalized = {
    ...payload,
    lines: (payload.lines ?? []).map((line: Record<string, any>) => ({
      ...line,
      mark_codes: line.mark_codes ?? [],
      line_note: line.line_note ?? null
    }))
  }

  try {
    const { data, error } = await supabase.rpc('update_operation', {
      operation_id: operationId,
      payload: normalized
    })

    if (error) {
      return { error: error.message }
    }

    return { id: data }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unexpected error' }
  }
}

export async function deleteOperation(operationId: string) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  try {
    const { error } = await supabase
      .from('operations')
      .delete()
      .eq('id', operationId)
      .eq('user_id', user.id)

    if (error) {
      return { error: error.message }
    }

    return { ok: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unexpected error' }
  }
}

