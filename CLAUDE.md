@AGENTS.md

# D-Scholar

SaaS de gestion scolaire (DembaSolution) : Next.js 16 App Router + Supabase + Tailwind v4, même stack et mêmes conventions que `../d-quinca`.

## Commandes

```bash
npm run dev     # http://localhost:3000 (nécessite .env.local, cf. .env.local.example)
npm run build
npm run lint
npx tsc --noEmit
```

Migrations SQL numérotées dans `supabase/migrations/` (à appliquer dans l'ordre sur le projet Supabase dédié à D-Scholar).

## Architecture

- **Tenancy** : un seul niveau, `etablissements`. Chaque table métier porte `etablissement_id` ; le RLS (`current_etablissement_id()`, `can_manage_parametres()`, `cycle_autorise()`) est le vrai contrôle d'accès.
- **Personnel** : table `utilisateurs` (rôles `direction`, `censeur`, `surveillant`, `secretariat`, `intendant`, `enseignant`). Aucune policy d'écriture : comptes créés via le client service role (console `/admin`, et Paramètres → Utilisateurs pour la direction, rôle vérifié avant).
- **Paliers** : `lib/abonnements/paliers.ts` est la source de vérité (prix, cycles ouverts), miroir SQL `cycles_du_palier()`.
- **Contexte** : `getCurrentUserContext()` (mémoïsé par requête) + gardes `requireParametrage()` / `requireDirection()` en tête de chaque page et action.
- **Proxy** : `proxy.ts` (la convention `middleware` est dépréciée en Next 16) → `utils/supabase/proxy.ts`.
- **Référentiel simple** (niveaux, séries, options, matières, salles) : déclaré une fois dans `lib/parametres/entites.ts`, rendu par `EntiteTable` et écrit par l'action générique `enregistrerEntite` (liste blanche des colonnes).
- **Abonnements** (`lib/abonnements/`, migration 05) : `souscriptions` (une par année) → `echeances_abonnement` (1 à 3 tranches, tranche 1 ≥ 50 %) → `paiements_abonnement` (une ligne par tentative, anti-doublon repris de D-QUINCA). L'accès (`complet` / `lecture_seule` / `suspendu`) est **calculé à la volée** par `acces_etablissement()` depuis les retards (15 j → lecture seule, 30 j → suspendu) ; `can_manage_parametres()` l'intègre, donc le RLS bloque les écritures en lecture seule. Toute nouvelle fonction d'écriture RLS doit appeler `ecriture_autorisee()`, et toute action serveur doit refuser si `context.acces !== 'complet'`. Crédit d'une tranche : uniquement via `reconcile.ts` (re-pull provider, jamais le corps du webhook). Chariow = produits à prix fixe par palier × part (100/50/25 %), Moneroo = montant libre.
- **Pédagogie** (migration 06) : élèves, enseignants (plusieurs matières / classes via `enseignements`), classes, inscriptions (une par élève et par année = cursus), créneaux (trigger anti-conflit classe / enseignant / salle), évaluations, notes, absences, décisions, examens officiels, mouvements. Règles **propres à l'établissement** : `types_evaluation` (nombre par période, poids), `appreciations` (barème des mentions), `etablissements.moyenne_passage / moyenne_repechage`. Les moyennes se calculent en SQL (`moyennes_matieres`, `moyennes_periode`, `moyennes_annuelles`, security invoker) : ne pas les recalculer côté client. Écriture RLS via `peut_ecrire(roles)`.
- **Démo** (migration 07) : `creer_demo()` remplit un établissement vide (Groupe scolaire Les Palmiers, 2025-2026 complète + rentrée 2026-2027) ; lancée depuis `/admin` (bouton « Créer la démo »). Données déterministes.
- **Actions serveur** : renvoient `{ success }` ou `{ error }` ; les erreurs Postgres passent par `lib/erreurs.ts` pour un message traduit.

## Règles

- **Trilingue fr / en / ar obligatoire** : tout texte visible passe par `dictionaries/{fr,en,ar}.json` (mêmes clés). Arabe en RTL : utiliser les utilitaires logiques (`ms-`, `me-`, `ps-`, `start-`, `end-`, `text-start`), jamais `left`/`right`. Les messages d'auth passent dans l'URL sous forme de code (`?message=identifiants`). Seule la console `/admin` (interne) est en français.
- **Tokens de couleur** : `bg-surface`, `text-foreground`, `text-foreground-muted`, `border-surface-border`, `bg-primary-soft`, tokens `sidebar-*` — pas de couleurs Tailwind brutes. Thèmes : Académie (défaut), Ardoise, Nuit (`app/globals.css`).
- **Responsive** : tableaux → cartes sous `sm`, modales en feuille basse sur mobile (`components/ui/Modal.tsx`), onglets défilants.
