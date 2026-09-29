'use client'

import { useMemo, useState, useTransition } from 'react'
import { Printer, Ticket, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { btnIcon, btnPrimary, btnSecondary, hintClass, inputClass, labelClass } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import { echapper, enteteHtml, imprimerPages } from '@/lib/impression'
import { TYPES_BILLET, type TypeBillet } from '@/lib/billets'
import { donneesBillet, emettreBillet, supprimerBillet } from './actions'

export type EleveAnnee = { id: string; nom: string; classe: string }

// Impression : deux volets identiques sur une page A4 (élève / souche
// conservée par la surveillance), séparés par un trait de coupe.
export async function imprimerBillet(id: string, lang: string, locale: string, dict: Dictionary) {
  const t = dict.billets
  const b = await donneesBillet(id)
  if (!b || !b.etablissement || !b.eleve) {
    toast.error(dict.errors.generic)
    return
  }
  const type = b.type as TypeBillet
  const quand = new Date(b.emis_le)
  const ligne = (k: string, v: string | null | undefined) => (v ? `<p><b>${echapper(k)}</b> ${echapper(v)}</p>` : '')
  const visas: Record<TypeBillet, string[]> = {
    entree: [t.visaSurveillance, t.visaProfesseur],
    sortie: [t.visaSurveillance, t.visaAccompagnant],
    visite_medicale: [t.visaSurveillance, t.visaInfirmerie],
    retard: [t.visaSurveillance, t.visaProfesseur],
  }
  const volet = (nomVolet: string) => `
    <div style="height:138mm;position:relative;padding-top:2mm">
      ${enteteHtml(b.etablissement!, `<p><b>${echapper(t.numero)}</b> <span class="num">${echapper(b.numero)}</span></p><p style="font-size:10px;color:#64748b">${echapper(nomVolet)}</p>`)}
      <div class="titre" style="margin:8px 0 10px">${echapper(t.types[type])}</div>
      <div class="grille">
        ${ligne(dict.eleves.eleve, `${b.eleve!.prenom} ${b.eleve!.nom}`)}
        ${ligne(dict.eleves.matricule, b.eleve!.matricule)}
        ${ligne(dict.eleves.classe, b.classe)}
        ${ligne(t.dateHeure, quand.toLocaleString(locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))}
        ${type === 'retard' ? ligne(t.minutes, String(b.minutes_retard ?? '')) : ''}
        ${b.heure_retour ? ligne(t.heureRetour, b.heure_retour.slice(0, 5)) : ''}
        ${ligne(type === 'sortie' ? t.accompagnant : type === 'visite_medicale' ? t.lieu : t.precisions, b.details)}
      </div>
      ${b.motif ? `<div class="bloc"><b>${echapper(t.motif)}</b> ${echapper(b.motif)}</div>` : ''}
      <p style="margin-top:10px;font-size:11.5px">${echapper(t.phrases[type])}</p>
      <div class="signatures" style="margin-top:18px">${visas[type].map((v) => `<div><div class="ligne"></div>${echapper(v)}</div>`).join('')}</div>
    </div>`
  const page = `<div class="page" style="padding-top:8mm;padding-bottom:0">${volet(t.voletEleve)}<div style="border-top:1.5px dashed #94a3b8;margin:3mm 0;position:relative"><span style="position:absolute;top:-8px;inset-inline-start:0;background:#fff;padding:0 6px;font-size:10px;color:#94a3b8">✂</span></div>${volet(t.voletSouche)}</div>`
  if (!imprimerPages(`${t.types[type]} ${b.numero}`, [page], lang)) toast.error(dict.bulletin.popup)
}

export function EmettreBilletButton({ anneeId, eleves, dict, lang, locale }: { anneeId: string; eleves: EleveAnnee[]; dict: Dictionary; lang: string; locale: string }) {
  const t = dict.billets
  const [ouvert, setOuvert] = useState(false)
  const [type, setType] = useState<TypeBillet>('retard')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()
  const classes = useMemo(() => [...new Set(eleves.map((e) => e.classe))].sort(), [eleves])
  const [classe, setClasse] = useState(classes[0] ?? '')

  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className={btnPrimary}><Ticket className="h-4 w-4" /> {t.nouveau}</button>
      <Modal
        open={ouvert}
        onClose={() => setOuvert(false)}
        title={t.nouveau}
        closeLabel={dict.common.close}
        footer={
          <>
            <button type="button" onClick={() => setOuvert(false)} className={btnSecondary}>{dict.common.cancel}</button>
            <button type="submit" form="form-billet" disabled={enCours} className={btnPrimary}>{enCours ? dict.common.saving : t.emettreImprimer}</button>
          </>
        }
      >
        <form
          id="form-billet"
          action={(fd) =>
            startTransition(async () => {
              setErreur(null)
              const r = await emettreBillet(fd)
              if (r.error) setErreur(r.error)
              else {
                toast.success(t.emisOk)
                setOuvert(false)
                if (r.id) await imprimerBillet(r.id, lang, locale, dict)
              }
            })
          }
          className="space-y-4"
        >
          <input type="hidden" name="annee_id" value={anneeId} />
          {erreur && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}
          <fieldset>
            <legend className={labelClass}>{t.type}</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {TYPES_BILLET.map((ty) => (
                <label key={ty} className="flex cursor-pointer items-center gap-2 rounded-lg border border-surface-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                  <input type="radio" name="type" value={ty} checked={type === ty} onChange={() => setType(ty)} />
                  {t.types[ty]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="bi-classe" className={labelClass}>{dict.eleves.classe}</label>
              <select id="bi-classe" value={classe} onChange={(e) => setClasse(e.target.value)} className={inputClass}>
                {classes.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="bi-eleve" className={labelClass}>{dict.eleves.eleve}</label>
              <select id="bi-eleve" name="eleve_id" required className={inputClass}>
                {eleves.filter((e) => e.classe === classe).map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
              </select>
            </div>
          </div>
          {type === 'retard' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="bi-min" className={labelClass}>{t.minutes}</label><input id="bi-min" name="minutes_retard" type="number" min={1} max={599} required defaultValue={10} className={inputClass} /></div>
              <label className="flex items-end gap-2 pb-2 text-sm text-foreground"><input type="checkbox" name="enregistrer_retard" defaultChecked /> {t.enregistrerRetard}</label>
            </div>
          )}
          {(type === 'sortie' || type === 'visite_medicale') && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="bi-det" className={labelClass}>{type === 'sortie' ? t.accompagnant : t.lieu}</label>
                <input id="bi-det" name="details" maxLength={200} placeholder={type === 'sortie' ? t.accompagnantPlaceholder : t.lieuPlaceholder} className={inputClass} />
              </div>
              <div><label htmlFor="bi-ret" className={labelClass}>{t.heureRetour}</label><input id="bi-ret" name="heure_retour" type="time" className={inputClass} /></div>
            </div>
          )}
          {type === 'entree' && (
            <div><label htmlFor="bi-det" className={labelClass}>{t.precisions}</label><input id="bi-det" name="details" maxLength={200} placeholder={t.precisionsPlaceholder} className={inputClass} /></div>
          )}
          <div>
            <label htmlFor="bi-motif" className={labelClass}>{t.motif}</label>
            <textarea id="bi-motif" name="motif" rows={2} maxLength={500} required={type === 'sortie' || type === 'visite_medicale'} className={inputClass} />
            <p className={hintClass}>{t.aides[type]}</p>
          </div>
        </form>
      </Modal>
    </>
  )
}

export function LigneBilletActions({ id, ecriture, dict, lang, locale }: { id: string; ecriture: boolean; dict: Dictionary; lang: string; locale: string }) {
  const [enCours, startTransition] = useTransition()
  return (
    <div className="flex justify-end gap-1">
      <button type="button" onClick={() => startTransition(() => imprimerBillet(id, lang, locale, dict))} disabled={enCours} className={btnIcon} aria-label={dict.billets.reimprimer} title={dict.billets.reimprimer}>
        <Printer className="h-4 w-4" />
      </button>
      {ecriture && (
        <button
          type="button"
          disabled={enCours}
          onClick={() => {
            if (!confirm(dict.billets.confirmSuppression)) return
            startTransition(async () => {
              const r = await supprimerBillet(id)
              if (r.error) toast.error(r.error)
            })
          }}
          className={`${btnIcon} hover:text-danger`}
          aria-label={dict.common.delete}
          title={dict.common.delete}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
