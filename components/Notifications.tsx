import { createClient } from '@/utils/supabase/server'
import type { Dictionary } from '@/dictionaries'
import { intlLocale } from '@/lib/i18n'
import { texteNotification, type NotificationBrute } from '@/lib/notifications'
import NotificationsMenu from './NotificationsMenu'

// Cloche de notifications (personnel et familles) : 20 dernières, non lues en tête.
export default async function Notifications({ dict, locale }: { dict: Dictionary; locale: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('notifications')
    .select('id, type, params, lien, lu_le, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)
  const loc = intlLocale(locale)
  const items = ((data ?? []) as NotificationBrute[]).map((n) => ({
    id: n.id,
    texte: texteNotification(n, dict, loc),
    type: n.type,
    lien: n.lien,
    lu: n.lu_le !== null,
    quand: new Date(n.created_at).toLocaleString(loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
  }))
  return <NotificationsMenu items={items} libelles={{ titre: dict.notifications.titre, vide: dict.notifications.vide }} />
}
