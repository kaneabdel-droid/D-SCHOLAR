-- Lot 2 : abonnements par année scolaire, payables par tranches (au moins 50 %
-- à la première). Facturation de la plateforme elle-même : un seul compte
-- Chariow / Moneroo, clés en variables d'environnement (cf. lib/abonnements).
--
-- Écritures exclusivement via le service role (actions serveur et webhooks) :
-- aucune policy insert/update/delete exposée à `authenticated`.

-- Accès offert par l'équipe plateforme (essai, démonstration, geste
-- commercial) : accès complet jusqu'à cette date, quel que soit l'état des paiements.
alter table public.etablissements add column acces_manuel_jusqu_au timestamptz;

-- Une souscription = une année d'abonnement. `debut`/`fin` sont fixés au
-- paiement de la tranche 1 (cf. lib/abonnements/reconcile.ts) ; tant qu'elle
-- n'est pas payée, la souscription reste `en_attente`.
create table public.souscriptions (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  palier varchar(20) not null check (palier in ('elementaire', 'secondaire', 'complet')),
  plan varchar(20) not null check (plan in ('comptant', 'deux_tranches', 'trois_tranches')),
  montant_total integer not null check (montant_total > 0),
  statut varchar(20) not null default 'en_attente' check (statut in ('en_attente', 'active', 'soldee', 'annulee')),
  debut timestamptz,
  fin timestamptz,
  created_at timestamptz not null default now()
);

create index idx_souscriptions_etablissement on public.souscriptions(etablissement_id);

-- Une seule souscription en attente de sa première tranche par établissement.
create unique index uq_souscription_en_attente
  on public.souscriptions(etablissement_id) where statut = 'en_attente';

create table public.echeances_abonnement (
  id uuid default gen_random_uuid() primary key,
  souscription_id uuid references public.souscriptions(id) on delete cascade not null,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  rang smallint not null check (rang between 1 and 3),
  pourcentage smallint not null check (pourcentage in (25, 50, 100)),
  montant integer not null check (montant > 0),
  -- Tranche 1 : date de création ; tranches suivantes : recalées sur la date
  -- de paiement de la tranche 1 (+3 / +6 mois par défaut, modifiables par l'admin).
  date_echeance date not null,
  statut varchar(20) not null default 'a_payer' check (statut in ('a_payer', 'payee')),
  payee_le timestamptz,
  constraint echeance_rang_unique unique (souscription_id, rang),
  -- Règle commerciale : au moins 50 % à la première tranche.
  constraint premiere_tranche_min_50 check (rang > 1 or pourcentage >= 50)
);

create index idx_echeances_souscription on public.echeances_abonnement(souscription_id);

-- Une ligne par tentative de paiement d'une échéance (même modèle que
-- D-QUINCA : checkout réutilisable, tentative abandonnée, doublon à rembourser).
create table public.paiements_abonnement (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  echeance_id uuid references public.echeances_abonnement(id) on delete cascade not null,
  montant integer not null check (montant > 0),
  provider varchar(20) not null check (provider in ('chariow', 'moneroo')),
  provider_reference varchar(255),
  checkout_url text,
  statut varchar(20) not null default 'en_attente' check (statut in ('en_attente', 'paye', 'echoue')),
  abandonne_le timestamptz,
  -- Encaissé alors que l'échéance était déjà réglée : n'est pas crédité, à rembourser.
  doublon boolean not null default false,
  metadata jsonb,
  created_at timestamptz not null default now(),
  paye_at timestamptz
);

create index idx_paiements_etablissement on public.paiements_abonnement(etablissement_id);
create index idx_paiements_statut on public.paiements_abonnement(statut);

-- Idempotence : un même paiement provider ne crédite qu'une seule ligne
-- (course cron ↔ webhook ↔ retour utilisateur).
create unique index uq_paiements_provider_reference
  on public.paiements_abonnement(provider, provider_reference) where provider_reference is not null;

-- Un seul paiement en cours par établissement (double clic, deux onglets).
create unique index uq_paiement_en_cours_par_etablissement
  on public.paiements_abonnement(etablissement_id) where statut = 'en_attente' and abandonne_le is null;

-- Chariow débite le prix d'un produit préconfiguré (aucun montant libre) : un
-- produit par palier × part de tranche (100 / 50 / 25 %), éditable dans
-- /admin/config sans redéploiement. Moneroo accepte un montant libre.
create table public.chariow_produits (
  palier varchar(20) not null check (palier in ('elementaire', 'secondaire', 'complet')),
  pourcentage smallint not null check (pourcentage in (25, 50, 100)),
  product_id varchar(255) not null,
  updated_at timestamptz not null default now(),
  primary key (palier, pourcentage)
);

alter table public.souscriptions enable row level security;
alter table public.echeances_abonnement enable row level security;
alter table public.paiements_abonnement enable row level security;
alter table public.chariow_produits enable row level security;

-- Lecture réservée à la direction (page /abonnement). chariow_produits : aucune policy.
create policy "select_souscriptions" on public.souscriptions for select
  using (etablissement_id = public.current_etablissement_id() and public.current_role() = 'direction');
