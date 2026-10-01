import { createAdminClient } from '@/utils/supabase/admin'
import EcheanceDateCell from './EcheanceDateCell'
import SupprimerPaiementButton from './SupprimerPaiementButton'

const STATUTS: Record<string, string> = { en_attente: 'En attente', paye: 'Payé', echoue: 'Échoué' }

export default async function AdminPaiementsPage() {
  const supabase = createAdminClient()

  const [{ data: paiements }, { data: echeances }, { count: nbEchoues }] = await Promise.all([
    supabase
      .from('paiements_abonnement')
      .select('id, montant, provider, provider_reference, statut, doublon, created_at, paye_at, etablissements(nom), echeances_abonnement(rang)')
      .order('created_at', { ascending: false })
      .limit(200),
    // Tranches restantes des souscriptions en cours (la tranche 1 d'une
    // souscription jamais payée n'engage encore rien).
    supabase
      .from('echeances_abonnement')
      .select('id, rang, montant, date_echeance, etablissements(nom), souscriptions!inner(statut)')
      .eq('statut', 'a_payer')
      .eq('souscriptions.statut', 'active')
      .order('date_echeance'),
    supabase.from('paiements_abonnement').select('id', { count: 'exact', head: true }).eq('statut', 'echoue'),
  ])

  const nom = (e: unknown) => (Array.isArray(e) ? e[0]?.nom : (e as { nom?: string } | null)?.nom) ?? '—'
  const rang = (e: unknown) => (Array.isArray(e) ? e[0]?.rang : (e as { rang?: number } | null)?.rang) ?? '—'
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const doublons = (paiements ?? []).filter((p) => p.doublon)

  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl font-bold text-foreground">Paiements</h1>

      {doublons.length > 0 && (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {doublons.length} paiement(s) encaissé(s) en double, à rembourser (marqués « Doublon » ci-dessous).
        </p>
      )}

      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">Tranches à venir</h2>
        <div className="overflow-x-auto rounded-2xl border border-surface-border bg-surface">
          <table className="min-w-full text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              <tr>
                <th className="px-4 py-3 text-start">Établissement</th>
                <th className="px-4 py-3 text-start">Tranche</th>
                <th className="px-4 py-3 text-start">Montant</th>
                <th className="px-4 py-3 text-start">Échéance (modifiable)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {(echeances ?? []).map((e) => (
                <tr key={e.id} className={e.date_echeance < aujourdhui ? 'bg-danger/5' : ''}>
                  <td className="px-4 py-3 font-medium">{nom(e.etablissements)}</td>
                  <td className="px-4 py-3">{e.rang}</td>
                  <td className="px-4 py-3 tabular-nums">{e.montant.toLocaleString('fr-FR')} FCFA</td>
                  <EcheanceDateCell id={e.id} date={e.date_echeance} />
                </tr>
              ))}
              {(echeances ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-foreground-muted">Aucune tranche en attente</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold">Historique (200 derniers)</h2>
          {(nbEchoues ?? 0) > 0 && <SupprimerPaiementButton nombre={nbEchoues ?? 0} />}
        </div>
        <div className="overflow-x-auto rounded-2xl border border-surface-border bg-surface">
          <table className="min-w-full text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              <tr>
                <th className="px-4 py-3 text-start">Date</th>
                <th className="px-4 py-3 text-start">Établissement</th>
                <th className="px-4 py-3 text-start">Tranche</th>
                <th className="px-4 py-3 text-start">Montant</th>
                <th className="px-4 py-3 text-start">Provider</th>
                <th className="px-4 py-3 text-start">Statut</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {(paiements ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-foreground-muted">{new Date(p.paye_at ?? p.created_at).toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 font-medium">{nom(p.etablissements)}</td>
                  <td className="px-4 py-3">{rang(p.echeances_abonnement)}</td>
                  <td className="px-4 py-3 tabular-nums">{p.montant.toLocaleString('fr-FR')} FCFA</td>
                  <td className="px-4 py-3">
                    {p.provider}
                    {p.provider_reference && <span className="block font-mono text-xs text-foreground-muted">{p.provider_reference}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={p.statut === 'paye' ? 'text-success' : p.statut === 'echoue' ? 'text-danger' : 'text-warning'}>{STATUTS[p.statut] ?? p.statut}</span>
                    {p.doublon && <span className="ms-2 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">Doublon</span>}
                  </td>
                  <td className="px-4 py-3 text-end">{p.statut === 'echoue' && <SupprimerPaiementButton paiementId={p.id} />}</td>
                </tr>
              ))}
              {(paiements ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-foreground-muted">Aucun paiement</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
