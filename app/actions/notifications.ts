'use server'

import { createClient } from '@/utils/supabase/server'

// Marque comme lues les notifications de l'utilisateur connecté (RLS : les siennes seulement).
export async function marquerNotificationsLues() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('notifications').update({ lu_le: new Date().toISOString() }).eq('user_id', user.id).is('lu_le', null)
}
