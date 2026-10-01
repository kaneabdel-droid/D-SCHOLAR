// Rôles du personnel (utilisateurs.role). Les libellés sont dans dict.roles.

export type Role = 'direction' | 'censeur' | 'surveillant' | 'secretariat' | 'intendant' | 'enseignant'

export const ROLES: Role[] = ['direction', 'censeur', 'surveillant', 'secretariat', 'intendant', 'enseignant']

// Miroir de public.can_manage_parametres() (02_rls_functions.sql).
export const ROLES_PARAMETRAGE: Role[] = ['direction', 'censeur']

export function peutGererParametres(role: Role): boolean {
  return ROLES_PARAMETRAGE.includes(role)
}

// Rôles autorisés en écriture par module — miroirs des policies RLS
// (06_pedagogie.sql, 08_modules.sql). L'interface s'en sert pour afficher ou
// non les boutons ; la base reste le vrai contrôle.
export const ECRITURE = {
  eleves: ['direction', 'censeur', 'secretariat'],
  admissions: ['direction', 'censeur', 'secretariat'],
  organisation: ['direction', 'censeur'],
  notes: ['direction', 'censeur', 'enseignant'],
  assiduite: ['direction', 'censeur', 'surveillant', 'enseignant'],
  decisions: ['direction', 'censeur'],
  finances: ['direction', 'intendant'],
  services: ['direction', 'intendant', 'secretariat'],
  documents: ['direction', 'censeur', 'secretariat'],
  annonces: ['direction', 'censeur', 'secretariat', 'surveillant'],
  billets: ['direction', 'censeur', 'surveillant'],
} as const satisfies Record<string, readonly Role[]>

export type Module = keyof typeof ECRITURE

export function peutEcrire(role: Role, module: Module): boolean {
  return (ECRITURE[module] as readonly Role[]).includes(role)
}

// Intitulé affiché d'un membre du personnel : son poste s'il est renseigné
// (utilisateurs.poste, 15_poste_utilisateurs.sql), sinon le libellé du rôle. Le
// poste n'est qu'un libellé : les droits restent ceux du rôle.
export function libellePoste(role: Role, poste: string | null | undefined, roles: Record<Role, string>): string {
  return poste?.trim() || roles[role]
}

// Postes suggérés pour le rôle « censeur » selon les cycles ouverts par
// l'abonnement : Directeur à l'élémentaire, Censeur au collège (cycle moyen),
// Proviseur au lycée. D'autres intitulés restent libres (autres pays).
export function postesSuggeres(cycles: readonly string[], postes: { elementaire: string; moyen: string; secondaire: string }): string[] {
  return [
    ...(cycles.includes('elementaire') ? [postes.elementaire] : []),
    ...(cycles.includes('moyen') ? [postes.moyen] : []),
    ...(cycles.includes('secondaire') ? [postes.secondaire] : []),
  ]
}
