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
})
