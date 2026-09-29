import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import SelecteurAnnee from '@/components/SelecteurAnnee'
import { cardClass } from '@/components/ui/styles'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { peutEcrire } from '@/lib/roles'
import { anneesEtSelection, libellePeriode, un } from '@/lib/scolarite'
import { intlLocale } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'
import ImprimerBulletins from '../classes/ImprimerBulletins'
import { CartesClasseButton, EmettreDocumentButton } from '../attestations/DocumentsClient'

// Bulletins (par période ou annuels) d'une classe et relevés de notes certifiés
// (cursus complet, document numéroté et vérifiable) de chaque élève.
export default async function RelevesPage({ searchParams }: { searchParams: Promise<{ annee?: string; classe?: string }> }) {
  const context = await getCurrentUserContext()
  const sp = await searchParams
  const supabase = await createClient()
  const locale = await getLocale()
  const loc = intlLocale(locale)
  const dict = await getDictionary(locale)
  const t = dict.documents
  const s = dict.scolarite
  const emission = peutEcrire(context.role, 'documents') && context.acces === 'complet'

  const { annees, selection } = await anneesEtSelection(supabase, sp.annee)
  const anneeId = selection?.id ?? ''
  const { data: classes } = selection ? await supabase.from('classes').select('id, nom').eq('annee_id', anneeId).order('nom') : { data: [] }
  const classe = (classes ?? []).find((c) => c.id === sp.classe) ?? (classes ?? [])[0] ?? null

  const [{ data: periodes }, { data: inscrits }] = classe
    ? await Promise.all([
        supabase.rpc('periodes_classe', { p_classe_id: classe.id }),
        supabase.from('inscriptions').select('eleve_id, eleves(prenom, nom, matricule)').eq('classe_id', classe.id),
      ])
    : [{ data: [] }, { data: [] }]
  const eleves = ((inscrits ?? []) as unknown as { eleve_id: string; eleves: { prenom: string; nom: string; matricule: string } | null }[])
    .map((i) => ({ id: i.eleve_id, ...un(i.eleves)! }))
    .filter((e) => e.nom)
    .sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom))

  return (
    <div>
      <PageHeader
        title={t.relevesTitle}
        subtitle={t.relevesSubtitle}
        actions={<SelecteurAnnee annees={annees} selection={selection?.id ?? null} libelles={{ annee: s.annee, active: s.active, cloturee: s.cloturee }} />}
      />
      <nav className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1 rounded-xl border border-surface-border bg-surface p-1 shadow-xs">
          {(classes ?? []).map((c) => (
            <Link key={c.id} href={`/releves?annee=${anneeId}&classe=${c.id}`} className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${classe?.id === c.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground-muted hover:bg-primary-soft hover:text-foreground'}`}>
              {c.nom}
            </Link>
          ))}
        </div>
      </nav>

      {classe ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
          <section className={`${cardClass} h-fit`}>
            <h2 className="border-b border-surface-border px-5 py-4 font-heading text-base font-semibold text-foreground">{t.bulletinsClasse}</h2>
            <div className="flex flex-col gap-2 p-5">
              {((periodes ?? []) as { id: string; rang: number; decoupage: string }[]).map((p) => (
                <ImprimerBulletins key={p.id} classeId={classe.id} periodeId={p.id} locale={loc} lang={locale} dict={dict} libelle={libellePeriode(dict.annees, p)} />
              ))}
              <ImprimerBulletins classeId={classe.id} periodeId={null} locale={loc} lang={locale} dict={dict} libelle={s.annuel} />
              <p className="mt-2 text-xs text-foreground-muted">{t.aideBulletins}</p>
              {emission && (
                <div className="mt-3 border-t border-surface-border pt-4">
                  <CartesClasseButton classeId={classe.id} dict={dict} lang={locale} locale={loc} />
                  <p className="mt-2 text-xs text-foreground-muted">{t.aideCartes}</p>
                </div>
              )}
            </div>
          </section>
          <section className={cardClass}>
            <h2 className="border-b border-surface-border px-5 py-4 font-heading text-base font-semibold text-foreground">{t.relevesEleves}</h2>
            <ul className="divide-y divide-surface-border">
              {eleves.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                  <Link href={`/eleves/${e.id}?annee=${anneeId}`} className="min-w-0 flex-1 truncate font-medium hover:text-primary">
                    {e.nom} {e.prenom} <span className="font-mono text-xs text-foreground-muted">{e.matricule}</span>
                  </Link>
                  {emission && <EmettreDocumentButton anneeId={anneeId} eleveFixe={e.id} typeFixe="releve_notes" libelle={t.releveCourt} dict={dict} lang={locale} locale={loc} />}
                </li>
              ))}
              {eleves.length === 0 && <li className="px-5 py-10 text-center text-foreground-muted">{dict.classes.aucuneNote}</li>}
            </ul>
          </section>
        </div>
      ) : (
        <p className={`${cardClass} px-5 py-12 text-center text-sm text-foreground-muted`}>{t.aucuneClasse}</p>
      )}
    </div>
  )
}
