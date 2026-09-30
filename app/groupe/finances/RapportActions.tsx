'use client'

import { Download, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { btnSecondary } from '@/components/ui/styles'
import { echapper, enteteHtml, imprimerPages, tableauHtml, type Cellule } from '@/lib/impression'

export type Tableau = { titre: string; colonnes: string[]; lignes: Cellule[][]; total?: Cellule[] }

// Rapport financier : impression (PDF via le navigateur, arabe compris) et export CSV.
export default function RapportActions({ titre, sousTitre, groupe, tableaux, libelles, lang }: {
  titre: string
  sousTitre: string
  groupe: string
  tableaux: Tableau[]
  libelles: { imprimer: string; csv: string; popup: string; edite: string }
  lang: string
}) {
  const imprimer = () => {
    const page = `<div class="page">
      ${enteteHtml({ nom: groupe }, `<p>${echapper(libelles.edite)}</p>`)}
      <div class="titre">${echapper(titre)}</div>
      <p class="sous-titre">${echapper(sousTitre)}</p>
      ${tableaux.map((t) => `<h3 style="margin:18px 0 4px;font-size:13px;color:#0f1b3d">${echapper(t.titre)}</h3>${tableauHtml(t.colonnes, t.lignes, t.total)}`).join('')}
    </div>`
    if (!imprimerPages(titre, [page], lang)) toast.error(libelles.popup)
  }

  const csv = () => {
    const cellule = (v: Cellule) => {
      const s = String(v ?? '')
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    // Point-virgule : séparateur attendu par Excel en français.
    const lignes = tableaux.flatMap((t) => [[t.titre], t.colonnes, ...t.lignes, ...(t.total ? [t.total] : []), []])
    const contenu = '﻿' + lignes.map((l) => l.map(cellule).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([contenu], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${titre.replace(/[^\p{L}\p{N}]+/gu, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex gap-2">
      <button type="button" onClick={imprimer} className={btnSecondary}><Printer className="h-4 w-4" /> {libelles.imprimer}</button>
      <button type="button" onClick={csv} className={btnSecondary}><Download className="h-4 w-4" /> {libelles.csv}</button>
    </div>
  )
}
