'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { chiffres, emailTechnique } from '@/lib/famille'
import { getDictionary } from '@/dictionaries'

type Resultat = { error?: string }

// Activation d'un accès famille avec le code remis par le secrétariat (sans SMS
// ni email) : crée le compte (email réel, ou email technique dérivé du
// téléphone), le relie à l'élève, consomme le code puis ouvre la session.
// Un parent qui a déjà un compte saisit son mot de passe : l'enfant est ajouté.
export async function activerCompte(formData: FormData): Promise<Resultat> {
  const dict = await getDictionary()
  const t = dict.activation
  const v = (n: string) => ((formData.get(n) as string | null) ?? '').trim()
  const code = v('code').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const email = v('email').toLowerCase()
  const telephone = v('telephone')
  const password = (formData.get('password') as string | null) ?? ''

  if (!code) return { error: t.codeRequis }
  if (!email && chiffres(telephone).length < 8) return { error: t.identifiantRequis }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: t.emailInvalide }
  if (password.length < 8) return { error: t.motDePasseCourt }
  const identifiant = email || emailTechnique(telephone)

  const admin = createAdminClient()
  const maintenant = new Date().toISOString()
  // Réservation atomique du code (un seul usage).
  const { data: reserve } = await admin
    .from('codes_activation')
    .update({ utilise_le: maintenant })
    .eq('code', code)
    .is('utilise_le', null)
    .gt('expire_le', maintenant)
    .select('code, etablissement_id, eleve_id, type, lien')
    .maybeSingle()
  if (!reserve) return { error: t.codeInvalide }
  const liberer = async (message: string) => {
    await admin.from('codes_activation').update({ utilise_le: null }).eq('code', code)
    return { error: message }
  }

  // Compte : création, ou compte existant vérifié par son mot de passe.
  let userId: string
  const creation = await admin.auth.admin.createUser({ email: identifiant, password, email_confirm: true })
  if (creation.data.user) {
    userId = creation.data.user.id
  } else {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email: identifiant, password })
    if (error || !data.user) return liberer(t.compteExistant)
    userId = data.user.id
  }

  const [{ data: personnel }, { data: compte }] = await Promise.all([
    admin.from('utilisateurs').select('id').eq('id', userId).maybeSingle(),
    admin.from('comptes_famille').select('id, type, etablissement_id').eq('id', userId).maybeSingle(),
  ])
  if (personnel) return liberer(t.comptePersonnel)
  if (compte && (compte.etablissement_id !== reserve.etablissement_id || compte.type !== reserve.type || reserve.type === 'eleve')) return liberer(t.compteIncompatible)

  if (!compte) {
    const { error } = await admin.from('comptes_famille').insert({
      id: userId,
      etablissement_id: reserve.etablissement_id,
      type: reserve.type,
      prenom: v('prenom').slice(0, 100) || null,
      nom: v('nom').slice(0, 100) || null,
      telephone: telephone.slice(0, 30) || null,
      email: email || null,
      eleve_id: reserve.type === 'eleve' ? reserve.eleve_id : null,
    })
    if (error) return liberer(dict.errors.generic)
  }
  if (reserve.type === 'parent') {
    const { error } = await admin.from('liens_famille').upsert({ compte_id: userId, eleve_id: reserve.eleve_id, lien: reserve.lien }, { onConflict: 'compte_id,eleve_id' })
    if (error) return liberer(dict.errors.generic)
  }
  await admin.from('codes_activation').update({ compte_id: userId }).eq('code', code)

  const supabase = await createClient()
  await supabase.auth.signInWithPassword({ email: identifiant, password })
  redirect('/portail')
}
