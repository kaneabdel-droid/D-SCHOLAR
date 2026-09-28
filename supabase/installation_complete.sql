-- D-Scholar : installation complète (migrations 00 à 05), à exécuter en une fois
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
