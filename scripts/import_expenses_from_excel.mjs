#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'

const REQUIRED_ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
]

const FIELD_ALIASES = {
  date: ['date', 'дата', 'occurred_at', 'дата операции'],
  amount: ['amount', 'сумма', 'sum', 'сумма руб', 'amount_rub'],
  category: ['category', 'категория', 'expense_category', 'категория расхода'],
  payment_source: ['payment_source', 'источник', 'источник оплаты', 'счет', 'счёт'],
  legal_entity: ['legal_entity', 'юрлицо', 'юридическое лицо', 'компания'],
  counterparty: ['counterparty', 'контрагент'],
  note: ['note', 'комментарий', 'описание', 'примечание'],
  type: ['type', 'тип']
}

function printUsage() {
  console.log(`Usage:
  node scripts/import_expenses_from_excel.mjs --file <path.xlsx> --user <user_uuid> [--sheet <name>] [--commit] [--autocreate]

Options:
  --file <path>       Path to .xlsx file (required)
  --user <uuid>       Target user_id in Supabase (required)
  --sheet <name>      Sheet name (default: first sheet)
  --commit            Actually insert rows (default: dry-run)
  --autocreate        Auto-create missing categories/payment sources/legal entities/counterparties
  --help              Show this message

Expected headers (any subset of aliases is supported):
  date, amount, category, payment_source, legal_entity, counterparty, note, type
`)
}

function parseArgs(argv) {
  const args = {
    file: '',
    user: '',
    sheet: '',
    commit: false,
    autocreate: false,
    help: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]
    if (arg === '--file' && next) {
      args.file = next
      i += 1
      continue
    }
    if (arg === '--user' && next) {
      args.user = next
      i += 1
      continue
    }
    if (arg === '--sheet' && next) {
      args.sheet = next
      i += 1
      continue
    }
    if (arg === '--commit') {
      args.commit = true
      continue
    }
    if (arg === '--autocreate') {
      args.autocreate = true
      continue
    }
    if (arg === '--help' || arg === '-h') {
      args.help = true
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  return args
}

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/\s+/g, ' ')
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const content = fs.readFileSync(filePath, 'utf8')
  const result = {}
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex <= 0) continue
    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

function getEnv() {
  const cwd = process.cwd()
  const envLocal = readEnvFile(path.join(cwd, '.env.local'))
  const envExample = readEnvFile(path.join(cwd, '.env.example'))
  const merged = {
    ...envExample,
    ...envLocal,
    ...process.env
  }
  for (const key of REQUIRED_ENV_KEYS) {
    if (!merged[key]) {
      throw new Error(`Missing env var: ${key}`)
    }
  }
  return merged
}

function getFieldValue(row, aliases) {
  const entries = Object.entries(row)
  for (const [rawKey, rawValue] of entries) {
    const normalizedKey = normalizeHeader(rawKey)
    if (aliases.some((alias) => normalizedKey === normalizeHeader(alias))) {
      return rawValue
    }
  }
  return null
}

function parseDateToIso(value) {
  if (value === null || value === undefined || value === '') return null

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const yyyy = value.getFullYear()
    const mm = String(value.getMonth() + 1).padStart(2, '0')
    const dd = String(value.getDate()).padStart(2, '0')
    return new Date(`${yyyy}-${mm}-${dd}T12:00:00`).toISOString()
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed?.y && parsed?.m && parsed?.d) {
      const yyyy = String(parsed.y)
      const mm = String(parsed.m).padStart(2, '0')
      const dd = String(parsed.d).padStart(2, '0')
      return new Date(`${yyyy}-${mm}-${dd}T12:00:00`).toISOString()
    }
  }

  const raw = String(value).trim()
  if (!raw) return null

  const isoLike = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoLike) {
    return new Date(`${isoLike[1]}-${isoLike[2]}-${isoLike[3]}T12:00:00`).toISOString()
  }

  const dotLike = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (dotLike) {
    const dd = dotLike[1].padStart(2, '0')
    const mm = dotLike[2].padStart(2, '0')
    const yyyy = dotLike[3]
    return new Date(`${yyyy}-${mm}-${dd}T12:00:00`).toISOString()
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear()
    const mm = String(parsed.getMonth() + 1).padStart(2, '0')
    const dd = String(parsed.getDate()).padStart(2, '0')
    return new Date(`${yyyy}-${mm}-${dd}T12:00:00`).toISOString()
  }

  return null
}

