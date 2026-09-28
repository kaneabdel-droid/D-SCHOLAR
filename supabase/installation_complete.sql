-- D-Scholar : installation complète (migrations 00 à 07), à exécuter en une fois
-- dans l'éditeur SQL de Supabase, sur un projet vide.

-- ============================================================
-- 00_schema.sql
-- ============================================================

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

-- ============================================================
-- 01_referentiel.sql
-- ============================================================

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

-- ============================================================
-- 02_rls_functions.sql
-- ============================================================

-- Fonctions SECURITY DEFINER réutilisées par les policies (03_rls_policies.sql).
-- Les restrictions de rôle sont imposées en base, pas seulement par la nav
-- (défense en profondeur, même principe que D-QUINCA).

create or replace function public.current_etablissement_id() returns uuid
language sql security definer stable set search_path = public as $$
  select etablissement_id from public.utilisateurs where id = auth.uid() and actif
$$;

create or replace function public.current_role() returns text
language sql security definer stable set search_path = public as $$
  select role from public.utilisateurs where id = auth.uid() and actif
$$;

-- Paramétrage pédagogique (années, niveaux, matières, coefficients, salles) :
-- direction et censeur (directeur des études).
create or replace function public.can_manage_parametres() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce(public.current_role() in ('direction', 'censeur'), false)
$$;

-- Cycles ouverts par le palier d'abonnement — miroir SQL de
-- lib/abonnements/paliers.ts (cyclesAutorises), à garder synchronisé.
create or replace function public.cycles_du_palier(p_palier text) returns text[]
language sql immutable as $$
  select case p_palier
    when 'elementaire' then array['prescolaire', 'elementaire']
    when 'secondaire' then array['moyen', 'secondaire']
    when 'complet' then array['prescolaire', 'elementaire', 'moyen', 'secondaire']
    else array[]::text[]
  end
$$;

create or replace function public.cycle_autorise(p_cycle text) returns boolean
language sql security definer stable set search_path = public as $$
  select p_cycle = any(public.cycles_du_palier(e.palier))
  from public.etablissements e
  where e.id = public.current_etablissement_id()
$$;

-- ============================================================
-- 03_rls_policies.sql
-- ============================================================

-- Policies RLS du lot 1.
--
-- etablissements / utilisateurs : lecture seule pour `authenticated`. Aucune
-- policy d'écriture : la création d'établissements et de comptes passe par le
-- client service-role (console /admin, et Paramètres → Utilisateurs pour la
-- direction, rôle vérifié côté serveur). Les infos d'établissement modifiables
-- par la direction passent par la RPC modifier_infos_etablissement() (04), qui
-- ne touche jamais palier / statut / abonnement.

alter table public.etablissements enable row level security;
alter table public.utilisateurs enable row level security;

create policy "select_etablissements" on public.etablissements for select
  using (id = public.current_etablissement_id());

