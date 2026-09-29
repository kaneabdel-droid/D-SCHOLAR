import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import SelecteurAnnee from '@/components/SelecteurAnnee'
import { cardClass } from '@/components/ui/styles'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { peutEcrire } from '@/lib/roles'
import { anneesEtSelection, un } from '@/lib/scolarite'
import { CYCLES, situationsFinancieres } from '@/lib/finances'
import type { Ligne } from '@/lib/parametres/entites'
import { intlLocale } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'
import EntiteTable from '../parametres/EntiteTable'
import { EncaissementButton, FraisEditor, LignePaiementActions, SouscriptionsEditor, type EleveAnnee } from './ServicesClient'

const VUES = ['paiements', 'souscriptions', 'frais', 'catalogue'] as const
type Vue = (typeof VUES)[number]

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ annee?: string; vue?: string }> }) {
  const context = await getCurrentUserContext()
  const sp = await searchParams
  const vue: Vue = (VUES as readonly string[]).includes(sp.vue ?? '') ? (sp.vue as Vue) : 'paiements'
  const supabase = await createClient()
  const locale = await getLocale()
  const loc = intlLocale(locale)
  const dict = await getDictionary(locale)
  const t = dict.finances
  const s = dict.scolarite
  const finances = peutEcrire(context.role, 'finances') && context.acces === 'complet'
  const services = peutEcrire(context.role, 'services') && context.acces === 'complet'

  const { annees, selection } = await anneesEtSelection(supabase, sp.annee)
  const anneeId = selection?.id ?? ''

  const { data: inscrits } = selection ? await supabase.from('inscriptions').select('eleve_id, eleves(prenom, nom), classes(nom)').eq('annee_id', anneeId) : { data: [] }
  const eleves: EleveAnnee[] = ((inscrits ?? []) as unknown as { eleve_id: string; eleves: { prenom: string; nom: string } | null; classes: { nom: string } | null }[])
    .map((i) => ({ id: i.eleve_id, nom: `${un(i.eleves)?.nom ?? ''} ${un(i.eleves)?.prenom ?? ''}`.trim(), classe: un(i.classes)?.nom ?? '' }))
    .sort((a, b) => a.classe.localeCompare(b.classe) || a.nom.localeCompare(b.nom))
  const nomEleve = new Map(eleves.map((e) => [e.id, e]))
  const { data: etab } = await supabase.from('etablissements').select('statut_juridique, mois_scolarite').eq('id', context.etablissementId).single()
  const regime = { prive: (etab?.statut_juridique ?? 'prive') === 'prive', mois: Number(etab?.mois_scolarite ?? 9) }

  const onglet = (v: Vue) => (
    <Link key={v} href={`/services?annee=${anneeId}&vue=${v}`} className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${vue === v ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground-muted hover:bg-primary-soft hover:text-foreground'}`}>
      {t.onglets[v]}
    </Link>
  )

  let contenu: React.ReactNode = null

  if (vue === 'catalogue') {
    const { data } = await supabase.from('services').select('id, type, nom, tarif, periodicite, actif').order('nom')
    contenu = <EntiteTable cle="services" lignes={(data ?? []) as Ligne[]} dict={dict} lectureSeule={!finances} />
  }

  if (vue === 'frais') {
    const [{ data: frais }, { data: niveaux }] = await Promise.all([
      supabase.from('frais_scolarite').select('id, libelle, montant, periodicite, cycle, date_echeance, niveaux(nom, ordre)').eq('annee_id', anneeId).order('libelle'),
      supabase.from('niveaux').select('id, nom, cycle').eq('actif', true).order('ordre'),
    ])
    const lignes = (frais ?? [])
      .map((f) => {
        const niv = un(f.niveaux as unknown as { nom: string; ordre: number } | null)
        return { id: f.id, libelle: f.libelle, montant: Number(f.montant), periodicite: f.periodicite, cycle: f.cycle, date_echeance: f.date_echeance, niveau: niv?.nom ?? null, rang: niv ? 2000 + niv.ordre : f.cycle ? 1000 + CYCLES.indexOf(f.cycle) : 0 }
      })
      .sort((a, b) => a.libelle.localeCompare(b.libelle) || a.rang - b.rang)
    contenu = (
      <section className={cardClass}>
        <FraisEditor
          anneeId={anneeId}
          frais={lignes}
          prive={regime.prive}
          mois={regime.mois}
          niveaux={niveaux ?? []}
          ecriture={finances}
          locale={loc}
          dict={dict}
        />
      </section>
    )
  }

  if (vue === 'souscriptions') {
    const [{ data: catalogue }, { data: sous }] = await Promise.all([
      supabase.from('services').select('id, nom').eq('actif', true).order('nom'),
      supabase.from('souscriptions_services').select('id, eleve_id, details, services(nom)').eq('annee_id', anneeId),
    ])
    contenu = (
      <section className={cardClass}>
        <SouscriptionsEditor
          anneeId={anneeId}
          services={catalogue ?? []}
          souscriptions={(sous ?? []).map((x) => ({ id: x.id, service: un(x.services as unknown as { nom: string } | null)?.nom ?? '', eleve: nomEleve.get(x.eleve_id)?.nom ?? '', classe: nomEleve.get(x.eleve_id)?.classe ?? '', details: x.details }))}
          eleves={eleves}
          ecriture={services}
          dict={dict}
        />
      </section>
    )
  }

  if (vue === 'paiements') {
    const [{ data: paiements }, situations, { data: frais }, { data: catalogue }] = await Promise.all([
      supabase.from('paiements_eleves').select('id, eleve_id, libelle, montant, mode, date_paiement, numero_recu').eq('annee_id', anneeId).order('created_at', { ascending: false }).limit(100),
      situationsFinancieres(supabase, anneeId),
      supabase.from('frais_scolarite').select('libelle, periodicite').eq('annee_id', anneeId),
      supabase.from('services').select('nom').eq('actif', true),
    ])
    const totaux = [...situations.values()].reduce((a, x) => ({ du: a.du + x.du, paye: a.paye + x.paye, reste: a.reste + x.reste }), { du: 0, paye: 0, reste: 0 })
    const impayes = [...situations.entries()].filter(([, x]) => x.reste > 0).sort((a, b) => b[1].reste - a[1].reste).slice(0, 12)
    const n = (v: number) => `${v.toLocaleString(loc)} ${dict.abonnement.fcfa}`
    contenu = (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[{ l: t.totalDu, v: totaux.du, c: 'text-foreground' }, { l: t.totalPaye, v: totaux.paye, c: 'text-success' }, { l: t.totalReste, v: totaux.reste, c: 'text-danger' }].map((k) => (
            <div key={k.l} className={`${cardClass} p-5`}>
              <p className="text-sm text-foreground-muted">{k.l}</p>
              <p className={`mt-1 font-heading text-2xl font-semibold tabular-nums ${k.c}`}>{n(k.v)}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
          <section className={`${cardClass} h-fit`}>
            <h2 className="border-b border-surface-border px-5 py-4 font-heading text-base font-semibold text-foreground">{t.impayes}</h2>
            <ul className="divide-y divide-surface-border">
              {impayes.map(([id, x]) => (
                <li key={id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <Link href={`/eleves/${id}?annee=${anneeId}`} className="min-w-0 flex-1 truncate font-medium hover:text-primary">{nomEleve.get(id)?.nom} <span className="text-xs text-foreground-muted">· {nomEleve.get(id)?.classe}</span></Link>
                  <span className="font-semibold tabular-nums text-danger">{n(x.reste)}</span>
                </li>
              ))}
              {impayes.length === 0 && <li className="px-5 py-8 text-center text-sm text-foreground-muted">{t.aucunImpaye}</li>}
            </ul>
          </section>
          <section className={cardClass}>
            <h2 className="border-b border-surface-border px-5 py-4 font-heading text-base font-semibold text-foreground">{t.derniersPaiements}</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  <tr>
                    <th className="px-4 py-3 text-start">{t.recu}</th>
                    <th className="px-4 py-3 text-start">{dict.eleves.eleve}</th>
                    <th className="px-4 py-3 text-start">{dict.fields.libelle}</th>
                    <th className="px-4 py-3 text-end">{t.montant}</th>
                    <th className="px-4 py-3"><span className="sr-only">{dict.common.actions}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {(paiements ?? []).map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">{p.numero_recu}<span className="block font-sans text-foreground-muted">{new Date(p.date_paiement + 'T00:00:00').toLocaleDateString(loc)} · {t.modes[p.mode as keyof typeof t.modes]}</span></td>
                      <td className="px-4 py-2.5">{nomEleve.get(p.eleve_id)?.nom}<span className="block text-xs text-foreground-muted">{nomEleve.get(p.eleve_id)?.classe}</span></td>
                      <td className="px-4 py-2.5 text-foreground-muted">{p.libelle}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-end font-semibold tabular-nums">{n(Number(p.montant))}</td>
                      <td className="px-4 py-2.5"><LignePaiementActions id={p.id} ecriture={finances} dict={dict} lang={locale} locale={loc} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    )
    // Suggestions de libellés pour l'encaissement (frais et services de l'année).
    // Mensualités : une suggestion par mois de l'année scolaire (« Mensualité · octobre »…).
    const debut = selection ? new Date(selection.date_debut + 'T00:00:00') : new Date()
    const moisAnnee = Array.from({ length: regime.mois }, (_, k) => new Date(debut.getFullYear(), debut.getMonth() + k, 1).toLocaleDateString(loc, { month: 'long', year: 'numeric' }))
    const suggestions = [
      ...new Set([
        ...(frais ?? []).flatMap((f) => (f.periodicite === 'mensuel' ? moisAnnee.map((m) => `${f.libelle} · ${m}`) : [f.libelle])),
        ...(catalogue ?? []).map((c) => c.nom),
      ]),
    ]
    return (
      <div>
        <PageHeader
          title={t.title}
          subtitle={t.subtitle}
          actions={
            <>
              <SelecteurAnnee annees={annees} selection={selection?.id ?? null} libelles={{ annee: s.annee, active: s.active, cloturee: s.cloturee }} />
              {finances && selection && <EncaissementButton anneeId={anneeId} eleves={eleves} suggestions={suggestions} dict={dict} lang={locale} locale={loc} />}
            </>
          }
        />
        <nav className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0"><div className="flex min-w-max gap-1 rounded-xl border border-surface-border bg-surface p-1 shadow-xs">{VUES.map(onglet)}</div></nav>
        {contenu}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={<SelecteurAnnee annees={annees} selection={selection?.id ?? null} libelles={{ annee: s.annee, active: s.active, cloturee: s.cloturee }} />}
      />
      <nav className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0"><div className="flex min-w-max gap-1 rounded-xl border border-surface-border bg-surface p-1 shadow-xs">{VUES.map(onglet)}</div></nav>
      {contenu}
    </div>
  )
}
