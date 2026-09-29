import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { cardClass } from '@/components/ui/styles'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { peutEcrire } from '@/lib/roles'
import { un } from '@/lib/scolarite'
import { getDictionary, getLocale } from '@/dictionaries'
import RentreeClient, { type LigneRentree } from './RentreeClient'

type Classe = { id: string; nom: string; annee_id: string; serie_id: string | null; niveaux: { id: string; ordre: number } | null; series: { code: string } | null }

export default async function RentreePage({ searchParams }: { searchParams: Promise<{ source?: string; cible?: string }> }) {
  const context = await getCurrentUserContext()
  if (!peutEcrire(context.role, 'eleves')) redirect('/passages')
  const sp = await searchParams
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.passages

  const { data: annees } = await supabase.from('annees_scolaires').select('id, libelle, date_debut').order('date_debut')
  const source = (annees ?? []).find((a) => a.id === sp.source) ?? null
  if (!source) redirect('/passages')
  // Année cible : celle demandée, sinon la première qui suit l'année source.
  const suivantes = (annees ?? []).filter((a) => a.date_debut > source.date_debut)
  const cible = suivantes.find((a) => a.id === sp.cible) ?? suivantes[0] ?? null

  const [{ data: decisions }, { data: classesBrutes }, { data: dejaInscrits }] = await Promise.all([
    supabase
      .from('decisions')
      .select('decision_finale, inscriptions!inner(annee_id, eleve_id, eleves(id, prenom, nom, statut), classes(id, nom, serie_id, niveaux(id, ordre), series(code)))')
      .eq('inscriptions.annee_id', source.id)
      .not('decision_finale', 'is', null),
    supabase.from('classes').select('id, nom, annee_id, serie_id, niveaux(id, ordre), series(code)'),
    cible ? supabase.from('inscriptions').select('eleve_id').eq('annee_id', cible.id) : Promise.resolve({ data: [] }),
  ])
  const classesCible = ((classesBrutes ?? []) as unknown as Classe[]).filter((c) => c.annee_id === cible?.id).map((c) => ({ ...c, niveau: un(c.niveaux), serie: un(c.series)?.code ?? null }))
  const inscrits = new Set((dejaInscrits ?? []).map((i) => i.eleve_id))

  // Classe proposée : niveau suivant pour un admis, même niveau pour un
  // redoublant, en gardant la série si une classe de même série existe.
  const proposer = (ordre: number, serie: string | null) => {
    const candidates = classesCible.filter((c) => c.niveau?.ordre === ordre)
    return (candidates.find((c) => c.serie === serie) ?? candidates[0] ?? null)?.id ?? null
  }

  type D = { decision_finale: string; inscriptions: { eleve_id: string; eleves: { id: string; prenom: string; nom: string; statut: string } | null; classes: Classe | null } | null }
  const lignes: LigneRentree[] = ((decisions ?? []) as unknown as D[])
    .map((d) => {
      const i = un(d.inscriptions)
      const el = un(i?.eleves)
      const cl = un(i?.classes)
      if (!el || !cl || el.statut !== 'actif') return null
      const ordre = un(cl.niveaux)?.ordre ?? 0
      const serie = un(cl.series)?.code ?? null
      const admis = d.decision_finale === 'admis'
      const proposee = admis ? proposer(ordre + 1, serie) : d.decision_finale === 'redouble' ? proposer(ordre, serie) : null
      return {
        eleveId: el.id,
        nom: `${el.nom} ${el.prenom}`,
        classeSource: cl.nom,
        decision: d.decision_finale,
        statut: admis ? 'passant' : 'redoublant',
        classeProposee: proposee,
        // Admis sans niveau suivant dans l'établissement (ex. bachelier) : fin de cycle.
        finCycle: admis && !classesCible.some((c) => (c.niveau?.ordre ?? 0) > ordre),
        dejaInscrit: inscrits.has(el.id),
      } satisfies LigneRentree
    })
    .filter((l): l is LigneRentree => l !== null && l.decision !== 'exclu')
    .sort((a, b) => a.classeSource.localeCompare(b.classeSource) || a.nom.localeCompare(b.nom))

  return (
    <div className="space-y-5">
      <Link href={`/passages?annee=${source.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-foreground-muted hover:text-primary">
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {t.title}
      </Link>
      <PageHeader title={t.rentree} subtitle={`${source.libelle} → ${cible?.libelle ?? '—'} · ${t.rentreeDesc}`} />
      {!cible ? (
        <p className={`${cardClass} px-5 py-10 text-center text-sm text-foreground-muted`}>{t.pasAnneeCible}</p>
      ) : (
        <RentreeClient anneeCibleId={cible.id} lignes={lignes} classes={classesCible.map((c) => ({ id: c.id, nom: c.nom }))} dict={dict} />
      )}
    </div>
  )
}
