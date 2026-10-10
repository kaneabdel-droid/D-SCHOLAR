do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'paiements_abonnement') then
    alter table public.paiements_abonnement drop constraint if exists paiements_abonnement_provider_check;
    alter table public.paiements_abonnement add constraint paiements_abonnement_provider_check
        check (provider in ('bictorys', 'moneroo', 'virement', 'chariow', 'maketou'));
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'abonnement_paiements') then
    alter table public.abonnement_paiements drop constraint if exists abonnement_paiements_provider_check;
    alter table public.abonnement_paiements add constraint abonnement_paiements_provider_check
        check (provider in ('bictorys', 'moneroo', 'virement', 'chariow', 'maketou'));
  end if;
end $$;
