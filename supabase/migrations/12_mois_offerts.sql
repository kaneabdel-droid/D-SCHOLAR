-- ═════════════════════════════════════════════════════════════════════════════
-- 12 · Deux mois de vacances offerts
-- L'abonnement se paie sur 10 mois : au 10e mois payé consécutif, la période
-- est prolongée de 2 mois offerts (lib/abonnements/reconcile.ts). Le compteur
-- repart après chaque période offerte, ou après une interruption de plus de
-- 30 jours (établissement suspendu).
-- À exécuter après 11_abonnement_mensuel.sql.
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.souscriptions add column if not exists mois_offerts smallint not null default 0
  check (mois_offerts between 0 and 2);
