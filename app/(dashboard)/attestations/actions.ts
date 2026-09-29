'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { contexteEcriture } from '@/lib/auth/getCurrentUserContext'
import { messageErreur } from '@/lib/erreurs'
import { situationsFinancieres } from '@/lib/finances'
import { qrSvg, urlVerification } from '@/lib/qr'
import { un } from '@/lib/scolarite'
import { TYPES_DOCUMENT, type AnneeReleve, type ContenuDocument, type TypeDocument } from '@/lib/documents'
import { getDictionary } from '@/dictionaries'

type ActionResult = { success?: true; error?: string }
type Supabase = Awaited<ReturnType<typeof createClient>>

type Insc = {
  id: string
  annee_id: string
  classe_id: string
  date_inscription: string
  annees_scolaires: { libelle: string; date_debut: string } | null
  classes: { nom: string } | null
  decisions: { moyenne_annuelle: number | null; rang: number | null; decision: string; decision_finale: string | null } | null
}

// Relevé de notes : cursus de l'élève dans l'établissement jusqu'à l'année
// choisie — moyennes annuelles par matière (moyenne des périodes), moyenne
// générale, rang et décision de chaque année.
async function cursus(supabase: Supabase, eleveId: string, inscriptions: Insc[]): Promise<AnneeReleve[]> {
  const { data: matieres } = await supabase.from('matieres').select('id, nom')
  const noms = new Map((matieres ?? []).map((m) => [m.id, m.nom]))
  return Promise.all(
    inscriptions.map(async (i) => {
      const { data: periodes } = await supabase.rpc('periodes_classe', { p_classe_id: i.classe_id })
      const [detail, { data: annuelles }] = await Promise.all([
        Promise.all(((periodes ?? []) as { id: string }[]).map((p) => supabase.rpc('moyennes_matieres', { p_classe_id: i.classe_id, p_periode_id: p.id }))),
        supabase.rpc('moyennes_annuelles', { p_classe_id: i.classe_id }),
      ])
      const parMatiere = new Map<string, { somme: number; n: number; coef: number }>()
      for (const d of detail) {
        for (const m of (d.data ?? []) as { eleve_id: string; matiere_id: string; moyenne: number; coefficient: number }[]) {
          if (m.eleve_id !== eleveId) continue
          const cur = parMatiere.get(m.matiere_id) ?? { somme: 0, n: 0, coef: Number(m.coefficient) }
          cur.somme += Number(m.moyenne)
          cur.n += 1
          parMatiere.set(m.matiere_id, cur)
        }
      }
      const liste = (annuelles ?? []) as { eleve_id: string; moyenne: number; rang: number }[]
      const moi = liste.find((a) => a.eleve_id === eleveId)
      const dec = un(i.decisions)
      return {
        annee: un(i.annees_scolaires)?.libelle ?? '',
        classe: un(i.classes)?.nom ?? '',
        lignes: [...parMatiere.entries()]
          .map(([id, v]) => ({ matiere: noms.get(id) ?? '—', coefficient: v.coef, moyenne: Math.round((v.somme / v.n) * 100) / 100 }))
          .sort((a, b) => b.coefficient - a.coefficient || a.matiere.localeCompare(b.matiere)),
        moyenne: dec?.moyenne_annuelle != null ? Number(dec.moyenne_annuelle) : moi ? Number(moi.moyenne) : null,
        rang: dec?.rang != null ? Number(dec.rang) : moi ? Number(moi.rang) : null,
        effectif: liste.length,
        decision: dec?.decision_finale ?? null,
      }
    })
  )
}

