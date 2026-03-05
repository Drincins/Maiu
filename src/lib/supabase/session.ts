type CookieEntry = {
  name: string
  value: string
}

type CookieStoreLike = {
  getAll(): CookieEntry[]
}

type SessionLike = {
  access_token?: unknown
  user?: {
    id?: unknown
    email?: unknown
  }
}

type JwtPayloadLike = {
  sub?: unknown
  email?: unknown
}

export type SupabaseCookieUser = {
  id: string | null
  email: string | null
}

const AUTH_COOKIE_RE = /-auth-token(?:\.(\d+))?$/
const BASE64_PREFIX = 'base64-'

const decodeBase64Url = (value: string) => {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return Buffer.from(padded, 'base64').toString('utf8')
  } catch {
    return null
  }
}

const parseSessionValue = (value: string): SessionLike | null => {
  const raw = value.startsWith(BASE64_PREFIX)
    ? decodeBase64Url(value.slice(BASE64_PREFIX.length))
    : value

  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as SessionLike) : null
  } catch {
    return null
  }
}

const decodeJwtPayload = (accessToken: string): JwtPayloadLike | null => {
  const [, payloadPart] = accessToken.split('.')
  if (!payloadPart) return null

  const payloadJson = decodeBase64Url(payloadPart)
  if (!payloadJson) return null

  try {
    const parsed = JSON.parse(payloadJson)
    return typeof parsed === 'object' && parsed !== null ? (parsed as JwtPayloadLike) : null
  } catch {
    return null
  }
}

const extractSessionFromCookies = (cookies: CookieEntry[]): SessionLike | null => {
  const grouped = new Map<string, Array<{ index: number; value: string }>>()

  cookies.forEach(({ name, value }) => {
    const match = name.match(AUTH_COOKIE_RE)
    if (!match) return

    const chunkIndex = match[1] ? Number.parseInt(match[1], 10) : -1
    const baseName = match[1] ? name.replace(/\.\d+$/, '') : name
    const chunks = grouped.get(baseName) ?? []
    chunks.push({ index: Number.isNaN(chunkIndex) ? -1 : chunkIndex, value })
    grouped.set(baseName, chunks)
  })

  for (const chunks of grouped.values()) {
    const hasChunkedValue = chunks.some((chunk) => chunk.index >= 0)
    const joinedValue = hasChunkedValue
      ? chunks
          .filter((chunk) => chunk.index >= 0)
          .sort((a, b) => a.index - b.index)
          .map((chunk) => chunk.value)
          .join('')
      : chunks[0]?.value ?? ''

    const session = parseSessionValue(joinedValue)
    if (session) return session
  }

  return null
}

export const getSupabaseUserFromCookies = (cookieStore: CookieStoreLike): SupabaseCookieUser => {
  const session = extractSessionFromCookies(cookieStore.getAll())
  if (!session) {
    return { id: null, email: null }
  }

  const accessToken =
    typeof session.access_token === 'string' ? session.access_token : null
  const payload = accessToken ? decodeJwtPayload(accessToken) : null

  const id =
    (typeof session.user?.id === 'string' && session.user.id) ||
    (typeof payload?.sub === 'string' && payload.sub) ||
    null
  const email =
    (typeof session.user?.email === 'string' && session.user.email) ||
    (typeof payload?.email === 'string' && payload.email) ||
    null

  return { id, email }
}
