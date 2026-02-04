'use client'

import { useState, type ChangeEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

type StorageUploaderProps = {
  bucket: string
  onUploaded: (url: string) => void
}

export default function StorageUploader({ bucket, onUploaded }: StorageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    const supabase = createClient()
    const fileExt = file.name.split('.').pop()
    const filePath = `${Date.now()}-${Math.random().toString(16).slice(2)}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file)

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
    onUploaded(data.publicUrl)
    setUploading(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="file" onChange={handleUpload} />
      {uploading ? (
        <span className="text-xs text-slate-500">Загрузка...</span>
      ) : null}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  )
}
