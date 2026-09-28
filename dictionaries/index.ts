import { cookies } from 'next/headers'

const dictionaries = {
  fr: () => import('./fr.json').then((module) => module.default),
  en: () => import('./en.json').then((module) => module.default),
  ar: () => import('./ar.json').then((module) => module.default),
}

export type Locale = keyof typeof dictionaries
export const locales: Locale[] = ['fr', 'en', 'ar']
export const defaultLocale: Locale = 'fr'

export const getDictionary = async (locale?: Locale) => {
  if (!locale) {
    const cookieStore = await cookies()
    const cookieLocale = cookieStore.get('lang')?.value as Locale
    locale = locales.includes(cookieLocale) ? cookieLocale : defaultLocale
  }
  return dictionaries[locale]()
}

export type Dictionary = Awaited<ReturnType<typeof getDictionary>>

export const getLocale = async () => {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get('lang')?.value as Locale
  return locales.includes(cookieLocale) ? cookieLocale : defaultLocale
}
