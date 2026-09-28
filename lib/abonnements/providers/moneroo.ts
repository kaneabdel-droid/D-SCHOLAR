// Adaptateur Moneroo (repris de D-QUINCA, d'après la skill izisaas mobile money).
// Activé par PAYMENT_PROVIDER_ACTIF=moneroo une fois MONEROO_API_KEY renseignée.
// Contrairement à Chariow, Moneroo accepte un montant libre par checkout.

import crypto from 'node:crypto'
import type { AdaptateurPaiement, InitierPaiementParams, InitierPaiementResultat, StatutPaiementDistant, StatutProvider } from '../types'
import { versE164 } from '../telephone'

const API_URL = 'https://api.moneroo.io'

function apiKey(): string {
  const key = process.env.MONEROO_API_KEY
  if (!key) throw new Error('MONEROO_API_KEY manquant')
  return key
}

async function monerooFetch(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
}

export const monerooAdapter: AdaptateurPaiement = {
  id: 'moneroo',

  async initierPaiement(params: InitierPaiementParams): Promise<InitierPaiementResultat> {
    const body = {
      amount: params.montantFcfa,
      currency: 'XOF',
      description: `Abonnement D-Scholar ${params.palier} — tranche ${params.rang} (${params.nomEtablissement})`.slice(0, 200),
      return_url: params.retourUrl,
      customer: {
        email: params.emailClient,
        // Moneroo répond 400 si first_name/last_name sont absents (piège connu,
        // cf. skill izisaas §"Moneroo customer.first_name / last_name required").
        first_name: params.prenomClient || '-',
        last_name: params.nomClient || '-',
        phone: versE164(params.telephoneLocal, params.telephonePays),
      },
      metadata: {
        paiementId: params.paiementId,
        palier: params.palier,
        tranche: String(params.rang),
      },
    }

    let res: Response
    try {
      res = await monerooFetch('/v1/payments/initialize', { method: 'POST', body: JSON.stringify(body) })
    } catch (err) {
      return { ok: false, error: `Erreur réseau Moneroo : ${(err as Error).message}` }
    }

    let parsed: { data?: { id?: string; checkout_url?: string }; message?: string }
    try {
      parsed = await res.json()
    } catch {
      return { ok: false, error: `Moneroo a répondu ${res.status} (réponse non-JSON)` }
    }

    if (!res.ok || !parsed.data?.id || !parsed.data?.checkout_url) {
      return { ok: false, error: parsed.message || `Moneroo a répondu ${res.status}` }
    }

    return { ok: true, checkoutUrl: parsed.data.checkout_url, referenceProvider: parsed.data.id }
  },

  async recupererStatut(referenceProvider: string): Promise<StatutPaiementDistant | null> {
    let res: Response
    try {
      res = await monerooFetch(`/v1/payments/${encodeURIComponent(referenceProvider)}/verify`, { method: 'GET' })
    } catch {
      return null
    }
    if (!res.ok) return null

    let json: { data?: { status?: string; amount?: number | string; currency?: { code?: string } | string } }
    try {
      json = await res.json()
    } catch {
      return null
    }
    if (!json.data?.status) return null

    const devise = typeof json.data.currency === 'string' ? json.data.currency : json.data.currency?.code
    const montant = typeof json.data.amount === 'string' ? parseInt(json.data.amount, 10) : json.data.amount

    return { statut: mapperStatutMoneroo(json.data.status), montant, devise }
  },
}

function mapperStatutMoneroo(statutBrut: string): StatutProvider {
  const s = statutBrut.toLowerCase()
  if (s === 'success' || s === 'completed' || s === 'paid') return 'succeeded'
  if (s === 'failed' || s === 'cancelled') return 'failed'
  return 'pending'
}

// Signature webhook Moneroo : HMAC-SHA256 sur le corps brut, header
// X-Moneroo-Signature. Comparaison en temps constant obligatoire.
export function verifierSignatureMoneroo(corpsBrut: Buffer, signature: string | null): boolean {
  const secret = process.env.MONEROO_WEBHOOK_SECRET
  if (!secret || !signature) return false

  const attendue = crypto.createHmac('sha256', secret).update(corpsBrut).digest('hex')
  const a = Buffer.from(signature.trim())
  const b = Buffer.from(attendue)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export function parserEvenementMoneroo(body: unknown): { providerReference: string; statut: StatutProvider } | null {
  const b = body as { event?: string; data?: { id?: string } } | null
  const id = b?.data?.id
  if (!b?.event || !id) return null

  if (b.event === 'payment.success') return { providerReference: id, statut: 'succeeded' }
  if (b.event === 'payment.failed' || b.event === 'payment.cancelled') return { providerReference: id, statut: 'failed' }
  return null
}
