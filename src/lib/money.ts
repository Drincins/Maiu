export function formatMoney(value?: number | null) {
  const amount = (value ?? 0) / 100
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB'
  }).format(amount)
}

export function moneyToInt(input: string | number | null | undefined) {
  if (input === null || input === undefined) return 0
  if (typeof input === 'number') return Math.round(input * 100)
  const normalized = input.replace(',', '.').replace(/\s/g, '')
  const value = Number.parseFloat(normalized)
  if (Number.isNaN(value)) return 0
  return Math.round(value * 100)
}

export function intToMoneyInput(value?: number | null) {
  if (value === null || value === undefined) return ''
  return (value / 100).toFixed(2)
}
