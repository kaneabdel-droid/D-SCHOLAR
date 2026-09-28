// Point unique de bascule entre providers : PAYMENT_PROVIDER_ACTIF choisit celui
// qui ouvre les nouveaux paiements ; webhooks et cron traitent les deux.

import type { AdaptateurPaiement, ProviderId } from './types'
import { chariowAdapter } from './providers/chariow'
import { monerooAdapter } from './providers/moneroo'

const ADAPTATEURS: Record<ProviderId, AdaptateurPaiement> = {
  chariow: chariowAdapter,
  moneroo: monerooAdapter,
}

export function providerActif(): ProviderId {
  return process.env.PAYMENT_PROVIDER_ACTIF === 'moneroo' ? 'moneroo' : 'chariow'
}

export function adaptateurActif(): AdaptateurPaiement {
  return ADAPTATEURS[providerActif()]
}

export function adaptateurPour(provider: ProviderId): AdaptateurPaiement {
  return ADAPTATEURS[provider]
}
