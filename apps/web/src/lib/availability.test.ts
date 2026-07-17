import { describe, expect, it } from 'vitest'
import { getItemDateStates } from './availability'
import { mockItems, mockRequests } from './mockData'

describe('getItemDateStates', () => {
  it('classifies a requested reservation as pending', () => {
    const itemId = mockItems[0].id
    const states = getItemDateStates(itemId, mockRequests)
    const pending = mockRequests.find((r) => r.item_id === itemId && r.status === 'requested')!
    expect(states).toContainEqual({
      start_date: pending.start_date,
      end_date: pending.end_date,
      state: 'pending',
    })
  })

  it('classifies approved/delivered/returned reservations as reserved', () => {
    const itemId = mockItems[1].id
    const states = getItemDateStates(itemId, mockRequests)
    const reserved = mockRequests.find((r) => r.item_id === itemId && r.status === 'delivered')!
    expect(states).toContainEqual({
      start_date: reserved.start_date,
      end_date: reserved.end_date,
      state: 'reserved',
    })
  })

  it('excludes closed, rejected, and cancelled reservations', () => {
    const itemId = mockItems[0].id
    const states = getItemDateStates(itemId, mockRequests)
    const excluded = mockRequests.filter(
      (r) => r.item_id === itemId && ['closed', 'rejected', 'cancelled'].includes(r.status),
    )
    for (const reservation of excluded) {
      expect(states).not.toContainEqual(
        expect.objectContaining({ start_date: reservation.start_date, end_date: reservation.end_date }),
      )
    }
  })

  it('excludes reservations for other items', () => {
    expect(getItemDateStates('nonexistent-item-id', mockRequests)).toHaveLength(0)
  })
})
