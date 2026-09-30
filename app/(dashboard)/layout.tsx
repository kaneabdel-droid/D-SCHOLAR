import { redirect } from 'next/navigation'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { etatAbonnement } from '@/lib/abonnements/etat'
import { RAPPEL_RENOUVELLEMENT_JOURS, SEUIL_LECTURE_SEULE_JOURS } from '@/lib/abonnements/plans'
import { fmt, intlLocale } from '@/lib/i18n'
import { getLocale, getDictionary } from '@/dictionaries'
import Notifications from '@/components/Notifications'
import ClientLayout, { type Bandeau } from './ClientLayout'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // getCurrentUserContext() redirige déjà vers /login sans session.
  const context = await getCurrentUserContext()

  // /compte-suspendu vit hors de ce layout pour rester atteignable.
  if (context.etablissementStatut === 'suspendu' || context.acces === 'suspendu') redirect('/compte-suspendu')

  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const t = dict.abonnement

  // Bandeau d'abonnement : lecture seule, jamais payé, ou tranche en retard.
  let bandeau: Bandeau | null = null
  const etat = await etatAbonnement(context.etablissementId)
  if (context.acces === 'lecture_seule') {
    bandeau = { niveau: 'alerte', texte: etat.courante || etat.future ? t.bannerLectureSeule : t.bannerNonPaye }
  } else if (etat.retardJours > 0 && etat.prochaine) {
    bandeau = {
      niveau: 'avertissement',
      texte: fmt(t.bannerRetard, {
        n: etat.prochaine.rang,
        montant: etat.prochaine.montant.toLocaleString(intlLocale(locale)),
        jours: etat.retardJours,
        seuil: SEUIL_LECTURE_SEULE_JOURS,
      }),
    }
  }
  // Abonnement mensuel : rappel avant la fin de la période payée, puis pendant
  // le délai de grâce (sauf accès offert par la plateforme, ex. démo).
  const offert = etat.accesManuelJusquAu && new Date(etat.accesManuelJusquAu) > new Date()
  if (!bandeau && !offert && etat.payeJusquau) {
    const fin = new Date(etat.payeJusquau)
    const jours = etat.joursAvantFin ?? 0
    const dateFin = fin.toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'long' })
    if (etat.courante?.plan === 'mensuel' && etat.futures.length === 0 && jours <= RAPPEL_RENOUVELLEMENT_JOURS) {
      bandeau = { niveau: 'avertissement', texte: fmt(t.bannerFinProche, { date: dateFin, jours }) }
    } else if (!etat.courante && !etat.future && jours <= 0) {
      bandeau = { niveau: 'avertissement', texte: fmt(t.bannerExpire, { date: dateFin, seuil: SEUIL_LECTURE_SEULE_JOURS }) }
    }
  }
  if (bandeau) {
    bandeau.action = context.role === 'direction' ? { libelle: t.bannerAction, href: '/abonnement' } : undefined
    bandeau.complement = context.role === 'direction' ? undefined : t.bannerContact
  }

  return (
    <ClientLayout
      role={context.role}
      etablissementNom={context.etablissementNom}
      anneeLibelle={context.anneeActive?.libelle ?? null}
      utilisateurNom={[context.prenom, context.nom].filter(Boolean).join(' ') || context.email || ''}
      bandeau={bandeau}
      notifications={<Notifications dict={dict} locale={locale} />}
      locale={locale}
      dict={dict}
    >
      {children}
    </ClientLayout>
  )
}
