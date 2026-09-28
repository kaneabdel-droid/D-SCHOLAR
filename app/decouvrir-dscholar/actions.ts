'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { withRetry } from '@/utils/supabase/retry'

// Comptes publics de l'établissement de démonstration (07_demo.sql, créés par
// « Créer la démo » dans /admin). Même mécanisme que D-AGROBUSINESS :
// generateLink() + verifyOtp() côté serveur avec la clé de service — aucun mot
// de passe n'est transmis au visiteur, et chaque clic ouvre sa propre session.
const COMPTES_DEMO = {
  direction: 'demo.direction@dembasolution.com',
  enseignant: 'demo.ndiaye@dembasolution.com',
} as const

const echec: () => never = () => redirect('/decouvrir-dscholar?demo_error=1')

export async function connexionDemo(formData: FormData) {
  const role = String(formData.get('role') ?? '') as keyof typeof COMPTES_DEMO
  const email = COMPTES_DEMO[role]
  if (!email) echec()

  const admin = createAdminClient()
  const { data, error } = await withRetry(() => admin.auth.admin.generateLink({ type: 'magiclink', email })).catch((e) => ({ data: null, error: e }))
  const jeton = data?.properties?.hashed_token
  if (error || !jeton) {
    console.error('Erreur génération du lien de démonstration :', error)
    echec()
  }

  const supabase = await createClient()
  const { error: erreurVerification } = await withRetry(() => supabase.auth.verifyOtp({ token_hash: jeton, type: 'magiclink' })).catch((e) => ({ error: e }))
  if (erreurVerification) {
    console.error('Erreur de connexion à la démonstration :', erreurVerification)
    echec()
  }

  // Les données complètes (notes, décisions) sont sur la dernière année clôturée.
  const { data: annee } = await supabase
    .from('annees_scolaires')
    .select('id')
    .eq('cloturee', true)
    .order('date_debut', { ascending: false })
    .limit(1)
    .maybeSingle()

  revalidatePath('/', 'layout')
  redirect(annee ? `/classes?annee=${annee.id}` : '/dashboard')
}
