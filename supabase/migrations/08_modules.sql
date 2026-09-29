-- Lot « modules restants » : découpage par cycle, poids nul, admissions,
-- verrouillage et publication des notes, décisions, services et frais,
-- attestations vérifiables, portail familles et notifications.
-- À exécuter AVANT de réexécuter 07_demo.sql (la démo utilise ces tables).

-- ═══ 1. Découpage trimestriel / semestriel par cycle ═══════════════════════
-- Un même établissement peut noter en trimestres au préscolaire / élémentaire
-- et en semestres au moyen / secondaire. `decoupage` reste la valeur par défaut
-- de l'année ; `decoupage_cycles` la précise par cycle, ex. {"moyen":"semestre"}.
alter table public.annees_scolaires add column decoupage_cycles jsonb not null default '{}'::jsonb;

alter table public.periodes add column decoupage varchar(20) not null default 'trimestre' check (decoupage in ('trimestre', 'semestre'));
update public.periodes p set decoupage = a.decoupage from public.annees_scolaires a where a.id = p.annee_id;
alter table public.periodes drop constraint periode_rang_unique;
alter table public.periodes add constraint periode_rang_unique unique (annee_id, decoupage, rang);

create or replace function public.decoupage_cycle(p_annee_id uuid, p_cycle text) returns text
language sql stable set search_path = public as $$
  select coalesce(decoupage_cycles ->> p_cycle, decoupage) from public.annees_scolaires where id = p_annee_id
$$;

-- Périodes suivies par une classe : celles du découpage de son cycle.
create or replace function public.periodes_classe(p_classe_id uuid) returns setof public.periodes
language sql stable set search_path = public as $$
  select p.*
  from public.classes c
  join public.niveaux n on n.id = c.niveau_id
  join public.periodes p on p.annee_id = c.annee_id and p.decoupage = public.decoupage_cycle(c.annee_id, n.cycle)
  where c.id = p_classe_id
  order by p.rang
$$;

drop function if exists public.creer_annee_scolaire(text, date, date, text);

