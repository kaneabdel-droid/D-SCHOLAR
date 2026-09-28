-- Schéma initial D-Scholar : un seul niveau de tenancy (etablissements), chaque
-- table métier porte etablissement_id. gen_random_uuid() est fourni nativement
-- par Supabase (pgcrypto activé par défaut).

-- Palier d'abonnement (cf. lib/abonnements/paliers.ts, seule source de vérité
-- côté application) : il détermine les cycles que l'établissement peut ouvrir.
--   elementaire → prescolaire + elementaire
--   secondaire  → moyen + secondaire
--   complet     → tous les cycles
create table public.etablissements (
  id uuid default gen_random_uuid() primary key,
  nom varchar(255) not null,
  sigle varchar(30),
  adresse text,
  ville varchar(100),
  pays varchar(2) not null default 'SN',
  telephone varchar(30),
  email varchar(255),
  devise varchar(10) not null default 'XOF',
  logo_url text,
  statut varchar(20) not null default 'actif' check (statut in ('actif', 'suspendu')),
  palier varchar(20) not null default 'elementaire' check (palier in ('elementaire', 'secondaire', 'complet')),
  abonnement_expire_le timestamptz,
  -- Portail élève (lot 9 bis) : un compte élève n'est créé qu'à partir de ce
  -- niveau (code de niveaux.code) — la 6e par défaut, modifiable par la direction.
  niveau_min_compte_eleve varchar(10) not null default '6E',
  created_at timestamptz not null default now()
);

-- Personnel de l'établissement, lié à auth.users. Les parents et les élèves
-- (portail, lot 9 bis) auront leur propre table : ils ne doivent jamais passer
-- par les policies du personnel.
create table public.utilisateurs (
  id uuid references auth.users not null primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  role varchar(20) not null check (role in ('direction', 'censeur', 'surveillant', 'secretariat', 'intendant', 'enseignant')),
  nom varchar(100),
  prenom varchar(100),
  -- Copie de l'email de connexion (auth.users) pour l'afficher sans appel admin.
  email varchar(255),
  telephone varchar(30),
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_utilisateurs_etablissement on public.utilisateurs(etablissement_id);
