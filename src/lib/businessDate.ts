const MOSCOW_UTC_OFFSET_MINUTES = 180

type Boundary = 'start' | 'end'

const parseBusinessDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = Date.UTC(year, month - 1, day)
  const parsed = new Date(utc)

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null
  }

  return { year, month, day }
}

const pad = (value: number) => String(value).padStart(2, '0')

export function getBusinessToday(now = new Date()) {
  const shifted = new Date(now.getTime() + MOSCOW_UTC_OFFSET_MINUTES * 60 * 1000)
  return [
    shifted.getUTCFullYear(),
    pad(shifted.getUTCMonth() + 1),
    pad(shifted.getUTCDate())
  ].join('-')
}

export function toBusinessDateBoundaryIso(value: string | null, boundary: Boundary) {
  if (!value) return null

  const parsed = parseBusinessDate(value)
  if (!parsed) return null

  const hour = boundary === 'start' ? 0 : 23
  const minute = boundary === 'start' ? 0 : 59
  const second = boundary === 'start' ? 0 : 59
  const millisecond = boundary === 'start' ? 0 : 999
  const utcMs =
    Date.UTC(parsed.year, parsed.month - 1, parsed.day, hour, minute, second, millisecond) -
    MOSCOW_UTC_OFFSET_MINUTES * 60 * 1000

  return new Date(utcMs).toISOString()
}
