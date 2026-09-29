'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { withRetry } from '@/utils/supabase/retry'
import { estPalierValide, estPlanValide } from '@/lib/abonnements/plans'
import { creerSouscriptionEtTranche1, lancerPaiement, telephoneValide } from '@/lib/abonnements/paiement'
import { getDictionary } from '@/dictionaries'

type Resultat = { checkoutUrl: string } | { error: string; versAbonnement?: true }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Un humain met plus de 3 s à remplir le formulaire ; un robot le soumet aussitôt.
const DELAI_MIN_MS = 3000

// Inscription en libre-service : crée l'établissement (référentiel du palier),
// le compte de la direction, ouvre sa session, puis lance le paiement de la
// tranche 1. Sans paiement confirmé, l'établissement reste en lecture seule
// (acces_etablissement()) : l'accès complet s'ouvre au crédit de la tranche.
export async function inscrire(formData: FormData): Promise<Resultat> {
  const dict = await getDictionary()
  const t = dict.tarifs
  const v = (n: string) => ((formData.get(n) as string | null) ?? '').trim()

  // Pot de miel : champ caché que seuls les robots remplissent.
  const ouvertLe = Number(formData.get('ouvert_le'))
  if (v('site_web') || !ouvertLe || Date.now() - ouvertLe < DELAI_MIN_MS) return { error: dict.errors.generic }

  const palier = v('palier')
  const plan = v('plan')
  const email = v('email').toLowerCase()
  const motDePasse = (formData.get('mot_de_passe') as string | null) ?? ''
  if (!v('nom_etablissement')) return { error: t.erreurs.nom }
  if (!v('nom')) return { error: t.erreurs.direction }
  if (!EMAIL.test(email)) return { error: dict.errors.emailInvalid }
  if (motDePasse.length < 8) return { error: dict.errors.passwordShort }
  if (!estPalierValide(palier)) return { error: dict.abonnement.erreurs.palier }
  if (!estPlanValide(plan)) return { error: dict.abonnement.erreurs.plan }
  if (!telephoneValide(v('pays'), v('telephone_paiement'))) return { error: dict.abonnement.erreurs.telephone }

  const admin = createAdminClient()

  const { data: compte, error: compteError } = await withRetry(() => admin.auth.admin.createUser({ email, password: motDePasse, email_confirm: true })).catch((e) => ({ data: null, error: e }))
  if (compteError || !compte?.user) {
    const deja = String(compteError?.message ?? '').toLowerCase().includes('already')
    if (!deja) console.error('inscrire(compte):', compteError?.message)
    return { error: deja ? t.erreurs.emailPris : dict.errors.generic }
  }

  const { data: etab, error: etabError } = await admin
    .from('etablissements')
    .insert({ nom: v('nom_etablissement').slice(0, 255), ville: v('ville') || null, telephone: v('telephone') || null, email, palier })
    .select('id, nom')
    .single()

  const annuler = async (etablissementId?: string) => {
    if (etablissementId) await admin.from('etablissements').delete().eq('id', etablissementId)
    await admin.auth.admin.deleteUser(compte.user.id)
  }

  if (etabError || !etab) {
    console.error('inscrire(etablissement):', etabError?.message)
    await annuler()
    return { error: dict.errors.generic }
  }

  const { error: refError } = await admin.rpc('initialiser_referentiel', { p_etablissement_id: etab.id })
  const { error: userError } = refError
    ? { error: refError }
    : await admin.from('utilisateurs').insert({ id: compte.user.id, etablissement_id: etab.id, role: 'direction', prenom: v('prenom') || null, nom: v('nom'), email })
  if (userError) {
    console.error('inscrire(direction):', userError.message)
    await annuler(etab.id)
    return { error: dict.errors.generic }
  }

  // Ouvre la session du directeur : le retour de paiement (/abonnement/retour)
  // exige un compte direction connecté.
  const supabase = await createClient()
  await supabase.auth.signInWithPassword({ email, password: motDePasse })

  const tranche = await creerSouscriptionEtTranche1(etab.id, palier, plan)
  const paiement =
    'erreur' in tranche
      ? tranche
      : await lancerPaiement({
          etablissementId: etab.id,
          etablissementNom: etab.nom,
          email,
          prenom: v('prenom'),
          nom: v('nom'),
          palier,
          echeance: tranche.echeance,
          pays: v('pays'),
          telephone: v('telephone_paiement'),
        })

  // L'espace existe et la session est ouverte : en cas d'échec du paiement, la
  // direction réessaie depuis /abonnement plutôt que de recréer un compte.
  if (!('checkoutUrl' in paiement)) return { error: t.erreurs.paiement, versAbonnement: true }
  return { checkoutUrl: paiement.checkoutUrl }
}