function parseAmountToKopecks(value) {
  if (value === null || value === undefined || value === '') return null

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100)
  }

  const normalized = String(value)
    .trim()
    .replace(/\s+/g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '')

  if (!normalized) return null
  const numeric = Number(normalized)
  if (!Number.isFinite(numeric)) return null
  return Math.round(numeric * 100)
}

function normalizeType(value) {
  const source = String(value ?? '').trim().toLowerCase()
  if (!source) return 'expense'
  if (['expense', 'расход', 'расходы'].includes(source)) return 'expense'
  if (['income', 'доход', 'доходы'].includes(source)) return 'income'
  return null
}

async function loadReferenceMaps(supabase, userId) {
  const [
    { data: categories, error: categoriesError },
    { data: paymentSources, error: paymentError },
    { data: legalEntities, error: legalError },
    { data: counterparties, error: counterpartyError }
  ] = await Promise.all([
    supabase
      .from('expense_categories')
      .select('id, name, kind')
      .eq('user_id', userId),
    supabase
      .from('payment_sources')
      .select('id, name')
      .eq('user_id', userId),
    supabase
      .from('legal_entities')
      .select('id, name')
      .eq('user_id', userId),
    supabase
      .from('counterparties')
      .select('id, name')
      .eq('user_id', userId)
  ])

  if (categoriesError) throw new Error(`Failed to load categories: ${categoriesError.message}`)
  if (paymentError) throw new Error(`Failed to load payment sources: ${paymentError.message}`)
  if (legalError) throw new Error(`Failed to load legal entities: ${legalError.message}`)
  if (counterpartyError) {
    throw new Error(`Failed to load counterparties: ${counterpartyError.message}`)
  }

  const categoryMap = new Map()
  for (const row of categories ?? []) {
    categoryMap.set(`${row.kind}|${normalizeName(row.name)}`, row.id)
  }

  const paymentSourceMap = new Map()
  for (const row of paymentSources ?? []) {
    paymentSourceMap.set(normalizeName(row.name), row.id)
  }

  const legalEntityMap = new Map()
  for (const row of legalEntities ?? []) {
    legalEntityMap.set(normalizeName(row.name), row.id)
  }

  const counterpartyMap = new Map()
  for (const row of counterparties ?? []) {
    counterpartyMap.set(normalizeName(row.name), row.id)
  }

  return { categoryMap, paymentSourceMap, legalEntityMap, counterpartyMap }
}