create or replace function public.creer_annee_scolaire(
  p_libelle text,
  p_date_debut date,
  p_date_fin date,
  p_decoupage text,
  p_decoupage_cycles jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_etab uuid := public.current_etablissement_id();
  v_annee uuid;
  v_premiere boolean;
  v_d text;
  v_nb smallint;
  v_duree integer;
begin
  if not public.can_manage_parametres() then
    raise exception 'Réservé à la direction et au censeur';
  end if;
  if p_decoupage not in ('trimestre', 'semestre')
     or exists (select 1 from jsonb_each_text(coalesce(p_decoupage_cycles, '{}')) where value not in ('trimestre', 'semestre')
                                                                                   or key not in ('prescolaire', 'elementaire', 'moyen', 'secondaire')) then
    raise exception 'Découpage invalide';
  end if;

  select not exists (select 1 from public.annees_scolaires where etablissement_id = v_etab) into v_premiere;

  insert into public.annees_scolaires (etablissement_id, libelle, date_debut, date_fin, decoupage, decoupage_cycles, active)
  values (v_etab, trim(p_libelle), p_date_debut, p_date_fin, p_decoupage, coalesce(p_decoupage_cycles, '{}'), v_premiere)
  returning id into v_annee;

  -- Une série de périodes par découpage utilisé (par défaut + précisions par cycle).
  for v_d in select distinct d from (select p_decoupage as d union select value from jsonb_each_text(coalesce(p_decoupage_cycles, '{}'))) x loop
    v_nb := case v_d when 'trimestre' then 3 else 2 end;
    v_duree := (p_date_fin - p_date_debut) / v_nb;
    for i in 1..v_nb loop
      insert into public.periodes (etablissement_id, annee_id, rang, libelle, date_debut, date_fin, decoupage)
      values (
        v_etab, v_annee, i,
        case v_d when 'trimestre' then 'Trimestre ' || i else 'Semestre ' || i end,
        p_date_debut + (i - 1) * v_duree,
        case when i = v_nb then p_date_fin else p_date_debut + i * v_duree - 1 end,
        v_d
      );
    end loop;
  end loop;

  return v_annee;
end;
$$;

-- ═══ 2. Poids nul : un type d'évaluation peut ne pas compter ═════════════════
-- (ex. les tests, notés pour information). Il est saisi et visible, mais exclu
-- de la moyenne ; une matière sans aucun type de poids > 0 n'a pas de moyenne.
alter table public.types_evaluation drop constraint types_evaluation_poids_check;
alter table public.types_evaluation add constraint types_evaluation_poids_check check (poids >= 0);

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
    where te.poids > 0
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

create or replace function public.moyennes_annuelles(p_classe_id uuid)
returns table (eleve_id uuid, moyenne numeric, rang bigint)
language sql stable set search_path = public as $$
  with mp as (
    select m.eleve_id, m.moyenne
    from public.periodes_classe(p_classe_id) p, lateral public.moyennes_periode(p_classe_id, p.id) m
  )
  select eleve_id, round(avg(moyenne), 2), rank() over (order by avg(moyenne) desc)
  from mp
  group by eleve_id
$$;

-- ═══ 3. Numérotation (matricules, reçus, documents) ══════════════════════════
create table public.compteurs (
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  cle varchar(40) not null,
  valeur integer not null default 0,
  primary key (etablissement_id, cle)
);
alter table public.compteurs enable row level security;

create or replace function public.prochain_numero(p_etablissement_id uuid, p_cle text) returns integer
language sql security definer set search_path = public as $$
  insert into public.compteurs (etablissement_id, cle, valeur) values (p_etablissement_id, p_cle, 1)
  on conflict (etablissement_id, cle) do update set valeur = public.compteurs.valeur + 1
  returning valeur
$$;
revoke execute on function public.prochain_numero(uuid, text) from public, anon, authenticated;

-- Matricule automatique : SIGLE-AA-0001 (sigle de l'établissement, sinon « EL »).
create or replace function public.attribuer_matricule() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_sigle text;
begin
  if coalesce(trim(new.matricule), '') = '' then
    select coalesce(nullif(upper(regexp_replace(sigle, '[^A-Za-z0-9]', '', 'g')), ''), 'EL') into v_sigle
    from public.etablissements where id = new.etablissement_id;
    new.matricule := v_sigle || '-' || to_char(now(), 'YY') || '-'
      || lpad(public.prochain_numero(new.etablissement_id, 'matricule-' || to_char(now(), 'YY'))::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger trg_eleves_matricule before insert on public.eleves
  for each row execute function public.attribuer_matricule();

-- ═══ 4. Admissions ═══════════════════════════════════════════════════════════
create table public.candidatures (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  annee_id uuid references public.annees_scolaires(id) on delete cascade not null,
  niveau_id uuid references public.niveaux(id) not null,
  serie_id uuid references public.series(id),
  prenom varchar(100) not null,
  nom varchar(100) not null,
  sexe char(1) not null check (sexe in ('M', 'F')),
  date_naissance date,
  lieu_naissance varchar(100),
  etablissement_origine varchar(150),
  moyenne_origine numeric(5, 2) check (moyenne_origine is null or moyenne_origine between 0 and 20),
  tuteur_nom varchar(150),
  tuteur_telephone varchar(30),
  tuteur_email varchar(255),
  statut varchar(20) not null default 'soumise'
    check (statut in ('soumise', 'en_etude', 'test_planifie', 'admise', 'liste_attente', 'refusee', 'inscrite')),
  date_test date,
  note_test numeric(5, 2) check (note_test is null or note_test between 0 and 20),
  commentaire text,
  eleve_id uuid references public.eleves(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_candidatures_annee on public.candidatures(annee_id);

-- ═══ 5. Publication et verrouillage des notes ════════════════════════════════
-- publiee : visible des familles. Une période verrouillée fige ses évaluations
-- et notes (seule la publication reste possible) : c'est la garantie que bulletins
-- et relevés émis ne changent plus.
alter table public.evaluations add column publiee boolean not null default false;

create or replace function public.verifier_periode_ouverte() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_periode uuid;
begin
  -- Suppressions en cascade (année, établissement) : jamais bloquées.
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;
  if tg_table_name = 'evaluations' then
    if tg_op = 'UPDATE' and (to_jsonb(new) - 'publiee') = (to_jsonb(old) - 'publiee') then
      return new;
    end if;
    v_periode := coalesce(new.periode_id, old.periode_id);
    if tg_op = 'UPDATE' and new.periode_id is distinct from old.periode_id
       and exists (select 1 from public.periodes where id = old.periode_id and verrouillee) then
      raise exception 'Période verrouillée' using errcode = 'DSVER';
    end if;
  else
    select periode_id into v_periode from public.evaluations where id = coalesce(new.evaluation_id, old.evaluation_id);
  end if;
  if exists (select 1 from public.periodes where id = v_periode and verrouillee) then
    raise exception 'Période verrouillée' using errcode = 'DSVER';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trg_evaluations_periode before insert or update or delete on public.evaluations
  for each row execute function public.verifier_periode_ouverte();
create trigger trg_notes_periode before insert or update or delete on public.notes
  for each row execute function public.verifier_periode_ouverte();

-- Un enseignant ne saisit que les évaluations et notes de ses propres cours.
create or replace function public.enseigne(p_enseignement_id uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.enseignements e join public.enseignants en on en.id = e.enseignant_id
    where e.id = p_enseignement_id and en.utilisateur_id = auth.uid()
  )
$$;

drop policy insert_evaluations on public.evaluations;
drop policy update_evaluations on public.evaluations;
drop policy delete_evaluations on public.evaluations;
create policy insert_evaluations on public.evaluations for insert with check (
  etablissement_id = public.current_etablissement_id()
  and (public.peut_ecrire(array['direction', 'censeur']) or (public.peut_ecrire(array['enseignant']) and public.enseigne(enseignement_id))));
create policy update_evaluations on public.evaluations for update using (
  etablissement_id = public.current_etablissement_id()
  and (public.peut_ecrire(array['direction', 'censeur']) or (public.peut_ecrire(array['enseignant']) and public.enseigne(enseignement_id))))
  with check (etablissement_id = public.current_etablissement_id());
create policy delete_evaluations on public.evaluations for delete using (
  etablissement_id = public.current_etablissement_id()
  and (public.peut_ecrire(array['direction', 'censeur']) or (public.peut_ecrire(array['enseignant']) and public.enseigne(enseignement_id))));

drop policy insert_notes on public.notes;
drop policy update_notes on public.notes;
drop policy delete_notes on public.notes;
create policy insert_notes on public.notes for insert with check (
  etablissement_id = public.current_etablissement_id()
  and (public.peut_ecrire(array['direction', 'censeur'])
       or (public.peut_ecrire(array['enseignant']) and public.enseigne((select enseignement_id from public.evaluations where id = evaluation_id)))));
create policy update_notes on public.notes for update using (
  etablissement_id = public.current_etablissement_id()
  and (public.peut_ecrire(array['direction', 'censeur'])
       or (public.peut_ecrire(array['enseignant']) and public.enseigne((select enseignement_id from public.evaluations where id = evaluation_id)))))
  with check (etablissement_id = public.current_etablissement_id());
create policy delete_notes on public.notes for delete using (
  etablissement_id = public.current_etablissement_id()
  and (public.peut_ecrire(array['direction', 'censeur'])
       or (public.peut_ecrire(array['enseignant']) and public.enseigne((select enseignement_id from public.evaluations where id = evaluation_id)))));

-- ═══ 6. Décisions de fin d'année (RPC direction / censeur) ═══════════════════
create or replace function public.calculer_decisions_classe(p_classe_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.peut_ecrire(array['direction', 'censeur']) then
    raise exception 'Réservé à la direction et au censeur';
  end if;
  if not exists (select 1 from public.classes where id = p_classe_id and etablissement_id = public.current_etablissement_id()) then
    raise exception 'Classe introuvable';
  end if;
  perform public._calculer_decisions(p_classe_id);
end;
$$;

-- ═══ 7. Services (tenue, transport, restauration…) et frais ══════════════════
create table public.services (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  type varchar(20) not null check (type in ('tenue', 'transport', 'restauration', 'fournitures', 'activite', 'autre')),
  nom varchar(100) not null,
  tarif integer not null check (tarif >= 0),
  periodicite varchar(20) not null default 'annuel' check (periodicite in ('unique', 'mensuel', 'trimestriel', 'annuel')),
  actif boolean not null default true
);

create table public.souscriptions_services (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  eleve_id uuid references public.eleves(id) on delete cascade not null,
  service_id uuid references public.services(id) on delete cascade not null,
  annee_id uuid references public.annees_scolaires(id) on delete cascade not null,
  details text,
  created_at timestamptz not null default now(),
  constraint souscription_service_unique unique (eleve_id, service_id, annee_id)
);

-- Frais de scolarité par année, pour un niveau (ou tous : niveau_id null).
create table public.frais_scolarite (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  annee_id uuid references public.annees_scolaires(id) on delete cascade not null,
  niveau_id uuid references public.niveaux(id) on delete cascade,
  libelle varchar(100) not null,
  montant integer not null check (montant > 0),
  date_echeance date
);

create table public.paiements_eleves (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  eleve_id uuid references public.eleves(id) on delete cascade not null,
  annee_id uuid references public.annees_scolaires(id) on delete cascade not null,
  libelle varchar(150) not null,
  montant integer not null check (montant > 0),
  mode varchar(20) not null default 'especes' check (mode in ('especes', 'mobile_money', 'virement', 'cheque', 'autre')),
  reference varchar(100),
  date_paiement date not null default current_date,
  numero_recu varchar(30),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index idx_paiements_eleves_eleve on public.paiements_eleves(eleve_id, annee_id);

create or replace function public.attribuer_numero_recu() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.numero_recu is null then
    new.numero_recu := 'R' || to_char(new.date_paiement, 'YY') || '-'
      || lpad(public.prochain_numero(new.etablissement_id, 'recu-' || to_char(new.date_paiement, 'YY'))::text, 5, '0');
  end if;
  return new;
end;
$$;
create trigger trg_paiements_eleves_recu before insert on public.paiements_eleves
  for each row execute function public.attribuer_numero_recu();

-- ═══ 8. Attestations et documents vérifiables ════════════════════════════════
create table public.documents_emis (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  eleve_id uuid references public.eleves(id) on delete cascade not null,
  annee_id uuid references public.annees_scolaires(id) on delete set null,
  type varchar(30) not null check (type in ('certificat_scolarite', 'attestation_inscription', 'certificat_frequentation',
                                            'attestation_reussite', 'exeat', 'releve_notes', 'bulletin')),
  numero varchar(40) not null,
  code_verification varchar(16) not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  contenu jsonb not null default '{}'::jsonb,
  emis_le timestamptz not null default now(),
  emis_par uuid default auth.uid(),
  annule boolean not null default false,
  constraint document_numero_unique unique (etablissement_id, numero)
);
create index idx_documents_eleve on public.documents_emis(eleve_id);

-- Émission numérotée (ex. CS-2026-0001) : le numéro et le code de vérification
-- sont attribués en base, jamais par le client.
create or replace function public.emettre_document(p_eleve_id uuid, p_type text, p_annee_id uuid, p_contenu jsonb)
returns public.documents_emis
language plpgsql security definer set search_path = public as $$
declare
  v_etab uuid := public.current_etablissement_id();
  v_prefixe text;
  v_doc public.documents_emis;
begin
  if not public.peut_ecrire(array['direction', 'censeur', 'secretariat']) then
    raise exception 'Réservé à la direction, au censeur et au secrétariat';
  end if;
  if not exists (select 1 from public.eleves where id = p_eleve_id and etablissement_id = v_etab) then
    raise exception 'Élève introuvable';
  end if;
  v_prefixe := case p_type
    when 'certificat_scolarite' then 'CS' when 'attestation_inscription' then 'AI' when 'certificat_frequentation' then 'CF'
    when 'attestation_reussite' then 'AR' when 'exeat' then 'EX' when 'releve_notes' then 'RN' else 'BU' end;
  insert into public.documents_emis (etablissement_id, eleve_id, annee_id, type, numero, contenu)
  values (v_etab, p_eleve_id, p_annee_id, p_type,
          v_prefixe || '-' || to_char(now(), 'YYYY') || '-' || lpad(public.prochain_numero(v_etab, 'doc-' || v_prefixe || '-' || to_char(now(), 'YYYY'))::text, 4, '0'),
          coalesce(p_contenu, '{}'))
  returning * into v_doc;
  return v_doc;
end;
$$;

-- Vérification publique (page /verifier/[code], QR code imprimé sur le document) :
-- ne renvoie que ce qui figure déjà sur le document papier.
create or replace function public.verifier_document(p_code text)
returns table (type text, numero text, emis_le timestamptz, annule boolean, eleve text, matricule text, etablissement text, annee text)
language sql security definer stable set search_path = public as $$
  select d.type::text, d.numero::text, d.emis_le, d.annule, (e.prenom || ' ' || e.nom)::text, e.matricule::text, et.nom::text, a.libelle::text
  from public.documents_emis d
  join public.eleves e on e.id = d.eleve_id
  join public.etablissements et on et.id = d.etablissement_id
  left join public.annees_scolaires a on a.id = d.annee_id
  where d.code_verification = upper(trim(p_code))
$$;
grant execute on function public.verifier_document(text) to anon, authenticated;

-- ═══ 9. Portail familles (parents et élèves) ═════════════════════════════════
create table public.comptes_famille (
  id uuid references auth.users(id) on delete cascade primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  type varchar(10) not null check (type in ('parent', 'eleve')),
  prenom varchar(100),
  nom varchar(100),
  telephone varchar(30),
  email varchar(255),
  eleve_id uuid references public.eleves(id) on delete cascade,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  constraint compte_eleve_coherent check ((type = 'eleve') = (eleve_id is not null))
);

create table public.liens_famille (
  compte_id uuid references public.comptes_famille(id) on delete cascade not null,
  eleve_id uuid references public.eleves(id) on delete cascade not null,
  lien varchar(20) not null default 'tuteur' check (lien in ('pere', 'mere', 'tuteur')),
  primary key (compte_id, eleve_id)
);

-- Code remis par le secrétariat (fiche d'inscription, QR) : sans SMS ni email,
-- le parent crée son accès avec ce code (cf. app/activer).
create table public.codes_activation (
  code varchar(12) primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  eleve_id uuid references public.eleves(id) on delete cascade not null,
  type varchar(10) not null check (type in ('parent', 'eleve')),
  lien varchar(20) not null default 'tuteur',
  cree_le timestamptz not null default now(),
  expire_le timestamptz not null default now() + interval '60 days',
  utilise_le timestamptz,
  compte_id uuid references public.comptes_famille(id) on delete set null
);

alter table public.absences
  add column justification_parent text,
  add column justification_demandee_le timestamptz;

create or replace function public.famille_etablissement_id() returns uuid
language sql security definer stable set search_path = public as $$
  select etablissement_id from public.comptes_famille where id = auth.uid() and actif
$$;

create or replace function public.mes_eleves() returns setof uuid
language sql security definer stable set search_path = public as $$
  select l.eleve_id from public.liens_famille l join public.comptes_famille c on c.id = l.compte_id
  where l.compte_id = auth.uid() and c.actif
  union
  select eleve_id from public.comptes_famille where id = auth.uid() and type = 'eleve' and actif
$$;

-- Génère un code d'activation (compte élève seulement à partir du niveau fixé
-- par l'établissement, 6e par défaut).
create or replace function public.generer_code_activation(p_eleve_id uuid, p_type text, p_lien text default 'tuteur') returns text
language plpgsql security definer set search_path = public as $$
declare
  v_etab uuid := public.current_etablissement_id();
  v_code text;
  v_ordre_eleve smallint;
  v_ordre_min smallint;
begin
  if not public.peut_ecrire(array['direction', 'censeur', 'secretariat']) then
    raise exception 'Réservé à la direction, au censeur et au secrétariat';
  end if;
  if p_type not in ('parent', 'eleve') or p_lien not in ('pere', 'mere', 'tuteur') then
    raise exception 'Paramètres invalides';
  end if;
  if not exists (select 1 from public.eleves where id = p_eleve_id and etablissement_id = v_etab) then
    raise exception 'Élève introuvable';
  end if;
  if p_type = 'eleve' then
    select n.ordre into v_ordre_eleve
    from public.inscriptions i join public.classes c on c.id = i.classe_id join public.niveaux n on n.id = c.niveau_id
    join public.annees_scolaires a on a.id = i.annee_id
    where i.eleve_id = p_eleve_id order by a.date_debut desc limit 1;
    select n.ordre into v_ordre_min from public.etablissements e join public.niveaux n on n.etablissement_id = e.id and n.code = e.niveau_min_compte_eleve
    where e.id = v_etab;
    if v_ordre_eleve is null or v_ordre_eleve < coalesce(v_ordre_min, 0) then
      raise exception 'Compte élève non disponible à ce niveau' using errcode = 'DSNIV';
    end if;
  end if;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.codes_activation (code, etablissement_id, eleve_id, type, lien) values (v_code, v_etab, p_eleve_id, p_type, p_lien);
  return v_code;
end;
$$;

-- Justification d'absence par la famille (le personnel valide ensuite).
create or replace function public.justifier_absence(p_absence_id uuid, p_motif text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_motif), '') = '' then
    raise exception 'Motif requis';
  end if;
  update public.absences set justification_parent = left(trim(p_motif), 500), justification_demandee_le = now()
  where id = p_absence_id and eleve_id in (select public.mes_eleves());
  if not found then
    raise exception 'Absence introuvable';
  end if;
end;
$$;

-- Bulletin d'un élève pour une période, pour sa famille : seulement si la
-- période est verrouillée (notes définitives). Calcule aussi le rang, que les
-- policies des familles (limitées à leurs enfants) ne permettraient pas.
create or replace function public.bulletin_eleve(p_eleve_id uuid, p_periode_id uuid)
returns table (matiere_id uuid, moyenne numeric, coefficient numeric, moyenne_generale numeric, rang bigint, effectif bigint)
language plpgsql security definer stable set search_path = public as $$
declare
  v_classe uuid;
  v_famille boolean := p_eleve_id in (select public.mes_eleves());
begin
  if not v_famille and not exists (select 1 from public.eleves where id = p_eleve_id and etablissement_id = public.current_etablissement_id()) then
    raise exception 'Élève introuvable';
  end if;
  if v_famille and not exists (select 1 from public.periodes where id = p_periode_id and verrouillee) then
    return;
  end if;
  select i.classe_id into v_classe
  from public.inscriptions i join public.periodes p on p.annee_id = i.annee_id
  where i.eleve_id = p_eleve_id and p.id = p_periode_id;
  if v_classe is null then
    return;
  end if;
  return query
    with g as (select * from public.moyennes_periode(v_classe, p_periode_id))
    select m.matiere_id, m.moyenne, m.coefficient,
      (select g.moyenne from g where g.eleve_id = p_eleve_id),
      (select g.rang from g where g.eleve_id = p_eleve_id),
      (select count(*) from g)
    from public.moyennes_matieres(v_classe, p_periode_id) m
    where m.eleve_id = p_eleve_id;
end;
$$;

-- ═══ 10. Communication : annonces et notifications ═══════════════════════════
create table public.annonces (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  titre varchar(200) not null,
  contenu text not null,
  cible varchar(20) not null default 'tous' check (cible in ('tous', 'personnel', 'familles', 'classe')),
  classe_id uuid references public.classes(id) on delete cascade,
  auteur_id uuid default auth.uid(),
  publiee_le timestamptz not null default now(),
  constraint annonce_classe_coherente check ((cible = 'classe') = (classe_id is not null))
);

-- Notifications dans l'application : type + paramètres, traduits à l'affichage
-- (fr / en / ar) plutôt qu'un texte figé dans une langue.
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type varchar(30) not null,
  params jsonb not null default '{}'::jsonb,
  lien text,
  lu_le timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on public.notifications(user_id, created_at desc);

-- Comptes famille d'un élève (parents liés + compte élève).
create or replace function public.comptes_de_l_eleve(p_eleve_id uuid) returns setof uuid
language sql security definer stable set search_path = public as $$
  select l.compte_id from public.liens_famille l join public.comptes_famille c on c.id = l.compte_id where l.eleve_id = p_eleve_id and c.actif
  union
  select id from public.comptes_famille where eleve_id = p_eleve_id and actif
$$;

create or replace function public.notifier_absence() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, params, lien)
  select c, 'absence',
    jsonb_build_object('type', new.type, 'date', new.date_absence, 'duree', new.duree,
                       'eleve', (select prenom from public.eleves where id = new.eleve_id)),
    '/portail/' || new.eleve_id || '?vue=assiduite'
  from public.comptes_de_l_eleve(new.eleve_id) c;
  return new;
end;
$$;
create trigger trg_absences_notification after insert on public.absences
  for each row execute function public.notifier_absence();

create or replace function public.notifier_publication() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.publiee and not old.publiee then
    insert into public.notifications (user_id, type, params, lien)
    select distinct c, 'note',
      jsonb_build_object('matiere', m.nom, 'evaluation', new.libelle, 'eleve', el.prenom),
      '/portail/' || n.eleve_id || '?vue=notes'
    from public.notes n
    join public.eleves el on el.id = n.eleve_id
    join public.enseignements en on en.id = new.enseignement_id
    join public.matieres m on m.id = en.matiere_id,
    lateral public.comptes_de_l_eleve(n.eleve_id) c
    where n.evaluation_id = new.id;
  end if;
  return new;
end;
$$;
create trigger trg_evaluations_publication after update of publiee on public.evaluations
  for each row execute function public.notifier_publication();

create or replace function public.notifier_annonce() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, params, lien)
  select distinct dest, 'annonce', jsonb_build_object('titre', new.titre), lien
  from (
    -- Personnel
    select u.id as dest, '/communication' as lien from public.utilisateurs u
    where u.etablissement_id = new.etablissement_id and u.actif and new.cible in ('tous', 'personnel') and u.id is distinct from new.auteur_id
    union
    -- Familles de l'établissement
    select c.id, '/portail' from public.comptes_famille c
    where c.etablissement_id = new.etablissement_id and c.actif and new.cible in ('tous', 'familles')
    union
    -- Familles d'une classe
    select cpt, '/portail' from public.inscriptions i, lateral public.comptes_de_l_eleve(i.eleve_id) cpt
    where new.cible = 'classe' and i.classe_id = new.classe_id
  ) d;
  return new;
end;
$$;
create trigger trg_annonces_notification after insert on public.annonces
  for each row execute function public.notifier_annonce();

-- ═══ 11. RLS des nouvelles tables (personnel) ════════════════════════════════
do $$
declare
  t text;
  regles jsonb := '{
    "candidatures": ["direction", "censeur", "secretariat"],
    "services": ["direction", "intendant"],
    "souscriptions_services": ["direction", "intendant", "secretariat"],
    "frais_scolarite": ["direction", "intendant"],
    "paiements_eleves": ["direction", "intendant"],
    "documents_emis": ["direction", "censeur", "secretariat"],
    "annonces": ["direction", "censeur", "secretariat", "surveillant"]
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

alter table public.comptes_famille enable row level security;
alter table public.liens_famille enable row level security;
alter table public.codes_activation enable row level security;
alter table public.notifications enable row level security;

-- Personnel : voit les comptes famille et codes de son établissement (écriture
-- via RPC / service role uniquement).
create policy select_comptes_famille on public.comptes_famille for select
  using (id = auth.uid() or etablissement_id = public.current_etablissement_id());
create policy select_liens_famille on public.liens_famille for select
  using (compte_id = auth.uid() or eleve_id in (select id from public.eleves where etablissement_id = public.current_etablissement_id()));
create policy select_codes_activation on public.codes_activation for select
  using (etablissement_id = public.current_etablissement_id());
create policy select_notifications on public.notifications for select using (user_id = auth.uid());
create policy update_notifications on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ═══ 12. RLS des familles (lecture seule, limitée à leurs enfants) ═══════════
create policy famille_etablissements on public.etablissements for select using (id = public.famille_etablissement_id());

do $$
declare
  t text;
  -- Référentiel et organisation : lisibles par les familles de l'établissement.
  tables text[] := array['annees_scolaires', 'periodes', 'niveaux', 'series', 'matieres', 'types_evaluation',
                         'appreciations', 'salles', 'classes', 'enseignements', 'creneaux', 'services'];
begin
  foreach t in array tables loop
    execute format('create policy %I on public.%I for select using (etablissement_id = public.famille_etablissement_id())', 'famille_' || t, t);
  end loop;
end $$;

-- Nom des enseignants seulement utile au portail : la table entière reste
-- lisible (coordonnées professionnelles de l'établissement).
create policy famille_enseignants on public.enseignants for select using (etablissement_id = public.famille_etablissement_id());

create policy famille_eleves on public.eleves for select using (id in (select public.mes_eleves()));
create policy famille_inscriptions on public.inscriptions for select using (eleve_id in (select public.mes_eleves()));
create policy famille_decisions on public.decisions for select
  using (inscription_id in (select id from public.inscriptions where eleve_id in (select public.mes_eleves())));
create policy famille_examens on public.examens_officiels for select using (eleve_id in (select public.mes_eleves()));
create policy famille_absences on public.absences for select using (eleve_id in (select public.mes_eleves()));
create policy famille_evaluations on public.evaluations for select using (publiee and etablissement_id = public.famille_etablissement_id());
create policy famille_notes on public.notes for select
  using (eleve_id in (select public.mes_eleves()) and exists (select 1 from public.evaluations ev where ev.id = evaluation_id and ev.publiee));
create policy famille_documents on public.documents_emis for select using (eleve_id in (select public.mes_eleves()) and not annule);
create policy famille_paiements on public.paiements_eleves for select using (eleve_id in (select public.mes_eleves()));
create policy famille_souscriptions_services on public.souscriptions_services for select using (eleve_id in (select public.mes_eleves()));
create policy famille_frais on public.frais_scolarite for select using (etablissement_id = public.famille_etablissement_id());
create policy famille_annonces on public.annonces for select using (
  etablissement_id = public.famille_etablissement_id()
  and (cible in ('tous', 'familles')
       or (cible = 'classe' and classe_id in (select classe_id from public.inscriptions where eleve_id in (select public.mes_eleves())))));
