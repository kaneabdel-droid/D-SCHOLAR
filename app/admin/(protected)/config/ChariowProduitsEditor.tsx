'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { PALIER_CODES, type PalierCode } from '@/lib/abonnements/paliers'
import { montantPourcentage, POURCENTAGES } from '@/lib/abonnements/plans'
import { enregistrerProduitChariow } from '../actions'

type Produit = { palier: string; pourcentage: number; product_id: string }
const NOMS: Record<PalierCode, string> = { elementaire: 'Élémentaire', secondaire: 'Secondaire', complet: 'Cycle complet' }

export default function ChariowProduitsEditor({ produits }: { produits: Produit[] }) {
  const cle = (p: string, pct: number) => `${p}_${pct}`
  const [valeurs, setValeurs] = useState<Record<string, string>>(() =>
    Object.fromEntries(produits.map((p) => [cle(p.palier, p.pourcentage), p.product_id]))
  )
  const [enCours, startTransition] = useTransition()

  const enregistrer = (palier: PalierCode, pct: number) =>
    startTransition(async () => {
      const res = await enregistrerProduitChariow(palier, pct, valeurs[cle(palier, pct)] ?? '')
      if (res.error) toast.error(res.error)
      else toast.success('Produit enregistré')
    })

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
          <tr>
            <th className="py-2 text-start">Palier</th>
            <th className="py-2 text-start">Part</th>
            <th className="py-2 text-start">Prix du produit</th>
            <th className="py-2 text-start">Product ID Chariow</th>
            <th />
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border">
          {PALIER_CODES.map((palier) =>
            POURCENTAGES.map((pct) => (
              <tr key={cle(palier, pct)}>
                <td className="py-2 pe-3">{NOMS[palier]}</td>
                <td className="py-2 pe-3">{pct} %</td>
                <td className="py-2 pe-3 tabular-nums text-foreground-muted">{montantPourcentage(palier, pct).toLocaleString('fr-FR')} FCFA</td>
                <td className="py-2 pe-3">
                  <input
                    value={valeurs[cle(palier, pct)] ?? ''}
                    onChange={(e) => setValeurs((v) => ({ ...v, [cle(palier, pct)]: e.target.value }))}
                    placeholder="product_id"
                    disabled={enCours}
                    className="w-full min-w-48 rounded-lg border border-surface-border bg-background px-2 py-1.5 font-mono text-xs"
                  />
                </td>
                <td className="py-2">
                  <button type="button" onClick={() => enregistrer(palier, pct)} disabled={enCours} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                    OK
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
