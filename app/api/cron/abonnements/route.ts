import { NextRequest, NextResponse } from 'next/server'
import { reconcilierPaiementsEnAttente } from '@/lib/abonnements/reconcile'

export const runtime = 'nodejs'

// Filet de sécurité quotidien (vercel.json) : rattrape les paiements dont le
// webhook s'est perdu. Aucune suspension à faire ici : l'accès est calculé à la
// volée depuis les échéances (public.acces_etablissement()). Protégé par
// CRON_SECRET (Vercel Cron envoie `Authorization: Bearer $CRON_SECRET`).
export async function GET(req: NextRequest) {
  const secretAttendu = process.env.CRON_SECRET
  if (!secretAttendu || req.headers.get('authorization') !== `Bearer ${secretAttendu}`) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 })
  }

  return NextResponse.json(await reconcilierPaiementsEnAttente())
}
