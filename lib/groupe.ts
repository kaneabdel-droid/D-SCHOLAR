import type { SupabaseClient } from '@supabase/supabase-js'
import type { SiteGroupe } from '@/lib/auth/getGroupeContext'
import { situationsFinancieres, MODES_PAIEMENT } from '@/lib/finances'
import { lireTout } from '@/lib/lireTout'
import { un } from '@/lib/scolarite'

// Indicateurs d'un établissement pour la vue groupe (synthèse, comparatifs,
// rapport financier). Tout est lu avec le client de l'utilisateur : le RLS du
// DG (10_groupes.sql) limite la lecture aux établissements de son groupe.

export type AnneeSite = { id: string; libelle: string; date_debut: string; date_fin: string; active: boolean; cloturee: boolean }

export type Indicateurs = {
  site: SiteGroupe
  acces: string
  annee: AnneeSite | null
  effectif: number
  filles: number
  garcons: number
  nouveaux: number
  redoublants: number
  parCycle: Record<string, number>
  classes: number
  enseignants: number
  personnel: number
  // Résultats : année choisie, ou dernière année close avant elle (année en cours sans décisions).
  resultats: { annee: string; decisions: number; admis: number; redoublent: number; exclus: number; repechages: number; moyenne: number | null } | null
  examens: { examen: string; presentes: number; admis: number }[]
  assiduite: { heuresNJ: number; heuresTotal: number; retards: number }
  finances: {
    du: number
    paye: number
    reste: number
    elevesEnRetard: number
    parMois: { mois: string; montant: number }[]
    parMode: Record<string, number>
    moisCourant: number
  }
  admissions: Record<string, number>
  billets: number
}

export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null)

