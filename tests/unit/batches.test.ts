import test from 'node:test'
import assert from 'node:assert/strict'
import { chunkItems } from '../../src/lib/batches'

test('chunkItems splits long lists into stable batches', () => {
  assert.deepEqual(chunkItems([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
})

test('chunkItems rejects invalid chunk size', () => {
  assert.throws(() => chunkItems([1], 0), /greater than 0/)
})
