import { requireDirection } from '@/lib/auth/getCurrentUserContext'
import { getDictionary, getLocale } from '@/dictionaries'
import RetourClient from './RetourClient'

// Hors du groupe (dashboard) : ce layout redirige vers /compte-suspendu quand
// l'accès est coupé, pile dans le cas où un paiement est fait pour le rétablir.
export default async function RetourAbonnementPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  await requireDirection()
  const { id } = await searchParams
  const dict = await getDictionary(await getLocale())
  return <RetourClient paiementId={id ?? null} libelles={dict.abonnement.retour} />
}
