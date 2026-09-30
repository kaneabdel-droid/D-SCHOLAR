'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { getGroupeContext } from '@/lib/auth/getGroupeContext'
import { PALIER_CODES, type PalierCode } from '@/lib/abonnements/paliers'
import { creerEtablissementAvecDirection } from '@/lib/etablissements/creation'
import { getDictionary } from '@/dictionaries'

// Nouveau site du groupe, créé par le DG avec le compte de son directeur. Le
// site a son propre abonnement (réglé par sa direction depuis /abonnement).
export async function creerSite(formData: FormData): Promise<{ success?: true; error?: string }> {
  const groupe = await getGroupeContext()
  const dict = await getDictionary()
  const t = dict.groupe.nouveauSite
  if (groupe.estDemo) return { error: dict.errors.demo }
  const v = (n: string) => ((formData.get(n) as string | null) ?? '').trim()
  const palier = v('palier') as PalierCode
  if (!PALIER_CODES.includes(palier)) return { error: t.erreurs.palier }

  const r = await creerEtablissementAvecDirection(createAdminClient(), {
    nom: v('nom'),
    sigle: v('sigle'),
    ville: v('ville'),
    telephone: v('telephone'),
    palier,
    prive: v('statut_juridique') !== 'public',
    directionNom: v('direction_nom'),
    directionPrenom: v('direction_prenom'),
    directionEmail: v('direction_email'),
    directionPassword: (formData.get('direction_password') as string | null) ?? '',
    groupeId: groupe.groupeId,
  })
  if (r.error) return { error: t.erreurs[r.error as keyof typeof t.erreurs] ?? r.error }
  revalidatePath('/groupe', 'layout')
  return { success: true }
}
