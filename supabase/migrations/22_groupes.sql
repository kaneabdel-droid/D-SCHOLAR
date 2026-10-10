-- ═════════════════════════════════════════════════════════════════════════════
-- 10 · Groupes scolaires (plusieurs établissements sur plusieurs sites)
-- Le propriétaire / directeur général (DG) consulte en lecture seule tous les
-- établissements de son groupe : synthèse, comparatifs, rapport financier.
-- Chaque établissement garde son propre abonnement ; la vue groupe est incluse.
-- À exécuter après 09_billets_cartes.sql (puis relancer 07_demo.sql).
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.groupes (
  id uuid default gen_random_uuid() primary key,
  nom varchar(200) not null,
  est_demo boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.etablissements add column if not exists groupe_id uuid references public.groupes(id) on delete set null;
create index if not exists idx_etablissements_groupe on public.etablissements(groupe_id);

-- Membres de la direction du groupe (un compte appartient à un seul groupe ;
-- compte dédié, distinct des comptes du personnel des sites).
create table if not exists public.membres_groupe (
  user_id uuid references auth.users(id) on delete cascade primary key,
  groupe_id uuid references public.groupes(id) on delete cascade not null,
  role varchar(20) not null default 'dg' check (role in ('proprietaire', 'dg')),
  prenom varchar(100),
  nom varchar(100),
  email varchar(255),
  telephone varchar(30),
  actif boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_membres_groupe on public.membres_groupe(groupe_id);

-- Un compte DG est dédié : s'il était aussi membre du personnel d'un site, les
-- écrans de ce site (filtrés par le RLS, pas par le code) mélangeraient les
-- données de tous les sites du groupe. Un compte du personnel n'a donc jamais
-- de groupe, même s'il figure dans membres_groupe.
create or replace function public.mon_groupe_id() returns uuid
language sql security definer stable set search_path = public as $$
  select m.groupe_id from public.membres_groupe m
  where m.user_id = auth.uid() and m.actif
    and not exists (select 1 from public.utilisateurs u where u.id = m.user_id)
$$;

create or replace function public.groupe_etablissements() returns setof uuid
language sql security definer stable set search_path = public as $$
  select e.id from public.etablissements e
  where e.groupe_id is not null and e.groupe_id = public.mon_groupe_id()
$$;

-- Accès (abonnement) de chaque site du groupe, pour le tableau de bord du DG.
create or replace function public.acces_sites_groupe()
returns table (etablissement_id uuid, acces text)
language sql security definer stable set search_path = public as $$
  select id, public.acces_etablissement(id) from public.etablissements where id in (select public.groupe_etablissements())
$$;
grant execute on function public.acces_sites_groupe() to authenticated;

alter table public.groupes enable row level security;
alter table public.membres_groupe enable row level security;
drop policy if exists select_groupes on public.groupes;
drop policy if exists select_membres_groupe on public.membres_groupe;
create policy select_groupes on public.groupes for select using (id = public.mon_groupe_id());
create policy select_membres_groupe on public.membres_groupe for select
  using (user_id = auth.uid() or groupe_id = public.mon_groupe_id());
-- Le groupe se renomme par le DG ; création et rattachements : console /admin
-- et actions serveur (clé de service) après vérification du rôle.
drop policy if exists update_groupes on public.groupes;
create policy update_groupes on public.groupes for update using (id = public.mon_groupe_id()) with check (id = public.mon_groupe_id());

-- Lecture seule du DG sur les établissements du groupe et toutes leurs données
-- (tables portant etablissement_id), en plus des policies existantes.
drop policy if exists groupe_etablissements on public.etablissements;
create policy groupe_etablissements on public.etablissements for select using (id in (select public.groupe_etablissements()));

do $$
declare
  t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'etablissement_id'
      and c.table_name not in ('compteurs', 'codes_activation', 'comptes_famille')
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', 'groupe_' || t, t);
    execute format('create policy %I on public.%I for select using (etablissement_id in (select public.groupe_etablissements()))', 'groupe_' || t, t);
  end loop;
end $$;

-- Tables sans etablissement_id mais lues par les écrans (via leur parent).
drop policy if exists groupe_liens_famille on public.liens_famille;
create policy groupe_liens_famille on public.liens_famille for select
  using (eleve_id in (select id from public.eleves where etablissement_id in (select public.groupe_etablissements())));
