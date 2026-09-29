'use client'

import { useMemo, useState, useTransition } from 'react'
import { Ban, FileBadge, Printer } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { btnIcon, btnPrimary, btnSecondary, inputClass, labelClass } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import { echapper, enteteHtml, imprimerPages, tableauHtml } from '@/lib/impression'
import { fmt } from '@/lib/i18n'
import { TYPES_DOCUMENT, type TypeDocument } from '@/lib/documents'
import { annulerDocument, donneesDocument, emettreDocument } from './actions'

export type EleveAnnee = { id: string; nom: string; classe: string }

const erreurBloc = (e: string | null) => (e ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{e}</p> : null)

// Mise en page d'un document émis (une page A4, plusieurs pour un long relevé).
export async function imprimerDocument(id: string, lang: string, locale: string, dict: Dictionary) {
  const t = dict.documents
  const d = await donneesDocument(id)
  if (!d || !d.etablissement) {
    toast.error(dict.errors.generic)
    return
  }
  const c = d.contenu
  const e = c.eleve
  const g = (e.sexe === 'F' ? 'F' : 'M') as 'M' | 'F'
  const date = (iso: string | null | undefined) => (iso ? new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : '—')
  const n = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  const decision = (v: string | null | undefined) => (v ? dict.scolarite.decisions[v as keyof typeof dict.scolarite.decisions] ?? v : '—')
  const vars = {
    etablissement: d.etablissement.nom,
    eleve: `${e.prenom} ${e.nom}`,
    ne: t.genre.ne[g],
    inscrit: t.genre.inscrit[g],
    declare: t.genre.declare[g],
    naissance: date(e.date_naissance),
    lieu: e.lieu_naissance || '—',
    matricule: e.matricule,
    classe: c.classe ?? '—',
    annee: c.annee ?? '—',
    dateInscription: date(c.date_inscription),
    dateEntree: date(c.date_entree ?? c.date_inscription),
    moyenne: n(c.moyenne),
    decision: decision(c.decision),
    dateSortie: date(c.sortie?.date),
    motif: c.sortie?.motif || dict.scolarite.mouvements[(c.sortie?.type ?? 'transfert_sortant') as keyof typeof dict.scolarite.mouvements] || '—',
  }
  const titre = t.types[d.type]
  const annule = d.annule ? `<div style="position:absolute;inset:40% 0 auto;text-align:center;font-size:64px;font-weight:800;color:rgba(220,38,38,.18);transform:rotate(-18deg)">${echapper(t.annuleFiligrane)}</div>` : ''
  const verification = (inline: boolean) =>
    `<div class="verification"${inline ? ' style="position:static;margin-top:24px"' : ''}>${d.qr}<div><b>${echapper(t.verifiable)}</b><br><span class="num">${echapper(d.url)}</span><br>${echapper(t.code)} <b class="num">${echapper(d.code)}</b></div></div>`
  const faitA = `<p style="margin-top:22px;text-align:end">${echapper(fmt(t.faitA, { ville: d.etablissement.ville || '—', date: date(d.emis_le) }))}</p>`
  const signature = `<div class="signatures"><div></div><div><div class="ligne"></div>${echapper(t.signatureChef)}</div></div>`
  const entete = enteteHtml(d.etablissement, `<p><b>${echapper(t.numero)}</b> <span class="num">${echapper(d.numero)}</span></p>`)

  let corps: string
  if (d.type === 'releve_notes') {
    const annees = (c.cursus ?? [])
      .map(
        (a) => `<h3 style="margin:16px 0 4px;font-size:13px;color:#0f1b3d">${echapper(a.annee)} · ${echapper(a.classe)}</h3>
        ${tableauHtml([dict.eleves.matiere, dict.eleves.coef, dict.bulletin.moyenne], a.lignes.map((l) => [l.matiere, l.coefficient, n(l.moyenne)]))}
        <div class="bloc grille"><p><b>${echapper(dict.eleves.moyenneGenerale)}</b> <span class="num">${n(a.moyenne)} / 20</span></p><p><b>${echapper(dict.classes.rangCol)}</b> <span class="num">${a.rang ?? '—'} / ${a.effectif}</span></p><p><b>${echapper(dict.passages.finale)}</b> ${echapper(decision(a.decision))}</p></div>`
      )
      .join('')
    corps = `<div class="grille">
        <p><b>${echapper(dict.eleves.eleve)}</b> ${echapper(vars.eleve)}</p>
        <p><b>${echapper(dict.eleves.matricule)}</b> <span class="num">${echapper(e.matricule)}</span></p>
        <p><b>${echapper(dict.eleves.form.dateNaissance)}</b> ${echapper(vars.naissance)} · ${echapper(vars.lieu)}</p>
        <p><b>${echapper(dict.bulletin.anneeScolaire)}</b> ${echapper(vars.annee)}</p>
      </div>${annees || `<p>${echapper(dict.classes.aucuneNote)}</p>`}${faitA}${signature}${verification(true)}`
  } else {
    let texte = fmt(t.textes[d.type], vars)
    if (d.type === 'exeat' && (c.reste_du ?? 0) > 0) texte += ' ' + fmt(t.resteDu, { montant: `${(c.reste_du ?? 0).toLocaleString(locale)} ${dict.abonnement.fcfa}` })
    else if (d.type === 'exeat') texte += ' ' + t.libreEngagement
    corps = `<p class="texte">${echapper(texte)}</p><p class="texte">${echapper(t.foi)}</p>${faitA}${signature}${verification(false)}`
  }

  const page = `<div class="page">${annule}${entete}<div class="titre">${echapper(titre)}</div>${corps}</div>`
  if (!imprimerPages(`${titre} ${d.numero}`, [page], lang)) toast.error(dict.bulletin.popup)
}

