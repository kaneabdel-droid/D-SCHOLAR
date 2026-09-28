import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { reconcilierParPaiementId, reconcilierParReferenceProvider } from '@/lib/abonnements/reconcile'

export const runtime = 'nodejs'

function comparaisonConstante(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)
}

// Chariow ne signe pas le corps : secret dans l'URL (?secret=...), comparé en
// temps constant (Chariow.md §7). Le corps ne sert qu'à identifier la vente à
// re-vérifier : le statut vient toujours du re-pull de l'API Chariow.
export async function POST(req: NextRequest) {
  const secretAttendu = process.env.CHARIOW_WEBHOOK_SECRET
  const secretRecu = req.nextUrl.searchParams.get('secret')
  if (!secretAttendu || !secretRecu || !comparaisonConstante(secretRecu, secretAttendu)) {
    return NextResponse.json({ error: 'secret invalide' }, { status: 401 })
  }

  let body: {
    data?: { purchase?: { id?: string; custom_metadata?: { paiementId?: string } } }
    purchase?: { id?: string }
    sale_id?: string
    custom_metadata?: { paiementId?: string }
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ received: true, ignored: true })
  }

  const saleId = body.data?.purchase?.id || body.purchase?.id || body.sale_id
  const paiementId = body.custom_metadata?.paiementId || body.data?.purchase?.custom_metadata?.paiementId

  if (saleId) await reconcilierParReferenceProvider('chariow', saleId)
  else if (paiementId) await reconcilierParPaiementId(paiementId)
  else return NextResponse.json({ received: true, ignored: true })

  return NextResponse.json({ received: true })
}
