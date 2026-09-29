import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import { cardClass, inputClass } from '@/components/ui/styles'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { peutEcrire } from '@/lib/roles'
import { un } from '@/lib/scolarite'
import { TEINTES_BILLET, TYPES_BILLET, type TypeBillet } from '@/lib/billets'
import { intlLocale } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'
import { EmettreBilletButton, LigneBilletActions, type EleveAnnee } from './BilletsClient'

const DATE = /^\d{4}-\d{2}-\d{2}$/

// Main courante de la surveillance : billets d'entrée, de sortie, de visite
// médicale et de retard délivrés sur une journée.
export default async function BilletsPage({ searchParams }: { searchParams: Promise<{ date?: string; type?: string }> }) {
  const context = await getCurrentUserContext()
  const sp = await searchParams
  const supabase = await createClient()
  const locale = await getLocale()
  const loc = intlLocale(locale)
  const dict = await getDictionary(locale)
  const t = dict.billets
  const ecriture = peutEcrire(context.role, 'billets') && context.acces === 'complet'
  const jour = DATE.test(sp.date ?? '') ? sp.date! : new Date().toISOString().slice(0, 10)
  const filtre = (TYPES_BILLET as readonly string[]).includes(sp.type ?? '') ? (sp.type as TypeBillet) : null
  const anneeId = context.anneeActive?.id ?? ''

  const debut = new Date(jour + 'T00:00:00Z')
  const fin = new Date(debut.getTime() + 86_400_000)
  const [{ data: billets }, { data: inscrits }] = await Promise.all([
    supabase
      .from('billets')
      .select('id, type, numero, emis_le, motif, details, minutes_retard, heure_retour, eleve_id, eleves(prenom, nom)')
      .gte('emis_le', debut.toISOString())
      .lt('emis_le', fin.toISOString())
      .order('emis_le', { ascending: false }),
    anneeId ? supabase.from('inscriptions').select('eleve_id, eleves(prenom, nom, statut), classes(nom)').eq('annee_id', anneeId) : Promise.resolve({ data: [] }),
  ])
  type Insc = { eleve_id: string; eleves: { prenom: string; nom: string; statut: string } | null; classes: { nom: string } | null }
  const inscriptions = (inscrits ?? []) as unknown as Insc[]
  const classeDe = new Map(inscriptions.map((i) => [i.eleve_id, un(i.classes)?.nom ?? '']))
  const eleves: EleveAnnee[] = inscriptions
    .filter((i) => un(i.eleves)?.statut === 'actif')
    .map((i) => ({ id: i.eleve_id, nom: `${un(i.eleves)?.nom ?? ''} ${un(i.eleves)?.prenom ?? ''}`.trim(), classe: un(i.classes)?.nom ?? '' }))
    .sort((a, b) => a.classe.localeCompare(b.classe) || a.nom.localeCompare(b.nom))

  const tous = billets ?? []
  const affiches = filtre ? tous.filter((b) => b.type === filtre) : tous
  const lien = (type: TypeBillet | null) => `/billets?date=${jour}${type ? `&type=${type}` : ''}`

  return (
    <div>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <>
            <form action="/billets" className="flex items-center gap-2">
              <label htmlFor="jour" className="sr-only">{t.jour}</label>
              <input id="jour" type="date" name="date" defaultValue={jour} className={`${inputClass} mt-0`} />
              <button type="submit" className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm font-semibold">{t.afficher}</button>
            </form>
            {ecriture && anneeId && <EmettreBilletButton anneeId={anneeId} eleves={eleves} dict={dict} lang={locale} locale={loc} />}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TYPES_BILLET.map((ty) => (
          <Link key={ty} href={lien(filtre === ty ? null : ty)} className={`${cardClass} p-4 transition hover:border-primary/40 ${filtre === ty ? 'ring-2 ring-primary/40' : ''}`}>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TEINTES_BILLET[ty]}`}>{t.types[ty]}</span>
            <p className="mt-2 font-heading text-2xl font-semibold tabular-nums text-foreground">{tous.filter((b) => b.type === ty).length}</p>
          </Link>
        ))}
      </div>

      <section className={cardClass}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              <tr>
                <th className="px-4 py-3 text-start">{t.heure}</th>
                <th className="px-4 py-3 text-start">{t.type}</th>
                <th className="px-4 py-3 text-start">{dict.eleves.eleve}</th>
                <th className="px-4 py-3 text-start">{t.motif}</th>
                <th className="px-4 py-3"><span className="sr-only">{dict.common.actions}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {affiches.map((b) => {
                const e = un(b.eleves as unknown as { prenom: string; nom: string } | null)
                const ty = b.type as TypeBillet
                return (
                  <tr key={b.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">
                      {new Date(b.emis_le).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}
                      <span className="block font-mono text-xs text-foreground-muted">{b.numero}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TEINTES_BILLET[ty]}`}>{t.types[ty]}</span>
                      {ty === 'retard' && b.minutes_retard && <span className="ms-2 text-xs text-foreground-muted">{b.minutes_retard} min</span>}
                      {b.heure_retour && <span className="ms-2 text-xs text-foreground-muted">↩ {b.heure_retour.slice(0, 5)}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/eleves/${b.eleve_id}`} className="font-medium hover:text-primary">{e?.prenom} {e?.nom}</Link>
                      <span className="block text-xs text-foreground-muted">{classeDe.get(b.eleve_id)}</span>
                    </td>
                    <td className="max-w-xs px-4 py-2.5 text-foreground-muted">{[b.motif, b.details].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="px-4 py-2.5"><LigneBilletActions id={b.id} ecriture={ecriture} dict={dict} lang={locale} locale={loc} /></td>
                  </tr>
                )
              })}
              {affiches.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-foreground-muted">{t.aucun}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
