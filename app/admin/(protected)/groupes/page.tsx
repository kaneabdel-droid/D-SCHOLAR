import { createAdminClient } from '@/utils/supabase/admin'
import { CreerGroupeButton, DetacherSite, MembreActif, RattacherSite } from './GroupesClient'

// Groupes scolaires : plusieurs établissements sous un même propriétaire / DG,
// qui dispose de la vue groupe (/groupe). Chaque site garde son abonnement.
export default async function AdminGroupesPage() {
  const supabase = createAdminClient()
  const [{ data: groupes }, { data: etablissements }, { data: membres }] = await Promise.all([
    supabase.from('groupes').select('id, nom, est_demo, created_at').order('nom'),
    supabase.from('etablissements').select('id, nom, ville, palier, groupe_id').order('nom'),
    supabase.from('membres_groupe').select('user_id, groupe_id, role, prenom, nom, email, actif'),
  ])
  const libres = (etablissements ?? []).filter((e) => !e.groupe_id)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">Groupes scolaires</h1>
          <p className="mt-1 text-sm text-foreground-muted">Le propriétaire / DG voit en lecture seule tous les sites de son groupe et peut en ajouter. Chaque site garde son propre abonnement ; la vue groupe est incluse.</p>
        </div>
        <CreerGroupeButton />
      </div>
      {(groupes ?? []).map((g) => {
        const sites = (etablissements ?? []).filter((e) => e.groupe_id === g.id)
        return (
          <section key={g.id} className="rounded-2xl border border-surface-border bg-surface shadow-xs">
            <div className="flex flex-wrap items-center gap-3 border-b border-surface-border px-5 py-4">
              <h2 className="flex-1 font-heading text-base font-semibold">{g.nom} {g.est_demo && <span className="ms-2 rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">démo</span>}</h2>
              <RattacherSite groupeId={g.id} libres={libres.map((e) => ({ id: e.id, nom: e.nom }))} />
            </div>
            <div className="grid gap-6 p-5 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Établissements ({sites.length})</p>
                <ul className="mt-2 divide-y divide-surface-border text-sm">
                  {sites.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 py-2">
                      <span className="min-w-0 flex-1 truncate">{s.nom} <span className="text-xs text-foreground-muted">· {s.ville ?? '—'} · {s.palier}</span></span>
                      <DetacherSite id={s.id} nom={s.nom} />
                    </li>
                  ))}
                  {sites.length === 0 && <li className="py-2 text-foreground-muted">Aucun établissement rattaché.</li>}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Direction du groupe</p>
                <ul className="mt-2 divide-y divide-surface-border text-sm">
                  {(membres ?? []).filter((m) => m.groupe_id === g.id).map((m) => (
                    <li key={m.user_id} className="flex items-center gap-2 py-2">
                      <span className="min-w-0 flex-1 truncate">{[m.prenom, m.nom].filter(Boolean).join(' ')} <span className="text-xs text-foreground-muted">· {m.email} · {m.role === 'proprietaire' ? 'propriétaire' : 'DG'}</span></span>
                      <MembreActif userId={m.user_id} actif={m.actif} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )
      })}
      {(groupes ?? []).length === 0 && <p className="rounded-2xl border border-surface-border bg-surface p-8 text-center text-sm text-foreground-muted">Aucun groupe pour le moment.</p>}
    </div>
  )
}