create policy "select_echeances" on public.echeances_abonnement for select
  using (etablissement_id = public.current_etablissement_id() and public.current_role() = 'direction');
create policy "select_paiements" on public.paiements_abonnement for select
  using (etablissement_id = public.current_etablissement_id() and public.current_role() = 'direction');

-- Niveau d'accès calculé à la volée depuis les échéances (pas de statut stocké
-- qu'un cron devrait tenir à jour). Seuils miroirs de lib/abonnements/plans.ts :
--   retard ≤ 15 j → complet · 15 < retard ≤ 30 j → lecture_seule · > 30 j → suspendu
-- Jamais payé (et pas d'accès offert) → lecture_seule : l'établissement peut se
-- connecter et régler sa première tranche.
create or replace function public.acces_etablissement(p_etablissement_id uuid) returns text
language plpgsql security definer stable set search_path = public as $$
declare
  v_statut text;
  v_acces_manuel timestamptz;
  v_souscription uuid;
  v_derniere_fin timestamptz;
  v_retard integer;
begin
  select statut, acces_manuel_jusqu_au into v_statut, v_acces_manuel
  from public.etablissements where id = p_etablissement_id;

  if v_statut is null or v_statut = 'suspendu' then
    return 'suspendu'; -- suspension manuelle par la plateforme
  end if;
  if v_acces_manuel is not null and v_acces_manuel > now() then
    return 'complet';
  end if;

  select id into v_souscription
  from public.souscriptions
  where etablissement_id = p_etablissement_id and statut in ('active', 'soldee') and debut <= now() and fin > now()
  order by debut desc
  limit 1;

  if v_souscription is not null then
    select coalesce(max(current_date - date_echeance), 0) into v_retard
    from public.echeances_abonnement
    where souscription_id = v_souscription and statut = 'a_payer' and date_echeance < current_date;
  else
    select max(fin) into v_derniere_fin
    from public.souscriptions
    where etablissement_id = p_etablissement_id and statut in ('active', 'soldee');
    if v_derniere_fin is null then
      return 'lecture_seule';
    end if;
    -- Année terminée sans renouvellement : même délai de grâce qu'une tranche en retard.
    v_retard := greatest(0, current_date - v_derniere_fin::date);
  end if;

  if v_retard > 30 then return 'suspendu'; end if;
  if v_retard > 15 then return 'lecture_seule'; end if;
  return 'complet';
end;
$$;

revoke execute on function public.acces_etablissement(uuid) from public, anon, authenticated;

-- Variante sans paramètre pour l'application (ne révèle que son propre établissement).
create or replace function public.mon_acces() returns text
language sql security definer stable set search_path = public as $$
  select public.acces_etablissement(public.current_etablissement_id())
$$;

create or replace function public.ecriture_autorisee() returns boolean
language sql security definer stable set search_path = public as $$
  select public.acces_etablissement(public.current_etablissement_id()) = 'complet'
$$;

-- Le paramétrage (et toutes les RPC qui s'appuient dessus) devient impossible
-- en lecture seule.
create or replace function public.can_manage_parametres() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce(public.current_role() in ('direction', 'censeur'), false) and public.ecriture_autorisee()
$$;

-- Crée une souscription et ses échéances en une transaction. Service role
-- uniquement (appelée par app/(dashboard)/abonnement/actions.ts après contrôle
-- du rôle). p_repartition : parts en % (ex. {50,25,25}), p_decalages : mois
-- après la tranche 1 (ex. {0,3,6}).
create or replace function public.creer_souscription(
  p_etablissement_id uuid,
  p_palier text,
  p_plan text,
  p_montant_total integer,
  p_repartition integer[],
  p_decalages integer[]
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_souscription uuid;
  v_nb integer := coalesce(array_length(p_repartition, 1), 0);
  v_cumul integer := 0;
  v_montant integer;
begin
  if v_nb = 0 or v_nb <> coalesce(array_length(p_decalages, 1), 0) then
    raise exception 'Plan de paiement invalide';
  end if;
  if (select sum(x) from unnest(p_repartition) x) <> 100 then
    raise exception 'La répartition doit totaliser 100 %%';
  end if;
  if p_repartition[1] < 50 then
    raise exception 'La première tranche doit représenter au moins 50 %%';
  end if;

  insert into public.souscriptions (etablissement_id, palier, plan, montant_total)
  values (p_etablissement_id, p_palier, p_plan, p_montant_total)
  returning id into v_souscription;

  for i in 1..v_nb loop
    -- La dernière tranche absorbe l'arrondi : la somme vaut exactement le total.
    v_montant := case when i = v_nb then p_montant_total - v_cumul else round(p_montant_total * p_repartition[i] / 100.0) end;
    v_cumul := v_cumul + v_montant;
    insert into public.echeances_abonnement (souscription_id, etablissement_id, rang, pourcentage, montant, date_echeance)
    values (v_souscription, p_etablissement_id, i, p_repartition[i], v_montant, (current_date + make_interval(months => p_decalages[i]))::date);
  end loop;

  return v_souscription;
end;
$$;

revoke execute on function public.creer_souscription(uuid, text, text, integer, integer[], integer[]) from public, anon, authenticated;
