import type { PalierCode } from './paliers'
import type { Pourcentage } from './plans'

export type ProviderId = 'chariow' | 'moneroo'

export type InitierPaiementParams = {
  paiementId: string
  palier: PalierCode
  /** Part de la tranche payée (sert à choisir le produit Chariow). */
  pourcentage: Pourcentage
  rang: number
  montantFcfa: number
  emailClient: string
  prenomClient: string
  nomClient: string
  telephoneLocal: string
  /** ISO2 du pays du numéro (SN, CI, ML, BJ, BF, TG, NE). */
  telephonePays: string
  retourUrl: string
  nomEtablissement: string
}

export type InitierPaiementResultat =
  | {
      ok: true
      checkoutUrl: string
      referenceProvider: string
      /** Montant réellement facturé par le provider (contrôle anti-fraude à la réconciliation). */
      montantFacture?: number
      deviseFacturee?: string
    }
  | { ok: false; error: string }

export type StatutProvider = 'pending' | 'succeeded' | 'failed' | 'abandoned'

export type StatutPaiementDistant = {
  statut: StatutProvider
  montant?: number
  devise?: string
  payeLe?: Date
}

export interface AdaptateurPaiement {
  readonly id: ProviderId
  initierPaiement(params: InitierPaiementParams): Promise<InitierPaiementResultat>
  /** Re-pull de l'état du paiement ; `null` si l'API ne répond pas de façon exploitable. */
  recupererStatut(referenceProvider: string): Promise<StatutPaiementDistant | null>
}
