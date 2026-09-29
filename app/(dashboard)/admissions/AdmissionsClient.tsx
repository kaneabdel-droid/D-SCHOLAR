'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarClock, GraduationCap, Plus } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { btnPrimary, btnSecondary, cardClass, inputClass, labelClass } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import { creerCandidature, inscrireCandidat, suivreCandidature } from './actions'

export type Candidature = {
  id: string
  prenom: string
  nom: string
  sexe: 'M' | 'F'
  date_naissance: string | null
  lieu_naissance: string | null
  etablissement_origine: string | null
  moyenne_origine: number | null
  tuteur_nom: string | null
  tuteur_telephone: string | null
  statut: Statut
  date_test: string | null
  note_test: number | null
  commentaire: string | null
  niveau_id: string
  eleve_id: string | null
  niveaux: { nom: string } | null
  series: { code: string } | null
}

type Statut = 'soumise' | 'en_etude' | 'test_planifie' | 'admise' | 'liste_attente' | 'refusee' | 'inscrite'
const COLONNES: Statut[] = ['soumise', 'en_etude', 'test_planifie', 'admise', 'liste_attente', 'inscrite', 'refusee']
const TEINTES: Record<Statut, string> = {
  soumise: 'bg-foreground-muted/10 text-foreground-muted',
  en_etude: 'bg-info/10 text-info',
  test_planifie: 'bg-secondary/15 text-secondary',
  admise: 'bg-success/10 text-success',
  liste_attente: 'bg-warning/10 text-warning',
  refusee: 'bg-danger/10 text-danger',
  inscrite: 'bg-primary-soft text-primary',
}

