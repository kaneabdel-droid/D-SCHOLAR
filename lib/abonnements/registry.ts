// Point unique de bascule entre providers : PAYMENT_PROVIDER_ACTIF choisit celui
// qui ouvre les nouveaux paiements ; webhooks et cron traitent les deux.

import type { AdaptateurPaiement, ProviderId } from './types'
import { chariowAdapter } from './providers/chariow'
import { monerooAdapter } from './providers/moneroo'
import { maketouAdapter } from './providers/maketou'

const ADAPTATEURS: Record<ProviderId, AdaptateurPaiement> = {
  chariow: chariowAdapter,
  moneroo: monerooAdapter,
  maketou: maketouAdapter,
}

export function providerActif(): ProviderId {
  const v = process.env.PAYMENT_PROVIDER_ACTIF
  if (v === 'moneroo' || v === 'chariow' || v === 'maketou') return v
  return 'chariow'
}

export function adaptateurActif(): AdaptateurPaiement {
  return ADAPTATEURS[providerActif()]
}

export function adaptateurPour(provider: ProviderId): AdaptateurPaiement {
  return ADAPTATEURS[provider]
}