-- Tout le personnel voit ses collègues (listes d'enseignants, affectations...).
create policy "select_utilisateurs" on public.utilisateurs for select
  using (id = auth.uid() or etablissement_id = public.current_etablissement_id());

-- Référentiel : lecture par tout le personnel de l'établissement, écriture par
-- direction / censeur. Même gabarit pour chaque table.
do $$
declare
  t text;
  tables text[] := array[
    'annees_scolaires', 'periodes', 'series', 'options', 'matieres', 'coefficients', 'salles'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select using (etablissement_id = public.current_etablissement_id())',
      'select_' || t, t
    );
    execute format(
      'create policy %I on public.%I for insert with check (etablissement_id = public.current_etablissement_id() and public.can_manage_parametres())',
      'insert_' || t, t
    );
    execute format(
      'create policy %I on public.%I for update using (etablissement_id = public.current_etablissement_id() and public.can_manage_parametres()) with check (etablissement_id = public.current_etablissement_id() and public.can_manage_parametres())',
      'update_' || t, t
    );
    execute format(
      'create policy %I on public.%I for delete using (etablissement_id = public.current_etablissement_id() and public.can_manage_parametres())',
      'delete_' || t, t
    );
  end loop;
end $$;

-- Niveaux : même gabarit, plus la restriction par palier sur l'écriture — un
-- établissement au palier Élémentaire ne peut pas ouvrir un niveau du secondaire.
alter table public.niveaux enable row level security;

create policy "select_niveaux" on public.niveaux for select
  using (etablissement_id = public.current_etablissement_id());
create policy "insert_niveaux" on public.niveaux for insert
  with check (etablissement_id = public.current_etablissement_id() and public.can_manage_parametres() and public.cycle_autorise(cycle));
create policy "update_niveaux" on public.niveaux for update
  using (etablissement_id = public.current_etablissement_id() and public.can_manage_parametres())
  with check (etablissement_id = public.current_etablissement_id() and public.can_manage_parametres() and public.cycle_autorise(cycle));
create policy "delete_niveaux" on public.niveaux for delete
  using (etablissement_id = public.current_etablissement_id() and public.can_manage_parametres());

-- ============================================================
-- 04_rpc_parametrage.sql
-- ============================================================

-- RPC du paramétrage (lot 1).

-- Infos d'établissement modifiables par la direction. Passe par une RPC plutôt
-- qu'une policy update sur etablissements : une policy ne peut pas restreindre
-- les colonnes, et palier / statut / abonnement_expire_le ne doivent être
-- modifiables que par la plateforme (service role).
create or replace function public.modifier_infos_etablissement(
  p_nom text,
  p_sigle text,
  p_adresse text,
  p_ville text,
  p_telephone text,
  p_email text,
  p_niveau_min_compte_eleve text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() is distinct from 'direction' then
    raise exception 'Réservé à la direction';
  end if;
  if coalesce(trim(p_nom), '') = '' then
    raise exception 'Le nom est requis';
  end if;

  update public.etablissements set
    nom = trim(p_nom),
    sigle = nullif(trim(p_sigle), ''),
    adresse = nullif(trim(p_adresse), ''),
    ville = nullif(trim(p_ville), ''),
    telephone = nullif(trim(p_telephone), ''),
    email = nullif(trim(p_email), ''),
    niveau_min_compte_eleve = coalesce(nullif(trim(p_niveau_min_compte_eleve), ''), niveau_min_compte_eleve)
  where id = public.current_etablissement_id();
end;
$$;

-- Crée une année scolaire et ses périodes (3 trimestres ou 2 semestres) en une
-- transaction. La première année créée devient automatiquement l'année active.
create or replace function public.creer_annee_scolaire(
  p_libelle text,
  p_date_debut date,
  p_date_fin date,
  p_decoupage text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_etab uuid := public.current_etablissement_id();
  v_annee uuid;
  v_nb smallint;
  v_duree integer;
  v_debut date;
  v_fin date;
  v_premiere boolean;
begin
  if not public.can_manage_parametres() then
    raise exception 'Réservé à la direction et au censeur';
  end if;
  if p_decoupage not in ('trimestre', 'semestre') then
    raise exception 'Découpage invalide';
  end if;

  select not exists (select 1 from public.annees_scolaires where etablissement_id = v_etab) into v_premiere;

  insert into public.annees_scolaires (etablissement_id, libelle, date_debut, date_fin, decoupage, active)
  values (v_etab, trim(p_libelle), p_date_debut, p_date_fin, p_decoupage, v_premiere)
  returning id into v_annee;

  -- Découpage indicatif en parts égales : les dates restent modifiables ensuite.
  v_nb := case p_decoupage when 'trimestre' then 3 else 2 end;
  v_duree := (p_date_fin - p_date_debut) / v_nb;
  for i in 1..v_nb loop
    v_debut := p_date_debut + (i - 1) * v_duree;
    v_fin := case when i = v_nb then p_date_fin else p_date_debut + i * v_duree - 1 end;
    insert into public.periodes (etablissement_id, annee_id, rang, libelle, date_debut, date_fin)
    values (
      v_etab, v_annee, i,
      case p_decoupage when 'trimestre' then 'Trimestre ' || i else 'Semestre ' || i end,
      v_debut, v_fin
    );
  end loop;

  return v_annee;
end;
$$;

-- Bascule l'année active (désactive l'ancienne dans la même transaction, pour
-- respecter l'index unique partiel uq_annee_active_par_etablissement).
create or replace function public.activer_annee_scolaire(p_annee_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_etab uuid := public.current_etablissement_id();
begin
  if not public.can_manage_parametres() then
    raise exception 'Réservé à la direction et au censeur';
  end if;
  if not exists (select 1 from public.annees_scolaires where id = p_annee_id and etablissement_id = v_etab) then
    raise exception 'Année introuvable';
  end if;

  update public.annees_scolaires set active = false where etablissement_id = v_etab and active;
  update public.annees_scolaires set active = true where id = p_annee_id;
end;
$$;

-- Référentiel sénégalais par défaut, limité aux cycles du palier. Appelée par
-- la console admin (service role) juste après la création de l'établissement ;
-- idempotente (on conflict do nothing), donc rejouable après un changement de
-- palier pour ajouter les niveaux nouvellement ouverts. Les libellés sont des
-- données de l'établissement, modifiables ensuite dans Paramètres.
create or replace function public.initialiser_referentiel(p_etablissement_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_cycles text[];
begin
  select public.cycles_du_palier(palier) into v_cycles from public.etablissements where id = p_etablissement_id;
  if v_cycles is null then
    raise exception 'Établissement introuvable';
  end if;

  insert into public.niveaux (etablissement_id, cycle, code, nom, ordre, a_series)
  select p_etablissement_id, n.cycle, n.code, n.nom, n.ordre, n.a_series
  from (values
    ('prescolaire', 'PS', 'Petite section', 1, false),
    ('prescolaire', 'MS', 'Moyenne section', 2, false),
    ('prescolaire', 'GS', 'Grande section', 3, false),
    ('elementaire', 'CI', 'CI', 4, false),
    ('elementaire', 'CP', 'CP', 5, false),
    ('elementaire', 'CE1', 'CE1', 6, false),
    ('elementaire', 'CE2', 'CE2', 7, false),
    ('elementaire', 'CM1', 'CM1', 8, false),
    ('elementaire', 'CM2', 'CM2', 9, false),
    ('moyen', '6E', '6e', 10, false),
    ('moyen', '5E', '5e', 11, false),
    ('moyen', '4E', '4e', 12, false),
    ('moyen', '3E', '3e', 13, false),
    ('secondaire', '2NDE', 'Seconde', 14, true),
    ('secondaire', '1ERE', 'Première', 15, true),
    ('secondaire', 'TLE', 'Terminale', 16, true)
  ) as n(cycle, code, nom, ordre, a_series)
  where n.cycle = any(v_cycles)
  on conflict (etablissement_id, code) do nothing;

  if 'secondaire' = any(v_cycles) then
    insert into public.series (etablissement_id, code, nom)
    select p_etablissement_id, s.code, s.nom
    from (values
      ('L1', 'Lettres – langues'),
      ('L2', 'Lettres – sciences humaines'),
      ('S1', 'Mathématiques – sciences physiques'),
      ('S2', 'Sciences expérimentales'),
      ('S3', 'Sciences et techniques'),
      ('G', 'Sciences et techniques économiques et de gestion')
    ) as s(code, nom)
    on conflict (etablissement_id, code) do nothing;
  end if;

  -- Matières communes, puis celles propres au primaire ou au secondaire.
  insert into public.matieres (etablissement_id, code, nom, couleur)
  select p_etablissement_id, m.code, m.nom, m.couleur
  from (values
    ('FR', 'Français', '#2563EB', true, true),
    ('MATH', 'Mathématiques', '#DC2626', true, true),
    ('ANG', 'Anglais', '#7C3AED', true, true),
    ('AR', 'Arabe', '#059669', true, true),
    ('EPS', 'Éducation physique et sportive', '#EA580C', true, true),
    ('EC', 'Éducation civique', '#0891B2', true, true),
    ('ESVS', 'Éducation à la science et à la vie sociale', '#65A30D', true, false),
    ('ART', 'Éducation artistique', '#DB2777', true, false),
    ('HG', 'Histoire-Géographie', '#B45309', false, true),
    ('SVT', 'Sciences de la vie et de la terre', '#16A34A', false, true),
    ('PC', 'Sciences physiques', '#4F46E5', false, true),
    ('ESP', 'Espagnol', '#CA8A04', false, true),
    ('PHILO', 'Philosophie', '#475569', false, true),
    ('INFO', 'Informatique', '#0D9488', false, true)
  ) as m(code, nom, couleur, primaire, secondaire)
  where (m.primaire and v_cycles && array['prescolaire', 'elementaire'])
     or (m.secondaire and v_cycles && array['moyen', 'secondaire'])
  on conflict (etablissement_id, code) do nothing;
end;
$$;

-- Réservée au service role (console admin) : un utilisateur connecté ne doit
-- pas pouvoir initialiser le référentiel d'un autre établissement.
revoke execute on function public.initialiser_referentiel(uuid) from public, anon, authenticated;

-- Remplace en une transaction la grille de coefficients d'un (niveau, série).
-- Pas d'upsert PostgREST possible ici : l'unicité repose sur un index
-- d'expression (coalesce(serie_id, ...)), que on_conflict ne sait pas cibler.
-- p_lignes : [{ "matiere_id": uuid, "coefficient": number, "volume_horaire": number|null }]
create or replace function public.enregistrer_coefficients(
  p_niveau_id uuid,
  p_serie_id uuid,
  p_lignes jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_etab uuid := public.current_etablissement_id();
begin
  if not public.can_manage_parametres() then
    raise exception 'Réservé à la direction et au censeur';
  end if;
  if not exists (select 1 from public.niveaux where id = p_niveau_id and etablissement_id = v_etab) then
    raise exception 'Niveau introuvable';
  end if;
  if p_serie_id is not null and not exists (select 1 from public.series where id = p_serie_id and etablissement_id = v_etab) then
    raise exception 'Série introuvable';
  end if;

  delete from public.coefficients
  where niveau_id = p_niveau_id and serie_id is not distinct from p_serie_id;

  insert into public.coefficients (etablissement_id, niveau_id, serie_id, matiere_id, coefficient, volume_horaire)
  select v_etab, p_niveau_id, p_serie_id, (l->>'matiere_id')::uuid, (l->>'coefficient')::numeric, nullif(l->>'volume_horaire', '')::numeric
  from jsonb_array_elements(p_lignes) l
  join public.matieres m on m.id = (l->>'matiere_id')::uuid and m.etablissement_id = v_etab
  where (l->>'coefficient')::numeric > 0;
end;
$$;

-- ============================================================
-- 05_abonnements.sql
-- ============================================================

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

-- ============================================================
-- 06_pedagogie.sql
-- ============================================================

-- Modèle pédagogique (socle des lots 3 à 7) : élèves, enseignants, classes,
-- inscriptions, enseignements, emploi du temps, évaluations, notes, assiduité,
-- décisions de fin d'année, examens officiels, mouvements.
--
-- Règles propres à chaque établissement (demande explicite) :
--   • types_evaluation : nature, nombre attendu par période et poids de chaque
--     type (devoirs, tests, compositions...) ;
--   • appreciations : barème des mentions (Félicitations, Tableau d'honneur,
--     Encouragements, Avertissement...) ;
--   • moyenne_passage / moyenne_repechage : seuils des décisions de fin d'année.

alter table public.etablissements
  add column moyenne_passage numeric(4, 2) not null default 10,
  add column moyenne_repechage numeric(4, 2) not null default 9,
  add column est_demo boolean not null default false,
  add constraint seuils_passage_coherents check (moyenne_repechage <= moyenne_passage);

-- ─── Règles d'évaluation de l'établissement ──────────────────────────────────

-- Moyenne d'une matière sur une période = Σ(moyenne du type × poids) / Σ(poids)
-- sur les types ayant au moins une note (cf. moyennes_matieres()).
create table public.types_evaluation (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  code varchar(20) not null,
  libelle varchar(60) not null,
  poids numeric(4, 2) not null default 1 check (poids > 0),
  -- Nombre d'évaluations de ce type attendues par matière et par période.
  nombre_par_periode smallint not null default 1 check (nombre_par_periode between 0 and 20),
  ordre smallint not null default 1,
  actif boolean not null default true,
  constraint type_evaluation_code_unique unique (etablissement_id, code)
);

-- Barème des appréciations : la mention retenue est celle dont moyenne_min est
-- la plus haute sans dépasser la moyenne de l'élève.
create table public.appreciations (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  libelle varchar(60) not null,
  moyenne_min numeric(4, 2) not null check (moyenne_min between 0 and 20),
  categorie varchar(20) not null default 'neutre' check (categorie in ('distinction', 'neutre', 'avertissement')),
  actif boolean not null default true,
  constraint appreciation_seuil_unique unique (etablissement_id, moyenne_min)
);

-- ─── Personnes ───────────────────────────────────────────────────────────────

create table public.eleves (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  matricule varchar(30) not null,
  prenom varchar(100) not null,
  nom varchar(100) not null,
  sexe char(1) not null check (sexe in ('M', 'F')),
  date_naissance date,
  lieu_naissance varchar(100),
  adresse text,
  tuteur_nom varchar(150),
  tuteur_telephone varchar(30),
  date_entree date,
  statut varchar(20) not null default 'actif' check (statut in ('actif', 'sorti')),
  created_at timestamptz not null default now(),
  constraint eleve_matricule_unique unique (etablissement_id, matricule)
);

create index idx_eleves_etablissement on public.eleves(etablissement_id);

-- Un enseignant peut avoir (ou non) un compte utilisateur ; il peut dispenser
-- plusieurs matières dans plusieurs classes (via enseignements).
create table public.enseignants (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  utilisateur_id uuid references public.utilisateurs(id) on delete set null,
  civilite varchar(10),
  prenom varchar(100) not null,
  nom varchar(100) not null,
  telephone varchar(30),
  email varchar(255),
  adresse text,
  statut varchar(20) not null default 'titulaire' check (statut in ('titulaire', 'vacataire')),
  actif boolean not null default true
);

create index idx_enseignants_etablissement on public.enseignants(etablissement_id);

-- ─── Classes et inscriptions ─────────────────────────────────────────────────

create table public.classes (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  annee_id uuid references public.annees_scolaires(id) on delete cascade not null,
  niveau_id uuid references public.niveaux(id) not null,
  serie_id uuid references public.series(id),
  nom varchar(30) not null,
  capacite integer check (capacite is null or capacite > 0),
  salle_id uuid references public.salles(id) on delete set null,
  professeur_principal_id uuid references public.enseignants(id) on delete set null,
  constraint classe_nom_unique unique (annee_id, nom)
);

create index idx_classes_annee on public.classes(annee_id);

-- Une inscription par élève et par année : c'est le fil du cursus.
create table public.inscriptions (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  eleve_id uuid references public.eleves(id) on delete cascade not null,
  annee_id uuid references public.annees_scolaires(id) on delete cascade not null,
  classe_id uuid references public.classes(id) not null,
  option_id uuid references public.options(id),
  statut varchar(20) not null default 'nouveau' check (statut in ('nouveau', 'passant', 'redoublant', 'transfere')),
  date_inscription date not null default current_date,
  constraint inscription_unique unique (eleve_id, annee_id)
);

create index idx_inscriptions_classe on public.inscriptions(classe_id);

-- Entrées et sorties hors du passage normal d'une année à l'autre.
create table public.mouvements (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  eleve_id uuid references public.eleves(id) on delete cascade not null,
  date_mouvement date not null,
  type varchar(30) not null check (type in ('entree', 'transfert_entrant', 'transfert_sortant', 'abandon', 'exclusion', 'fin_de_cycle')),
  motif text
);

create index idx_mouvements_eleve on public.mouvements(eleve_id);

create table public.examens_officiels (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  eleve_id uuid references public.eleves(id) on delete cascade not null,
  annee_id uuid references public.annees_scolaires(id) on delete cascade not null,
  examen varchar(10) not null check (examen in ('CFEE', 'BFEM', 'BAC')),
  session varchar(30),
  resultat varchar(20) not null check (resultat in ('admis', 'ajourne')),
  mention varchar(30),
  constraint examen_unique unique (eleve_id, annee_id, examen)
);

-- ─── Enseignement et emploi du temps ─────────────────────────────────────────

create table public.enseignements (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  classe_id uuid references public.classes(id) on delete cascade not null,
  matiere_id uuid references public.matieres(id) not null,
  enseignant_id uuid references public.enseignants(id) on delete set null,
  constraint enseignement_unique unique (classe_id, matiere_id)
);

create index idx_enseignements_enseignant on public.enseignements(enseignant_id);

-- jour : 1 = lundi … 6 = samedi.
create table public.creneaux (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  enseignement_id uuid references public.enseignements(id) on delete cascade not null,
  jour smallint not null check (jour between 1 and 6),
  heure_debut time not null,
  heure_fin time not null,
  salle_id uuid references public.salles(id) on delete set null,
  constraint creneau_horaire_coherent check (heure_fin > heure_debut)
);

create index idx_creneaux_enseignement on public.creneaux(enseignement_id);

-- Interdit le double emploi : un même enseignant, une même classe ou une même
-- salle ne peuvent pas avoir deux créneaux qui se chevauchent.
create or replace function public.verifier_conflit_creneau() returns trigger
language plpgsql set search_path = public as $$
declare
  v_classe uuid;
  v_enseignant uuid;
begin
  select classe_id, enseignant_id into v_classe, v_enseignant from public.enseignements where id = new.enseignement_id;

  if exists (
    select 1
    from public.creneaux c
    join public.enseignements e on e.id = c.enseignement_id
    where c.id <> new.id
      and c.jour = new.jour
      and c.heure_debut < new.heure_fin
      and new.heure_debut < c.heure_fin
      and (
        e.classe_id = v_classe
        or (v_enseignant is not null and e.enseignant_id = v_enseignant)
        or (new.salle_id is not null and c.salle_id = new.salle_id)
      )
  ) then
    raise exception 'Conflit d''emploi du temps : classe, enseignant ou salle déjà occupé sur ce créneau'
      using errcode = '23P01';
  end if;
  return new;
end;
$$;

create trigger trg_creneaux_conflit
  before insert or update on public.creneaux
  for each row execute function public.verifier_conflit_creneau();

-- ─── Évaluations, notes, assiduité ───────────────────────────────────────────

create table public.evaluations (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  enseignement_id uuid references public.enseignements(id) on delete cascade not null,
  periode_id uuid references public.periodes(id) on delete cascade not null,
  type_id uuid references public.types_evaluation(id) not null,
  libelle varchar(80),
  date_evaluation date not null,
  bareme numeric(5, 2) not null default 20 check (bareme > 0)
);

create index idx_evaluations_enseignement on public.evaluations(enseignement_id, periode_id);

-- valeur sur le barème de l'évaluation ; absent = pas de note (exclue de la moyenne).
create table public.notes (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  evaluation_id uuid references public.evaluations(id) on delete cascade not null,
  eleve_id uuid references public.eleves(id) on delete cascade not null,
  valeur numeric(5, 2) check (valeur is null or valeur >= 0),
  absent boolean not null default false,
  absence_justifiee boolean not null default false,
  constraint note_unique unique (evaluation_id, eleve_id),
  constraint note_ou_absence check ((valeur is not null) <> absent)
);

create index idx_notes_eleve on public.notes(eleve_id);

create table public.absences (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  eleve_id uuid references public.eleves(id) on delete cascade not null,
  annee_id uuid references public.annees_scolaires(id) on delete cascade not null,
  enseignement_id uuid references public.enseignements(id) on delete set null,
  date_absence date not null,
  type varchar(10) not null check (type in ('absence', 'retard')),
  -- Durée en heures pour une absence, en minutes pour un retard.
  duree numeric(5, 2) not null check (duree > 0),
  justifiee boolean not null default false,
  motif text
);

create index idx_absences_eleve on public.absences(eleve_id, annee_id);

-- ─── Fin d'année ─────────────────────────────────────────────────────────────

-- decision : proposition calculée depuis les seuils de l'établissement ;
-- decision_finale : après repêchage et délibération du conseil de classe.
create table public.decisions (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  inscription_id uuid references public.inscriptions(id) on delete cascade not null unique,
  moyenne_annuelle numeric(5, 2),
  rang smallint,
  decision varchar(20) not null check (decision in ('admis', 'repechage', 'redouble', 'exclu')),
  note_repechage numeric(5, 2),
  decision_finale varchar(20) check (decision_finale in ('admis', 'redouble', 'exclu')),
  orientation varchar(100),
  commentaire text
);

-- ─── Calculs (security invoker : le RLS des tables s'applique) ───────────────

create or replace function public.moyennes_matieres(p_classe_id uuid, p_periode_id uuid)
returns table (eleve_id uuid, matiere_id uuid, moyenne numeric, coefficient numeric)
language sql stable set search_path = public as $$
  with classe as (
    select niveau_id, serie_id from public.classes where id = p_classe_id
  ),
  par_type as (
    select n.eleve_id, en.matiere_id, ev.type_id, avg(n.valeur * 20 / ev.bareme) as moy
    from public.evaluations ev
    join public.enseignements en on en.id = ev.enseignement_id
    join public.notes n on n.evaluation_id = ev.id
    where en.classe_id = p_classe_id and ev.periode_id = p_periode_id and n.valeur is not null
    group by n.eleve_id, en.matiere_id, ev.type_id
  ),
  par_matiere as (
    select pt.eleve_id, pt.matiere_id, sum(pt.moy * te.poids) / sum(te.poids) as moyenne
    from par_type pt
    join public.types_evaluation te on te.id = pt.type_id
    group by pt.eleve_id, pt.matiere_id
  )
  select
    m.eleve_id,
    m.matiere_id,
    round(m.moyenne, 2),
    coalesce(
      (select co.coefficient from public.coefficients co, classe c
       where co.niveau_id = c.niveau_id and co.matiere_id = m.matiere_id and co.serie_id = c.serie_id),
      (select co.coefficient from public.coefficients co, classe c
       where co.niveau_id = c.niveau_id and co.matiere_id = m.matiere_id and co.serie_id is null),
      1
    )
  from par_matiere m
$$;

create or replace function public.moyennes_periode(p_classe_id uuid, p_periode_id uuid)
returns table (eleve_id uuid, moyenne numeric, rang bigint)
language sql stable set search_path = public as $$
  select
    eleve_id,
    round(sum(moyenne * coefficient) / sum(coefficient), 2),
    rank() over (order by sum(moyenne * coefficient) / sum(coefficient) desc)
  from public.moyennes_matieres(p_classe_id, p_periode_id)
  group by eleve_id
$$;

-- Moyenne annuelle = moyenne des périodes où l'élève a été évalué (un élève
-- arrivé en cours d'année n'est pas pénalisé par la période manquée).
create or replace function public.moyennes_annuelles(p_classe_id uuid)
returns table (eleve_id uuid, moyenne numeric, rang bigint)
language sql stable set search_path = public as $$
  with periodes as (
    select p.id from public.periodes p join public.classes c on c.annee_id = p.annee_id where c.id = p_classe_id
  ),
  mp as (
    select m.eleve_id, m.moyenne from periodes p, lateral public.moyennes_periode(p_classe_id, p.id) m
  )
  select eleve_id, round(avg(moyenne), 2), rank() over (order by avg(moyenne) desc)
  from mp
  group by eleve_id
$$;

-- Propose les décisions de fin d'année d'une classe selon les seuils de
-- l'établissement (écrase les propositions, conserve repêchage et décision finale
-- déjà saisis). Interne : appelée par la démo (service role) et, au lot 7, par
-- une RPC réservée à la direction et au censeur.
create or replace function public._calculer_decisions(p_classe_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_passage numeric;
  v_repechage numeric;
begin
  select e.moyenne_passage, e.moyenne_repechage into v_passage, v_repechage
  from public.classes c join public.etablissements e on e.id = c.etablissement_id
  where c.id = p_classe_id;

  insert into public.decisions (etablissement_id, inscription_id, moyenne_annuelle, rang, decision)
  select i.etablissement_id, i.id, m.moyenne, m.rang,
    case when m.moyenne >= v_passage then 'admis' when m.moyenne >= v_repechage then 'repechage' else 'redouble' end
  from public.moyennes_annuelles(p_classe_id) m
  join public.inscriptions i on i.eleve_id = m.eleve_id and i.classe_id = p_classe_id
  join public.eleves el on el.id = i.eleve_id and el.statut = 'actif'
  on conflict (inscription_id) do update
    set moyenne_annuelle = excluded.moyenne_annuelle, rang = excluded.rang, decision = excluded.decision;
end;
$$;

revoke execute on function public._calculer_decisions(uuid) from public, anon, authenticated;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

-- Écriture : un rôle autorisé ET un établissement en accès complet (pas de
-- lecture seule pour retard de paiement, cf. 05_abonnements.sql).
create or replace function public.peut_ecrire(p_roles text[]) returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce(public.current_role() = any(p_roles), false) and public.ecriture_autorisee()
$$;

do $$
declare
  t text;
  -- table → rôles autorisés en écriture
  regles jsonb := '{
    "types_evaluation": ["direction", "censeur"],
    "appreciations": ["direction", "censeur"],
    "eleves": ["direction", "censeur", "secretariat"],
    "inscriptions": ["direction", "censeur", "secretariat"],
    "mouvements": ["direction", "censeur", "secretariat"],
    "examens_officiels": ["direction", "censeur", "secretariat"],
    "enseignants": ["direction", "censeur"],
    "classes": ["direction", "censeur"],
    "enseignements": ["direction", "censeur"],
    "creneaux": ["direction", "censeur"],
    "evaluations": ["direction", "censeur", "enseignant"],
    "notes": ["direction", "censeur", "enseignant"],
    "absences": ["direction", "censeur", "surveillant", "enseignant"],
    "decisions": ["direction", "censeur"]
  }';
  roles text;
begin
  for t in select jsonb_object_keys(regles) loop
    roles := (select string_agg(quote_literal(r), ',') from jsonb_array_elements_text(regles -> t) r);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (etablissement_id = public.current_etablissement_id())', 'select_' || t, t);
    execute format('create policy %I on public.%I for insert with check (etablissement_id = public.current_etablissement_id() and public.peut_ecrire(array[%s]))', 'insert_' || t, t, roles);
    execute format('create policy %I on public.%I for update using (etablissement_id = public.current_etablissement_id() and public.peut_ecrire(array[%s])) with check (etablissement_id = public.current_etablissement_id())', 'update_' || t, t, roles);
    execute format('create policy %I on public.%I for delete using (etablissement_id = public.current_etablissement_id() and public.peut_ecrire(array[%s]))', 'delete_' || t, t, roles);
  end loop;
end $$;

-- Seuils de passage : modifiables par la direction et le censeur.
create or replace function public.modifier_seuils_passage(p_passage numeric, p_repechage numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_parametres() then
    raise exception 'Réservé à la direction et au censeur';
  end if;
  if p_passage is null or p_repechage is null or p_passage < 0 or p_passage > 20 or p_repechage < 0 or p_repechage > p_passage then
    raise exception 'Seuils invalides';
  end if;
  update public.etablissements set moyenne_passage = p_passage, moyenne_repechage = p_repechage
  where id = public.current_etablissement_id();
end;
$$;

-- ============================================================
-- 07_demo.sql
-- ============================================================

-- Établissement de démonstration « Groupe scolaire Les Palmiers » (Dakar),
-- généré par la console admin (app/admin/(protected)/demo/actions.ts). Données
-- fictives mais réalistes et déterministes (même résultat à chaque génération) :
--
--   2025-2026 (année clôturée) : 5 classes (CM2, 6e, 3e, 2nde S, Tle S2),
--     3 trimestres de notes (2 devoirs, 1 test noté sur 10, 1 composition par
--     matière et par trimestre, selon les règles de l'établissement), absences
--     et retards, élève absentéiste, absence justifiée à une composition,
--     transfert entrant au 2e trimestre, départ au 3e trimestre, décisions de
--     fin d'année (passages, redoublements, repêchages réussi et échoué),
--     orientation après la 3e, CFEE / BFEM / BAC (1er et 2nd groupe).
--   2026-2027 (année active, rentrée) : 8 classes alimentées par les décisions
--     (passants, redoublants) et de nouveaux élèves, emplois du temps complets
--     sans conflit. M. Ibrahima Ndiaye enseigne les Mathématiques ET les
--     Sciences physiques dans plusieurs classes.

-- Pseudo-aléatoire déterministe dans [0, 1).
create or replace function public._demo_alea(p text) returns numeric
language sql immutable as $$
  select (abs(hashtext(p)::bigint) % 100000) / 100000.0
$$;

-- Ramène un samedi / dimanche au lundi suivant.
create or replace function public._demo_jour_ouvre(p date) returns date
language sql immutable as $$
  select case extract(isodow from p) when 6 then p + 2 when 7 then p + 1 else p end
$$;

create or replace function public._demo_creer_eleve(p_etab uuid, p_g integer, p_niveau text, p_decalage integer, p_date_entree date)
returns uuid
language plpgsql set search_path = public as $$
declare
  prenoms_m text[] := array['Mamadou', 'Moussa', 'Ibrahima', 'Cheikh', 'Abdoulaye', 'Ousmane', 'Modou', 'Pape', 'Serigne', 'Babacar',
                            'Aliou', 'Souleymane', 'Alioune', 'Lamine', 'Mouhamed', 'El Hadji', 'Samba', 'Demba', 'Omar', 'Idrissa'];
  prenoms_f text[] := array['Aïssatou', 'Fatou', 'Mariama', 'Awa', 'Khady', 'Ndeye', 'Aminata', 'Coumba', 'Astou', 'Bineta',
                            'Rokhaya', 'Seynabou', 'Adama', 'Dieynaba', 'Maïmouna', 'Oumou', 'Sokhna', 'Yacine', 'Fatimata', 'Ramatoulaye'];
  -- 31 noms (nombre premier) : combinaisons prénom × nom distinctes sur toute la démo.
  noms text[] := array['Diop', 'Ndiaye', 'Fall', 'Sarr', 'Sow', 'Ba', 'Diallo', 'Gueye', 'Mbaye', 'Faye', 'Seck', 'Cissé', 'Thiam',
                       'Kane', 'Diouf', 'Niang', 'Sy', 'Wade', 'Camara', 'Touré', 'Ndour', 'Sène', 'Diagne', 'Lô', 'Mbodj',
                       'Gaye', 'Kâ', 'Sall', 'Badji', 'Coly', 'Dieng'];
  villes text[] := array['Dakar', 'Pikine', 'Rufisque', 'Thiès', 'Guédiawaye', 'Saint-Louis', 'Kaolack', 'Mbour', 'Ziguinchor', 'Diourbel'];
  quartiers text[] := array['Sicap Liberté', 'Médina', 'Parcelles Assainies', 'Grand Yoff', 'HLM', 'Point E', 'Ouakam', 'Yoff',
                            'Mermoz', 'Fass', 'Colobane', 'Sacré-Cœur'];
  v_sexe char(1) := case when p_g % 2 = 0 then 'F' else 'M' end;
  v_nom text := noms[p_g % 31 + 1];
  v_prenom text := case when p_g % 2 = 0 then prenoms_f[(p_g / 2) % 20 + 1] else prenoms_m[(p_g / 2) % 20 + 1] end;
  v_annee integer := case p_niveau
    when 'CM2' then 2014 when '6E' then 2013 when '5E' then 2012 when '3E' then 2010
    when '2NDE' then 2009 when '1ERE' then 2008 else 2007 end + p_decalage;
  v_id uuid;
begin
  insert into public.eleves (etablissement_id, matricule, prenom, nom, sexe, date_naissance, lieu_naissance, adresse,
                             tuteur_nom, tuteur_telephone, date_entree)
  values (
    p_etab,
    'GSLP-' || lpad(p_g::text, 4, '0'),
    v_prenom, v_nom, v_sexe,
    make_date(v_annee, 1 + (p_g * 5) % 12, 1 + (p_g * 13) % 28),
    villes[(p_g * 3) % 10 + 1],
    quartiers[(p_g * 7) % 12 + 1] || ', Dakar',
    prenoms_m[(p_g * 7 + 5) % 20 + 1] || ' ' || v_nom,
    (array['77', '78', '76', '70'])[p_g % 4 + 1] || ' ' || lpad(((p_g * 7919) % 1000)::text, 3, '0') || ' '
      || lpad(((p_g * 3571) % 100)::text, 2, '0') || ' ' || lpad(((p_g * 1237) % 100)::text, 2, '0'),
    p_date_entree
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.creer_demo(p_etablissement_id uuid, p_utilisateur_enseignant uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  e uuid := p_etablissement_id;
  a1 uuid;
  a2 uuid;
  v_labo uuid;
  bases numeric[] := array[17.4, 15.2, 14.1, 12.9, 12.3, 11.5, 10.9, 10.4, 9.5, 9.4, 7.2, 5.4];
  g integer := 0;
  c record;
  r record;
  v_id uuid;
  v_eval uuid;
  v_cas text;
  v_statut text;
  v_cle text;
  v_n integer;
  v_date date;
  v_besoin integer;
  v_place integer;
  v_slot integer;
  v_jour smallint;
  v_debut time;
  v_salle uuid;
begin
  if not exists (select 1 from public.etablissements where id = e) then
    raise exception 'Établissement introuvable';
  end if;
  if exists (select 1 from public.annees_scolaires where etablissement_id = e) then
    raise exception 'La démo doit être générée sur un établissement vide';
  end if;

  update public.etablissements set est_demo = true, moyenne_passage = 10, moyenne_repechage = 9 where id = e;
  perform public.initialiser_referentiel(e);

  -- Séries de Seconde (S / L), en plus des séries de Première et Terminale.
  insert into public.series (etablissement_id, code, nom) values
    (e, 'S', 'Scientifique (Seconde)'),
    (e, 'L', 'Littéraire (Seconde)')
  on conflict do nothing;

  insert into public.salles (etablissement_id, nom, capacite, type)
  select e, 'Salle ' || i, 45, 'classe' from generate_series(1, 8) i
  on conflict do nothing;
  insert into public.salles (etablissement_id, nom, capacite, type) values
    (e, 'Laboratoire', 30, 'laboratoire'),
    (e, 'Salle informatique', 30, 'informatique')
  on conflict do nothing;
  select id into v_labo from public.salles where etablissement_id = e and nom = 'Laboratoire';

  -- Règles d'évaluation et barème d'appréciations choisis par l'établissement.
  insert into public.types_evaluation (etablissement_id, code, libelle, poids, nombre_par_periode, ordre) values
    (e, 'DEV', 'Devoir', 1, 2, 1),
    (e, 'TEST', 'Interrogation écrite (test)', 1, 1, 2),
    (e, 'COMPO', 'Composition', 2, 1, 3)
  on conflict do nothing;

  insert into public.appreciations (etablissement_id, libelle, moyenne_min, categorie) values
    (e, 'Félicitations du conseil', 16, 'distinction'),
    (e, 'Tableau d''honneur', 14, 'distinction'),
    (e, 'Encouragements', 12, 'distinction'),
    (e, 'Travail passable', 10, 'neutre'),
    (e, 'Travail insuffisant', 8, 'avertissement'),
    (e, 'Avertissement travail', 6, 'avertissement'),
    (e, 'Blâme', 0, 'avertissement')
  on conflict do nothing;

  -- ─── Années et trimestres ────────────────────────────────────────────────
  insert into public.annees_scolaires (etablissement_id, libelle, date_debut, date_fin, decoupage, active, cloturee)
  values (e, '2025-2026', '2025-10-06', '2026-07-10', 'trimestre', false, true)
  returning id into a1;
  insert into public.annees_scolaires (etablissement_id, libelle, date_debut, date_fin, decoupage, active, cloturee)
  values (e, '2026-2027', '2026-10-05', '2027-07-09', 'trimestre', true, false)
  returning id into a2;

  insert into public.periodes (etablissement_id, annee_id, rang, libelle, date_debut, date_fin, verrouillee) values
    (e, a1, 1, 'Trimestre 1', '2025-10-06', '2025-12-20', true),
    (e, a1, 2, 'Trimestre 2', '2026-01-05', '2026-03-28', true),
    (e, a1, 3, 'Trimestre 3', '2026-04-06', '2026-07-10', true),
    (e, a2, 1, 'Trimestre 1', '2026-10-05', '2026-12-19', false),
    (e, a2, 2, 'Trimestre 2', '2027-01-04', '2027-03-27', false),
    (e, a2, 3, 'Trimestre 3', '2027-04-05', '2027-07-09', false);

  -- ─── Coefficients et volumes horaires hebdomadaires ──────────────────────
  insert into public.coefficients (etablissement_id, niveau_id, serie_id, matiere_id, coefficient, volume_horaire)
  select e, n.id, s.id, m.id, v.coef, v.vol
  from (values
    ('CM2', null, 'FR', 3, 8), ('CM2', null, 'MATH', 3, 6), ('CM2', null, 'ESVS', 2, 4), ('CM2', null, 'EC', 1, 1),
    ('CM2', null, 'AR', 1, 2), ('CM2', null, 'ANG', 1, 2), ('CM2', null, 'EPS', 1, 2), ('CM2', null, 'ART', 1, 1),
    ('6E', null, 'FR', 4, 5), ('6E', null, 'MATH', 4, 5), ('6E', null, 'ANG', 2, 3), ('6E', null, 'HG', 2, 3),
    ('6E', null, 'SVT', 2, 2), ('6E', null, 'EC', 1, 1), ('6E', null, 'EPS', 1, 2), ('6E', null, 'AR', 1, 2),
    ('5E', null, 'FR', 4, 5), ('5E', null, 'MATH', 4, 5), ('5E', null, 'ANG', 2, 3), ('5E', null, 'HG', 2, 3),
    ('5E', null, 'SVT', 2, 2), ('5E', null, 'EC', 1, 1), ('5E', null, 'EPS', 1, 2), ('5E', null, 'AR', 1, 2),
    ('3E', null, 'FR', 3, 5), ('3E', null, 'MATH', 4, 5), ('3E', null, 'PC', 2, 3), ('3E', null, 'SVT', 2, 2),
    ('3E', null, 'ANG', 2, 3), ('3E', null, 'HG', 2, 3), ('3E', null, 'EC', 1, 1), ('3E', null, 'EPS', 1, 2),
    ('3E', null, 'ESP', 1, 2),
    ('2NDE', 'S', 'MATH', 5, 5), ('2NDE', 'S', 'PC', 5, 4), ('2NDE', 'S', 'SVT', 3, 3), ('2NDE', 'S', 'FR', 3, 4),
    ('2NDE', 'S', 'ANG', 2, 3), ('2NDE', 'S', 'HG', 2, 3), ('2NDE', 'S', 'EPS', 1, 2), ('2NDE', 'S', 'ESP', 1, 2),
    ('2NDE', 'L', 'FR', 5, 5), ('2NDE', 'L', 'HG', 4, 4), ('2NDE', 'L', 'ANG', 4, 4), ('2NDE', 'L', 'ESP', 3, 3),
    ('2NDE', 'L', 'MATH', 2, 3), ('2NDE', 'L', 'SVT', 1, 2), ('2NDE', 'L', 'EPS', 1, 2),
    ('1ERE', 'S2', 'MATH', 5, 5), ('1ERE', 'S2', 'PC', 5, 5), ('1ERE', 'S2', 'SVT', 5, 4), ('1ERE', 'S2', 'FR', 3, 4),
    ('1ERE', 'S2', 'ANG', 2, 3), ('1ERE', 'S2', 'HG', 2, 2), ('1ERE', 'S2', 'EPS', 1, 2),
    ('TLE', 'S2', 'MATH', 5, 5), ('TLE', 'S2', 'PC', 6, 6), ('TLE', 'S2', 'SVT', 6, 5), ('TLE', 'S2', 'PHILO', 2, 3),
    ('TLE', 'S2', 'ANG', 2, 3), ('TLE', 'S2', 'HG', 2, 2), ('TLE', 'S2', 'EPS', 1, 2)
  ) as v(niv, ser, mat, coef, vol)
  join public.niveaux n on n.etablissement_id = e and n.code = v.niv
  left join public.series s on s.etablissement_id = e and s.code = v.ser
  join public.matieres m on m.etablissement_id = e and m.code = v.mat
  on conflict do nothing;

  -- ─── Enseignants ─────────────────────────────────────────────────────────
  create temp table _ens (code text primary key, id uuid) on commit drop;
  for r in select * from (values
    ('NDIAYE', 'M.', 'Ibrahima', 'Ndiaye', '77 512 34 21', 'i.ndiaye@lespalmiers.sn', 'Sicap Liberté 4, Dakar', 'titulaire'),
    ('DIOP', 'M.', 'Pape', 'Diop', '77 640 18 55', 'p.diop@lespalmiers.sn', 'Grand Yoff, Dakar', 'titulaire'),
    ('DIALLO', 'Mme', 'Aïssatou', 'Diallo', '78 233 90 12', 'a.diallo@lespalmiers.sn', 'Mermoz, Dakar', 'titulaire'),
    ('SARR', 'M.', 'Moussa', 'Sarr', '76 118 47 30', 'm.sarr@lespalmiers.sn', 'Ouakam, Dakar', 'titulaire'),
    ('SOW', 'Mme', 'Fatou', 'Sow', '77 905 61 08', 'f.sow@lespalmiers.sn', 'Point E, Dakar', 'titulaire'),
    ('FALL', 'M.', 'Cheikh', 'Fall', '78 402 77 64', 'c.fall@lespalmiers.sn', 'Médina, Dakar', 'titulaire'),
    ('GUEYE', 'M.', 'Abdou', 'Gueye', '77 318 25 49', 'a.gueye@lespalmiers.sn', 'HLM Grand Médine, Dakar', 'vacataire'),
    ('BA', 'Mme', 'Mariama', 'Ba', '76 552 83 17', 'm.ba@lespalmiers.sn', 'Fass, Dakar', 'titulaire'),
    ('KANE', 'M.', 'Ousmane', 'Kane', '77 771 09 36', 'o.kane@lespalmiers.sn', 'Parcelles Assainies, Dakar', 'titulaire'),
    ('MBAYE', 'Mme', 'Khady', 'Mbaye', '70 214 58 90', 'k.mbaye@lespalmiers.sn', 'Yoff, Dakar', 'vacataire'),
    ('SECK', 'M.', 'Alioune', 'Seck', '77 683 42 75', 'a.seck@lespalmiers.sn', 'Colobane, Dakar', 'titulaire'),
    ('FAYE', 'Mme', 'Ndeye', 'Faye', '78 147 36 82', 'n.faye@lespalmiers.sn', 'Sacré-Cœur, Dakar', 'titulaire')
  ) as v(code, civ, prenom, nom, tel, mail, adr, statut) loop
    insert into public.enseignants (etablissement_id, civilite, prenom, nom, telephone, email, adresse, statut)
    values (e, r.civ, r.prenom, r.nom, r.tel, r.mail, r.adr, r.statut)
    returning id into v_id;
    insert into _ens values (r.code, v_id);
  end loop;

  if p_utilisateur_enseignant is not null then
    update public.enseignants set utilisateur_id = p_utilisateur_enseignant where id = (select id from _ens where code = 'NDIAYE');
  end if;

  -- ─── Classes des deux années ─────────────────────────────────────────────
  create temp table _cls (cle text, annee uuid, id uuid, niv text, ser text, ordre integer) on commit drop;
  for r in select * from (values
    (1, 'A1', 'CM2A', 'CM2', null, 'CM2 A', 'Salle 1', 'FAYE'),
    (2, 'A1', '6A', '6E', null, '6e A', 'Salle 2', 'DIALLO'),
    (3, 'A1', '3A', '3E', null, '3e A', 'Salle 3', 'NDIAYE'),
    (4, 'A1', '2S', '2NDE', 'S', '2nde S', 'Salle 4', 'SARR'),
    (5, 'A1', 'TS2', 'TLE', 'S2', 'Tle S2', 'Salle 5', 'GUEYE'),
    (1, 'A2', 'CM2A', 'CM2', null, 'CM2 A', 'Salle 1', 'FAYE'),
    (2, 'A2', '6A', '6E', null, '6e A', 'Salle 2', 'DIALLO'),
    (3, 'A2', '5A', '5E', null, '5e A', 'Salle 3', 'DIOP'),
    (4, 'A2', '3A', '3E', null, '3e A', 'Salle 4', 'NDIAYE'),
    (5, 'A2', '2S', '2NDE', 'S', '2nde S', 'Salle 5', 'SARR'),
    (6, 'A2', '2L', '2NDE', 'L', '2nde L', 'Salle 6', 'FALL'),
    (7, 'A2', '1S', '1ERE', 'S2', '1re S2', 'Salle 7', 'SOW'),
    (8, 'A2', 'TS2', 'TLE', 'S2', 'Tle S2', 'Salle 8', 'GUEYE')
  ) as v(ordre, an, cle, niv, ser, nom, salle, pp) loop
    insert into public.classes (etablissement_id, annee_id, niveau_id, serie_id, nom, capacite, salle_id, professeur_principal_id)
    values (
      e,
      case r.an when 'A1' then a1 else a2 end,
      (select id from public.niveaux where etablissement_id = e and code = r.niv),
      (select id from public.series where etablissement_id = e and code = r.ser),
      r.nom, 45,
      (select id from public.salles where etablissement_id = e and nom = r.salle),
      (select id from _ens where code = r.pp)
    )
    returning id into v_id;
    insert into _cls values (r.cle, case r.an when 'A1' then a1 else a2 end, v_id, r.niv, r.ser, r.ordre);
  end loop;

  -- Enseignements : une matière par coefficient du niveau (et de la série),
  -- affectée à son enseignant. M. Ndiaye cumule Maths et PC (3e, 2nde S, 1re).
  insert into public.enseignements (etablissement_id, classe_id, matiere_id, enseignant_id)
  select e, c2.id, co.matiere_id, (select id from _ens where code =
    case
      when c2.niv = 'CM2' then case when m.code = 'AR' then 'SECK' else 'FAYE' end
      when m.code = 'MATH' then case when c2.niv = '3E' or (c2.niv = '2NDE' and c2.ser = 'S') then 'NDIAYE' else 'DIOP' end
      when m.code = 'PC' then case when c2.niv = 'TLE' then 'GUEYE' else 'NDIAYE' end
      when m.code = 'FR' then case when c2.niv = '1ERE' then 'BA' else 'DIALLO' end
      when m.code = 'PHILO' then 'BA'
      when m.code = 'SVT' then 'SARR'
      when m.code = 'ANG' then 'SOW'
      when m.code in ('HG', 'EC') then 'FALL'
      when m.code = 'EPS' then 'KANE'
      when m.code = 'ESP' then 'MBAYE'
      when m.code = 'AR' then 'SECK'
    end)
  from _cls c2
  join public.niveaux n on n.etablissement_id = e and n.code = c2.niv
  left join public.series s on s.etablissement_id = e and s.code = c2.ser
  join public.coefficients co on co.niveau_id = n.id and co.serie_id is not distinct from s.id
  join public.matieres m on m.id = co.matiere_id;

  -- ─── Élèves 2025-2026 ────────────────────────────────────────────────────
  -- 12 élèves par classe, du très bon (Félicitations) au très faible (Blâme). Rangs
  -- 9 et 10 : moyennes proches de 9,5 → repêchage (le 1er réussit, le 2e non).
  create temp table _el (id uuid, cle text, base numeric, cas text) on commit drop;
  for c in select * from _cls where annee = a1 order by ordre loop
    for i in 1..12 loop
      g := g + 1;
      v_cas := case
        when i in (9, 10) then 'repechage'
        when i = 12 then 'absenteiste'
        when i = 6 and c.cle = '6A' then 'depart'
        when i = 6 then 'absent_compo'
        else null end;
      v_statut := case when i in (3, 7) then 'nouveau' when i = 11 then 'redoublant' else 'passant' end;
      v_id := public._demo_creer_eleve(e, g, c.niv, 0, case when v_statut = 'nouveau' then date '2025-10-06' else date '2022-10-03' end);
      insert into _el values (v_id, c.cle, bases[i], v_cas);
      insert into public.inscriptions (etablissement_id, eleve_id, annee_id, classe_id, statut, date_inscription)
      values (e, v_id, a1, c.id, v_statut, '2025-09-22');
      if v_statut = 'nouveau' then
        insert into public.mouvements (etablissement_id, eleve_id, date_mouvement, type, motif)
        values (e, v_id, '2025-10-06', 'entree', 'Première inscription dans l''établissement');
      end if;
    end loop;

    -- Transfert entrant au 2e trimestre (aucune note au 1er trimestre).
    if c.cle = '2S' then
      g := g + 1;
      v_id := public._demo_creer_eleve(e, g, c.niv, 0, '2026-01-05');
      insert into _el values (v_id, c.cle, 13.2, 'transfert');
      insert into public.inscriptions (etablissement_id, eleve_id, annee_id, classe_id, statut, date_inscription)
      values (e, v_id, a1, c.id, 'transfere', '2026-01-05');
      insert into public.mouvements (etablissement_id, eleve_id, date_mouvement, type, motif)
      values (e, v_id, '2026-01-05', 'transfert_entrant', 'Arrivée du lycée Malick Sy de Thiès (mutation du parent)');
    end if;
  end loop;

  -- ─── Évaluations et notes 2025-2026 ──────────────────────────────────────
  -- Note = niveau de l'élève + affinité avec la matière + aléa de l'épreuve,
  -- ramenée au barème (le test est noté sur 10), arrondie au quart de point.
  for r in
    select en.id as ens_id, en.matiere_id, cl.cle, p.id as per_id, p.rang, p.date_debut, p.date_fin,
           t.id as type_id, t.code as type_code, t.nombre_par_periode as nb
    from public.enseignements en
    join _cls cl on cl.id = en.classe_id and cl.annee = a1
    join public.periodes p on p.annee_id = a1
    cross join public.types_evaluation t
    where t.etablissement_id = e
  loop
    for k in 1..r.nb loop
      v_date := public._demo_jour_ouvre(case r.type_code
        when 'DEV' then r.date_debut + 21 * k
        when 'TEST' then r.date_debut + 35
        else r.date_fin - 10 end);
      insert into public.evaluations (etablissement_id, enseignement_id, periode_id, type_id, libelle, date_evaluation, bareme)
      values (
        e, r.ens_id, r.per_id, r.type_id,
        case r.type_code
          when 'DEV' then 'Devoir n°' || k
          when 'TEST' then 'Interrogation écrite'
          else 'Composition du trimestre ' || r.rang end,
        v_date,
        case r.type_code when 'TEST' then 10 else 20 end
      )
      returning id into v_eval;

      insert into public.notes (etablissement_id, evaluation_id, eleve_id, valeur)
      select e, v_eval, el.id,
        round(
          greatest(0, least(20,
            el.base
            + case when el.cas = 'repechage' then 0 else (public._demo_alea(el.id::text || r.matiere_id::text) - 0.5) * 3 end
            + (public._demo_alea(el.id::text || v_eval::text) - 0.5) * case when el.cas = 'repechage' then 1.5 else 5 end
          )) * (case r.type_code when 'TEST' then 10 else 20 end) / 20.0 * 4
        ) / 4
      from _el el
      where el.cle = r.cle
        -- coalesce : el.cas est NULL pour la plupart des élèves, et « not (NULL and …) »
        -- vaut NULL, ce qui exclurait ces élèves des 1er et 3e trimestres.
        and not (coalesce(el.cas, '') = 'transfert' and r.rang = 1)
        and not (coalesce(el.cas, '') = 'depart' and r.rang = 3);
    end loop;
  end loop;

  -- Absence justifiée (maladie) à la composition de Mathématiques du 2e trimestre.
  update public.notes n set valeur = null, absent = true, absence_justifiee = true
  from public.evaluations ev, public.enseignements en, public.matieres m, public.periodes p, public.types_evaluation t, _el el
  where n.evaluation_id = ev.id and ev.enseignement_id = en.id and en.matiere_id = m.id and m.code = 'MATH'
    and ev.periode_id = p.id and p.annee_id = a1 and p.rang = 2
    and ev.type_id = t.id and t.code = 'COMPO'
    and n.eleve_id = el.id and el.cas = 'absent_compo';

  -- Absence non justifiée au 1er devoir de Français du 3e trimestre (absentéiste).
  update public.notes n set valeur = null, absent = true, absence_justifiee = false
  from public.evaluations ev, public.enseignements en, public.matieres m, public.periodes p, public.types_evaluation t, _el el
  where n.evaluation_id = ev.id and ev.enseignement_id = en.id and en.matiere_id = m.id and m.code = 'FR'
    and ev.periode_id = p.id and p.annee_id = a1 and p.rang = 3
    and ev.type_id = t.id and t.code = 'DEV' and ev.libelle = 'Devoir n°1'
    and n.eleve_id = el.id and el.cas = 'absenteiste';

  -- ─── Assiduité 2025-2026 ─────────────────────────────────────────────────
  -- Quelques absences (le plus souvent justifiées) et retards pour la majorité.
  insert into public.absences (etablissement_id, eleve_id, annee_id, enseignement_id, date_absence, type, duree, justifiee, motif)
  select e, el.id, a1,
    (select en.id from public.enseignements en join _cls cl on cl.id = en.classe_id
     where cl.cle = el.cle and cl.annee = a1 order by en.id limit 1 offset (k % 5)),
    public._demo_jour_ouvre(date '2025-10-13' + floor(public._demo_alea(el.id::text || 'date' || k) * 250)::integer),
    case when k % 2 = 0 then 'retard' else 'absence' end,
    case when k % 2 = 0 then 10 + 5 * (k % 3) else 2 end,
    case when k % 2 = 0 then public._demo_alea(el.id::text || 'just' || k) > 0.7 else public._demo_alea(el.id::text || 'just' || k) > 0.25 end,
    case when k % 2 = 0 then 'Retard (transport)' when public._demo_alea(el.id::text || 'just' || k) > 0.25 then 'Maladie (certificat médical)' else null end
  from _el el, generate_series(1, 4) k
  where el.cas is null and public._demo_alea(el.id::text || 'n' || k) < 0.55;

  -- Élève absentéiste : 16 absences non justifiées aux 2e et 3e trimestres.
  insert into public.absences (etablissement_id, eleve_id, annee_id, enseignement_id, date_absence, type, duree, justifiee, motif)
  select e, el.id, a1,
    (select en.id from public.enseignements en join _cls cl on cl.id = en.classe_id
     where cl.cle = el.cle and cl.annee = a1 order by en.id limit 1 offset (k % 6)),
    public._demo_jour_ouvre(date '2026-01-12' + 9 * k),
    'absence', 2, false, null
  from _el el, generate_series(1, 16) k
  where el.cas = 'absenteiste';

  -- ─── Départ en cours d'année ─────────────────────────────────────────────
  update public.eleves set statut = 'sorti' where id in (select id from _el where cas = 'depart');
  insert into public.mouvements (etablissement_id, eleve_id, date_mouvement, type, motif)
  select e, id, '2026-04-13', 'transfert_sortant', 'Déménagement de la famille à Saint-Louis'
  from _el where cas = 'depart';

  -- ─── Décisions de fin d'année ────────────────────────────────────────────
  for c in select id from _cls where annee = a1 loop
    perform public._calculer_decisions(c.id);
  end loop;

  -- Repêchage : alternativement réussi (admis) et échoué (redoublement).
  v_n := 0;
  for r in
    select d.id from public.decisions d join public.inscriptions i on i.id = d.inscription_id
    where i.annee_id = a1 and d.decision = 'repechage'
    order by d.moyenne_annuelle desc, d.id
  loop
    v_n := v_n + 1;
    update public.decisions set
      note_repechage = case when v_n % 2 = 1 then 11.5 else 8.75 end,
      decision_finale = case when v_n % 2 = 1 then 'admis' else 'redouble' end,
      commentaire = case when v_n % 2 = 1 then 'Admis après repêchage' else 'Repêchage non obtenu : redoublement' end
    where id = r.id;
  end loop;

  update public.decisions d set
    decision_finale = d.decision,
    commentaire = case d.decision when 'admis' then 'Passage en classe supérieure' else 'Redoublement' end
  from public.inscriptions i
  where i.id = d.inscription_id and i.annee_id = a1 and d.decision_finale is null;

  -- Orientation.
  update public.decisions d set orientation = case cl.cle
      when 'CM2A' then '6e'
      when '6A' then '5e'
      when '3A' then case when d.moyenne_annuelle >= 12 then 'Seconde S' else 'Seconde L' end
      when '2S' then 'Première S2'
      else 'Enseignement supérieur' end
  from public.inscriptions i join _cls cl on cl.id = i.classe_id
  where i.id = d.inscription_id and i.annee_id = a1 and d.decision_finale = 'admis';

  -- ─── Examens officiels : CFEE (CM2), BFEM (3e), BAC (Tle) ────────────────
  insert into public.examens_officiels (etablissement_id, eleve_id, annee_id, examen, session, resultat, mention)
  select e, i.eleve_id, a1,
    case cl.cle when 'CM2A' then 'CFEE' when '3A' then 'BFEM' else 'BAC' end,
    case when cl.cle = 'TS2' then
      case when d.decision = 'repechage' then 'Session 2026 · 2nd groupe' else 'Session 2026 · 1er groupe' end
    else 'Session 2026' end,
    case when d.decision_finale = 'admis' then 'admis' else 'ajourne' end,
    case
      when d.decision_finale <> 'admis' then null
      when d.decision = 'repechage' then 'Passable'
      when d.moyenne_annuelle >= 16 then 'Très bien'
      when d.moyenne_annuelle >= 14 then 'Bien'
      when d.moyenne_annuelle >= 12 then 'Assez bien'
      else 'Passable' end
  from public.decisions d
  join public.inscriptions i on i.id = d.inscription_id
  join _cls cl on cl.id = i.classe_id
  where i.annee_id = a1 and cl.cle in ('CM2A', '3A', 'TS2');

  -- Bacheliers : fin de cycle, ils quittent l'établissement.
  insert into public.mouvements (etablissement_id, eleve_id, date_mouvement, type, motif)
  select e, i.eleve_id, '2026-07-24', 'fin_de_cycle', 'Baccalauréat obtenu'
  from public.decisions d join public.inscriptions i on i.id = d.inscription_id join _cls cl on cl.id = i.classe_id
  where i.annee_id = a1 and cl.cle = 'TS2' and d.decision_finale = 'admis';
  update public.eleves set statut = 'sorti'
  where id in (
    select i.eleve_id from public.decisions d join public.inscriptions i on i.id = d.inscription_id join _cls cl on cl.id = i.classe_id
    where i.annee_id = a1 and cl.cle = 'TS2' and d.decision_finale = 'admis'
  );

  -- ─── Rentrée 2026-2027 : passants et redoublants ─────────────────────────
  for r in
    select i.eleve_id, cl.cle, d.decision_finale, d.orientation
    from public.decisions d
    join public.inscriptions i on i.id = d.inscription_id
    join _cls cl on cl.id = i.classe_id
    where i.annee_id = a1
  loop
    if r.decision_finale = 'admis' then
      v_cle := case r.cle
        when 'CM2A' then '6A'
        when '6A' then '5A'
        when '3A' then case when r.orientation = 'Seconde S' then '2S' else '2L' end
        when '2S' then '1S'
        else null end;
      v_statut := 'passant';
    else
      v_cle := r.cle;
      v_statut := 'redoublant';
    end if;
    if v_cle is not null then
      insert into public.inscriptions (etablissement_id, eleve_id, annee_id, classe_id, statut, date_inscription)
      values (e, r.eleve_id, a2, (select id from _cls where cle = v_cle and annee = a2), v_statut, '2026-09-14');
    end if;
  end loop;

  -- Nouveaux élèves de la rentrée (dont un transfert entrant en 3e).
  for r in select * from (values
    ('CM2A', 'CM2', 12), ('6A', '6E', 3), ('5A', '5E', 2), ('3A', '3E', 9),
    ('2S', '2NDE', 2), ('2L', '2NDE', 2), ('1S', '1ERE', 4), ('TS2', 'TLE', 6)
  ) as v(cle, niv, nb) loop
    for i in 1..r.nb loop
      g := g + 1;
      v_id := public._demo_creer_eleve(e, g, r.niv, 1, '2026-10-05');
      v_statut := case when r.cle = '3A' and i = 1 then 'transfere' else 'nouveau' end;
      insert into public.inscriptions (etablissement_id, eleve_id, annee_id, classe_id, statut, date_inscription)
      values (e, v_id, a2, (select id from _cls where cle = r.cle and annee = a2), v_statut, '2026-09-21');
      insert into public.mouvements (etablissement_id, eleve_id, date_mouvement, type, motif)
      values (e, v_id, '2026-10-05',
        case when v_statut = 'transfere' then 'transfert_entrant' else 'entree' end,
        case when v_statut = 'transfere' then 'Venant du CEM de Pikine' else 'Première inscription dans l''établissement' end);
    end loop;
  end loop;

  -- ─── Emplois du temps 2026-2027 ──────────────────────────────────────────
  -- 17 créneaux de 2 h par semaine (lun.–ven. 8 h, 10 h, 15 h ; sam. 8 h, 10 h),
  -- placés un à un : le trigger verifier_conflit_creneau refuse tout double
  -- emploi (classe, enseignant, salle). Sciences en laboratoire si libre.
  for c in select * from _cls where annee = a2 order by ordre loop
    for r in
      select en.id as ens_id, m.code as mat, co.volume_horaire as vol
      from public.enseignements en
      join public.matieres m on m.id = en.matiere_id
      join public.classes cl on cl.id = en.classe_id
      join public.coefficients co on co.niveau_id = cl.niveau_id and co.serie_id is not distinct from cl.serie_id and co.matiere_id = en.matiere_id
      where en.classe_id = c.id
      order by co.volume_horaire desc, m.code
    loop
      v_besoin := ceil(coalesce(r.vol, 2) / 2.0);
      v_place := 0;
      -- 1re passe : au plus une séance de la matière par jour ; 2e passe (si des
      -- heures restent à placer) : cette contrainte de confort est levée.
      for passe in 1..2 loop
      for s in 0..16 loop
        exit when v_place >= v_besoin;
        v_slot := (s * 7 + c.ordre * 3) % 17; -- 7 premier avec 17 : parcourt tous les créneaux
        v_jour := case when v_slot < 15 then v_slot / 3 + 1 else 6 end;
        v_debut := case when v_slot < 15 then (array[time '08:00', time '10:00', time '15:00'])[v_slot % 3 + 1]
                        else (array[time '08:00', time '10:00'])[v_slot - 14] end;
        continue when passe = 1 and exists (select 1 from public.creneaux cr where cr.enseignement_id = r.ens_id and cr.jour = v_jour);
        v_salle := case when r.mat in ('PC', 'SVT') and c.niv <> 'CM2' then v_labo else (select salle_id from public.classes where id = c.id) end;
        begin
          insert into public.creneaux (etablissement_id, enseignement_id, jour, heure_debut, heure_fin, salle_id)
          values (e, r.ens_id, v_jour, v_debut, v_debut + interval '2 hours', v_salle);
          v_place := v_place + 1;
        exception when sqlstate '23P01' then
          -- Laboratoire occupé : même créneau dans la salle de la classe.
          if v_salle = v_labo then
            begin
              insert into public.creneaux (etablissement_id, enseignement_id, jour, heure_debut, heure_fin, salle_id)
              values (e, r.ens_id, v_jour, v_debut, v_debut + interval '2 hours', (select salle_id from public.classes where id = c.id));
              v_place := v_place + 1;
            exception when sqlstate '23P01' then
              null;
            end;
          end if;
        end;
      end loop;
      end loop;
    end loop;
  end loop;
end;
$$;

revoke execute on function public.creer_demo(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._demo_creer_eleve(uuid, integer, text, integer, date) from public, anon, authenticated;