async function ensureReferenceId({
  label,
  sourceName,
  map,
  autocreate,
  createFn,
  keyBuilder = normalizeName
}) {
  if (!sourceName) return null
  const key = keyBuilder(sourceName)
  const existing = map.get(key)
  if (existing) return existing
  if (!autocreate) {
    throw new Error(`${label} not found: "${sourceName}"`)
  }
  const createdId = await createFn(sourceName.trim())
  map.set(key, createdId)
  return createdId
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help || !args.file || !args.user) {
    printUsage()
    if (!args.help) process.exitCode = 1
    return
  }

  const absoluteFile = path.resolve(process.cwd(), args.file)
  if (!fs.existsSync(absoluteFile)) {
    throw new Error(`File not found: ${absoluteFile}`)
  }

  const env = getEnv()
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )

  const workbook = XLSX.readFile(absoluteFile, { cellDates: true })
  const targetSheetName = args.sheet || workbook.SheetNames[0]
  if (!targetSheetName) {
    throw new Error('Workbook does not contain sheets')
  }
  const worksheet = workbook.Sheets[targetSheetName]
  if (!worksheet) {
    throw new Error(`Sheet not found: ${targetSheetName}`)
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    defval: null,
    raw: true
  })

  if (!rows.length) {
    throw new Error('No data rows found in the sheet')
  }

  const refs = await loadReferenceMaps(supabase, args.user)

  const payload = []
  const errors = []

  const createCategory = async (name) => {
    const { data, error } = await supabase
      .from('expense_categories')
      .insert({ user_id: args.user, name, kind: 'expense' })
      .select('id')
      .single()
    if (error) throw new Error(`Failed to create category "${name}": ${error.message}`)
    return data.id
  }

  const createPaymentSource = async (name) => {
    const { data, error } = await supabase
      .from('payment_sources')
      .insert({ user_id: args.user, name, type: 'other' })
      .select('id')
      .single()
    if (error) throw new Error(`Failed to create payment source "${name}": ${error.message}`)
    return data.id
  }

  const createLegalEntity = async (name) => {
    const { data, error } = await supabase
      .from('legal_entities')
      .insert({ user_id: args.user, name })
      .select('id')
      .single()
    if (error) throw new Error(`Failed to create legal entity "${name}": ${error.message}`)
    return data.id
  }

  const createCounterparty = async (name) => {
    const { data, error } = await supabase
      .from('counterparties')
      .insert({ user_id: args.user, name, type: 'other' })
      .select('id')
      .single()
    if (error) throw new Error(`Failed to create counterparty "${name}": ${error.message}`)
    return data.id
  }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowNumber = index + 2

    try {
      const occurredAtRaw = getFieldValue(row, FIELD_ALIASES.date)
      const amountRaw = getFieldValue(row, FIELD_ALIASES.amount)
      const categoryRaw = getFieldValue(row, FIELD_ALIASES.category)
      const paymentSourceRaw = getFieldValue(row, FIELD_ALIASES.payment_source)
      const legalEntityRaw = getFieldValue(row, FIELD_ALIASES.legal_entity)
      const counterpartyRaw = getFieldValue(row, FIELD_ALIASES.counterparty)
      const noteRaw = getFieldValue(row, FIELD_ALIASES.note)
      const typeRaw = getFieldValue(row, FIELD_ALIASES.type)

      const occurredAt = parseDateToIso(occurredAtRaw)
      if (!occurredAt) throw new Error(`Invalid date: "${occurredAtRaw}"`)

      const amount = parseAmountToKopecks(amountRaw)
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(`Invalid amount: "${amountRaw}"`)
      }

      const type = normalizeType(typeRaw)
      if (!type) throw new Error(`Unsupported type: "${typeRaw}"`)
      if (type !== 'expense') {
        throw new Error(`Only expense rows are supported by this script (got "${typeRaw}")`)
      }

      const categoryName = String(categoryRaw ?? '').trim()
      const paymentSourceName = String(paymentSourceRaw ?? '').trim()
      const legalEntityName = String(legalEntityRaw ?? '').trim()
      const counterpartyName = String(counterpartyRaw ?? '').trim()
      const note = String(noteRaw ?? '').trim() || null

      const categoryId = await ensureReferenceId({
        label: 'Category',
        sourceName: categoryName,
        map: refs.categoryMap,
        autocreate: args.autocreate,
        createFn: createCategory,
        keyBuilder: (name) => `expense|${normalizeName(name)}`
      })
      const paymentSourceId = await ensureReferenceId({
        label: 'Payment source',
        sourceName: paymentSourceName,
        map: refs.paymentSourceMap,
        autocreate: args.autocreate,
        createFn: createPaymentSource
      })
      const legalEntityId = await ensureReferenceId({
        label: 'Legal entity',
        sourceName: legalEntityName,
        map: refs.legalEntityMap,
        autocreate: args.autocreate,
        createFn: createLegalEntity
      })
      const counterpartyId = await ensureReferenceId({
        label: 'Counterparty',
        sourceName: counterpartyName,
        map: refs.counterpartyMap,
        autocreate: args.autocreate,
        createFn: createCounterparty
      })

      payload.push({
        user_id: args.user,
        occurred_at: occurredAt,
        type: 'expense',
        amount,
        category_id: categoryId,
        payment_source_id: paymentSourceId,
        legal_entity_id: legalEntityId,
        counterparty_id: counterpartyId,
        note
      })
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : String(error)
      })
    }
  }

  console.log(`Sheet: ${targetSheetName}`)
  console.log(`Rows read: ${rows.length}`)
  console.log(`Valid rows: ${payload.length}`)
  console.log(`Errors: ${errors.length}`)
  console.log(`Mode: ${args.commit ? 'COMMIT' : 'DRY-RUN'}`)

  if (errors.length) {
    console.log('\nValidation errors:')
    for (const item of errors.slice(0, 20)) {
      console.log(`- row ${item.row}: ${item.message}`)
    }
    if (errors.length > 20) {
      console.log(`... and ${errors.length - 20} more`)
    }
  }

  if (!payload.length) {
    throw new Error('No valid rows to import')
  }

  if (!args.commit) {
    console.log('\nPreview of first rows:')
    console.log(JSON.stringify(payload.slice(0, 5), null, 2))
    console.log('\nDry-run complete. Re-run with --commit to insert rows.')
    return
  }

  const batchSize = 200
  let inserted = 0
  for (let offset = 0; offset < payload.length; offset += batchSize) {
    const batch = payload.slice(offset, offset + batchSize)
    const { error } = await supabase.from('finance_transactions').insert(batch)
    if (error) {
      throw new Error(`Insert failed at batch starting ${offset + 1}: ${error.message}`)
    }
    inserted += batch.length
  }

  console.log(`\nInserted rows: ${inserted}`)
}

main().catch((error) => {
  console.error(`\nImport failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
