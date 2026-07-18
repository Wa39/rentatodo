import { en } from './en'

export type Translations = typeof en

const translations: Record<'en', Translations> = { en }

export function useTranslation(locale: keyof typeof translations = 'en'): Translations {
  return translations[locale]
}