export default function AdmissionsClient({
  anneeId,
  candidatures,
  niveaux,
  series,
  classes,
  gestion,
  locale,
  dict,
}: {
  anneeId: string
  candidatures: Candidature[]
  niveaux: { id: string; nom: string; a_series: boolean }[]
  series: { id: string; code: string; nom: string }[]
  classes: { id: string; nom: string; niveau_id: string }[]
  gestion: boolean
  locale: string
  dict: Dictionary
}) {
  const router = useRouter()
  const t = dict.admissions
  const c = dict.common
  const [nouveau, setNouveau] = useState(false)
  const [suivi, setSuivi] = useState<Candidature | null>(null)
  const [aInscrire, setAInscrire] = useState<Candidature | null>(null)
  const [niveauChoisi, setNiveauChoisi] = useState(niveaux[0]?.id ?? '')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()

  const fermer = () => {
    setNouveau(false)
    setSuivi(null)
    setAInscrire(null)
    setErreur(null)
  }
  const executer = (action: () => Promise<{ error?: string; eleveId?: string }>) =>
    startTransition(async () => {
      setErreur(null)
      const res = await action()
      if (res.error) setErreur(res.error)
      else {
        toast.success(c.saved)
        fermer()
        if (res.eleveId) router.push(`/eleves/${res.eleveId}`)
      }
    })

  const date = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  const aSeries = niveaux.find((n) => n.id === niveauChoisi)?.a_series

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {COLONNES.map((st) => (
          <span key={st} className={`rounded-full px-3 py-1 text-xs font-semibold ${TEINTES[st]}`}>
            {t.statuts[st]} · {candidatures.filter((x) => x.statut === st).length}
          </span>
        ))}
        {gestion && (
          <button type="button" onClick={() => setNouveau(true)} className={`${btnPrimary} ms-auto`}>
            <Plus className="h-4 w-4" /> {t.nouvelle}
          </button>
        )}
      </div>

      {/* Tableau par statut : défilement horizontal sur mobile, colonnes sur grand écran. */}
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="grid min-w-[64rem] grid-cols-7 gap-3">
          {COLONNES.map((st) => (
            <div key={st} className="rounded-2xl bg-background/60 p-2">
              <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">{t.statuts[st]}</p>
              <div className="space-y-2">
                {candidatures
                  .filter((x) => x.statut === st)
                  .map((x) => (
                    <div
                      key={x.id}
                      role={gestion && x.statut !== 'inscrite' ? 'button' : undefined}
                      tabIndex={gestion && x.statut !== 'inscrite' ? 0 : undefined}
                      onClick={() => (gestion && x.statut !== 'inscrite' ? setSuivi(x) : undefined)}
                      onKeyDown={(e) => e.key === 'Enter' && gestion && x.statut !== 'inscrite' && setSuivi(x)}
                      className={`${cardClass} block w-full cursor-pointer p-3 text-start transition hover:border-primary/40`}
                    >
                      <p className="font-medium text-foreground">{x.prenom} {x.nom}</p>
                      <p className="mt-0.5 text-xs text-foreground-muted">
                        {x.niveaux?.nom}{x.series ? ` ${x.series.code}` : ''} · {x.etablissement_origine ?? '—'}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[0.7rem]">
                        {x.moyenne_origine !== null && <span className="rounded-full bg-background px-2 py-0.5">{t.moyenne} {x.moyenne_origine}</span>}
                        {x.date_test && <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5"><CalendarClock className="h-3 w-3" />{date(x.date_test)}</span>}
                        {x.note_test !== null && <span className="rounded-full bg-background px-2 py-0.5">{t.test} {x.note_test}/20</span>}
                      </div>
                      {x.statut === 'admise' && gestion && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setAInscrire(x)
                          }}
                          className="mt-2 inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
                        >
                          <GraduationCap className="h-3.5 w-3.5" /> {t.inscrire}
                        </button>
                      )}
                      {x.statut === 'inscrite' && x.eleve_id && (
                        <Link href={`/eleves/${x.eleve_id}`} onClick={(e) => e.stopPropagation()} className="mt-2 inline-block text-xs font-semibold text-primary">{t.voirFiche}</Link>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Nouvelle candidature */}
      <Modal
        open={nouveau}
        onClose={fermer}
        title={t.nouvelle}
        closeLabel={c.close}
        size="lg"
        footer={
          <>
            <button type="button" onClick={fermer} className={btnSecondary}>{c.cancel}</button>
            <button type="submit" form="form-candidature" disabled={enCours} className={btnPrimary}>{enCours ? c.creating : c.create}</button>
          </>
        }
      >
        <form id="form-candidature" action={(fd) => executer(() => creerCandidature(fd))} className="space-y-4">
          <input type="hidden" name="annee_id" value={anneeId} />
          {erreur && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ name="prenom" label={dict.eleves.form.prenom} required />
            <Champ name="nom" label={dict.eleves.form.nom} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="cd-sexe" className={labelClass}>{dict.eleves.form.sexe}</label>
              <select id="cd-sexe" name="sexe" className={inputClass}>
                <option value="M">{dict.scolarite.sexe.M}</option>
                <option value="F">{dict.scolarite.sexe.F}</option>
              </select>
            </div>
            <Champ name="date_naissance" label={dict.eleves.form.dateNaissance} type="date" />
            <Champ name="lieu_naissance" label={dict.eleves.form.lieuNaissance} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cd-niveau" className={labelClass}>{t.niveau}</label>
              <select id="cd-niveau" name="niveau_id" value={niveauChoisi} onChange={(e) => setNiveauChoisi(e.target.value)} className={inputClass}>
                {niveaux.map((n) => <option key={n.id} value={n.id}>{n.nom}</option>)}
              </select>
            </div>
            {aSeries && (
              <div>
                <label htmlFor="cd-serie" className={labelClass}>{dict.coefficients.serie}</label>
                <select id="cd-serie" name="serie_id" className={inputClass}>
                  <option value="">—</option>
                  {series.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Champ name="etablissement_origine" label={t.origine} />
            <Champ name="moyenne_origine" label={t.moyenneOrigine} inputMode="decimal" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Champ name="tuteur_nom" label={dict.eleves.form.tuteurNom} />
            <Champ name="tuteur_telephone" label={dict.eleves.form.tuteurTelephone} type="tel" />
            <Champ name="tuteur_email" label={dict.utilisateurs.email} type="email" />
          </div>
        </form>
      </Modal>

      {/* Suivi */}
      <Modal
        open={suivi !== null}
        onClose={fermer}
        title={suivi ? `${suivi.prenom} ${suivi.nom}` : ''}
        closeLabel={c.close}
        footer={
          <>
            <button type="button" onClick={fermer} className={btnSecondary}>{c.cancel}</button>
            <button type="submit" form="form-suivi" disabled={enCours} className={btnPrimary}>{enCours ? c.saving : c.save}</button>
          </>
        }
      >
        {suivi && (
          <form key={suivi.id} id="form-suivi" action={(fd) => executer(() => suivreCandidature(suivi.id, fd))} className="space-y-4">
            {erreur && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}
            <div>
              <label htmlFor="sv-statut" className={labelClass}>{t.statut}</label>
              <select id="sv-statut" name="statut" defaultValue={suivi.statut} className={inputClass}>
                {COLONNES.filter((st) => st !== 'inscrite').map((st) => <option key={st} value={st}>{t.statuts[st]}</option>)}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Champ name="date_test" label={t.dateTest} type="date" defaultValue={suivi.date_test ?? ''} />
              <Champ name="note_test" label={t.noteTest} inputMode="decimal" defaultValue={suivi.note_test ?? ''} />
            </div>
            <div>
              <label htmlFor="sv-comm" className={labelClass}>{t.commentaire}</label>
              <textarea id="sv-comm" name="commentaire" rows={3} defaultValue={suivi.commentaire ?? ''} className={inputClass} />
            </div>
          </form>
        )}
      </Modal>

      {/* Inscription d'un admis */}
      <Modal
        open={aInscrire !== null}
        onClose={fermer}
        title={t.inscrireTitre}
        closeLabel={c.close}
        footer={
          <>
            <button type="button" onClick={fermer} className={btnSecondary}>{c.cancel}</button>
            <button type="submit" form="form-inscrire" disabled={enCours} className={btnPrimary}>{enCours ? c.saving : t.inscrire}</button>
          </>
        }
      >
        {aInscrire && (
          <form id="form-inscrire" action={(fd) => executer(() => inscrireCandidat(aInscrire.id, (fd.get('classe_id') as string) ?? ''))} className="space-y-4">
            {erreur && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}
            <p className="text-sm text-foreground-muted">{aInscrire.prenom} {aInscrire.nom} · {aInscrire.niveaux?.nom}</p>
            <label htmlFor="ins-classe" className={labelClass}>{dict.eleves.classe}</label>
            <select id="ins-classe" name="classe_id" className={inputClass}>
              {classes
                .filter((cl) => cl.niveau_id === aInscrire.niveau_id)
                .concat(classes.filter((cl) => cl.niveau_id !== aInscrire.niveau_id))
                .map((cl) => <option key={cl.id} value={cl.id}>{cl.nom}</option>)}
            </select>
          </form>
        )}
      </Modal>
    </div>
  )
}

function Champ({ name, label, ...props }: { name: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={`cd-${name}`} className={labelClass}>{label}</label>
      <input id={`cd-${name}`} name={name} className={inputClass} {...props} />
    </div>
  )
}
