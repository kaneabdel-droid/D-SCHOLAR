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
