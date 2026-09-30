import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { getGroupeContext } from '@/lib/auth/getGroupeContext'
import { intlLocale } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'
import NouveauSiteButton from './NouveauSiteButton'

// Établissements du groupe : coordonnées, direction, abonnement de chaque site.
export default async function GroupeEtablissements() {
  const groupe = await getGroupeContext()
  const supabase = await createClient()
  const locale = await getLocale()
  const loc = intlLocale(locale)
  const dict = await getDictionary(locale)
  const t = dict.groupe
  const ids = groupe.sites.map((s) => s.id)

  const [{ data: sites }, { data: directions }, { data: acces }] = await Promise.all([
    supabase.from('etablissements').select('id, nom, sigle, adresse, ville, telephone, email, palier, abonnement_expire_le').in('id', ids).order('nom'),
    supabase.from('utilisateurs').select('etablissement_id, prenom, nom, email').in('etablissement_id', ids).eq('role', 'direction').eq('actif', true),
    supabase.rpc('acces_sites_groupe'),
  ])
  const accesParSite = new Map(((acces ?? []) as { etablissement_id: string; acces: string }[]).map((a) => [a.etablissement_id, a.acces]))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{t.onglets.etablissements}</h1>
          <p className="mt-1 text-sm text-foreground-muted">{t.etablissementsSousTitre}</p>
        </div>
        {!groupe.estDemo && <NouveauSiteButton dict={dict} />}
      </div>
      <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface shadow-xs">
        <ul className="divide-y divide-surface-border">
          {(sites ?? []).map((s) => {
            const dir = (directions ?? []).filter((d) => d.etablissement_id === s.id)
            const a = accesParSite.get(s.id) ?? 'complet'
            return (
              <li key={s.id}>
                <Link href={`/groupe/etablissements/${s.id}`} className="group flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-background">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{s.nom} {s.sigle && <span className="font-mono text-xs text-foreground-muted">{s.sigle}</span>}</p>
                    <p className="text-sm text-foreground-muted">{[s.adresse, s.ville].filter(Boolean).join(', ') || '—'} {s.telephone && <span dir="ltr">· {s.telephone}</span>}</p>
                    <p className="mt-1 text-xs text-foreground-muted">{t.directionSite} : {dir.map((d) => [d.prenom, d.nom].filter(Boolean).join(' ')).join(', ') || '—'}</p>
                  </div>
                  <div className="text-end text-xs">
                    <p className="font-medium text-foreground">{dict.paliers[s.palier as keyof typeof dict.paliers]}</p>
                    <p className={a === 'complet' ? 'text-success' : 'text-danger'}>
                      {a === 'complet' ? t.accesLibelle.complet : t.accesLibelle[a as 'lecture_seule' | 'suspendu'] ?? a}
                      {s.abonnement_expire_le && ` · ${new Date(s.abonnement_expire_le).toLocaleDateString(loc)}`}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-foreground-muted group-hover:text-primary rtl:-scale-x-100" />
                </Link>
              </li>
            )
          })}
          {(sites ?? []).length === 0 && <li className="px-5 py-10 text-center text-sm text-foreground-muted">{t.aucunSite}</li>}
        </ul>
      </div>
    </div>
  )
}
