// Comptes famille sans email (parents joignables seulement par téléphone) :
// Supabase Auth exige un email, on en dérive un technique, jamais affiché ni
// utilisé pour écrire. Le parent se connecte avec son numéro, traduit ici.
export const DOMAINE_FAMILLE = 'famille.scholar.dembasolution.com'

export function chiffres(telephone: string) {
  return telephone.replace(/\D/g, '')
}

export function emailTechnique(telephone: string) {
  return `${chiffres(telephone)}@${DOMAINE_FAMILLE}`
}

// Identifiant saisi à la connexion : un email tel quel, sinon un numéro de téléphone.
export function identifiantVersEmail(identifiant: string) {
  const v = identifiant.trim().toLowerCase()
  return v.includes('@') ? v : emailTechnique(v)
}