// Années de chaque site : on aligne les sites sur un libellé commun (« 2026-2027 »).
export async function anneesDesSites(supabase: SupabaseClient, sites: SiteGroupe[]) {
  const { data } = await supabase
    .from('annees_scolaires')
    .select('id, libelle, date_debut, date_fin, active, cloturee, etablissement_id')
    .in('etablissement_id', sites.map((s) => s.id))
    .order('date_debut', { ascending: false })
  const parSite = new Map<string, AnneeSite[]>()
  for (const a of data ?? []) parSite.set(a.etablissement_id, [...(parSite.get(a.etablissement_id) ?? []), a])
  const libelles = [...new Set((data ?? []).map((a) => a.libelle))].sort().reverse()
  const actives = (data ?? []).filter((a) => a.active).map((a) => a.libelle)
  // Libellé par défaut : l'année active la plus fréquente.
  const frequence = new Map<string, number>()
  for (const l of actives) frequence.set(l, (frequence.get(l) ?? 0) + 1)
  const defaut = [...frequence.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? libelles[0] ?? null
  return { parSite, libelles, defaut }
}

export async function indicateursSite(supabase: SupabaseClient, site: SiteGroupe, annees: AnneeSite[], libelle: string | null, acces: string): Promise<Indicateurs> {
  const annee = annees.find((a) => a.libelle === libelle) ?? null
  const vide: Indicateurs = {
    site, acces, annee, effectif: 0, filles: 0, garcons: 0, nouveaux: 0, redoublants: 0, parCycle: {}, classes: 0, enseignants: 0, personnel: 0,
    resultats: null, examens: [], assiduite: { heuresNJ: 0, heuresTotal: 0, retards: 0 },
    finances: { du: 0, paye: 0, reste: 0, elevesEnRetard: 0, parMois: [], parMode: {}, moisCourant: 0 }, admissions: {}, billets: 0,
  }
  const [{ count: enseignants }, { count: personnel }] = await Promise.all([
    supabase.from('enseignants').select('id', { count: 'exact', head: true }).eq('etablissement_id', site.id).eq('actif', true),
    supabase.from('utilisateurs').select('id', { count: 'exact', head: true }).eq('etablissement_id', site.id).eq('actif', true),
  ])
  vide.enseignants = enseignants ?? 0
  vide.personnel = personnel ?? 0
  if (!annee) return vide

  // Résultats : l'année choisie si elle a des décisions, sinon la précédente close.
  const anneeResultats = async () => {
    for (const a of annees.filter((x) => x.date_debut <= annee.date_debut)) {
      const { count } = await supabase.from('decisions').select('id, inscriptions!inner(annee_id)', { count: 'exact', head: true }).eq('inscriptions.annee_id', a.id)
      if ((count ?? 0) > 0) return a
    }
    return null
  }

  const [inscriptions, { count: classes }, anneeRes, examens, absences, situations, paiements, { data: candidatures }, { count: billets }] = await Promise.all([
    lireTout((de, a) => supabase.from('inscriptions').select('eleve_id, statut, eleves(sexe), classes(niveaux(cycle))').eq('annee_id', annee.id).order('id').range(de, a)),
    supabase.from('classes').select('id', { count: 'exact', head: true }).eq('annee_id', annee.id),
    anneeResultats(),
    lireTout((de, a) => supabase.from('examens_officiels').select('examen, resultat').eq('annee_id', annee.id).order('id').range(de, a)),
    lireTout((de, a) => supabase.from('absences').select('type, duree, justifiee').eq('annee_id', annee.id).order('id').range(de, a)),
    situationsFinancieres(supabase, annee.id),
    lireTout((de, a) => supabase.from('paiements_eleves').select('montant, mode, date_paiement').eq('annee_id', annee.id).order('id').range(de, a)),
    supabase.from('candidatures').select('statut').eq('annee_id', annee.id),
    supabase.from('billets').select('id', { count: 'exact', head: true }).eq('annee_id', annee.id),
  ])

  type Insc = { eleve_id: string; statut: string; eleves: { sexe: string } | null; classes: { niveaux: { cycle: string } | null } | null }
  const r = { ...vide, classes: classes ?? 0, billets: billets ?? 0 }
  for (const i of inscriptions as unknown as Insc[]) {
    r.effectif++
    if (un(i.eleves)?.sexe === 'F') r.filles++
    else r.garcons++
    if (i.statut === 'nouveau' || i.statut === 'transfere') r.nouveaux++
    if (i.statut === 'redoublant') r.redoublants++
    const cycle = un(un(i.classes)?.niveaux)?.cycle ?? 'autre'
    r.parCycle[cycle] = (r.parCycle[cycle] ?? 0) + 1
  }

  if (anneeRes) {
    const decisions = await lireTout((de, a) =>
      supabase.from('decisions').select('decision, decision_finale, moyenne_annuelle, inscriptions!inner(annee_id)').eq('inscriptions.annee_id', anneeRes.id).order('id').range(de, a)
    ) as { decision: string; decision_finale: string | null; moyenne_annuelle: number | null }[]
    const moyennes = decisions.map((d) => d.moyenne_annuelle).filter((m): m is number => m !== null).map(Number)
    r.resultats = {
      annee: anneeRes.libelle,
      decisions: decisions.length,
      admis: decisions.filter((d) => d.decision_finale === 'admis').length,
      redoublent: decisions.filter((d) => d.decision_finale === 'redouble').length,
      exclus: decisions.filter((d) => d.decision_finale === 'exclu').length,
      repechages: decisions.filter((d) => d.decision === 'repechage').length,
      moyenne: moyennes.length ? Math.round((moyennes.reduce((s, m) => s + m, 0) / moyennes.length) * 100) / 100 : null,
    }
  }

  const parExamen = new Map<string, { presentes: number; admis: number }>()
  for (const e of examens as { examen: string; resultat: string }[]) {
    const cur = parExamen.get(e.examen) ?? { presentes: 0, admis: 0 }
    cur.presentes++
    if (e.resultat === 'admis') cur.admis++
    parExamen.set(e.examen, cur)
  }
  r.examens = ['CFEE', 'BFEM', 'BAC'].filter((x) => parExamen.has(x)).map((x) => ({ examen: x, ...parExamen.get(x)! }))

  for (const a of absences as { type: string; duree: number; justifiee: boolean }[]) {
    if (a.type === 'retard') r.assiduite.retards++
    else {
      r.assiduite.heuresTotal += Number(a.duree)
      if (!a.justifiee) r.assiduite.heuresNJ += Number(a.duree)
    }
  }

  // Finances : dû / payé / reste, encaissements par mois de l'année scolaire et par mode.
  for (const s of situations.values()) {
    r.finances.du += s.du
    r.finances.paye += s.paye
    r.finances.reste += s.reste
    if (s.reste > 0) r.finances.elevesEnRetard++
  }
  const debut = new Date(annee.date_debut + 'T00:00:00')
  const mois = Array.from({ length: 12 }, (_, k) => {
    const d = new Date(debut.getFullYear(), debut.getMonth() + k, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const parMois = new Map(mois.map((m) => [m, 0]))
  const parMode: Record<string, number> = Object.fromEntries(MODES_PAIEMENT.map((m) => [m, 0]))
  const courant = new Date().toISOString().slice(0, 7)
  for (const p of paiements as { montant: number; mode: string; date_paiement: string }[]) {
    const m = p.date_paiement.slice(0, 7)
    // Paiements anticipés (avant la rentrée) : comptés sur le premier mois.
    const cle = parMois.has(m) ? m : m < mois[0] ? mois[0] : null
    if (cle) parMois.set(cle, (parMois.get(cle) ?? 0) + Number(p.montant))
    parMode[p.mode] = (parMode[p.mode] ?? 0) + Number(p.montant)
    if (m === courant) r.finances.moisCourant += Number(p.montant)
  }
  r.finances.parMois = mois.map((m) => ({ mois: m, montant: parMois.get(m) ?? 0 }))
  r.finances.parMode = parMode

  for (const c of candidatures ?? []) r.admissions[c.statut] = (r.admissions[c.statut] ?? 0) + 1
  return r
}

// Tous les sites du groupe pour un libellé d'année, en parallèle.
export async function indicateursGroupe(supabase: SupabaseClient, sites: SiteGroupe[], libelle: string | null) {
  const [{ parSite, libelles, defaut }, { data: acces }] = await Promise.all([anneesDesSites(supabase, sites), supabase.rpc('acces_sites_groupe')])
  const choisi = libelle && libelles.includes(libelle) ? libelle : defaut
  const accesParSite = new Map(((acces ?? []) as { etablissement_id: string; acces: string }[]).map((a) => [a.etablissement_id, a.acces]))
  const indicateurs = await Promise.all(sites.map((s) => indicateursSite(supabase, s, parSite.get(s.id) ?? [], choisi, accesParSite.get(s.id) ?? 'complet')))
  return { indicateurs, libelles, libelle: choisi }
}

// Consolidation du groupe (somme des sites).
export function consolider(liste: Indicateurs[]) {
  const somme = (f: (i: Indicateurs) => number) => liste.reduce((s, i) => s + f(i), 0)
  const resultats = liste.map((i) => i.resultats).filter((x): x is NonNullable<Indicateurs['resultats']> => x !== null)
  const moyennes = resultats.filter((x) => x.moyenne !== null)
  const mois = liste[0]?.finances.parMois.map((m) => m.mois) ?? []
  return {
    sites: liste.length,
    effectif: somme((i) => i.effectif),
    filles: somme((i) => i.filles),
    nouveaux: somme((i) => i.nouveaux),
    classes: somme((i) => i.classes),
    enseignants: somme((i) => i.enseignants),
    personnel: somme((i) => i.personnel),
    decisions: resultats.reduce((s, x) => s + x.decisions, 0),
    admis: resultats.reduce((s, x) => s + x.admis, 0),
    moyenne: moyennes.length ? Math.round((moyennes.reduce((s, x) => s + x.moyenne! * x.decisions, 0) / moyennes.reduce((s, x) => s + x.decisions, 0)) * 100) / 100 : null,
    heuresNJ: somme((i) => i.assiduite.heuresNJ),
    du: somme((i) => i.finances.du),
    paye: somme((i) => i.finances.paye),
    reste: somme((i) => i.finances.reste),
    elevesEnRetard: somme((i) => i.finances.elevesEnRetard),
    moisCourant: somme((i) => i.finances.moisCourant),
    // Les sites peuvent commencer l'année à des mois différents : alignement par rang de mois.
    parMois: mois.map((m, k) => ({ mois: m, montant: liste.reduce((s, i) => s + (i.finances.parMois[k]?.montant ?? 0), 0) })),
    parMode: MODES_PAIEMENT.reduce((acc, m) => ({ ...acc, [m]: somme((i) => i.finances.parMode[m] ?? 0) }), {} as Record<string, number>),
  }
}
