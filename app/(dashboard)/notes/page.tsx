import PageHeader from '@/components/PageHeader'
import SelecteurAnnee from '@/components/SelecteurAnnee'
import { cardClass } from '@/components/ui/styles'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { peutEcrire } from '@/lib/roles'
import { anneesEtSelection, libellePeriode, un } from '@/lib/scolarite'
import { fmt, intlLocale } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'
import FiltresNotes from './FiltresNotes'
import { EvaluationsListe, SaisieNotes } from './NotesClient'

type SP = { annee?: string; classe?: string; enseignement?: string; periode?: string; evaluation?: string }

export default async function NotesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const context = await getCurrentUserContext()
  const sp = await searchParams
  const supabase = await createClient()
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const t = dict.notes
  const s = dict.scolarite

  const { annees, selection } = await anneesEtSelection(supabase, sp.annee)

  // Enseignant : uniquement ses cours (fiche enseignant liée à son compte).
  const estEnseignant = context.role === 'enseignant'
  const { data: moi } = estEnseignant ? await supabase.from('enseignants').select('id').eq('utilisateur_id', context.userId).maybeSingle() : { data: null }

  let requete = supabase
    .from('enseignements')
    .select('id, classe_id, matieres(nom, couleur), enseignants(civilite, nom), classes!inner(id, nom, annee_id)')
    .eq('classes.annee_id', selection?.id ?? '')
  if (estEnseignant) requete = requete.eq('enseignant_id', moi?.id ?? '00000000-0000-0000-0000-000000000000')
  const { data: ensBruts } = selection ? await requete : { data: [] }

  type Ens = { id: string; classe_id: string; matieres: { nom: string; couleur: string } | null; enseignants: { civilite: string | null; nom: string } | null; classes: { id: string; nom: string } | null }
  const enseignements = ((ensBruts ?? []) as unknown as Ens[]).map((e) => ({ ...e, matiere: un(e.matieres), prof: un(e.enseignants), classe: un(e.classes) }))
  const classes = [...new Map(enseignements.filter((e) => e.classe).map((e) => [e.classe!.id, e.classe!])).values()].sort((a, b) => a.nom.localeCompare(b.nom))
  const classe = classes.find((c) => c.id === sp.classe) ?? classes[0] ?? null
  const ensClasse = enseignements.filter((e) => e.classe_id === classe?.id).sort((a, b) => (a.matiere?.nom ?? '').localeCompare(b.matiere?.nom ?? ''))
  const enseignement = ensClasse.find((e) => e.id === sp.enseignement) ?? ensClasse[0] ?? null

  const [{ data: periodesBrutes }, { data: types }] = await Promise.all([
    classe ? supabase.rpc('periodes_classe', { p_classe_id: classe.id }) : Promise.resolve({ data: [] }),
    supabase.from('types_evaluation').select('id, code, libelle, poids, nombre_par_periode').eq('actif', true).order('ordre'),
  ])
  const periodes = (periodesBrutes ?? []) as { id: string; rang: number; decoupage: string; verrouillee: boolean }[]
  const periode = periodes.find((p) => p.id === sp.periode) ?? periodes.find((p) => !p.verrouillee) ?? periodes[0] ?? null

  const { data: evaluationsBrutes } =
    enseignement && periode
      ? await supabase
          .from('evaluations')
          .select('id, libelle, date_evaluation, bareme, publiee, type_id, notes(count)')
          .eq('enseignement_id', enseignement.id)
          .eq('periode_id', periode.id)
          .order('date_evaluation')
      : { data: [] }
  const evaluations = ((evaluationsBrutes ?? []) as unknown as { id: string; libelle: string | null; date_evaluation: string; bareme: number; publiee: boolean; type_id: string; notes: { count: number }[] }[]).map((e) => ({
    ...e,
    nbNotes: e.notes?.[0]?.count ?? 0,
    type: (types ?? []).find((x) => x.id === e.type_id)?.libelle ?? '',
  }))
  const evaluation = evaluations.find((e) => e.id === sp.evaluation) ?? null

  // Élèves de la classe et notes de l'évaluation ouverte.
  const [{ data: inscrits }, { data: notes }] = await Promise.all([
    evaluation && classe ? supabase.from('inscriptions').select('eleves(id, prenom, nom, statut)').eq('classe_id', classe.id) : Promise.resolve({ data: [] }),
    evaluation ? supabase.from('notes').select('eleve_id, valeur, absent, absence_justifiee').eq('evaluation_id', evaluation.id) : Promise.resolve({ data: [] }),
  ])
  const eleves = ((inscrits ?? []) as unknown as { eleves: { id: string; prenom: string; nom: string; statut: string } | null }[])
    .map((i) => un(i.eleves))
    .filter((e): e is { id: string; prenom: string; nom: string; statut: string } => Boolean(e))
    .sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom))

  // Suivi du nombre d'évaluations attendu par type (règle de l'établissement).
  const suivi = (types ?? []).map((ty) => ({ ...ty, faites: evaluations.filter((e) => e.type_id === ty.id).length }))
  const ecriture = peutEcrire(context.role, 'notes') && context.acces === 'complet'

  return (
    <div>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={<SelecteurAnnee annees={annees} selection={selection?.id ?? null} libelles={{ annee: s.annee, active: s.active, cloturee: s.cloturee }} />}
      />

      {!classe ? (
        <p className={`${cardClass} px-5 py-10 text-center text-sm text-foreground-muted`}>{estEnseignant ? t.aucunCours : s.aucuneDonnee}</p>
      ) : (
        <div className="space-y-5">
          <FiltresNotes
            classes={classes.map((c) => ({ id: c.id, nom: c.nom }))}
            enseignements={ensClasse.map((e) => ({ id: e.id, nom: e.matiere?.nom ?? '—' }))}
            periodes={periodes.map((p) => ({ id: p.id, nom: libellePeriode(dict.annees, p) + (p.verrouillee ? ' 🔒' : '') }))}
            valeurs={{ classe: classe.id, enseignement: enseignement?.id ?? '', periode: periode?.id ?? '' }}
            libelles={{ classe: dict.eleves.classe, matiere: dict.eleves.matiere, periode: dict.classes.periode }}
          />

          {periode?.verrouillee && <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">{dict.errors.periodeVerrouillee}</p>}

          <div className="flex flex-wrap gap-2">
            {suivi.map((ty) => (
              <span key={ty.id} className={`rounded-full px-3 py-1 text-xs font-semibold ${ty.faites >= ty.nombre_par_periode ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                {ty.libelle} · {ty.faites}/{ty.nombre_par_periode}
                {Number(ty.poids) === 0 ? ` · ${t.poidsNul}` : ` · ${fmt(t.poids, { p: Number(ty.poids) })}`}
              </span>
            ))}
          </div>

          {enseignement && periode && (
            <EvaluationsListe
              enseignementId={enseignement.id}
              periode={periode}
              evaluations={evaluations}
              types={(types ?? []).map((ty) => ({ id: ty.id, libelle: ty.libelle, code: ty.code }))}
              selection={evaluation?.id ?? null}
              effectif={eleves.length || null}
              ecriture={ecriture && !periode.verrouillee}
              locale={intlLocale(locale)}
              dict={dict}
            />
          )}

          {evaluation && (
            <SaisieNotes
              key={evaluation.id}
              evaluation={evaluation}
              eleves={eleves}
              notes={(notes ?? []).map((n) => ({ eleve_id: n.eleve_id, valeur: n.valeur === null ? '' : String(n.valeur), absent: n.absent, justifiee: n.absence_justifiee }))}
              ecriture={ecriture && !periode?.verrouillee}
              publication={ecriture}
              dict={dict}
            />
          )}
        </div>
      )}
    </div>
  )
}
