'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { contexteEcriture, requireParametrage } from '@/lib/auth/getCurrentUserContext'
import { PERIODICITES, TYPES_SERVICE } from '@/lib/finances'
import { cycleAutorise, CYCLES, type Cycle } from '@/lib/abonnements/paliers'
import { CATEGORIES_APPRECIATION, ENTITES, TYPES_SALLE, type EntiteCle } from '@/lib/parametres/entites'
import { messageErreur } from '@/lib/erreurs'
import { fmt } from '@/lib/i18n'
import { getDictionary } from '@/dictionaries'

type ActionResult = { success?: true; error?: string }

const VALEURS_SELECT: Record<string, readonly string[]> = {
  cycles: CYCLES,
  typesSalle: TYPES_SALLE,
  categories: CATEGORIES_APPRECIATION,
  typesService: TYPES_SERVICE,
  periodicites: PERIODICITES,
}

// Garde d'écriture : paramétrage (direction / censeur) par défaut, ou le module
// propre à l'entité (ex. services : direction / intendance).
async function garde(cle: EntiteCle, dict: Awaited<ReturnType<typeof getDictionary>>) {
  const module = ENTITES[cle]?.module
  if (module) {
    const g = await contexteEcriture(module, dict)
    return 'erreur' in g ? { erreur: g.erreur } : { context: g.context }
  }
  const context = await requireParametrage()
  if (context.acces !== 'complet') return { erreur: dict.errors.lectureSeule }
  return { context }
}

// Action générique des tables simples du référentiel : seules les colonnes
// déclarées dans ENTITES sont lues du formulaire et écrites (liste blanche).
export async function enregistrerEntite(cle: EntiteCle, id: string | null, formData: FormData): Promise<ActionResult> {
  const dict = await getDictionary()
  const g = await garde(cle, dict)
  if ('erreur' in g) return { error: g.erreur }
  const context = g.context!
  const entite = ENTITES[cle]
  if (!entite) return { error: dict.errors.generic }

  const valeurs: Record<string, string | number | boolean | null> = {}
  for (const champ of entite.champs) {
    const libelle = dict.fields[champ.nom]
    const brut = formData.get(champ.nom)

    if (champ.type === 'checkbox') {
      valeurs[champ.nom] = brut === 'on'
      continue
    }

    let texte = typeof brut === 'string' ? brut.trim() : ''
    if (champ.majuscules) texte = texte.toUpperCase()
    if (champ.max) texte = texte.slice(0, champ.max)

    if (!texte) {
      if (champ.requis) return { error: fmt(dict.errors.required, { champ: libelle }) }
      valeurs[champ.nom] = null
      continue
    }

    if (champ.type === 'number') {
      const nombre = Number(texte.replace(',', '.'))
      if (!Number.isFinite(nombre) || (champ.entier && !Number.isInteger(nombre)) || nombre < 0) {
        return { error: fmt(dict.errors.invalidNumber, { champ: libelle }) }
      }
      valeurs[champ.nom] = nombre
    } else if (champ.type === 'select') {
      if (!champ.options || !VALEURS_SELECT[champ.options].includes(texte)) {
        return { error: fmt(dict.errors.required, { champ: libelle }) }
      }
      valeurs[champ.nom] = texte
    } else if (champ.type === 'color') {
      valeurs[champ.nom] = /^#[0-9a-fA-F]{6}$/.test(texte) ? texte : String(champ.defaut ?? '#2563EB')
    } else {
      valeurs[champ.nom] = texte
    }
  }

  // Restriction par palier, vérifiée ici pour un message clair (le RLS la
  // réimpose de toute façon, cf. insert_niveaux / update_niveaux).
  if (cle === 'niveaux' && !cycleAutorise(context.palier, valeurs.cycle as Cycle)) {
    return { error: dict.errors.cycleNotAllowed }
  }

  const supabase = await createClient()
  const { error } = id
    ? await supabase.from(entite.table).update(valeurs).eq('id', id)
    : await supabase.from(entite.table).insert({ ...valeurs, etablissement_id: context.etablissementId })
  if (error) return { error: messageErreur(error, dict, `enregistrerEntite(${cle})`) }

  revalidatePath('/parametres', 'layout')
  revalidatePath('/services')
  return { success: true }
}

export async function supprimerEntite(cle: EntiteCle, id: string): Promise<ActionResult> {
  const dict = await getDictionary()
  const g = await garde(cle, dict)
  if ('erreur' in g) return { error: g.erreur }
  const entite = ENTITES[cle]
  if (!entite) return { error: dict.errors.generic }

  const supabase = await createClient()
  const { error } = await supabase.from(entite.table).delete().eq('id', id)
  if (error) return { error: messageErreur(error, dict, `supprimerEntite(${cle})`) }

  revalidatePath('/parametres', 'layout')
  revalidatePath('/services')
  return { success: true }
}
