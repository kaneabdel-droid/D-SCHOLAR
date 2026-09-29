// Adaptateur Chariow (provider par défaut). Patterns repris de Chariow.md à la
// racine du repo et de D-QUINCA : checkout hébergé, prix fixé par un produit de
// la boutique (aucun montant libre via l'API, cf. §6), réconciliation par re-pull
// de `GET /sales/{id}` uniquement, jamais par confiance dans le webhook.

import type { AdaptateurPaiement, InitierPaiementParams, InitierPaiementResultat, StatutPaiementDistant, StatutProvider } from '../types'
import type { PalierCode } from '../paliers'
import type { Pourcentage } from '../plans'
import { versNumeroNational } from '../telephone'
import { createAdminClient } from '@/utils/supabase/admin'

const API_URL = process.env.CHARIOW_API_URL || 'https://api.chariow.com/v1'

function apiKey(): string {
  const key = process.env.CHARIOW_API_KEY
  if (!key) throw new Error('CHARIOW_API_KEY manquant')
  return key
}

// Chariow débite le prix DU PRODUIT configuré dans sa boutique : un produit
// par palier × part de tranche (100 / 50 %), au prix exact issu de
// montantPourcentage() (cf. .env.local.example).
// Table admin-éditable (chariow_produits, /admin/config) en priorité, repli sur
// la variable d'env CHARIOW_PRODUCT_<PALIER>_<POURCENTAGE>.
async function idProduit(palier: PalierCode, pourcentage: Pourcentage): Promise<string | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('chariow_produits')
    .select('product_id')
    .eq('palier', palier)
    .eq('pourcentage', pourcentage)
    .maybeSingle()
  if (data?.product_id) return data.product_id

  return process.env[`CHARIOW_PRODUCT_${palier.toUpperCase()}_${pourcentage}`] || null
}

// Ordre des tests non négociable (Chariow.md §3.3) : "unpaid" contient "paid",
// une implémentation qui teste `paid` en premier créditerait une vente non payée.
export function mapperStatutChariow(statutBrut: string): StatutProvider {
  const s = statutBrut.toLowerCase()
  if (/unpaid/.test(s)) return 'pending'
  if (/fail|error/.test(s)) return 'failed'
  if (/cancel|abandon|refund/.test(s)) return 'abandoned'
  if (/settle|complete|paid|success/.test(s)) return 'succeeded'
  return 'pending'
}

async function chariowFetch(path: string, init: RequestInit): Promise<Response> {
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

export const chariowAdapter: AdaptateurPaiement = {
  id: 'chariow',

  async initierPaiement(params: InitierPaiementParams): Promise<InitierPaiementResultat> {
    const productId = await idProduit(params.palier, params.pourcentage)
    if (!productId) {
      return {
        ok: false,
        error: `Aucun produit Chariow configuré pour ${params.palier} / ${params.pourcentage} % (prix attendu : ${params.montantFcfa} FCFA). À renseigner dans /admin/config.`,
      }
    }

    const body = {
      product_id: productId,
      email: params.emailClient,
      first_name: params.prenomClient || '-',
      last_name: params.nomClient || '-',
      phone: {
        number: versNumeroNational(params.telephoneLocal, params.telephonePays),
        country_code: params.telephonePays,
      },
      redirect_url: params.retourUrl,
      custom_metadata: {
        paiementId: params.paiementId,
        palier: params.palier,
        tranche: String(params.rang),
        etablissement: params.nomEtablissement,
      },
    }

    let res: Response
    try {
      res = await chariowFetch('/checkout', { method: 'POST', body: JSON.stringify(body) })
    } catch (err) {
      return { ok: false, error: `Erreur réseau Chariow : ${(err as Error).message}` }
    }

    let parsed: { data?: { purchase?: { id?: string; amount?: { value?: number; currency?: string } }; payment?: { checkout_url?: string } }; message?: string }
    try {
      parsed = await res.json()
    } catch {
      return { ok: false, error: `Chariow a répondu ${res.status} (réponse non-JSON)` }
    }

    const saleId = parsed.data?.purchase?.id
    const checkoutUrl = parsed.data?.payment?.checkout_url
    if (!res.ok || !saleId || !checkoutUrl) {
      return { ok: false, error: parsed.message || `Chariow a répondu ${res.status}` }
    }

    return {
      ok: true,
      checkoutUrl,
      referenceProvider: saleId,
      montantFacture: parsed.data?.purchase?.amount?.value,
      deviseFacturee: parsed.data?.purchase?.amount?.currency,
    }
  },

  async recupererStatut(referenceProvider: string): Promise<StatutPaiementDistant | null> {
    let res: Response
    try {
      res = await chariowFetch(`/sales/${encodeURIComponent(referenceProvider)}`, { method: 'GET' })
    } catch {
      return null
    }
    if (!res.ok) return null

    let json: { data?: { status?: string; amount?: { value?: number; currency?: string }; settled_at?: string; paid_at?: string; completed_at?: string } }
    try {
      json = await res.json()
    } catch {
      return null
    }
    if (!json.data?.status) return null

    const dateReglement = json.data.settled_at || json.data.paid_at || json.data.completed_at

    return {
      statut: mapperStatutChariow(json.data.status),
      montant: json.data.amount?.value,
      devise: json.data.amount?.currency,
      payeLe: dateReglement ? new Date(dateReglement) : undefined,
    }
  },
}
