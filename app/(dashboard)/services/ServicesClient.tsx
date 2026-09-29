'use client'

import { useMemo, useState, useTransition } from 'react'
import { Plus, Printer, Trash2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { btnIcon, btnPrimary, btnSecondary, inputClass, labelClass } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import { echapper, enteteHtml, imprimerPages } from '@/lib/impression'
import { fmt } from '@/lib/i18n'
import { MODES_PAIEMENT } from '@/lib/finances'
import { ajouterFrais, annulerPaiement, donneesRecu, encaisser, retirerService, souscrireService, supprimerFrais } from './actions'

export type EleveAnnee = { id: string; nom: string; classe: string }
const erreurBloc = (e: string | null) => (e ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{e}</p> : null)

// Sélecteur d'élève : filtre par classe puis liste des élèves.
function ChoixEleve({ eleves, dict, name = 'eleve_id' }: { eleves: EleveAnnee[]; dict: Dictionary; name?: string }) {
  const classes = useMemo(() => [...new Set(eleves.map((e) => e.classe))].sort(), [eleves])
  const [classe, setClasse] = useState(classes[0] ?? '')
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor={`${name}-classe`} className={labelClass}>{dict.eleves.classe}</label>
        <select id={`${name}-classe`} value={classe} onChange={(e) => setClasse(e.target.value)} className={inputClass}>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={name} className={labelClass}>{dict.eleves.eleve}</label>
        <select id={name} name={name} required className={inputClass}>
          {eleves.filter((e) => e.classe === classe).map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
        </select>
      </div>
    </div>
  )
}

export function FraisEditor({ anneeId, frais, niveaux, ecriture, locale, dict }: { anneeId: string; frais: { id: string; libelle: string; montant: number; niveau: string | null; date_echeance: string | null }[]; niveaux: { id: string; nom: string }[]; ecriture: boolean; locale: string; dict: Dictionary }) {
  const t = dict.finances
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()
  return (
    <div>
      <ul className="divide-y divide-surface-border">
        {frais.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <span className="min-w-40 flex-1 font-medium text-foreground">{f.libelle}</span>
            <span className="text-sm text-foreground-muted">{f.niveau ?? t.tousNiveaux}</span>
            {f.date_echeance && <span className="text-xs text-foreground-muted">{new Date(f.date_echeance + 'T00:00:00').toLocaleDateString(locale)}</span>}
            <span className="font-semibold tabular-nums">{f.montant.toLocaleString(locale)} {dict.abonnement.fcfa}</span>
            {ecriture && (
              <button type="button" onClick={() => startTransition(async () => { const r = await supprimerFrais(f.id); if (r.error) toast.error(r.error) })} className={`${btnIcon} hover:text-danger`} aria-label={dict.common.delete}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
        {frais.length === 0 && <li className="px-5 py-8 text-center text-sm text-foreground-muted">{t.aucunFrais}</li>}
      </ul>
      {ecriture && (
        <form
          action={(fd) =>
            startTransition(async () => {
              setErreur(null)
              const r = await ajouterFrais(anneeId, fd)
              if (r.error) setErreur(r.error)
              else toast.success(dict.common.created)
            })
          }
          className="grid gap-3 border-t border-surface-border p-5 sm:grid-cols-2 lg:grid-cols-[2fr_1.4fr_1fr_1fr_auto] lg:items-end"
        >
          <div><label htmlFor="fr-lib" className={labelClass}>{dict.fields.libelle}</label><input id="fr-lib" name="libelle" required placeholder={t.libelleFraisPlaceholder} className={inputClass} /></div>
          <div>
            <label htmlFor="fr-niv" className={labelClass}>{dict.coefficients.niveau}</label>
            <select id="fr-niv" name="niveau_id" className={inputClass}>
              <option value="">{t.tousNiveaux}</option>
              {niveaux.map((n) => <option key={n.id} value={n.id}>{n.nom}</option>)}
            </select>
          </div>
          <div><label htmlFor="fr-mt" className={labelClass}>{t.montant}</label><input id="fr-mt" name="montant" inputMode="numeric" required className={inputClass} /></div>
          <div><label htmlFor="fr-ech" className={labelClass}>{dict.abonnement.echeance}</label><input id="fr-ech" name="date_echeance" type="date" className={inputClass} /></div>
          <button type="submit" disabled={enCours} className={btnPrimary}><Plus className="h-4 w-4" /> {dict.emplois.ajouter}</button>
          <div className="sm:col-span-2 lg:col-span-5">{erreurBloc(erreur)}</div>
        </form>
      )}
    </div>
  )
}

export function SouscriptionsEditor({ anneeId, services, souscriptions, eleves, ecriture, dict }: { anneeId: string; services: { id: string; nom: string }[]; souscriptions: { id: string; service: string; eleve: string; classe: string; details: string | null }[]; eleves: EleveAnnee[]; ecriture: boolean; dict: Dictionary }) {
  const t = dict.finances
  const [ouvert, setOuvert] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()
  const parService = services.map((s) => ({ ...s, lignes: souscriptions.filter((x) => x.service === s.nom) }))
  return (
    <div>
      {ecriture && (
        <div className="flex justify-end border-b border-surface-border px-5 py-3">
          <button type="button" onClick={() => setOuvert(true)} className={btnPrimary}><Plus className="h-4 w-4" /> {t.nouvelleSouscription}</button>
        </div>
      )}
      {parService.map((s) => (
        <details key={s.id} className="border-b border-surface-border px-5 py-3 last:border-b-0">
          <summary className="cursor-pointer font-medium text-foreground">{s.nom} <span className="text-sm font-normal text-foreground-muted">· {fmt(dict.eleves.effectif, { n: s.lignes.length })}</span></summary>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {s.lignes.map((l) => (
              <li key={l.id} className="flex items-center gap-2 rounded-lg bg-background px-3 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate">{l.eleve} <span className="text-xs text-foreground-muted">· {l.classe}{l.details ? ` · ${l.details}` : ''}</span></span>
                {ecriture && (
                  <button type="button" onClick={() => startTransition(async () => { const r = await retirerService(l.id); if (r.error) toast.error(r.error) })} className={`${btnIcon} hover:text-danger`} aria-label={dict.common.delete}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      ))}
      <Modal
        open={ouvert}
        onClose={() => setOuvert(false)}
        title={t.nouvelleSouscription}
        closeLabel={dict.common.close}
        footer={
          <>
            <button type="button" onClick={() => setOuvert(false)} className={btnSecondary}>{dict.common.cancel}</button>
            <button type="submit" form="form-souscription" disabled={enCours} className={btnPrimary}>{enCours ? dict.common.saving : dict.common.save}</button>
          </>
        }
      >
        <form
          id="form-souscription"
          action={(fd) =>
            startTransition(async () => {
              setErreur(null)
              const r = await souscrireService((fd.get('eleve_id') as string) ?? '', (fd.get('service_id') as string) ?? '', anneeId, (fd.get('details') as string) ?? '')
              if (r.error) setErreur(r.error)
              else {
                toast.success(dict.common.created)
                setOuvert(false)
              }
            })
          }
          className="space-y-4"
        >
          {erreurBloc(erreur)}
          <ChoixEleve eleves={eleves} dict={dict} />
          <div>
            <label htmlFor="sv-service" className={labelClass}>{t.service}</label>
            <select id="sv-service" name="service_id" className={inputClass}>
              {services.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </div>
          <div><label htmlFor="sv-details" className={labelClass}>{t.details}</label><input id="sv-details" name="details" placeholder={t.detailsPlaceholder} className={inputClass} /></div>
        </form>
      </Modal>
    </div>
  )
}

// Reçu imprimable (une page).
export async function imprimerRecu(paiementId: string, lang: string, locale: string, dict: Dictionary) {
  const r = await donneesRecu(paiementId)
  if (!r) return
  const un = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)
  const etab = un(r.etablissements as never) as { nom: string; sigle: string | null; adresse: string | null; ville: string | null; telephone: string | null; email: string | null } | null
  const el = un(r.eleves as never) as { prenom: string; nom: string; matricule: string } | null
  const an = un(r.annees_scolaires as never) as { libelle: string } | null
  const t = dict.finances
  const page = `<div class="page">
    ${enteteHtml(etab ?? { nom: '' }, `<p><b>${echapper(t.recu)}</b> <span class="num">${echapper(r.numero_recu)}</span></p><p>${echapper(new Date(r.date_paiement + 'T00:00:00').toLocaleDateString(locale))}</p>`)}
    <div class="titre">${echapper(t.recuTitre)}</div>
    <div class="grille">
      <p><b>${echapper(dict.eleves.eleve)}</b> ${echapper(`${el?.prenom ?? ''} ${el?.nom ?? ''}`)}</p>
      <p><b>${echapper(dict.eleves.matricule)}</b> <span class="num">${echapper(el?.matricule)}</span></p>
      <p><b>${echapper(dict.scolarite.annee)}</b> ${echapper(an?.libelle)}</p>
      <p><b>${echapper(t.mode)}</b> ${echapper(t.modes[r.mode as keyof typeof t.modes] ?? r.mode)}${r.reference ? ` · <span class="num">${echapper(r.reference)}</span>` : ''}</p>
    </div>
    <div class="bloc"><p><b>${echapper(dict.fields.libelle)}</b> ${echapper(r.libelle)}</p><p style="font-size:18px;margin-top:8px"><b>${echapper(t.montant)}</b> <span class="num">${Number(r.montant).toLocaleString(locale)} FCFA</span></p></div>
    <div class="signatures"><div><div class="ligne"></div>${echapper(t.signatureCaisse)}</div><div><div class="ligne"></div>${echapper(t.signatureParent)}</div></div>
  </div>`
  if (!imprimerPages(`${t.recu} ${r.numero_recu}`, [page], lang)) toast.error(dict.bulletin.popup)
}

export function EncaissementButton({ anneeId, eleves, suggestions, dict, lang, locale }: { anneeId: string; eleves: EleveAnnee[]; suggestions: string[]; dict: Dictionary; lang: string; locale: string }) {
  const t = dict.finances
  const [ouvert, setOuvert] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()
  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className={btnPrimary}><Wallet className="h-4 w-4" /> {t.encaisser}</button>
      <Modal
        open={ouvert}
        onClose={() => setOuvert(false)}
        title={t.encaisser}
        closeLabel={dict.common.close}
        footer={
          <>
            <button type="button" onClick={() => setOuvert(false)} className={btnSecondary}>{dict.common.cancel}</button>
            <button type="submit" form="form-encaisser" disabled={enCours} className={btnPrimary}>{enCours ? dict.common.saving : t.encaisserImprimer}</button>
          </>
        }
      >
        <form
          id="form-encaisser"
          action={(fd) =>
            startTransition(async () => {
              setErreur(null)
              const r = await encaisser(fd)
              if (r.error) setErreur(r.error)
              else {
                toast.success(fmt(t.encaisseOk, { numero: r.recu?.numero ?? '' }))
                setOuvert(false)
                if (r.recu) await imprimerRecu(r.recu.id, lang, locale, dict)
              }
            })
          }
          className="space-y-4"
        >
          <input type="hidden" name="annee_id" value={anneeId} />
          {erreurBloc(erreur)}
          <ChoixEleve eleves={eleves} dict={dict} />
          <div>
            <label htmlFor="enc-lib" className={labelClass}>{dict.fields.libelle}</label>
            <input id="enc-lib" name="libelle" list="enc-suggestions" required className={inputClass} />
            <datalist id="enc-suggestions">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label htmlFor="enc-mt" className={labelClass}>{t.montant}</label><input id="enc-mt" name="montant" inputMode="numeric" required className={inputClass} /></div>
            <div>
              <label htmlFor="enc-mode" className={labelClass}>{t.mode}</label>
              <select id="enc-mode" name="mode" className={inputClass}>{MODES_PAIEMENT.map((m) => <option key={m} value={m}>{t.modes[m]}</option>)}</select>
            </div>
            <div><label htmlFor="enc-date" className={labelClass}>{dict.assiduite.date}</label><input id="enc-date" name="date_paiement" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass} /></div>
          </div>
          <div><label htmlFor="enc-ref" className={labelClass}>{t.reference}</label><input id="enc-ref" name="reference" className={inputClass} /></div>
        </form>
      </Modal>
    </>
  )
}

export function LignePaiementActions({ id, ecriture, dict, lang, locale }: { id: string; ecriture: boolean; dict: Dictionary; lang: string; locale: string }) {
  const [enCours, startTransition] = useTransition()
  return (
    <div className="flex gap-1">
      <button type="button" onClick={() => startTransition(() => imprimerRecu(id, lang, locale, dict))} disabled={enCours} className={btnIcon} aria-label={dict.finances.recu} title={dict.finances.recu}>
        <Printer className="h-4 w-4" />
      </button>
      {ecriture && (
        <button
          type="button"
          disabled={enCours}
          onClick={() => {
            if (!confirm(dict.finances.confirmAnnulation)) return
            startTransition(async () => {
              const r = await annulerPaiement(id)
              if (r.error) toast.error(r.error)
            })
          }}
          className={`${btnIcon} hover:text-danger`}
          aria-label={dict.common.delete}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
