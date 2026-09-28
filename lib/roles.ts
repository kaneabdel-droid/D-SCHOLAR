// Rôles du personnel (utilisateurs.role). Les libellés sont dans dict.roles.

export type Role = 'direction' | 'censeur' | 'surveillant' | 'secretariat' | 'intendant' | 'enseignant'

export const ROLES: Role[] = ['direction', 'censeur', 'surveillant', 'secretariat', 'intendant', 'enseignant']

// Miroir de public.can_manage_parametres() (02_rls_functions.sql).
export const ROLES_PARAMETRAGE: Role[] = ['direction', 'censeur']

export function peutGererParametres(role: Role): boolean {
  return ROLES_PARAMETRAGE.includes(role)
}
