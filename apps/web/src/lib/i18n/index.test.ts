import { describe, expect, it } from 'vitest'
import { useTranslation } from './index'

describe('useTranslation', () => {
  it('defaults to the English dictionary', () => {
    const t = useTranslation()
    expect(t.login.submit).toBe('Sign in')
  })

  it('returns the English dictionary when locale is explicitly "en"', () => {
    const t = useTranslation('en')
    expect(t.nav.overview).toBe('Overview')
  })

  it('has an English label for every category, including the new "other" value', () => {
    const t = useTranslation()
    expect(t.categories.other).toBe('Other')
    expect(Object.keys(t.categories)).toHaveLength(7)
  })

  it('has the new nav, item-card, calendar, items, publish, requests, and earnings keys', () => {
    const t = useTranslation()
    expect(t.nav.calendar).toBe('Calendar')
    expect(t.nav.earnedThisMonth).toBe('Earned this month')
    expect(t.calendar.legend.pending).toBe('Pending')
    expect(t.items.title).toBe('My items')
    expect(t.publish.submit).toBe('Publish item')
    expect(t.requests.tabPending).toBe('Pending')
    expect(t.earnings.kpiTotal).toBe('Total earned')
    expect(t.earnings.reservationCount(1)).toBe('1 closed reservation')
    expect(t.earnings.reservationCount(3)).toBe('3 closed reservations')
  })
})
