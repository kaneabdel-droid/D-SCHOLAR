import Link from 'next/link'
import { ChevronRight, ClipboardCheck, PenLine, Wallet } from 'lucide-react'
import { cardClass } from '@/components/ui/styles'
import { createClient } from '@/utils/supabase/server'
import { getFamilleContext } from '@/lib/auth/getFamilleContext'
import { situationsFinancieres } from '@/lib/finances'
import { fmt, intlLocale } from '@/lib/i18n'
import { getDictionary, getLocale } from '@/dictionaries'

// Date ISO (AAAA-MM-JJ) d'il y a n jours.
function ilYA(jours: number) {
  return new Date(Date.now() - jours * 86_400_000).toISOString().slice(0, 10)
}

// Accueil du portail : un résumé par enfant et les annonces de l'établissement.
export default async function PortailAccueil() {
  const famille = await getFamilleContext()
  const supabase = await createClient()
  const locale = await getLocale()
  const loc = intlLocale(locale)
  const dict = await getDictionary(locale)
  const t = dict.portail
  const ids = famille.enfants.map((e) => e.id)
  const depuis = ilYA(30)

  const [{ data: notes }, { data: absences }, { data: annonces }, situations] = await Promise.all([
    ids.length ? supabase.from('notes').select('eleve_id, evaluations!inner(date_evaluation)').in('eleve_id', ids).gte('evaluations.date_evaluation', depuis) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('absences').select('eleve_id, type, duree, justifiee, annee_id').in('eleve_id', ids).eq('type', 'absence').eq('justifiee', false) : Promise.resolve({ data: [] }),
    supabase.from('annonces').select('id, titre, contenu, publiee_le').order('publiee_le', { ascending: false }).limit(10),
    famille.type === 'parent'
      ? Promise.all(famille.enfants.filter((e) => e.anneeId).map(async (e) => [e.id, (await situationsFinancieres(supabase, e.anneeId!, [e.id])).get(e.id)] as const))
      : Promise.resolve([]),
  ])
  const reste = new Map(situations)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">{fmt(t.bonjour, { nom: famille.prenom ?? '' }).trim()}</h1>
        <p className="mt-1 text-sm text-foreground-muted">{t.intro}</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        {famille.enfants.map((e) => {
          const nbNotes = (notes ?? []).filter((n) => n.eleve_id === e.id).length
          const heures = (absences ?? []).filter((a) => a.eleve_id === e.id && a.annee_id === e.anneeId).reduce((s, a) => s + Number(a.duree), 0)
          const du = reste.get(e.id)?.resteADate ?? 0
          return (
            <Link key={e.id} href={`/portail/${e.id}`} className={`${cardClass} group block p-5 transition hover:border-primary/40 hover:shadow-md`}>
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft font-heading text-lg font-semibold text-primary">{e.prenom[0]}{e.nom[0]}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-lg font-semibold text-foreground">{e.prenom} {e.nom}</p>
                  <p className="text-sm text-foreground-muted">{e.classe ?? '—'} · <span className="font-mono text-xs">{e.matricule}</span></p>
                </div>
                <ChevronRight className="h-5 w-5 text-foreground-muted transition group-hover:text-primary rtl:-scale-x-100" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <span className="rounded-xl bg-background px-2 py-2.5"><PenLine className="mx-auto mb-1 h-4 w-4 text-primary" /><b className="block text-base text-foreground">{nbNotes}</b>{t.notesRecentes}</span>
                <span className="rounded-xl bg-background px-2 py-2.5"><ClipboardCheck className={`mx-auto mb-1 h-4 w-4 ${heures > 0 ? 'text-danger' : 'text-success'}`} /><b className="block text-base text-foreground">{heures} h</b>{t.nonJustifiees}</span>
                {famille.type === 'parent' ? (
                  <span className="rounded-xl bg-background px-2 py-2.5"><Wallet className={`mx-auto mb-1 h-4 w-4 ${du > 0 ? 'text-warning' : 'text-success'}`} /><b className="block text-base text-foreground">{du.toLocaleString(loc)}</b>{t.resteAPayer}</span>
                ) : (
                  <span className="rounded-xl bg-background px-2 py-2.5" />
                )}
              </div>
            </Link>
          )
        })}
        {famille.enfants.length === 0 && <p className={`${cardClass} p-6 text-sm text-foreground-muted sm:col-span-2`}>{t.aucunEnfant}</p>}
      </section>

      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold text-foreground">{t.annonces}</h2>
        <div className="space-y-3">
          {(annonces ?? []).map((a) => (
            <article key={a.id} className={`${cardClass} p-5`}>
              <p className="text-xs text-foreground-muted">{new Date(a.publiee_le).toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <h3 className="mt-1 font-semibold text-foreground">{a.titre}</h3>
              <p className="mt-2 whitespace-pre-line text-sm text-foreground">{a.contenu}</p>
            </article>
          ))}
          {(annonces ?? []).length === 0 && <p className={`${cardClass} p-6 text-center text-sm text-foreground-muted`}>{t.aucuneAnnonce}</p>}
        </div>
      </section>
    </div>
  )
}
