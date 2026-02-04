'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { Button } from '@/components/Button'

const hints = new Map()
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.QR_CODE
])

function normalizeCodes(raw: string) {
  return raw
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

type MarkCodeScannerProps = {
  value: string[]
  onChange: (codes: string[]) => void
}

export default function MarkCodeScanner({ value, onChange }: MarkCodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [pasteValue, setPasteValue] = useState('')

  const codes = useMemo(() => value, [value])

  const addCode = (code: string) => {
    if (!code || codes.includes(code)) return
    onChange([...codes, code])
  }

  const start = async () => {
    if (isRunning) return
    setIsRunning(true)
    if (!readerRef.current) {
      readerRef.current = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 200
      })
    }

    if (!videoRef.current) {
      setIsRunning(false)
      return
    }

    try {
      controlsRef.current = await readerRef.current.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          if (result) {
            addCode(result.getText())
          }
        }
      )
    } catch (error) {
      console.error(error)
      controlsRef.current?.stop()
      controlsRef.current = null
      setIsRunning(false)
    }
  }

  const stop = () => {
    controlsRef.current?.stop()
    controlsRef.current = null
    setIsRunning(false)
  }

  useEffect(() => {
    return () => {
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [])

  const handlePaste = () => {
    const parsed = normalizeCodes(pasteValue)
    if (!parsed.length) return
    const unique = Array.from(new Set([...codes, ...parsed]))
    onChange(unique)
    setPasteValue('')
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={start} disabled={isRunning}>
          Старт
        </Button>
        <Button type="button" variant="secondary" onClick={stop}>
          Стоп
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onChange([])}
        >
          Очистить
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-black">
        <video ref={videoRef} className="h-48 w-full object-cover" />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Ручной ввод
        </label>
        <textarea
          value={pasteValue}
          onChange={(event) => setPasteValue(event.target.value)}
          className="min-h-[80px] rounded-xl border border-slate-200 p-2 text-sm"
          placeholder="Вставьте коды построчно"
        />
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={handlePaste}>
            Добавить
          </Button>
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Сканированные коды: {codes.length}
        </div>
        <div className="mt-2 max-h-28 overflow-auto rounded-xl border border-slate-200 bg-white p-2 text-xs">
          {codes.length ? (
            <ul className="space-y-1">
              {codes.map((code) => (
                <li key={code} className="break-all text-slate-700">
                  {code}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-slate-400">Пока нет кодов</div>
          )}
        </div>
      </div>
    </div>
  )
}
