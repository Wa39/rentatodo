import { describe, expect, it } from 'vitest'
import { mockEarnings, mockItems, mockRequests, mockTransactions, mockUser } from './mockData'

const CATEGORIES = ['tools', 'photography', 'camping', 'sports', 'electronics', 'home']
const RESERVATION_STATUSES = ['requested', 'approved', 'delivered', 'returned', 'closed', 'rejected', 'cancelled']

describe('mockData', () => {
  it('mockUser has a valid shape', () => {
    expect(mockUser.email).toContain('@')
  })

  it('mockItems includes at least one inactive item', () => {
    expect(mockItems.some((item) => !item.is_active)).toBe(true)
  })

  it('every mock item has an allowed category and an integer price', () => {
    for (const item of mockItems) {
      expect(CATEGORIES).toContain(item.category)
      expect(Number.isInteger(item.price_per_day)).toBe(true)
    }
  })

  it('every mock request has an allowed reservation status', () => {
    for (const reservation of mockRequests) {
      expect(RESERVATION_STATUSES).toContain(reservation.status)
    }
  })

  it('mockTransactions and mockEarnings amounts are integers (centavos)', () => {
    for (const tx of mockTransactions) {
      expect(Number.isInteger(tx.amount)).toBe(true)
    }
    expect(Number.isInteger(mockEarnings.total_earnings)).toBe(true)
  })

  it('mockEarnings.by_month has 6 integer entries summing to total_earnings', () => {
    expect(mockEarnings.by_month).toHaveLength(6)
    for (const entry of mockEarnings.by_month) {
      expect(Number.isInteger(entry.total)).toBe(true)
    }
    const sum = mockEarnings.by_month.reduce((acc, entry) => acc + entry.total, 0)
    expect(sum).toBe(mockEarnings.total_earnings)
  })
})
