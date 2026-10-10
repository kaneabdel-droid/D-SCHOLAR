import type { AdaptateurPaiement, InitierPaiementParams, InitierPaiementResultat, StatutPaiementDistant, StatutProvider } from '../types'
import type { PalierCode, DureeMois } from '../paliers'
import { versNumeroNational } from '../telephone'
import { createAdminClient } from '@/utils/supabase/admin'
const maketouApiKey = process.env.MAKETOU_API_KEY
const maketouApiUrl = process.env.MAKETOU_API_URL || 'https://api.maketou.net'

async function idProduit(palier: PalierCode, dureeMois: DureeMois): Promise<string | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('maketou_produits')
    .select('product_id')
    .eq('palier', palier)
    .eq('duree_mois', dureeMois)
    .maybeSingle()
  return data?.product_id || null
}

function mapMaketouStatus(raw: string): StatutProvider {
  const s = raw.toLowerCase()
  if (s === 'completed') return 'succeeded'
  if (s === 'payment_failed' || s === 'abandoned') return 'failed'
  return 'pending' // waiting_payment
}

function splitName(full: string | undefined, fallbackEmail: string): { first: string; last: string } {
  const v = (full ?? '').trim()
  if (!v) {
    const local = fallbackEmail.split('@')[0] || 'Client'
    return { first: local, last: '-' }
  }
  const parts = v.split(/\\s+/)
  return { first: parts[0]!, last: parts.slice(1).join(' ') || '-' }
}

export const maketouAdapter: AdaptateurPaiement = {
  id: 'maketou',

  async initierPaiement(params: InitierPaiementParams): Promise<InitierPaiementResultat> {
    if (!maketouApiKey) {
      return { ok: false, error: 'Maketou non configuré (MAKETOU_API_KEY manquant)' }
    }

    const productId = await idProduit(params.palier, params.dureeMois)
    if (!productId) {
      return {
        ok: false,
        error: `Aucun produit Maketou configuré pour ${params.palier}/${params.dureeMois} mois. Créer le produit dans la boutique Maketou au prix indiqué et renseigner son id.`,
      }
    }

    const { first, last } = splitName(params.nomClient ? `${params.prenomClient} ${params.nomClient}` : params.prenomClient, params.emailClient)

    const body = {
      productDocumentId: productId,
      email: params.emailClient,
      firstName: first,
      lastName: last,
      phone: versNumeroNational(params.telephoneLocal, params.telephonePays),
      redirectURL: params.retourUrl,
      meta: { paymentId: params.abonnementId },
    }

    let res: Response
    try {
      res = await fetch(`${maketouApiUrl}/api/v1/stores/cart/checkout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${maketouApiKey}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      })
    } catch (err) {
      return { ok: false, error: `Erreur réseau Maketou : ${(err as Error).message}` }
    }

    let parsed: any
    try {
      parsed = await res.json()
    } catch {
      return { ok: false, error: `Maketou a répondu ${res.status} (réponse non-JSON)` }
    }

    const providerTransactionId = parsed.cart?.id
    const checkoutUrl = parsed.redirectUrl

    if (!res.ok || !providerTransactionId || !checkoutUrl) {
      return { ok: false, error: parsed.message || `Maketou a répondu ${res.status}` }
    }

    return {
      ok: true,
      checkoutUrl,
      referenceProvider: providerTransactionId,
    }
  },

  async recupererStatut(referenceProvider: string): Promise<StatutPaiementDistant | null> {
    if (!maketouApiKey) return null
    let res: Response
    try {
      res = await fetch(`${maketouApiUrl}/api/v1/stores/cart/${encodeURIComponent(referenceProvider)}`, {
        headers: { Authorization: `Bearer ${maketouApiKey}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      })
    } catch {
      return null
    }
    if (!res.ok) return null
    const json = (await res.json().catch(() => null)) as any
    if (!json?.status) return null

    return {
      statut: mapMaketouStatus(json.status),
    }
  },
}