// Émission : élève (choisi dans l'année ou imposé depuis sa fiche) et type.
export function EmettreDocumentButton({
  anneeId,
  eleves,
  eleveFixe,
  typeFixe,
  libelle,
  dict,
  lang,
  locale,
}: {
  anneeId: string | null
  eleves?: EleveAnnee[]
  eleveFixe?: string
  typeFixe?: TypeDocument
  libelle?: string
  dict: Dictionary
  lang: string
  locale: string
}) {
  const t = dict.documents
  const [ouvert, setOuvert] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()
  const classes = useMemo(() => [...new Set((eleves ?? []).map((e) => e.classe))].sort(), [eleves])
  const [classe, setClasse] = useState(classes[0] ?? '')

  const emettre = (eleveId: string, type: string, forcer = false) =>
    startTransition(async () => {
      setErreur(null)
      const r = await emettreDocument(eleveId, type, anneeId, forcer)
      if (r.impaye) {
        if (confirm(fmt(t.confirmImpaye, { montant: `${r.impaye.toLocaleString(locale)} ${dict.abonnement.fcfa}` }))) emettre(eleveId, type, true)
        return
      }
      if (r.error) {
        setErreur(r.error)
        if (!ouvert) toast.error(r.error)
        return
      }
      setOuvert(false)
      toast.success(t.emisOk)
      if (r.id) await imprimerDocument(r.id, lang, locale, dict)
    })

  // Type et élève imposés : émission directe, sans fenêtre.
  if (eleveFixe && typeFixe) {
    return (
      <button type="button" onClick={() => emettre(eleveFixe, typeFixe)} disabled={enCours} className={btnSecondary}>
        <FileBadge className="h-4 w-4" /> {enCours ? dict.bulletin.preparation : libelle ?? t.types[typeFixe]}
      </button>
    )
  }

  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className={eleveFixe ? btnSecondary : btnPrimary}>
        <FileBadge className="h-4 w-4" /> {libelle ?? t.emettre}
      </button>
      <Modal
        open={ouvert}
        onClose={() => setOuvert(false)}
        title={t.emettre}
        closeLabel={dict.common.close}
        footer={
          <>
            <button type="button" onClick={() => setOuvert(false)} className={btnSecondary}>{dict.common.cancel}</button>
            <button type="submit" form="form-document" disabled={enCours} className={btnPrimary}>{enCours ? dict.bulletin.preparation : t.emettreImprimer}</button>
          </>
        }
      >
        <form
          id="form-document"
          action={(fd) => emettre(eleveFixe ?? String(fd.get('eleve_id') ?? ''), typeFixe ?? String(fd.get('type') ?? ''))}
          className="space-y-4"
        >
          {erreurBloc(erreur)}
          {!eleveFixe && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="doc-classe" className={labelClass}>{dict.eleves.classe}</label>
                <select id="doc-classe" value={classe} onChange={(ev) => setClasse(ev.target.value)} className={inputClass}>
                  {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="doc-eleve" className={labelClass}>{dict.eleves.eleve}</label>
                <select id="doc-eleve" name="eleve_id" required className={inputClass}>
                  {(eleves ?? []).filter((e) => e.classe === classe).map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
                </select>
              </div>
            </div>
          )}
          {!typeFixe && (
            <fieldset>
              <legend className={labelClass}>{t.type}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {TYPES_DOCUMENT.map((ty, i) => (
                  <label key={ty} className="flex cursor-pointer items-start gap-2 rounded-lg border border-surface-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                    <input type="radio" name="type" value={ty} defaultChecked={i === 0} className="mt-0.5" />
                    <span>
                      <span className="block font-medium text-foreground">{t.types[ty]}</span>
                      <span className="block text-xs text-foreground-muted">{t.aides[ty]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </form>
      </Modal>
    </>
  )
}

export function LigneDocumentActions({ id, annule, ecriture, dict, lang, locale }: { id: string; annule: boolean; ecriture: boolean; dict: Dictionary; lang: string; locale: string }) {
  const [enCours, startTransition] = useTransition()
  return (
    <div className="flex justify-end gap-1">
      <button type="button" onClick={() => startTransition(() => imprimerDocument(id, lang, locale, dict))} disabled={enCours} className={btnIcon} aria-label={dict.documents.reimprimer} title={dict.documents.reimprimer}>
        <Printer className="h-4 w-4" />
      </button>
      {ecriture && !annule && (
        <button
          type="button"
          disabled={enCours}
          onClick={() => {
            if (!confirm(dict.documents.confirmAnnulation)) return
            startTransition(async () => {
              const r = await annulerDocument(id)
              if (r.error) toast.error(r.error)
            })
          }}
          className={`${btnIcon} hover:text-danger`}
          aria-label={dict.documents.annuler}
          title={dict.documents.annuler}
        >
          <Ban className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
