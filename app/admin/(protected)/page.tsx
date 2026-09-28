import { Building2, Users } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import type { PalierCode } from '@/lib/abonnements/paliers'
import CreerEtablissementButton from './CreerEtablissementButton'
import EtablissementActions from './EtablissementActions'
import AccesOffertCell from './AccesOffertCell'

export default async function AdminPage() {
  const supabase = createAdminClient()

  const [{ data: etablissements }, { data: utilisateurs }] = await Promise.all([
    supabase.from('etablissements').select('id, nom, ville, palier, statut, abonnement_expire_le, acces_manuel_jusqu_au, created_at').order('created_at', { ascending: false }),
    supabase.from('utilisateurs').select('etablissement_id, role, email'),
  ])

  // Niveau d'accès calculé en base (même fonction que le RLS).
  const acces = new Map<string, string>()
  await Promise.all(
    (etablissements ?? []).map(async (e) => {
      const { data } = await supabase.rpc('acces_etablissement', { p_etablissement_id: e.id })
      acces.set(e.id, (data as string | null) ?? 'suspendu')
    })
  )

  const personnel = new Map<string, number>()
  const directions = new Map<string, string>()
  for (const u of utilisateurs ?? []) {
    personnel.set(u.etablissement_id, (personnel.get(u.etablissement_id) ?? 0) + 1)
    if (u.role === 'direction' && u.email && !directions.has(u.etablissement_id)) directions.set(u.etablissement_id, u.email)
  }

  const cartes = [
    { label: 'Établissements', value: etablissements?.length ?? 0, icon: Building2 },
    { label: 'Utilisateurs', value: utilisateurs?.length ?? 0, icon: Users },
  ]

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-foreground">Établissements</h1>
        <CreerEtablissementButton />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:max-w-md">
        {cartes.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-surface-border bg-surface p-5">
            <Icon className="h-5 w-5 text-primary" />
            <p className="mt-3 font-heading text-2xl font-semibold tabular-nums">{value}</p>
            <p className="text-sm text-foreground-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-surface-border bg-surface">
        <table className="min-w-full text-sm">
          <thead className="text-start text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            <tr>
              <th className="px-4 py-3 text-start">Établissement</th>
              <th className="px-4 py-3 text-start">Direction</th>
              <th className="px-4 py-3 text-start">Personnel</th>
              <th className="px-4 py-3 text-start">Palier</th>
              <th className="px-4 py-3 text-start">Statut</th>
              <th className="px-4 py-3 text-start">Accès</th>
              <th className="px-4 py-3 text-start">Payé jusqu&apos;au</th>
              <th className="px-4 py-3 text-start">Créé le</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {(etablissements ?? []).map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{e.nom}</p>
                  {e.ville && <p className="text-xs text-foreground-muted">{e.ville}</p>}
                </td>
                <td className="px-4 py-3 text-foreground-muted">{directions.get(e.id) ?? '—'}</td>
                <td className="px-4 py-3 tabular-nums text-foreground-muted">{personnel.get(e.id) ?? 0}</td>
                <EtablissementActions id={e.id} palier={e.palier as PalierCode} statut={e.statut as 'actif' | 'suspendu'} />
                <AccesOffertCell id={e.id} acces={acces.get(e.id) ?? 'suspendu'} jusquAu={e.acces_manuel_jusqu_au} />
                <td className="px-4 py-3 text-foreground-muted">{e.abonnement_expire_le ? new Date(e.abonnement_expire_le).toLocaleDateString('fr-FR') : '—'}</td>
                <td className="px-4 py-3 text-foreground-muted">{new Date(e.created_at).toLocaleDateString('fr-FR')}</td>
              </tr>
            ))}
            {(etablissements ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-foreground-muted">Aucun établissement</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
