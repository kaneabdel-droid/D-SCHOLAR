-- Module Comptabilité / Trésorerie pour D-Scholar

-- 1. Comptes de trésorerie
create table public.comptes_tresorerie (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  nom varchar(100) not null,
  type varchar(20) not null check (type in ('caisse', 'banque', 'mobile_money')),
  solde_initial integer not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  unique (etablissement_id, nom)
);
create index idx_comptes_tresorerie_etablissement on public.comptes_tresorerie(etablissement_id);

-- 2. Catégories de charges
create table public.categories_charges (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  nom varchar(100) not null,
  created_at timestamptz not null default now(),
  unique (etablissement_id, nom)
);
create index idx_categories_charges_etab on public.categories_charges(etablissement_id);

-- 3. Mouvements de trésorerie
create table public.mouvements_tresorerie (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  annee_id uuid references public.annees_scolaires(id) on delete cascade not null,
  compte_id uuid references public.comptes_tresorerie(id) on delete restrict not null,
  categorie_charge_id uuid references public.categories_charges(id) on delete set null,
  type_mouvement varchar(20) not null check (type_mouvement in ('recette', 'depense', 'virement_sortant', 'virement_entrant')),
  montant integer not null check (montant > 0),
  date_mouvement date not null default current_date,
  libelle text not null,
  reference_piece varchar(100),
  paiement_eleve_id uuid references public.paiements_eleves(id) on delete set null,
  created_by uuid references auth.users not null,
  created_at timestamptz not null default now()
);
create index idx_mouvements_tresorerie_etab on public.mouvements_tresorerie(etablissement_id);
create index idx_mouvements_tresorerie_annee on public.mouvements_tresorerie(annee_id);
create index idx_mouvements_tresorerie_compte on public.mouvements_tresorerie(compte_id);

-- Fonction pour calculer le solde d'un compte
create or replace function public.solde_compte(p_compte_id uuid) returns bigint
language sql stable as $$
  select coalesce(c.solde_initial, 0) +
         coalesce((select sum(montant) from public.mouvements_tresorerie where compte_id = p_compte_id and type_mouvement in ('recette', 'virement_entrant')), 0) -
         coalesce((select sum(montant) from public.mouvements_tresorerie where compte_id = p_compte_id and type_mouvement in ('depense', 'virement_sortant')), 0)
  from public.comptes_tresorerie c
  where c.id = p_compte_id
$$;

-- Initialisation des catégories de charges par défaut
create or replace function public.initialiser_categories_charges(p_etablissement_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.categories_charges (etablissement_id, nom)
  values
    (p_etablissement_id, 'Électricité'),
    (p_etablissement_id, 'Eau'),
    (p_etablissement_id, 'Loyer'),
    (p_etablissement_id, 'Salaires et honoraires'),
    (p_etablissement_id, 'Services extérieurs'),
    (p_etablissement_id, 'Fournitures de bureau'),
    (p_etablissement_id, 'Matériels et équipements'),
    (p_etablissement_id, 'Impôts et taxes'),
    (p_etablissement_id, 'Frais bancaires'),
    (p_etablissement_id, 'Divers')
  on conflict (etablissement_id, nom) do nothing;
end;
$$;

-- RLS (Row Level Security)
alter table public.comptes_tresorerie enable row level security;
alter table public.categories_charges enable row level security;
alter table public.mouvements_tresorerie enable row level security;

drop policy if exists "Lecture des comptes_tresorerie par le personnel" on public.comptes_tresorerie;
create policy "Lecture des comptes_tresorerie par le personnel" on public.comptes_tresorerie for select using (etablissement_id = public.current_etablissement_id());

drop policy if exists "Modif des comptes_tresorerie par intendant/direction" on public.comptes_tresorerie;
create policy "Modif des comptes_tresorerie par intendant/direction" on public.comptes_tresorerie for all using (
  etablissement_id = public.current_etablissement_id() 
  and public.current_role() in ('direction', 'intendant', 'secretariat')
);

drop policy if exists "Lecture des categories_charges par le personnel" on public.categories_charges;
create policy "Lecture des categories_charges par le personnel" on public.categories_charges for select using (etablissement_id = public.current_etablissement_id());

drop policy if exists "Modif des categories_charges par intendant/direction" on public.categories_charges;
create policy "Modif des categories_charges par intendant/direction" on public.categories_charges for all using (
  etablissement_id = public.current_etablissement_id() 
  and public.current_role() in ('direction', 'intendant', 'secretariat')
);

drop policy if exists "Lecture des mouvements_tresorerie par le personnel" on public.mouvements_tresorerie;
create policy "Lecture des mouvements_tresorerie par le personnel" on public.mouvements_tresorerie for select using (etablissement_id = public.current_etablissement_id());

drop policy if exists "Modif des mouvements_tresorerie par intendant/direction" on public.mouvements_tresorerie;
create policy "Modif des mouvements_tresorerie par intendant/direction" on public.mouvements_tresorerie for all using (
  etablissement_id = public.current_etablissement_id() 
  and public.current_role() in ('direction', 'intendant', 'secretariat')
);

-- Vue pour le tableau de bord (résultat, balance)
create or replace view public.vue_resultat_tresorerie as
select
  etablissement_id,
  annee_id,
  sum(case when type_mouvement in ('recette') then montant else 0 end) as total_recettes,
  sum(case when type_mouvement in ('depense') then montant else 0 end) as total_depenses,
  sum(case when type_mouvement in ('recette') then montant else 0 end) - 
  sum(case when type_mouvement in ('depense') then montant else 0 end) as resultat_net
from public.mouvements_tresorerie
group by etablissement_id, annee_id;
