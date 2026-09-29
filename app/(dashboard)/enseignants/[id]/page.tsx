import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Mail, MapPin, Phone } from 'lucide-react'
import EmploiGrid from '@/components/EmploiGrid'
import SelecteurAnnee from '@/components/SelecteurAnnee'
import { cardClass } from '@/components/ui/styles'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { chargerCreneaux } from '@/lib/emploi'
import { anneesEtSelection, un } from '@/lib/scolarite'
import { getDictionary, getLocale } from '@/dictionaries'
import { peutEcrire } from '@/lib/roles'
import EnseignantForm from '../EnseignantForm'

export default async function EnseignantPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ annee?: string }> }) {
  const context = await getCurrentUserContext()
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.enseignants
  const s = dict.scolarite

  const [{ data: ens }, { annees, selection }] = await Promise.all([
    supabase
      .from('enseignants')
      .select('id, civilite, prenom, nom, telephone, email, adresse, statut, actif, utilisateur_id, enseignements(id, classe_id, matieres(nom, couleur), classes(id, nom, annee_id))')
      .eq('id', id)
      .maybeSingle(),
    anneesEtSelection(supabase, sp.annee),
  ])
  if (!ens) notFound()

  type Cours = { id: string; matieres: { nom: string; couleur: string } | null; classes: { id: string; nom: string; annee_id: string } | null }
  const cours = ((ens.enseignements ?? []) as unknown as Cours[])
    .map((c) => ({ ...c, matiere: un(c.matieres), classe: un(c.classes) }))
    .filter((c) => c.classe?.annee_id === selection?.id)
  const parClasse = new Map<string, { id: string; nom: string; matieres: { nom: string; couleur: string }[] }>()
  for (const c of cours) {
    if (!c.classe || !c.matiere) continue
    const l = parClasse.get(c.classe.id) ?? { id: c.classe.id, nom: c.classe.nom, matieres: [] }
    l.matieres.push(c.matiere)
    parClasse.set(c.classe.id, l)
  }
  const creneaux = selection ? await chargerCreneaux(supabase, { enseignantId: id, anneeId: selection.id }) : []

  return (
    <div className="space-y-5">
      <Link href="/enseignants" className="inline-flex items-center gap-1 text-sm font-medium text-foreground-muted hover:text-primary">
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {t.retour}
      </Link>
      <section className={`${cardClass} flex flex-wrap items-start gap-4 p-5 sm:p-6`}>
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-soft font-heading text-xl font-semibold text-primary">{ens.prenom[0]}{ens.nom[0]}</span>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-2xl font-bold text-foreground">{`${ens.civilite ?? ''} ${ens.prenom} ${ens.nom}`.trim()}</h1>
          <p className="text-sm text-foreground-muted">{t.statuts[ens.statut as 'titulaire' | 'vacataire']}</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-foreground-muted">
            {ens.telephone && <span className="flex items-center gap-1.5" dir="ltr"><Phone className="h-4 w-4" /> {ens.telephone}</span>}
            {ens.email && <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> {ens.email}</span>}
            {ens.adresse && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {ens.adresse}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <SelecteurAnnee annees={annees} selection={selection?.id ?? null} libelles={{ annee: s.annee, active: s.active, cloturee: s.cloturee }} />
          {peutEcrire(context.role, 'organisation') && (
            <EnseignantForm
              valeurs={ens}
              comptes={((await supabase.from('utilisateurs').select('id, prenom, nom, email').eq('role', 'enseignant').eq('actif', true)).data ?? []).map((u) => ({ id: u.id, nom: [u.prenom, u.nom].filter(Boolean).join(' ') || u.email || u.id }))}
              dict={dict}
            />
          )}
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="border-b border-surface-border px-5 py-4 font-heading text-base font-semibold text-foreground">{t.coursTitle}</h2>
        <ul className="divide-y divide-surface-border">
          {[...parClasse.values()].map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <Link href={`/classes/${c.id}?vue=enseignements`} className="w-28 font-semibold text-foreground hover:text-primary">{c.nom}</Link>
              <div className="flex flex-wrap gap-1.5">
                {c.matieres.map((m) => (
                  <span key={m.nom} className="inline-flex items-center gap-1.5 rounded-full border border-surface-border px-2.5 py-0.5 text-xs">
                    <span className="h-2 w-2 rounded-full" style={{ background: m.couleur }} /> {m.nom}
                  </span>
                ))}
              </div>
            </li>
          ))}
          {parClasse.size === 0 && <li className="px-5 py-8 text-center text-sm text-foreground-muted">{s.aucuneDonnee}</li>}
        </ul>
      </section>

      <section className={cardClass}>
        <h2 className="border-b border-surface-border px-5 py-4 font-heading text-base font-semibold text-foreground">{dict.classes.tabs.emploi}</h2>
        <EmploiGrid creneaux={creneaux} jours={s.jours} vide={dict.emplois.vide} />
      </section>
    </div>
  )
}
