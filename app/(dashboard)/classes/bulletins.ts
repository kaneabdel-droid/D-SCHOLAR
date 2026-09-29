'use server'

import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { appreciationPour, baremeAppreciations, un } from '@/lib/scolarite'

export type LigneBulletin = { matiere: string; coefficient: number; moyenne: number | null; enseignant: string }
export type Bulletin = {
  eleve: { id: string; prenom: string; nom: string; matricule: string; date_naissance: string | null }
  lignes: LigneBulletin[]
  moyenne: number | null
  rang: number | null
  appreciation: string | null
  heuresAbsence: number
  heuresNonJustifiees: number
  decision: string | null
}
export type DonneesBulletins = {
  etablissement: { nom: string; sigle: string | null; adresse: string | null; ville: string | null; telephone: string | null; email: string | null }
  classe: string
  annee: string
  periode: { rang: number; decoupage: string } | null
  effectif: number
  moyenneClasse: number | null
  bulletins: Bulletin[]
}

// Données de tous les bulletins d'une classe pour une période (ou l'année,
// periodeId null) — calculs SQL (moyennes_matieres / moyennes_periode /
// moyennes_annuelles), appréciations du barème de l'établissement.
export async function donneesBulletins(classeId: string, periodeId: string | null): Promise<DonneesBulletins | null> {
  const context = await getCurrentUserContext()
  const supabase = await createClient()

  const { data: classe } = await supabase.from('classes').select('id, nom, annee_id, annees_scolaires(libelle)').eq('id', classeId).maybeSingle()
  if (!classe) return null

  const [{ data: etab }, { data: inscrits }, { data: ens }, bareme, { data: periodes }] = await Promise.all([
    supabase.from('etablissements').select('nom, sigle, adresse, ville, telephone, email').eq('id', context.etablissementId).single(),
    supabase.from('inscriptions').select('id, eleves(id, prenom, nom, matricule, date_naissance, statut), decisions(decision_finale)').eq('classe_id', classeId),
    supabase.from('enseignements').select('matiere_id, matieres(nom), enseignants(civilite, nom)').eq('classe_id', classeId),
    baremeAppreciations(supabase),
    supabase.rpc('periodes_classe', { p_classe_id: classeId }),
  ])
  const listePeriodes = (periodes ?? []) as { id: string; rang: number; decoupage: string; date_debut: string; date_fin: string }[]
  const periode = periodeId ? listePeriodes.find((p) => p.id === periodeId) ?? null : null

  // Moyennes par matière : période choisie, ou moyenne des périodes pour l'année.
  const periodesCalcul = periode ? [periode] : listePeriodes
  const detail = await Promise.all(periodesCalcul.map((p) => supabase.rpc('moyennes_matieres', { p_classe_id: classeId, p_periode_id: p.id })))
  const parEleveMatiere = new Map<string, { somme: number; n: number; coef: number }>()
  for (const d of detail) {
    for (const m of (d.data ?? []) as { eleve_id: string; matiere_id: string; moyenne: number; coefficient: number }[]) {
      const cle = `${m.eleve_id}|${m.matiere_id}`
      const cur = parEleveMatiere.get(cle) ?? { somme: 0, n: 0, coef: Number(m.coefficient) }
      cur.somme += Number(m.moyenne)
      cur.n += 1
      parEleveMatiere.set(cle, cur)
    }
  }
  const { data: generales } = periode
    ? await supabase.rpc('moyennes_periode', { p_classe_id: classeId, p_periode_id: periode.id })
    : await supabase.rpc('moyennes_annuelles', { p_classe_id: classeId })
  const gen = new Map(((generales ?? []) as { eleve_id: string; moyenne: number; rang: number }[]).map((g) => [g.eleve_id, g]))

  // Absences sur la période (ou l'année).
  const debut = periode?.date_debut ?? listePeriodes[0]?.date_debut
  const fin = periode?.date_fin ?? listePeriodes[listePeriodes.length - 1]?.date_fin
  const { data: absences } = await supabase
    .from('absences')
    .select('eleve_id, type, duree, justifiee')
    .eq('annee_id', classe.annee_id)
    .gte('date_absence', debut ?? '1900-01-01')
    .lte('date_absence', fin ?? '2999-12-31')

  type Insc = { id: string; eleves: Bulletin['eleve'] & { statut: string } | null; decisions: { decision_finale: string | null } | null }
  type Ens = { matiere_id: string; matieres: { nom: string } | null; enseignants: { civilite: string | null; nom: string } | null }
  const matieres = ((ens ?? []) as unknown as Ens[]).map((e) => ({ id: e.matiere_id, nom: un(e.matieres)?.nom ?? '—', prof: un(e.enseignants) }))

  const bulletins: Bulletin[] = ((inscrits ?? []) as unknown as Insc[])
    .map((i) => ({ ...i, eleve: un(i.eleves), decision: un(i.decisions) }))
    .filter((i) => i.eleve)
    .map((i) => {
      const g = gen.get(i.eleve!.id)
      const lignes = matieres
        .map((m) => {
          const v = parEleveMatiere.get(`${i.eleve!.id}|${m.id}`)
          return { matiere: m.nom, coefficient: v?.coef ?? 1, moyenne: v ? Math.round((v.somme / v.n) * 100) / 100 : null, enseignant: m.prof ? `${m.prof.civilite ?? ''} ${m.prof.nom}`.trim() : '' }
        })
        .sort((a, b) => b.coefficient - a.coefficient || a.matiere.localeCompare(b.matiere))
      const abs = (absences ?? []).filter((a) => a.eleve_id === i.eleve!.id && a.type === 'absence')
      return {
        eleve: { id: i.eleve!.id, prenom: i.eleve!.prenom, nom: i.eleve!.nom, matricule: i.eleve!.matricule, date_naissance: i.eleve!.date_naissance },
        lignes,
        moyenne: g ? Number(g.moyenne) : null,
        rang: g ? Number(g.rang) : null,
        appreciation: appreciationPour(bareme, g ? Number(g.moyenne) : null)?.libelle ?? null,
        heuresAbsence: abs.reduce((t, a) => t + Number(a.duree), 0),
        heuresNonJustifiees: abs.filter((a) => !a.justifiee).reduce((t, a) => t + Number(a.duree), 0),
        decision: periode ? null : (i.decision?.decision_finale ?? null),
      }
    })
    .filter((b) => b.moyenne !== null)
    .sort((a, b) => (a.rang ?? 999) - (b.rang ?? 999))

  const moyennes = bulletins.map((b) => b.moyenne!).filter(Number.isFinite)
  return {
    etablissement: etab ?? { nom: '', sigle: null, adresse: null, ville: null, telephone: null, email: null },
    classe: classe.nom,
    annee: un(classe.annees_scolaires as unknown as { libelle: string })?.libelle ?? '',
    periode: periode ? { rang: periode.rang, decoupage: periode.decoupage } : null,
    effectif: bulletins.length,
    moyenneClasse: moyennes.length ? Math.round((moyennes.reduce((a, b) => a + b, 0) / moyennes.length) * 100) / 100 : null,
    bulletins,
  }
}
