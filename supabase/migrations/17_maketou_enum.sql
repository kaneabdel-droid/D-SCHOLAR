alter table public.abonnement_paiements drop constraint if exists abonnement_paiements_provider_check;
alter table public.abonnement_paiements add constraint abonnement_paiements_provider_check
    check (provider in ('bictorys', 'moneroo', 'virement', 'chariow', 'maketou'));

alter table public.abonnement_paiements drop constraint if exists abonnement_paiements_moyen_paiement_check;
alter table public.abonnement_paiements add constraint abonnement_paiements_moyen_paiement_check
    check (moyen_paiement in ('wave', 'orange', 'carte', 'virement', 'chariow', 'maketou'));
