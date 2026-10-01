'use server'

import { randomBytes } from 'node:crypto'
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
  parent: 'demo.parent@dembasolution.com',
  dg: 'demo.dg@dembasolution.com',
  eleve: 'demo.eleve@dembasolution.com',
} as const

const echec: () => never = () => redirect('/decouvrir-dscholar?demo_error=1')

// Compte élève de la démonstration, créé au premier clic (les démos créées avant
// son ajout n'en ont pas) : rattaché à l'aîné des enfants du parent de démo
// (1re S, au-dessus du niveau minimal d'un compte élève, la 6e). Un compte élève
// ne voit que lui-même (mes_eleves(), 08_modules.sql) et pas les paiements.
async function assurerCompteEleveDemo(admin: ReturnType<typeof createAdminClient>): Promise<boolean> {
  const email = COMPTES_DEMO.eleve
  const { data: existant } = await admin.from('comptes_famille').select('id').eq('email', email).maybeSingle()
  if (existant) return true

  const { data: parent } = await admin.from('comptes_famille').select('id, etablissement_id').eq('email', COMPTES_DEMO.parent).maybeSingle()
  if (!parent) return false
  const { data: liens } = await admin.from('liens_famille').select('eleve_id').eq('compte_id', parent.id)
  const ids = (liens ?? []).map((l) => l.eleve_id)
  if (ids.length === 0) return false
  const { data: aine } = await admin
    .from('eleves')
    .select('id, prenom, nom')
    .in('id', ids)
    .order('date_naissance', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!aine) return false

  // Le compte auth peut survivre à une démo supprimée puis recréée : on le réutilise.
  let userId: string | undefined
  const { data: cree } = await admin.auth.admin.createUser({ email, password: randomBytes(24).toString('base64url'), email_confirm: true })
  userId = cree?.user?.id
  if (!userId) {
    const { data: lien } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    userId = lien?.user?.id
  }
  if (!userId) return false

  const { error } = await admin.from('comptes_famille').insert({
    id: userId,
    etablissement_id: parent.etablissement_id,
    type: 'eleve',
    prenom: aine.prenom,
    nom: aine.nom,
    email,
    eleve_id: aine.id,
  })
  if (error) console.error('Création du compte élève de démonstration :', error)
  return !error
}

export async function connexionDemo(formData: FormData) {
  const role = String(formData.get('role') ?? '') as keyof typeof COMPTES_DEMO
  const email = COMPTES_DEMO[role]
  if (!email) echec()

  const admin = createAdminClient()
  if (role === 'eleve' && !(await withRetry(() => assurerCompteEleveDemo(admin)).catch(() => false))) echec()
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

  // Directeur général : synthèse du groupe (3 sites).
  if (role === 'dg') {
    revalidatePath('/', 'layout')
    redirect('/groupe')
  }

  // Parent ou élève : directement sur le portail des familles.
  if (role === 'parent' || role === 'eleve') {
    revalidatePath('/', 'layout')
    redirect('/portail')
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
