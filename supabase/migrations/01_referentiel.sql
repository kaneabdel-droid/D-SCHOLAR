-- Référentiel scolaire paramétré par chaque établissement (lot 1) : années,
-- périodes, niveaux, séries, options, matières, coefficients, salles. Tout le
-- reste (classes, inscriptions, notes...) s'appuie dessus.

-- Une seule année « active » à la fois par établissement (index partiel plus
-- bas) : c'est elle que tous les écrans utilisent par défaut.
create table public.annees_scolaires (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  libelle varchar(20) not null,
  date_debut date not null,
  date_fin date not null,
  decoupage varchar(20) not null default 'trimestre' check (decoupage in ('trimestre', 'semestre')),
  active boolean not null default false,
  cloturee boolean not null default false,
  created_at timestamptz not null default now(),
  constraint annee_dates_coherentes check (date_fin > date_debut),
  constraint annee_libelle_unique unique (etablissement_id, libelle)
);

create unique index uq_annee_active_par_etablissement
  on public.annees_scolaires(etablissement_id) where active;

-- Trimestres ou semestres. `verrouillee` fige les notes de la période : aucun
-- bulletin ni relevé n'est émis sur une période ouverte (cf. plan §4).
create table public.periodes (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  annee_id uuid references public.annees_scolaires(id) on delete cascade not null,
  rang smallint not null check (rang between 1 and 3),
  libelle varchar(50) not null,
  date_debut date,
  date_fin date,
  verrouillee boolean not null default false,
  constraint periode_rang_unique unique (annee_id, rang)
);

create index idx_periodes_annee on public.periodes(annee_id);

-- Niveaux (PS … Tle). `cycle` sert à la restriction par palier d'abonnement ;
-- `ordre` donne l'enchaînement utilisé plus tard par les passages de classe.
create table public.niveaux (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  cycle varchar(20) not null check (cycle in ('prescolaire', 'elementaire', 'moyen', 'secondaire')),
  code varchar(10) not null,
  nom varchar(50) not null,
  ordre smallint not null,
  -- Vrai pour les niveaux du lycée : une classe de ce niveau porte une série.
  a_series boolean not null default false,
  actif boolean not null default true,
  constraint niveau_code_unique unique (etablissement_id, code)
);

create index idx_niveaux_etablissement on public.niveaux(etablissement_id);

create table public.series (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  code varchar(10) not null,
  nom varchar(100) not null,
  actif boolean not null default true,
  constraint serie_code_unique unique (etablissement_id, code)
);

-- Options facultatives (LV2, arts, ...) choisies par l'élève à l'inscription.
create table public.options (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  code varchar(20) not null,
  nom varchar(100) not null,
  actif boolean not null default true,
  constraint option_code_unique unique (etablissement_id, code)
);

create table public.matieres (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  code varchar(20) not null,
  nom varchar(100) not null,
  couleur varchar(7) not null default '#2563EB',
  actif boolean not null default true,
  constraint matiere_code_unique unique (etablissement_id, code)
);

-- Coefficient et volume horaire d'une matière pour un niveau (et une série
-- au lycée). serie_id null = valable pour tout le niveau.
create table public.coefficients (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  niveau_id uuid references public.niveaux(id) on delete cascade not null,
  serie_id uuid references public.series(id) on delete cascade,
  matiere_id uuid references public.matieres(id) on delete cascade not null,
  coefficient numeric(4, 2) not null check (coefficient > 0),
  volume_horaire numeric(4, 1) check (volume_horaire is null or volume_horaire >= 0)
);

-- Un seul coefficient par (niveau, série, matière), série absente comprise.
create unique index uq_coefficient
  on public.coefficients(niveau_id, coalesce(serie_id, '00000000-0000-0000-0000-000000000000'::uuid), matiere_id);
create index idx_coefficients_etablissement on public.coefficients(etablissement_id);

create table public.salles (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  nom varchar(50) not null,
  capacite integer check (capacite is null or capacite > 0),
  type varchar(20) not null default 'classe' check (type in ('classe', 'laboratoire', 'informatique', 'polyvalente', 'autre')),
  actif boolean not null default true,
  constraint salle_nom_unique unique (etablissement_id, nom)
);
