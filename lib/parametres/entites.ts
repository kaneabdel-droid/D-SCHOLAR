// Description déclarative des tables simples du référentiel (niveaux, séries,
// options, matières, salles). Partagée par le composant client (formulaires,
// tableau) et par l'action serveur générique (validation et liste blanche des
// colonnes écrites) : un seul endroit à modifier pour ajouter un champ.

export type TypeChamp = 'text' | 'number' | 'color' | 'checkbox' | 'select'

// Source des libellés d'un champ select : section du dictionnaire.
export type SourceOptions = 'cycles' | 'typesSalle' | 'categories' | 'typesService' | 'periodicites'

export type Champ = {
  nom:
    | 'code' | 'nom' | 'cycle' | 'ordre' | 'a_series' | 'actif' | 'couleur' | 'capacite' | 'type'
    | 'libelle' | 'poids' | 'nombre_par_periode' | 'moyenne_min' | 'categorie' | 'tarif' | 'periodicite'
  type: TypeChamp
  requis?: boolean
  max?: number
  majuscules?: boolean
  entier?: boolean
  options?: SourceOptions
  defaut?: string | number | boolean
  // Colonne affichée dans le tableau (les autres restent dans le formulaire).
  colonne?: boolean
}

export type EntiteCle = 'niveaux' | 'series' | 'options' | 'matieres' | 'salles' | 'evaluations' | 'appreciations' | 'services'

export type Entite = {
  // Table Supabase (peut différer de la clé, qui sert aussi de section du dictionnaire).
  table: string
  tri: string
  champs: Champ[]
  // Module d'écriture (lib/roles.ts) quand ce n'est pas le paramétrage (direction / censeur).
  module?: 'finances'
}

export const TYPES_SALLE = ['classe', 'laboratoire', 'informatique', 'polyvalente', 'autre'] as const
export const CATEGORIES_APPRECIATION = ['distinction', 'neutre', 'avertissement'] as const

export const ENTITES: Record<EntiteCle, Entite> = {
  niveaux: {
    table: 'niveaux',
    tri: 'ordre',
    champs: [
      { nom: 'ordre', type: 'number', requis: true, entier: true, colonne: true },
      { nom: 'code', type: 'text', requis: true, max: 10, majuscules: true, colonne: true },
      { nom: 'nom', type: 'text', requis: true, max: 50, colonne: true },
      { nom: 'cycle', type: 'select', requis: true, options: 'cycles', colonne: true },
      { nom: 'a_series', type: 'checkbox', defaut: false, colonne: true },
      { nom: 'actif', type: 'checkbox', defaut: true, colonne: true },
    ],
  },
  series: {
    table: 'series',
    tri: 'code',
    champs: [
      { nom: 'code', type: 'text', requis: true, max: 10, majuscules: true, colonne: true },
      { nom: 'nom', type: 'text', requis: true, max: 100, colonne: true },
      { nom: 'actif', type: 'checkbox', defaut: true, colonne: true },
    ],
  },
  options: {
    table: 'options',
    tri: 'code',
    champs: [
      { nom: 'code', type: 'text', requis: true, max: 20, majuscules: true, colonne: true },
      { nom: 'nom', type: 'text', requis: true, max: 100, colonne: true },
      { nom: 'actif', type: 'checkbox', defaut: true, colonne: true },
    ],
  },
  matieres: {
    table: 'matieres',
    tri: 'nom',
    champs: [
      { nom: 'couleur', type: 'color', defaut: '#2563EB', colonne: true },
      { nom: 'code', type: 'text', requis: true, max: 20, majuscules: true, colonne: true },
      { nom: 'nom', type: 'text', requis: true, max: 100, colonne: true },
      { nom: 'actif', type: 'checkbox', defaut: true, colonne: true },
    ],
  },
  salles: {
    table: 'salles',
    tri: 'nom',
    champs: [
      { nom: 'nom', type: 'text', requis: true, max: 50, colonne: true },
      { nom: 'type', type: 'select', requis: true, options: 'typesSalle', defaut: 'classe', colonne: true },
      { nom: 'capacite', type: 'number', entier: true, colonne: true },
      { nom: 'actif', type: 'checkbox', defaut: true, colonne: true },
    ],
  },
  // Règles d'évaluation propres à l'établissement (06_pedagogie.sql).
  evaluations: {
    table: 'types_evaluation',
    tri: 'ordre',
    champs: [
      { nom: 'ordre', type: 'number', requis: true, entier: true, colonne: true },
      { nom: 'code', type: 'text', requis: true, max: 20, majuscules: true, colonne: true },
      { nom: 'libelle', type: 'text', requis: true, max: 60, colonne: true },
      { nom: 'nombre_par_periode', type: 'number', requis: true, entier: true, defaut: 1, colonne: true },
      { nom: 'poids', type: 'number', requis: true, defaut: 1, colonne: true },
      { nom: 'actif', type: 'checkbox', defaut: true, colonne: true },
    ],
  },
  // Services proposés aux élèves (08_modules.sql) : gérés par la direction et l'intendance.
  services: {
    table: 'services',
    tri: 'nom',
    module: 'finances',
    champs: [
      { nom: 'type', type: 'select', requis: true, options: 'typesService', defaut: 'restauration', colonne: true },
      { nom: 'nom', type: 'text', requis: true, max: 100, colonne: true },
      { nom: 'tarif', type: 'number', requis: true, entier: true, colonne: true },
      { nom: 'periodicite', type: 'select', requis: true, options: 'periodicites', defaut: 'mensuel', colonne: true },
      { nom: 'actif', type: 'checkbox', defaut: true, colonne: true },
    ],
  },
  appreciations: {
    table: 'appreciations',
    tri: 'moyenne_min',
    champs: [
      { nom: 'moyenne_min', type: 'number', requis: true, colonne: true },
      { nom: 'libelle', type: 'text', requis: true, max: 60, colonne: true },
      { nom: 'categorie', type: 'select', requis: true, options: 'categories', defaut: 'neutre', colonne: true },
      { nom: 'actif', type: 'checkbox', defaut: true, colonne: true },
    ],
  },
}

export type Ligne = { id: string } & Record<string, string | number | boolean | null>
