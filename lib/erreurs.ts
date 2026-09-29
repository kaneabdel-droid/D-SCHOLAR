import type { Dictionary } from '@/dictionaries'

// Traduit une erreur PostgREST en message du dictionnaire, pour ne jamais
// afficher un message technique (en anglais) à l'utilisateur. Le détail brut
// est journalisé côté serveur.
export function messageErreur(error: { code?: string; message: string }, dict: Dictionary, contexte: string): string {
  switch (error.code) {
    case '23505':
      return dict.errors.duplicate
    case '23503':
      return dict.errors.inUse
    case '23514':
      return dict.errors.invalidValue
    case '42501':
      return dict.errors.forbidden
    // Codes propres à D-Scholar (08_modules.sql, 06_pedagogie.sql).
    case 'DSVER':
      return dict.errors.periodeVerrouillee
    case 'DSNIV':
      return dict.errors.niveauCompteEleve
    case '23P01':
      return dict.errors.conflitCreneau
    default:
      console.error(`${contexte}:`, error.code, error.message)
      return dict.errors.generic
  }
}
