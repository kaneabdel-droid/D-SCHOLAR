'use client'

import { useTransition } from 'react'
import { Printer } from 'lucide-react'
import { toast } from 'sonner'
import { btnSecondary } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import { echapper, enteteHtml, imprimerPages, tableauHtml } from '@/lib/impression'
import { libellePeriode } from '@/lib/scolarite'
import { donneesBulletins } from './bulletins'

// Un bulletin par élève (une page A4 chacun), imprimé par le navigateur.
export default function ImprimerBulletins({ classeId, periodeId, locale, lang, dict, libelle }: { classeId: string; periodeId: string | null; locale: string; lang: string; dict: Dictionary; libelle?: string }) {
  const t = dict.bulletin
  const [enCours, startTransition] = useTransition()
  const n = (v: number | null) => (v === null ? '—' : v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

  const imprimer = () =>
    startTransition(async () => {
      const d = await donneesBulletins(classeId, periodeId)
      if (!d || d.bulletins.length === 0) {
        toast.error(dict.classes.aucuneNote)
        return
      }
      const titrePeriode = d.periode ? libellePeriode(dict.annees, d.periode) : dict.scolarite.annuel
      const pages = d.bulletins.map((b) => {
        const lignes = b.lignes.map((l) => [l.matiere, l.coefficient, n(l.moyenne), l.moyenne === null ? '—' : n(Math.round(l.moyenne * l.coefficient * 100) / 100), l.enseignant])
        const totalCoef = b.lignes.filter((l) => l.moyenne !== null).reduce((s, l) => s + l.coefficient, 0)
        const totalPoints = b.lignes.filter((l) => l.moyenne !== null).reduce((s, l) => s + l.moyenne! * l.coefficient, 0)
        return `<div class="page">
          ${enteteHtml(d.etablissement, `<p><b>${echapper(t.anneeScolaire)}</b> ${echapper(d.annee)}</p><p><b>${echapper(dict.eleves.classe)}</b> ${echapper(d.classe)}</p>`)}
          <div class="titre">${echapper(t.titre)} · ${echapper(titrePeriode)}</div>
          <div class="grille">
            <p><b>${echapper(dict.eleves.eleve)}</b> ${echapper(`${b.eleve.prenom} ${b.eleve.nom}`)}</p>
            <p><b>${echapper(dict.eleves.matricule)}</b> <span class="num">${echapper(b.eleve.matricule)}</span></p>
            <p><b>${echapper(dict.eleves.form.dateNaissance)}</b> ${echapper(b.eleve.date_naissance ? new Date(b.eleve.date_naissance + 'T00:00:00').toLocaleDateString(locale) : '—')}</p>
            <p><b>${echapper(t.effectif)}</b> ${d.effectif}</p>
          </div>
          ${tableauHtml([dict.eleves.matiere, dict.eleves.coef, t.moyenne, t.points, dict.classes.enseignant], lignes, [t.total, totalCoef, '', n(Math.round(totalPoints * 100) / 100), ''])}
          <div class="bloc grille">
            <p><b>${echapper(dict.eleves.moyenneGenerale)}</b> <span class="num">${n(b.moyenne)} / 20</span></p>
            <p><b>${echapper(dict.classes.rangCol)}</b> <span class="num">${b.rang ?? '—'} / ${d.effectif}</span></p>
            <p><b>${echapper(dict.classes.moyenneClasse)}</b> <span class="num">${n(d.moyenneClasse)}</span></p>
            <p><b>${echapper(t.absences)}</b> <span class="num">${b.heuresAbsence} h</span> (${echapper(t.nonJustifiees)} <span class="num">${b.heuresNonJustifiees} h</span>)</p>
          </div>
          ${b.appreciation ? `<p style="margin-top:12px"><b>${echapper(dict.eleves.appreciation)}</b> <span class="mention">${echapper(b.appreciation)}</span></p>` : ''}
          ${b.decision ? `<p style="margin-top:8px"><b>${echapper(dict.passages.finale)}</b> <span class="mention">${echapper(dict.scolarite.decisions[b.decision as keyof typeof dict.scolarite.decisions] ?? b.decision)}</span></p>` : ''}
          <div class="signatures"><div><div class="ligne"></div>${echapper(t.signaturePP)}</div><div><div class="ligne"></div>${echapper(t.signatureDirection)}</div><div><div class="ligne"></div>${echapper(t.signatureParent)}</div></div>
        </div>`
      })
      if (!imprimerPages(`${t.titre} ${d.classe} ${titrePeriode}`, pages, lang)) toast.error(t.popup)
    })

  return (
    <button type="button" onClick={imprimer} disabled={enCours} className={btnSecondary}>
      <Printer className="h-4 w-4" /> {enCours ? t.preparation : libelle ?? t.imprimer}
    </button>
  )
}
