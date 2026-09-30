-- ═════════════════════════════════════════════════════════════════════════════
-- 11 · Abonnement mensuel
-- Élémentaire 10 000 · Moyen-secondaire 15 000 · Cycle complet 22 500 FCFA par
-- mois (lib/abonnements/paliers.ts). Un paiement = une souscription d'un mois
-- (plan « mensuel », une échéance à 100 %), payable d'avance ; les périodes
-- s'enchaînent (lib/abonnements/reconcile.ts). Les accès (complet / lecture
-- seule / suspendu) suivent la fin de la dernière période payée, comme avant.
-- À exécuter après 10_groupes.sql.
-- ═════════════════════════════════════════════════════════════════════════════

-- Plans acceptés pour les nouvelles souscriptions ; NOT VALID : les
-- souscriptions annuelles déjà enregistrées restent telles quelles.
alter table public.souscriptions drop constraint if exists souscriptions_plan_check;
alter table public.souscriptions add constraint souscriptions_plan_check
  check (plan in ('mensuel', 'comptant', 'deux_tranches')) not valid;

-- Produits Chariow : les identifiants saisis pour l'ancienne tarification
-- annuelle débiteraient l'ancien prix. On les retire : les nouveaux produits
-- mensuels viennent des variables CHARIOW_PRODUCT_Scholar_Elem / _MS / _FULL,
-- ou de /admin/config (un produit par palier, part 100 %).
delete from public.chariow_produits;