// Émission d'un document : le contenu est figé en base (instantané), le numéro
// et le code de vérification sont attribués par emettre_document. Pour un exeat
// avec un reste à payer, la première tentative renvoie `impaye` : l'interface
// demande confirmation puis rappelle avec forcer = true.
export async function emettreDocument(
  eleveId: string,
  type: string,
  anneeId: string | null,
  forcer = false
): Promise<ActionResult & { id?: string; impaye?: number }> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('documents', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  if (!(TYPES_DOCUMENT as readonly string[]).includes(type)) return { error: dict.errors.generic }
  const t = type as TypeDocument

  const supabase = await createClient()
  const [{ data: eleve }, { data: inscBrutes }, { data: mouvements }] = await Promise.all([
    supabase.from('eleves').select('prenom, nom, matricule, sexe, date_naissance, lieu_naissance, date_entree, tuteur_nom, tuteur_telephone').eq('id', eleveId).maybeSingle(),
    supabase
      .from('inscriptions')
      .select('id, annee_id, classe_id, date_inscription, annees_scolaires(libelle, date_debut), classes(nom), decisions(moyenne_annuelle, rang, decision, decision_finale)')
      .eq('eleve_id', eleveId),
    supabase.from('mouvements').select('date_mouvement, type, motif').eq('eleve_id', eleveId).neq('type', 'entree').neq('type', 'transfert_entrant').order('date_mouvement', { ascending: false }).limit(1),
  ])
  if (!eleve) return { error: dict.documents.eleveIntrouvable }

  const inscriptions = ((inscBrutes ?? []) as unknown as Insc[]).sort((a, b) =>
    (un(a.annees_scolaires)?.date_debut ?? '').localeCompare(un(b.annees_scolaires)?.date_debut ?? '')
  )
  const inscription = (anneeId ? inscriptions.find((i) => i.annee_id === anneeId) : null) ?? inscriptions[inscriptions.length - 1] ?? null
  if (!inscription) return { error: dict.documents.sansInscription }
  const decision = un(inscription.decisions)

  if (t === 'attestation_reussite' && decision?.decision_finale !== 'admis') return { error: dict.documents.pasAdmis }

  let reste = 0
  if (t === 'exeat') {
    const situation = (await situationsFinancieres(supabase, inscription.annee_id, [eleveId])).get(eleveId)
    reste = situation?.reste ?? 0
    if (reste > 0 && !forcer) return { impaye: reste }
  }

  const sortie = un(mouvements?.[0] ?? null)
  const contenu: ContenuDocument = {
    eleve: { prenom: eleve.prenom, nom: eleve.nom, matricule: eleve.matricule, sexe: eleve.sexe, date_naissance: eleve.date_naissance, lieu_naissance: eleve.lieu_naissance },
    classe: un(inscription.classes)?.nom ?? null,
    annee: un(inscription.annees_scolaires)?.libelle ?? null,
    date_inscription: inscription.date_inscription,
    date_entree: eleve.date_entree,
    moyenne: decision?.moyenne_annuelle != null ? Number(decision.moyenne_annuelle) : null,
    decision: decision?.decision_finale ?? null,
    sortie: t === 'exeat' ? (sortie ? { date: sortie.date_mouvement, type: sortie.type, motif: sortie.motif } : { date: new Date().toISOString().slice(0, 10), type: 'transfert_sortant', motif: null }) : null,
    reste_du: t === 'exeat' ? reste : undefined,
    tuteur: t === 'carte_scolaire' ? { nom: eleve.tuteur_nom, telephone: eleve.tuteur_telephone } : undefined,
    cursus: t === 'releve_notes' ? await cursus(supabase, eleveId, inscriptions.filter((i) => (un(i.annees_scolaires)?.date_debut ?? '') <= (un(inscription.annees_scolaires)?.date_debut ?? ''))) : undefined,
  }

  const { data, error } = await supabase.rpc('emettre_document', { p_eleve_id: eleveId, p_type: t, p_annee_id: inscription.annee_id, p_contenu: contenu })
  if (error || !data) return { error: messageErreur(error ?? { message: '' }, dict, 'emettreDocument') }

  revalidatePath('/attestations')
  revalidatePath(`/eleves/${eleveId}`)
  return { success: true, id: (data as { id: string }).id }
}

export async function annulerDocument(id: string): Promise<ActionResult> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('documents', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const supabase = await createClient()
  const { error } = await supabase.from('documents_emis').update({ annule: true }).eq('id', id)
  if (error) return { error: messageErreur(error, dict, 'annulerDocument') }
  revalidatePath('/attestations')
  revalidatePath('/eleves', 'layout')
  return { success: true }
}

// Données d'impression : le document, l'en-tête de l'établissement et le QR code.
export async function donneesDocument(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('documents_emis')
    .select('type, numero, code_verification, contenu, emis_le, annule, etablissements(nom, sigle, adresse, ville, telephone, email)')
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  const url = urlVerification(data.code_verification)
  return {
    type: data.type as TypeDocument,
    numero: data.numero as string,
    code: data.code_verification as string,
    url,
    qr: await qrSvg(url),
    contenu: data.contenu as ContenuDocument,
    emis_le: data.emis_le as string,
    annule: data.annule as boolean,
    etablissement: un(data.etablissements as unknown as { nom: string; sigle: string | null; adresse: string | null; ville: string | null; telephone: string | null; email: string | null } | null),
  }
}

// Cartes scolaires d'une classe : réutilise la carte valide déjà émise pour
// l'année, sinon en émet une (même numérotation et vérification que les attestations).
export async function emettreCartesClasse(classeId: string): Promise<ActionResult & { ids?: string[] }> {
  const dict = await getDictionary()
  const garde = await contexteEcriture('documents', dict)
  if ('erreur' in garde) return { error: garde.erreur }
  const supabase = await createClient()
  const { data: classe } = await supabase.from('classes').select('annee_id').eq('id', classeId).maybeSingle()
  if (!classe) return { error: dict.errors.generic }
  const { data: inscrits } = await supabase.from('inscriptions').select('eleve_id, eleves(nom, prenom, statut)').eq('classe_id', classeId)
  const eleves = ((inscrits ?? []) as unknown as { eleve_id: string; eleves: { nom: string; prenom: string; statut: string } | null }[])
    .filter((i) => un(i.eleves)?.statut === 'actif')
    .sort((a, b) => (un(a.eleves)?.nom ?? '').localeCompare(un(b.eleves)?.nom ?? '') || (un(a.eleves)?.prenom ?? '').localeCompare(un(b.eleves)?.prenom ?? ''))
  if (eleves.length === 0) return { error: dict.documents.aucunEleve }

  const { data: existantes } = await supabase
    .from('documents_emis')
    .select('id, eleve_id')
    .eq('type', 'carte_scolaire')
    .eq('annee_id', classe.annee_id)
    .eq('annule', false)
    .in('eleve_id', eleves.map((e) => e.eleve_id))
  const parEleve = new Map((existantes ?? []).map((d) => [d.eleve_id, d.id]))

  const ids: string[] = []
  for (const e of eleves) {
    const deja = parEleve.get(e.eleve_id)
    if (deja) {
      ids.push(deja)
      continue
    }
    const r = await emettreDocument(e.eleve_id, 'carte_scolaire', classe.annee_id)
    if (r.error) return { error: r.error }
    if (r.id) ids.push(r.id)
  }
  return { success: true, ids }
}

// Données d'impression de plusieurs documents (planche de cartes scolaires).
export async function donneesDocuments(ids: string[]) {
  const liste = await Promise.all(ids.slice(0, 200).map((id) => donneesDocument(id)))
  return liste.filter((d) => d !== null)
}
