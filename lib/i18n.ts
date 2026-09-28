import type { Locale } from '@/dictionaries'

// Remplace les {variables} d'un libellé de dictionnaire.
export function fmt(texte: string, vars: Record<string, string | number>): string {
  return texte.replace(/\{(\w+)\}/g, (_, cle: string) => String(vars[cle] ?? `{${cle}}`))
}

// Locale BCP 47 pour les dates et nombres (arabe : chiffres occidentaux, usage
// courant au Maghreb et en Afrique de l'Ouest).
export function intlLocale(locale: Locale | string): string {
  if (locale === 'ar') return 'ar-u-nu-latn'
  if (locale === 'en') return 'en-GB'
  return 'fr-FR'
}
