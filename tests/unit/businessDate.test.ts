import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getBusinessToday,
  toBusinessDateBoundaryIso
} from '../../src/lib/businessDate'

test('getBusinessToday returns Moscow calendar date instead of UTC date', () => {
  const utcEvening = new Date('2026-05-24T22:30:00.000Z')

  assert.equal(getBusinessToday(utcEvening), '2026-05-25')
})

test('toBusinessDateBoundaryIso converts Moscow day start and end to UTC boundaries', () => {
  assert.equal(
    toBusinessDateBoundaryIso('2026-05-25', 'start'),
    '2026-05-24T21:00:00.000Z'
  )
  assert.equal(
    toBusinessDateBoundaryIso('2026-05-25', 'end'),
    '2026-05-25T20:59:59.999Z'
  )
})

test('toBusinessDateBoundaryIso returns null for invalid dates', () => {
  assert.equal(toBusinessDateBoundaryIso('', 'start'), null)
  assert.equal(toBusinessDateBoundaryIso('not-a-date', 'end'), null)
  assert.equal(toBusinessDateBoundaryIso('2026-02-31', 'start'), null)
})
