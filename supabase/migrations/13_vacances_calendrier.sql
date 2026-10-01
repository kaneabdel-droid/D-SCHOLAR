-- ═════════════════════════════════════════════════════════════════════════════
-- 13 · Vacances selon le calendrier de l'établissement + confidentialité
-- À exécuter après 12_mois_offerts.sql.
-- ═════════════════════════════════════════════════════════════════════════════

-- Les vacances offertes (après 10 mois payés d'affilée) vont de la fin de
-- l'année scolaire à la rentrée suivante du calendrier de l'établissement, qui
-- varie d'un pays à l'autre (lib/abonnements/cycle.ts) : jusqu'à 3 mois.
alter table public.souscriptions drop constraint if exists souscriptions_mois_offerts_check;
alter table public.souscriptions add constraint souscriptions_mois_offerts_check check (mois_offerts between 0 and 3);

-- Réservée aux triggers de notification : ne doit pas être appelable par un
-- utilisateur (elle renvoie les comptes famille de n'importe quel élève).
revoke execute on function public.comptes_de_l_eleve(uuid) from public, anon, authenticated;

-- Familles : les évaluations publiées des seules classes de leurs enfants
-- (classes actuelles et passées).
drop policy if exists famille_evaluations on public.evaluations;
create policy famille_evaluations on public.evaluations for select using (
  publiee and enseignement_id in (
    select en.id from public.enseignements en
    join public.inscriptions i on i.classe_id = en.classe_id
    where i.eleve_id in (select public.mes_eleves())));
