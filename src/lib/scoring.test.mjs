import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { scoreMatch } from './scoring.ts'

const person = (overrides = {}) => ({
  id: 'one',
  city: 'Bengaluru',
  areas: ['Indiranagar'],
  budget_min: 10000,
  budget_max: 20000,
  move_in_date: '2026-12-01',
  room_type: 'private',
  lifestyle: { smoking: 'no', work: 'hybrid' },
  ...overrides,
})

describe('scoreMatch', () => {
  it('returns the deterministic maximum when all factors align', () => {
    assert.deepEqual(scoreMatch(person(), person({ id: 'two' })), {
      budget: 25, location: 20, lifestyle: 30, moveIn: 15, roomType: 10, total: 100,
    })
  })

  it('gives zero for non-overlapping budget and different city', () => {
    const result = scoreMatch(person(), person({ city: 'Mumbai', budget_min: 50000, budget_max: 60000 }))
    assert.equal(result.budget, 0)
    assert.equal(result.location, 0)
  })

  it('scores missing information as zero instead of inventing compatibility', () => {
    const result = scoreMatch(person(), person({ budget_min: null, budget_max: null, lifestyle: {}, move_in_date: null, room_type: null }))
    assert.deepEqual(result, { budget: 0, location: 20, lifestyle: 0, moveIn: 0, roomType: 0, total: 20 })
  })

  it('treats an either-room preference as compatible with a specified room type', () => {
    assert.equal(scoreMatch(person({ room_type: 'either' }), person({ room_type: 'shared' })).roomType, 10)
  })
})
