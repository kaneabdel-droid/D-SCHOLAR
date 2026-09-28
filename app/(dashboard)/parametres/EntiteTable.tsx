'use client'

import { useState, useTransition } from 'react'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { btnIcon, btnPrimary, btnSecondary, cardClass, hintClass, inputClass, labelClass } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import { CYCLES } from '@/lib/abonnements/paliers'
import { ENTITES, TYPES_SALLE, type Champ, type EntiteCle, type Ligne } from '@/lib/parametres/entites'
import { fmt } from '@/lib/i18n'
import { enregistrerEntite, supprimerEntite } from './actions'

// Tableau + formulaire générique d'une table du référentiel (cf. lib/parametres/entites.ts).
export default function EntiteTable({
  cle,
  lignes,
  dict,
  cyclesAutorises,
  lectureSeule = false,
}: {
  cle: EntiteCle
  lignes: Ligne[]
  dict: Dictionary
  cyclesAutorises?: string[]
  lectureSeule?: boolean
}) {
  const entite = ENTITES[cle]
  const t = dict[cle]
  const c = dict.common
  const colonnes = entite.champs.filter((ch) => ch.colonne)

  const [edition, setEdition] = useState<Ligne | 'nouveau' | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()

  const optionsDe = (champ: Champ): { valeur: string; libelle: string; desactive?: boolean }[] => {
    if (champ.options === 'cycles') {
      return CYCLES.map((v) => ({ valeur: v, libelle: dict.cycles[v], desactive: cyclesAutorises ? !cyclesAutorises.includes(v) : false }))
    }
    if (champ.options === 'typesSalle') return TYPES_SALLE.map((v) => ({ valeur: v, libelle: dict.salles.types[v] }))
    return []
  }

  const affichage = (champ: Champ, valeur: Ligne[string]) => {
    if (champ.type === 'checkbox') {
      if (champ.nom === 'actif') {
        return valeur ? (
          <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">{c.active}</span>
        ) : (
          <span className="rounded-full bg-foreground-muted/10 px-2 py-0.5 text-xs font-medium text-foreground-muted">{c.inactive}</span>
        )
      }
      return valeur ? <Check className="h-4 w-4 text-primary" /> : <span className="text-foreground-muted">—</span>
    }
    if (champ.type === 'color') return <span className="block h-5 w-5 rounded-md ring-1 ring-black/10" style={{ background: String(valeur) }} />
    if (champ.type === 'select') return optionsDe(champ).find((o) => o.valeur === valeur)?.libelle ?? '—'
    if (valeur === null || valeur === '') return <span className="text-foreground-muted">—</span>
    return String(valeur)
  }

  const fermer = () => {
    setEdition(null)
    setErreur(null)
  }

  const soumettre = (formData: FormData) => {
    setErreur(null)
    const id = edition && edition !== 'nouveau' ? edition.id : null
    startTransition(async () => {
      const res = await enregistrerEntite(cle, id, formData)
      if (res.error) setErreur(res.error)
      else {
        toast.success(id ? c.saved : c.created)
        fermer()
      }
    })
  }

  const supprimer = (ligne: Ligne) => {
    if (!confirm(fmt(c.confirmDelete, { nom: String(ligne.nom ?? ligne.code ?? '') }))) return
    startTransition(async () => {
      const res = await supprimerEntite(cle, ligne.id)
      if (res.error) toast.error(res.error)
      else toast.success(c.deleted)
    })
  }

  const valeurInitiale = (champ: Champ) => {
    if (edition && edition !== 'nouveau') return edition[champ.nom]
    return champ.defaut ?? null
  }

  return (
    <section className={cardClass}>
      <div className="flex flex-col gap-3 border-b border-surface-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-heading text-base font-semibold text-foreground">{t.title}</h2>
          <p className="mt-0.5 text-sm text-foreground-muted">{t.desc}</p>
        </div>
        {!lectureSeule && (
          <button type="button" onClick={() => setEdition('nouveau')} className={`${btnPrimary} shrink-0`}>
            <Plus className="h-4 w-4" /> {t.newButton}
          </button>
        )}
      </div>

      {lignes.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-foreground-muted">{t.empty}</p>
      ) : (
        <>
          {/* Mobile : cartes */}
          <ul className="divide-y divide-surface-border sm:hidden">
            {lignes.map((ligne) => (
              <li key={ligne.id} className="flex items-start gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium text-foreground">
                    {cle === 'matieres' && <span className="me-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: String(ligne.couleur) }} />}
                    {String(ligne.nom ?? '')}
                    {ligne.code ? <span className="ms-2 text-xs font-semibold text-foreground-muted">{String(ligne.code)}</span> : null}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-muted">
                    {colonnes
                      .filter((ch) => !['nom', 'code', 'couleur'].includes(ch.nom))
                      .map((ch) => (
                        <span key={ch.nom} className="inline-flex items-center gap-1">
                          {ch.nom !== 'actif' && <span className="text-foreground-muted/70">{dict.fields[ch.nom]}</span>}
                          {affichage(ch, ligne[ch.nom])}
                        </span>
                      ))}
                  </div>
                </div>
                {!lectureSeule && (
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => setEdition(ligne)} className={btnIcon} aria-label={c.edit}><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => supprimer(ligne)} className={`${btnIcon} hover:text-danger`} aria-label={c.delete}><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {/* sm+ : tableau */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-start text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  {colonnes.map((ch) => (
                    <th key={ch.nom} className="px-5 py-3 text-start font-semibold">{dict.fields[ch.nom]}</th>
                  ))}
                  {!lectureSeule && <th className="px-5 py-3"><span className="sr-only">{c.actions}</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {lignes.map((ligne) => (
                  <tr key={ligne.id} className="transition-colors hover:bg-background/60">
                    {colonnes.map((ch) => (
                      <td key={ch.nom} className={`px-5 py-3 ${ch.nom === 'nom' ? 'font-medium text-foreground' : 'text-foreground-muted'}`}>
                        {affichage(ch, ligne[ch.nom])}
                      </td>
                    ))}
                    {!lectureSeule && (
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setEdition(ligne)} className={btnIcon} title={c.edit} aria-label={c.edit}><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => supprimer(ligne)} className={`${btnIcon} hover:text-danger`} title={c.delete} aria-label={c.delete}><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal
        open={edition !== null}
        onClose={fermer}
        title={edition === 'nouveau' ? t.newTitle : t.editTitle}
        closeLabel={c.close}
        footer={
          <>
            <button type="button" onClick={fermer} className={btnSecondary}>{c.cancel}</button>
            <button type="submit" form={`form-${cle}`} disabled={enCours} className={btnPrimary}>
              {enCours ? c.saving : c.save}
            </button>
          </>
        }
      >
        {/* key : remonte le formulaire (valeurs par défaut) à chaque ouverture */}
        <form key={edition === 'nouveau' ? 'nouveau' : edition?.id ?? 'ferme'} id={`form-${cle}`} action={soumettre} className="space-y-4">
          {erreur && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}
          {entite.champs.map((champ) => {
            const valeur = valeurInitiale(champ)
            const id = `${cle}-${champ.nom}`
            if (champ.type === 'checkbox') {
              return (
                <label key={champ.nom} htmlFor={id} className="flex items-start gap-3 rounded-lg border border-surface-border px-3 py-2.5">
                  <input id={id} name={champ.nom} type="checkbox" defaultChecked={Boolean(valeur)} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
                  <span className="text-sm text-foreground">
                    {dict.fields[champ.nom]}
                    {cle === 'niveaux' && champ.nom === 'a_series' && <span className={hintClass + ' block'}>{dict.niveaux.aSeriesHint}</span>}
                  </span>
                </label>
              )
            }
            return (
              <div key={champ.nom}>
                <label htmlFor={id} className={labelClass}>
                  {dict.fields[champ.nom]}
                  {!champ.requis && champ.type !== 'color' && <span className="ms-1 font-normal text-foreground-muted">({c.optional})</span>}
                </label>
                {champ.type === 'select' ? (
                  <select id={id} name={champ.nom} required={champ.requis} defaultValue={valeur == null ? '' : String(valeur)} className={inputClass}>
                    <option value="" disabled>—</option>
                    {optionsDe(champ).map((o) => (
                      <option key={o.valeur} value={o.valeur} disabled={o.desactive}>{o.libelle}</option>
                    ))}
                  </select>
                ) : champ.type === 'color' ? (
                  <input id={id} name={champ.nom} type="color" defaultValue={String(valeur ?? '#2563EB')} className="mt-1.5 block h-10 w-20 cursor-pointer rounded-lg border border-surface-border bg-background p-1" />
                ) : (
                  <input
                    id={id}
                    name={champ.nom}
                    type={champ.type === 'number' ? 'number' : 'text'}
                    inputMode={champ.type === 'number' ? 'numeric' : undefined}
                    min={champ.type === 'number' ? 0 : undefined}
                    step={champ.entier ? 1 : 'any'}
                    maxLength={champ.max}
                    required={champ.requis}
                    defaultValue={valeur == null ? '' : String(valeur)}
                    className={`${inputClass} ${champ.majuscules ? 'uppercase' : ''}`}
                  />
                )}
              </div>
            )
          })}
        </form>
      </Modal>
    </section>
  )
}
