import { NextRequest, NextResponse } from 'next/server'
import { parserEvenementMoneroo, verifierSignatureMoneroo } from '@/lib/abonnements/providers/moneroo'
import { reconcilierParReferenceProvider } from '@/lib/abonnements/reconcile'

export const runtime = 'nodejs'

// Corps brut requis pour vérifier l'HMAC (header X-Moneroo-Signature).
export async function POST(req: NextRequest) {
  const rawBody = Buffer.from(await req.text(), 'utf-8')
  if (!verifierSignatureMoneroo(rawBody, req.headers.get('x-moneroo-signature'))) {
    return NextResponse.json({ error: 'signature invalide' }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody.toString('utf-8'))
  } catch {
    return NextResponse.json({ received: true, ignored: true })
  }

  const evenement = parserEvenementMoneroo(body)
  if (!evenement) return NextResponse.json({ received: true, ignored: true })

  // Re-pull même après signature vérifiée (défense en profondeur).
  await reconcilierParReferenceProvider('moneroo', evenement.providerReference)
  return NextResponse.json({ received: true })
}
