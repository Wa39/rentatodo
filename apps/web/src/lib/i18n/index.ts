import { en } from './en'

export type Translations = typeof en

const translations: Record<'en', Translations> = { en }

export function useTranslation(): Translations {
  return translations.en
}
