import { describe, expect, it } from 'vitest'
import { mockEarnings, mockItemDetail, mockItems, mockRequests, mockTransactions, mockUser } from './mockData'

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

  it('mockItemDetail returns unavailable_dates for a known item id', () => {
    const detail = mockItemDetail(mockItems[0].id)
    expect(detail?.unavailable_dates.length).toBeGreaterThan(0)
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
})
