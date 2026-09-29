import type { Dictionary } from '@/dictionaries'
import { fmt } from '@/lib/i18n'

// Notifications stockées en type + paramètres (triggers de 08_modules.sql),
// traduites à l'affichage dans la langue du lecteur.
export type NotificationBrute = { id: string; type: string; params: Record<string, unknown>; lien: string | null; lu_le: string | null; created_at: string }

export function texteNotification(n: NotificationBrute, dict: Dictionary, locale: string) {
  const t = dict.notifications
  const p = n.params ?? {}
  const s = (k: string) => String(p[k] ?? '')
  const date = (v: string) => (v ? new Date(v + 'T00:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '')
  switch (n.type) {
    case 'absence':
      return fmt(s('type') === 'retard' ? t.retard : t.absence, { eleve: s('eleve'), date: date(s('date')), duree: s('duree') })
    case 'note':
      return fmt(t.note, { eleve: s('eleve'), matiere: s('matiere'), evaluation: s('evaluation') })
    case 'annonce':
      return fmt(t.annonce, { titre: s('titre') })
    default:
      return t.autre
  }
}
