// Documents officiels émis par l'établissement (table documents_emis) : chaque
// document est numéroté et vérifiable en ligne (QR code → /verifier/[code]).
export const TYPES_DOCUMENT = [
  'certificat_scolarite',
  'attestation_inscription',
  'certificat_frequentation',
  'attestation_reussite',
  'exeat',
  'releve_notes',
] as const
export type TypeDocument = (typeof TYPES_DOCUMENT)[number]

// Instantané figé au moment de l'émission : une réimpression donne exactement
// le même document, même si la fiche de l'élève a changé depuis.
export type LigneReleve = { matiere: string; coefficient: number; moyenne: number | null }
export type AnneeReleve = {
  annee: string
  classe: string
  lignes: LigneReleve[]
  moyenne: number | null
  rang: number | null
  effectif: number
  decision: string | null
}
export type ContenuDocument = {
  eleve: { prenom: string; nom: string; matricule: string; sexe: string; date_naissance: string | null; lieu_naissance: string | null }
  classe: string | null
  annee: string | null
  date_inscription?: string | null
  date_entree?: string | null
  moyenne?: number | null
  decision?: string | null
  sortie?: { date: string; type: string; motif: string | null } | null
  reste_du?: number
  cursus?: AnneeReleve[]
}
