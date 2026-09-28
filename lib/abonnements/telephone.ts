// Normalisation de téléphone minimale pour les checkouts mobile money.
//
// Contrairement au modèle BYOK complet documenté dans la skill izisaas
// (voir __MACOSX/../"izisaas mobile money skills"/references/*.md), qui utilise
// libphonenumber pour couvrir le monde entier, D-Scholar facture en XOF : seuls les
// pays de la zone UEMOA sont proposés : un indicatif codé en dur pour cette liste de pays
// suffit et évite une dépendance supplémentaire (libphonenumber n'est pas dans
// package.json). Si un pays hors de cette liste est nécessaire un jour,
// ajouter son indicatif ici plutôt que de réintroduire une dépendance lourde.
const INDICATIFS: Record<string, string> = {
  SN: '221',
  CI: '225',
  ML: '223',
  BJ: '229',
  BF: '226',
  TG: '228',
  NE: '227',
}

export const PAYS_TELEPHONE_SUPPORTES = Object.keys(INDICATIFS) as Array<keyof typeof INDICATIFS>

// Chariow exige { number: national SANS le 0 ni l'indicatif, country_code: ISO2 }
// (cf. Chariow.md §3bis) — un E.164 brut ou un 0 initial fait échouer le
// checkout avec "400 Invalid phone number".
export function versNumeroNational(local: string, paysIso2: string): string {
  let digits = local.replace(/\D/g, '')
  const indicatif = INDICATIFS[paysIso2]
  if (indicatif && digits.startsWith(indicatif)) {
    digits = digits.slice(indicatif.length)
  }
  if (digits.startsWith('0')) {
    digits = digits.slice(1)
  }
  return digits
}

// Moneroo/Bictorys attendent plutôt un numéro complet ; on reconstruit un E.164
// du mieux possible à partir du même indicatif codé en dur.
export function versE164(local: string, paysIso2: string): string {
  const national = versNumeroNational(local, paysIso2)
  const indicatif = INDICATIFS[paysIso2]
  return indicatif ? `+${indicatif}${national}` : local.replace(/\D/g, '')
}
