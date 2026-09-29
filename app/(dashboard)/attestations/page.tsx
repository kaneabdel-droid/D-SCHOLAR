import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import SelecteurAnnee from '@/components/SelecteurAnnee'
import { cardClass } from '@/components/ui/styles'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { peutEcrire } from '@/lib/roles'
import { anneesEtSelection, un } from '@/lib/scolarite'
import { TYPES_DOCUMENT, type ContenuDocument, type TypeDocument } from '@/lib/documents'
import { intlLocale } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'
import { EmettreDocumentButton, LigneDocumentActions, type EleveAnnee } from './DocumentsClient'

// Registre des documents émis (numérotés, vérifiables par QR code).
export default async function AttestationsPage({ searchParams }: { searchParams: Promise<{ annee?: string; type?: string }> }) {
  const context = await getCurrentUserContext()
  const sp = await searchParams
  const supabase = await createClient()
  const locale = await getLocale()
  const loc = intlLocale(locale)
  const dict = await getDictionary(locale)
  const t = dict.documents
  const s = dict.scolarite
  const ecriture = peutEcrire(context.role, 'documents') && context.acces === 'complet'
  const filtre = (TYPES_DOCUMENT as readonly string[]).includes(sp.type ?? '') ? (sp.type as TypeDocument) : null

  const { annees, selection } = await anneesEtSelection(supabase, sp.annee)
  const anneeId = selection?.id ?? ''

  let q = supabase.from('documents_emis').select('id, type, numero, contenu, emis_le, annule, eleve_id').eq('annee_id', anneeId).order('emis_le', { ascending: false }).limit(300)
  if (filtre) q = q.eq('type', filtre)
  const [{ data: documents }, { data: inscrits }] = await Promise.all([
    selection ? q : Promise.resolve({ data: [] }),
    selection && ecriture ? supabase.from('inscriptions').select('eleve_id, eleves(prenom, nom), classes(nom)').eq('annee_id', anneeId) : Promise.resolve({ data: [] }),
  ])
  const eleves: EleveAnnee[] = ((inscrits ?? []) as unknown as { eleve_id: string; eleves: { prenom: string; nom: string } | null; classes: { nom: string } | null }[])
    .map((i) => ({ id: i.eleve_id, nom: `${un(i.eleves)?.nom ?? ''} ${un(i.eleves)?.prenom ?? ''}`.trim(), classe: un(i.classes)?.nom ?? '' }))
    .sort((a, b) => a.classe.localeCompare(b.classe) || a.nom.localeCompare(b.nom))

  const lien = (type: TypeDocument | null) => `/attestations?annee=${anneeId}${type ? `&type=${type}` : ''}`
  const pastille = (type: TypeDocument | null, texte: string) => (
    <Link key={type ?? 'tous'} href={lien(type)} className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${filtre === type ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground-muted hover:bg-primary-soft hover:text-foreground'}`}>
      {texte}
    </Link>
  )

  return (
    <div>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <>
            <SelecteurAnnee annees={annees} selection={selection?.id ?? null} libelles={{ annee: s.annee, active: s.active, cloturee: s.cloturee }} />
            {ecriture && selection && <EmettreDocumentButton anneeId={anneeId} eleves={eleves} dict={dict} lang={locale} locale={loc} />}
          </>
        }
      />
      <nav className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1 rounded-xl border border-surface-border bg-surface p-1 shadow-xs">
          {pastille(null, t.tous)}
          {TYPES_DOCUMENT.map((ty) => pastille(ty, t.types[ty]))}
        </div>
      </nav>
      <section className={cardClass}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              <tr>
                <th className="px-4 py-3 text-start">{t.numero}</th>
                <th className="px-4 py-3 text-start">{t.type}</th>
                <th className="px-4 py-3 text-start">{dict.eleves.eleve}</th>
                <th className="px-4 py-3 text-start">{t.emisLe}</th>
                <th className="px-4 py-3"><span className="sr-only">{dict.common.actions}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {(documents ?? []).map((d) => {
                const c = d.contenu as ContenuDocument
                return (
                  <tr key={d.id} className={d.annule ? 'opacity-60' : ''}>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">
                      {d.numero}
                      {d.annule && <span className="ms-2 rounded-full bg-danger/10 px-2 py-0.5 font-sans font-semibold text-danger">{t.annule}</span>}
                    </td>
                    <td className="px-4 py-2.5">{t.types[d.type as TypeDocument]}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/eleves/${d.eleve_id}?annee=${anneeId}`} className="font-medium hover:text-primary">{c.eleve.prenom} {c.eleve.nom}</Link>
                      <span className="block text-xs text-foreground-muted">{c.classe}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-foreground-muted">{new Date(d.emis_le).toLocaleDateString(loc)}</td>
                    <td className="px-4 py-2.5"><LigneDocumentActions id={d.id} annule={d.annule} ecriture={ecriture} dict={dict} lang={locale} locale={loc} /></td>
                  </tr>
                )
              })}
              {(documents ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-foreground-muted">{t.aucun}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
