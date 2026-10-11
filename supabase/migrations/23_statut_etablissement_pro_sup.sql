-- 23_statut_etablissement_pro_sup.sql
-- Ajout des options 'professionnel' et 'superieur' au statut de l'établissement
-- et enrichissement de la démo avec des niveaux, classes, cours, élèves et notes réalistes.

-- 1. Statut juridique élargi (prive, public, professionnel, superieur)
alter table public.etablissements drop constraint if exists etablissements_statut_juridique_check;
alter table public.etablissements alter column statut_juridique type varchar(30);
alter table public.etablissements add constraint etablissements_statut_juridique_check
  check (statut_juridique in ('prive', 'public', 'professionnel', 'superieur'));

create or replace function public.modifier_regime_etablissement(p_statut_juridique text, p_mois_scolarite integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() is distinct from 'direction' or not public.ecriture_autorisee() then
    raise exception 'Réservé à la direction';
  end if;
  update public.etablissements
  set statut_juridique = case when p_statut_juridique in ('prive', 'public', 'professionnel', 'superieur') then p_statut_juridique else statut_juridique end,
      mois_scolarite = greatest(1, least(12, coalesce(p_mois_scolarite, mois_scolarite)))
  where id = public.current_etablissement_id();
end;
$$;

-- 2. Mise à jour de initialiser_referentiel pour inclure Pro et Sup en démo et selon palier/statut
create or replace function public.initialiser_referentiel(p_etablissement_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_palier text;
  v_statut text;
  v_demo boolean;
  v_cycles text[];
begin
  select palier, coalesce(statut_juridique, 'prive'), coalesce(est_demo, false)
  into v_palier, v_statut, v_demo
  from public.etablissements where id = p_etablissement_id;

  if v_demo then
    v_cycles := array['prescolaire', 'elementaire', 'moyen', 'secondaire', 'professionnel', 'superieur'];
  else
    v_cycles := public.cycles_du_palier(v_palier);
    if v_statut = 'professionnel' and not ('professionnel' = any(v_cycles)) then
      v_cycles := array_append(v_cycles, 'professionnel');
    end if;
    if v_statut = 'superieur' and not ('superieur' = any(v_cycles)) then
      v_cycles := array_append(v_cycles, 'superieur');
    end if;
  end if;

  insert into public.niveaux (etablissement_id, cycle, code, nom, ordre, a_series)
  select p_etablissement_id, n.cycle, n.code, n.nom, n.ordre, n.a_series
  from (values
    ('prescolaire', 'TPS', 'Toute petite section', 1, false),
    ('prescolaire', 'PS', 'Petite section', 2, false),
    ('prescolaire', 'MS', 'Moyenne section', 3, false),
    ('prescolaire', 'GS', 'Grande section', 4, false),
    ('elementaire', 'CI', 'CI', 5, false),
    ('elementaire', 'CP', 'CP', 6, false),
    ('elementaire', 'CE1', 'CE1', 7, false),
    ('elementaire', 'CE2', 'CE2', 8, false),
    ('elementaire', 'CM1', 'CM1', 9, false),
    ('elementaire', 'CM2', 'CM2', 10, false),
    ('moyen', '6E', '6e', 11, false),
    ('moyen', '5E', '5e', 12, false),
    ('moyen', '4E', '4e', 13, false),
    ('moyen', '3E', '3e', 14, false),
    ('secondaire', '2NDE', 'Seconde', 15, true),
    ('secondaire', '1ERE', 'Première', 16, true),
    ('secondaire', 'TLE', 'Terminale', 17, true),
    ('professionnel', 'CAP', 'CAP', 18, true),
    ('professionnel', 'BEP', 'BEP', 19, true),
    ('professionnel', 'BT', 'BT', 20, true),
    ('professionnel', 'BTS', 'BTS', 21, true),
    ('superieur', 'L1', 'Licence 1', 22, true),
    ('superieur', 'L2', 'Licence 2', 23, true),
    ('superieur', 'L3', 'Licence 3', 24, true),
    ('superieur', 'M1', 'Master 1', 25, true),
    ('superieur', 'M2', 'Master 2', 26, true)
  ) as n(cycle, code, nom, ordre, a_series)
  where n.cycle = any(v_cycles)
  on conflict (etablissement_id, code) do nothing;

  if 'secondaire' = any(v_cycles) or 'professionnel' = any(v_cycles) or 'superieur' = any(v_cycles) then
    insert into public.series (etablissement_id, code, nom)
    select p_etablissement_id, s.code, s.nom
    from (values
      ('L1', 'Lettres – langues'),
      ('L2', 'Lettres – sciences humaines'),
      ('S1', 'Mathématiques – sciences physiques'),
      ('S2', 'Sciences expérimentales'),
      ('S3', 'Sciences et techniques'),
      ('G', 'Sciences et techniques économiques et de gestion'),
      ('PRO', 'Générique Professionnelle'),
      ('SUP', 'Générique Supérieur')
    ) as s(code, nom)
    on conflict (etablissement_id, code) do nothing;
  end if;

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
    ('INFO', 'Informatique', '#0D9488', false, true),
    ('PRO_TECH', 'Matières techniques PRO', '#9333EA', false, true),
    ('SUP_SPEC', 'Spécialité SUP', '#E11D48', false, true)
  ) as m(code, nom, couleur, primaire, secondaire)
  where (m.primaire and v_cycles && array['prescolaire', 'elementaire'])
     or (m.secondaire and (v_cycles && array['moyen', 'secondaire', 'professionnel', 'superieur']))
  on conflict (etablissement_id, code) do nothing;
end;
$$;

-- 3. Mise à jour de la fonction _demo_creer_eleve pour gérer les âges Pro et Sup
create or replace function public._demo_creer_eleve(p_etab uuid, p_g integer, p_niveau text, p_decalage integer, p_date_entree date)
returns uuid
language plpgsql set search_path = public as $$
declare
  prenoms_m text[] := array['Mamadou', 'Moussa', 'Ibrahima', 'Cheikh', 'Abdoulaye', 'Ousmane', 'Modou', 'Pape', 'Serigne', 'Babacar',
                            'Aliou', 'Souleymane', 'Alioune', 'Lamine', 'Mouhamed', 'El Hadji', 'Samba', 'Demba', 'Omar', 'Idrissa'];
  prenoms_f text[] := array['Aïssatou', 'Fatou', 'Mariama', 'Awa', 'Khady', 'Ndeye', 'Aminata', 'Coumba', 'Astou', 'Bineta',
                            'Rokhaya', 'Seynabou', 'Adama', 'Dieynaba', 'Maïmouna', 'Oumou', 'Sokhna', 'Yacine', 'Fatimata', 'Ramatoulaye'];
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
    when '2NDE' then 2009 when '1ERE' then 2008 when 'TLE' then 2007
    when 'BTS' then 2005 when 'L1' then 2005 else 2006 end + p_decalage;
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
    prenoms_m[(p_g * 3) % 20 + 1] || ' ' || v_nom,
    '77 ' || lpad(((p_g * 179) % 900 + 100)::text, 3, '0') || ' ' || lpad(((p_g * 43) % 90 + 10)::text, 2, '0') || ' ' || lpad(((p_g * 67) % 90 + 10)::text, 2, '0'),
    p_date_entree
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- 4. Mise à jour complète de creer_demo avec classes, élèves, cours et notes Pro et Sup
create or replace function public.creer_demo(
  p_etablissement_id uuid,
  p_utilisateur_enseignant uuid default null,
  p_utilisateur_parent uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  e uuid := p_etablissement_id;
  a1 uuid; a2 uuid;
  v_id uuid;
  r record;
  c record;
  v_labo uuid;
  g integer := 0;
  v_cas text;
  v_statut text;
  bases numeric[] := array[16.8, 15.4, 14.2, 13.5, 12.8, 12.1, 11.4, 10.7, 9.8, 9.2, 8.1, 6.4];
  v_eval uuid;
  v_date date;
  v_note numeric;
  v_cle text;
  v_besoin integer;
  v_place integer;
  v_slot integer;
  v_jour smallint;
  v_debut time;
  v_salle uuid;
  v_enfant1 uuid;
  v_enfant2 uuid;
begin
  if not exists (select 1 from public.etablissements where id = e) then
    raise exception 'Établissement introuvable';
  end if;
  if exists (select 1 from public.annees_scolaires where etablissement_id = e) then
    raise exception 'La démo doit être générée sur un établissement vide';
  end if;

  drop table if exists pg_temp._ens, pg_temp._cls, pg_temp._el, pg_temp._mens;

  update public.etablissements set est_demo = true, moyenne_passage = 10, moyenne_repechage = 9 where id = e;
  perform public.initialiser_referentiel(e);

  insert into public.series (etablissement_id, code, nom) values
    (e, 'S', 'Scientifique (Seconde)'),
    (e, 'L', 'Littéraire (Seconde)')
  on conflict do nothing;

  insert into public.salles (etablissement_id, nom, capacite, type)
  select e, 'Salle ' || i, 45, 'classe' from generate_series(1, 12) i
  on conflict do nothing;
  insert into public.salles (etablissement_id, nom, capacite, type) values
    (e, 'Laboratoire', 30, 'laboratoire'),
    (e, 'Salle informatique', 30, 'informatique')
  on conflict do nothing;
  select id into v_labo from public.salles where etablissement_id = e and nom = 'Laboratoire';

  insert into public.types_evaluation (etablissement_id, code, libelle, poids, nombre_par_periode, ordre) values
    (e, 'DEV', 'Devoir', 1, 2, 1),
    (e, 'TEST', 'Interrogation écrite (test)', 0, 1, 2),
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

  insert into public.annees_scolaires (etablissement_id, libelle, date_debut, date_fin, decoupage, decoupage_cycles, active, cloturee)
  values (e, '2025-2026', '2025-10-06', '2026-07-10', 'semestre', '{"prescolaire": "trimestre", "elementaire": "trimestre"}', false, true)
  returning id into a1;
  insert into public.annees_scolaires (etablissement_id, libelle, date_debut, date_fin, decoupage, decoupage_cycles, active, cloturee)
  values (e, '2026-2027', '2026-10-05', '2027-07-09', 'semestre', '{"prescolaire": "trimestre", "elementaire": "trimestre"}', true, false)
  returning id into a2;

  insert into public.periodes (etablissement_id, annee_id, decoupage, rang, libelle, date_debut, date_fin) values
    (e, a1, 'trimestre', 1, 'Trimestre 1', '2025-10-06', '2025-12-20'),
    (e, a1, 'trimestre', 2, 'Trimestre 2', '2026-01-05', '2026-03-28'),
    (e, a1, 'trimestre', 3, 'Trimestre 3', '2026-04-06', '2026-07-10'),
    (e, a1, 'semestre', 1, 'Semestre 1', '2025-10-06', '2026-02-20'),
    (e, a1, 'semestre', 2, 'Semestre 2', '2026-02-23', '2026-07-10'),
    (e, a2, 'trimestre', 1, 'Trimestre 1', '2026-10-05', '2026-12-19'),
    (e, a2, 'trimestre', 2, 'Trimestre 2', '2027-01-04', '2027-03-27'),
    (e, a2, 'trimestre', 3, 'Trimestre 3', '2027-04-05', '2027-07-09'),
    (e, a2, 'semestre', 1, 'Semestre 1', '2026-10-05', '2027-02-19'),
    (e, a2, 'semestre', 2, 'Semestre 2', '2027-02-22', '2027-07-09');

  -- Coefficients y compris pour Professionnel (BTS / PRO) et Supérieur (L1 / SUP)
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
    ('TLE', 'S2', 'ANG', 2, 3), ('TLE', 'S2', 'HG', 2, 2), ('TLE', 'S2', 'EPS', 1, 2),
    -- Professionnel (BTS)
    ('BTS', 'PRO', 'PRO_TECH', 6, 8), ('BTS', 'PRO', 'INFO', 4, 4), ('BTS', 'PRO', 'MATH', 3, 3),
    ('BTS', 'PRO', 'FR', 2, 3), ('BTS', 'PRO', 'ANG', 2, 3),
    -- Supérieur (L1)
    ('L1', 'SUP', 'SUP_SPEC', 6, 8), ('L1', 'SUP', 'INFO', 3, 3), ('L1', 'SUP', 'MATH', 4, 4),
    ('L1', 'SUP', 'ANG', 2, 3), ('L1', 'SUP', 'FR', 2, 2)
  ) as v(niv, ser, mat, coef, vol)
  join public.niveaux n on n.etablissement_id = e and n.code = v.niv
  left join public.series s on s.etablissement_id = e and s.code = v.ser
  join public.matieres m on m.etablissement_id = e and m.code = v.mat
  on conflict do nothing;

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

  -- Classes des deux années, incluant BTS 1 et Licence 1
  create temp table _cls (cle text, annee uuid, id uuid, niv text, ser text, ordre integer) on commit drop;
  for r in select * from (values
    (1, 'A1', 'CM2A', 'CM2', null, 'CM2 A', 'Salle 1', 'FAYE'),
    (2, 'A1', '6A', '6E', null, '6e A', 'Salle 2', 'DIALLO'),
    (3, 'A1', '3A', '3E', null, '3e A', 'Salle 3', 'NDIAYE'),
    (4, 'A1', '2S', '2NDE', 'S', '2nde S', 'Salle 4', 'SARR'),
    (5, 'A1', 'TS2', 'TLE', 'S2', 'Tle S2', 'Salle 5', 'GUEYE'),
    (6, 'A1', 'BTS1', 'BTS', 'PRO', 'BTS 1 Informatique & Gestion', 'Salle 6', 'SECK'),
    (7, 'A1', 'L1A', 'L1', 'SUP', 'Licence 1 Sciences de Gestion', 'Salle 7', 'GUEYE'),
    (1, 'A2', 'CM2A', 'CM2', null, 'CM2 A', 'Salle 1', 'FAYE'),
    (2, 'A2', '6A', '6E', null, '6e A', 'Salle 2', 'DIALLO'),
    (3, 'A2', '5A', '5E', null, '5e A', 'Salle 3', 'DIOP'),
    (4, 'A2', '3A', '3E', null, '3e A', 'Salle 4', 'NDIAYE'),
    (5, 'A2', '2S', '2NDE', 'S', '2nde S', 'Salle 5', 'SARR'),
    (6, 'A2', '2L', '2NDE', 'L', '2nde L', 'Salle 6', 'FALL'),
    (7, 'A2', '1S', '1ERE', 'S2', '1re S2', 'Salle 7', 'SOW'),
    (8, 'A2', 'TS2', 'TLE', 'S2', 'Tle S2', 'Salle 8', 'GUEYE'),
    (9, 'A2', 'BTS1', 'BTS', 'PRO', 'BTS 1 Informatique & Gestion', 'Salle 9', 'SECK'),
    (10, 'A2', 'L1A', 'L1', 'SUP', 'Licence 1 Sciences de Gestion', 'Salle 10', 'GUEYE')
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

  -- Enseignements affectés
  insert into public.enseignements (etablissement_id, classe_id, matiere_id, enseignant_id)
  select e, c2.id, co.matiere_id, (select id from _ens where code =
    case
      when c2.niv = 'CM2' then case when m.code = 'AR' then 'SECK' else 'FAYE' end
      when m.code = 'PRO_TECH' then 'SECK'
      when m.code = 'SUP_SPEC' then 'GUEYE'
      when m.code = 'INFO' then 'DIOP'
      when m.code = 'MATH' then case when c2.niv in ('3E', 'BTS') or (c2.niv = '2NDE' and c2.ser = 'S') then 'NDIAYE' else 'DIOP' end
      when m.code = 'PC' then case when c2.niv = 'TLE' then 'GUEYE' else 'NDIAYE' end
      when m.code = 'FR' then case when c2.niv in ('1ERE', 'L1') then 'BA' else 'DIALLO' end
      when m.code = 'PHILO' then 'BA'
      when m.code = 'SVT' then 'SARR'
      when m.code = 'ANG' then 'SOW'
      when m.code in ('HG', 'EC') then 'FALL'
      when m.code = 'EPS' then 'KANE'
      when m.code = 'ESP' then 'MBAYE'
      when m.code = 'AR' then 'SECK'
      else 'DIALLO'
    end)
  from _cls c2
  join public.niveaux n on n.etablissement_id = e and n.code = c2.niv
  left join public.series s on s.etablissement_id = e and s.code = c2.ser
  join public.coefficients co on co.niveau_id = n.id and co.serie_id is not distinct from s.id
  join public.matieres m on m.id = co.matiere_id;

  -- Élèves 2025-2026 (12 élèves par classe, y compris BTS 1 et Licence 1)
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

  -- Évaluations et notes 2025-2026
  for r in
    select en.id as ens_id, en.matiere_id, cl.cle, p.id as per_id, p.rang, p.decoupage, p.date_debut, p.date_fin,
           t.id as type_id, t.code as type_code, t.nombre_par_periode as nb
    from public.enseignements en
    join _cls cl on cl.id = en.classe_id and cl.annee = a1
    join public.niveaux nv on nv.etablissement_id = e and nv.code = cl.niv
    join public.periodes p on p.annee_id = a1 and p.decoupage = public.decoupage_cycle(a1, nv.cycle)
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
          else 'Composition du ' || r.decoupage || ' ' || r.rang end,
        v_date,
        case r.type_code when 'TEST' then 10 else 20 end
      )
      returning id into v_eval;

      insert into public.notes (etablissement_id, evaluation_id, eleve_id, valeur)
      select e, v_eval, el.id,
        round(
          greatest(0, least(20,
            el.base
            + (public._demo_alea(el.id::text || r.matiere_id::text) - 0.5) * 4
            + (public._demo_alea(el.id::text || v_eval::text) - 0.5) * 3
          )) * case r.type_code when 'TEST' then 0.5 else 1 end * 4
        ) / 4.0
      from _el el
      where el.cle = r.cle
        and not (r.rang = 1 and el.cas = 'transfert')
        and not (r.rang = 3 and el.cas = 'depart')
        and not (r.type_code = 'COMPO' and r.rang = 2 and el.cas = 'absent_compo')
        and not (el.cas = 'absenteiste' and public._demo_alea(el.id::text || v_eval::text) < 0.35);

      if r.type_code = 'COMPO' and r.rang = 2 then
        insert into public.absences_retards (etablissement_id, eleve_id, type, date_debut, justifie, motif)
        select e, el.id, 'absence', v_date, true, 'Certificat médical transmis'
        from _el el where el.cle = r.cle and el.cas = 'absent_compo';
      end if;
    end loop;
  end loop;

  -- Départs en cours d'année
  insert into public.mouvements (etablissement_id, eleve_id, date_mouvement, type, motif)
  select e, el.id, '2026-04-10', 'depart', 'Déménagement de la famille à Mbour'
  from _el el where el.cas = 'depart';
  update public.eleves set statut = 'sorti' where id in (select id from _el where cas = 'depart');

  -- Bulletins annuels et décisions
  for r in select distinct a1 as annee_id, c.id as classe_id from _cls c where c.annee = a1 loop
    perform public.cloturer_bulletins_classe(r.classe_id, 2);
    perform public.calculer_decisions_fin_annee(r.classe_id);
  end loop;

  update public.decisions d
  set decision_finale = 'admis',
      decision = 'repechage',
      motif_repechage = 'Moyenne annuelle de 9,8/20 avec avis favorable du conseil (bonne assiduité)'
  from public.inscriptions i join _el el on el.id = i.eleve_id
  where i.id = d.inscription_id and i.annee_id = a1 and el.base = 9.8;

  update public.decisions d
  set decision_finale = 'redouble',
      decision = 'refuse',
      motif_repechage = 'Moyenne de 9,2/20 insuffisante pour le repêchage'
  from public.inscriptions i join _el el on el.id = i.eleve_id
  where i.id = d.inscription_id and i.annee_id = a1 and el.base = 9.2;

  update public.decisions d set orientation = case cl.cle
      when 'CM2A' then '6e'
      when '6A' then '5e'
      when '3A' then case when d.moyenne_annuelle >= 12 then 'Seconde S' else 'Seconde L' end
      when '2S' then 'Première S2'
      when 'BTS1' then 'BTS 2 Informatique & Gestion'
      when 'L1A' then 'Licence 2 Sciences de Gestion'
      else 'Enseignement supérieur' end
  from public.inscriptions i join _cls cl on cl.id = i.classe_id
  where i.id = d.inscription_id and i.annee_id = a1 and d.decision_finale = 'admis';

  -- Examens officiels
  insert into public.examens_officiels (etablissement_id, eleve_id, annee_id, examen, session, resultat, mention)
  select e, i.eleve_id, a1,
    case cl.cle when 'CM2A' then 'CFEE' when '3A' then 'BFEM' when 'BTS1' then 'BTS' else 'BAC' end,
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
  where i.annee_id = a1 and cl.cle in ('CM2A', '3A', 'TS2', 'BTS1');

  -- Bacheliers sortants
  insert into public.mouvements (etablissement_id, eleve_id, date_mouvement, type, motif)
  select e, i.eleve_id, '2026-07-24', 'fin_de_cycle', 'Baccalauréat obtenu'
  from public.decisions d join public.inscriptions i on i.id = d.inscription_id join _cls cl on cl.id = i.classe_id
  where i.annee_id = a1 and cl.cle = 'TS2' and d.decision_finale = 'admis';
  update public.eleves set statut = 'sorti'
  where id in (
    select i.eleve_id from public.decisions d join public.inscriptions i on i.id = d.inscription_id join _cls cl on cl.id = i.classe_id
    where i.annee_id = a1 and cl.cle = 'TS2' and d.decision_finale = 'admis'
  );

  -- Rentrée 2026-2027
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
        when 'BTS1' then 'BTS1'
        when 'L1A' then 'L1A'
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

  -- Nouveaux élèves pour 2026-2027 (y compris BTS 1 et L1)
  for r in select * from (values
    ('CM2A', 'CM2', 12), ('6A', '6E', 3), ('5A', '5E', 2), ('3A', '3E', 9),
    ('2S', '2NDE', 2), ('2L', '2NDE', 2), ('1S', '1ERE', 4), ('TS2', 'TLE', 6),
    ('BTS1', 'BTS', 8), ('L1A', 'L1', 8)
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

  -- Emplois du temps 2026-2027
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
      for passe in 1..2 loop
      for s in 0..16 loop
        exit when v_place >= v_besoin;
        v_slot := (s * 7 + c.ordre * 3) % 17;
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

  update public.evaluations ev set publiee = true from public.periodes p where ev.periode_id = p.id and p.annee_id = a1;
  update public.periodes set verrouillee = true where annee_id = a1;

  -- Services
  insert into public.services (etablissement_id, type, nom, tarif, periodicite) values
    (e, 'restauration', 'Cantine (déjeuner)', 15000, 'mensuel'),
    (e, 'transport', 'Bus scolaire · circuit Parcelles / Grand Yoff', 12000, 'mensuel'),
    (e, 'transport', 'Bus scolaire · circuit Ouakam / Yoff', 12000, 'mensuel'),
    (e, 'tenue', 'Tenue scolaire (2 ensembles)', 25000, 'unique'),
    (e, 'fournitures', 'Kit de fournitures', 18000, 'annuel'),
    (e, 'activite', 'Club informatique', 5000, 'trimestriel');

  -- Frais de scolarité
  update public.etablissements set statut_juridique = 'prive', mois_scolarite = 9 where id = e;
  insert into public.frais_scolarite (etablissement_id, annee_id, niveau_id, cycle, libelle, montant, periodicite, date_echeance)
  select e, a.id, null, null, 'Frais d''inscription', 25000, 'unique', a.date_debut
  from public.annees_scolaires a where a.id in (a1, a2);

  insert into public.frais_scolarite (etablissement_id, annee_id, niveau_id, cycle, libelle, montant, periodicite, date_echeance)
  select e, a.id, null, x.cycle, 'Mensualité', x.montant, 'mensuel', a.date_debut + 5
  from public.annees_scolaires a
  cross join (values
    ('elementaire', 20000),
    ('moyen', 25000),
    ('secondaire', 30000),
    ('professionnel', 35000),
    ('superieur', 45000)
  ) as x(cycle, montant)
  where a.id in (a1, a2);

  insert into public.frais_scolarite (etablissement_id, annee_id, niveau_id, cycle, libelle, montant, periodicite, date_echeance)
  select e, a.id, n.id, null, 'Mensualité', x.montant, 'mensuel', a.date_debut + 5
  from public.annees_scolaires a
  cross join (values ('CM2', 22500), ('3E', 27500), ('TLE', 35000), ('BTS', 38000), ('L1', 48000)) as x(niv, montant)
  join public.niveaux n on n.etablissement_id = e and n.code = x.niv
  where a.id in (a1, a2);

  insert into public.souscriptions_services (etablissement_id, eleve_id, service_id, annee_id, details)
  select e, i.eleve_id, s.id, a2,
    case when s.type = 'transport' then 'Arrêt ' || (array['Marché', 'Mosquée', 'Rond-point', 'Station'])[1 + floor(public._demo_alea(i.eleve_id::text || 'arret') * 4)::integer] end
  from public.inscriptions i
  join public.services s on s.etablissement_id = e
  where i.annee_id = a2
    and case s.nom
      when 'Cantine (déjeuner)' then public._demo_alea(i.eleve_id::text || 'cantine') < 0.45
      when 'Bus scolaire · circuit Parcelles / Grand Yoff' then public._demo_alea(i.eleve_id::text || 'bus') < 0.15
      when 'Bus scolaire · circuit Ouakam / Yoff' then public._demo_alea(i.eleve_id::text || 'bus') between 0.15 and 0.28
      when 'Tenue scolaire (2 ensembles)' then i.statut in ('nouveau', 'transfere')
      when 'Kit de fournitures' then public._demo_alea(i.eleve_id::text || 'kit') < 0.6
      else public._demo_alea(i.eleve_id::text || 'club') < 0.12 end;

  create temp table _mens on commit drop as
  select i.eleve_id, i.annee_id,
    (select f.montant from public.frais_scolarite f
     where f.annee_id = i.annee_id and f.libelle = 'Mensualité' and (f.niveau_id = cla.niveau_id or f.cycle = n.cycle)
     order by (f.niveau_id is not null) desc limit 1) as montant
  from public.inscriptions i
  join public.classes cla on cla.id = i.classe_id
  join public.niveaux n on n.id = cla.niveau_id
  where i.etablissement_id = e;

  insert into public.paiements_eleves (etablissement_id, eleve_id, annee_id, libelle, montant, mode, date_paiement)
  select e, m.eleve_id, a1, x.libelle, x.montant,
    (array['especes', 'mobile_money', 'mobile_money', 'virement'])[1 + floor(public._demo_alea(m.eleve_id::text || x.libelle) * 4)::integer],
    x.date_p
  from _mens m
  cross join lateral (
    select 'Frais d''inscription' as libelle, 25000 as montant, date '2025-09-22' as date_p, 0 as rang
    union all
    select 'Mensualité · ' || (array['octobre 2025', 'novembre 2025', 'décembre 2025', 'janvier 2026', 'février 2026', 'mars 2026', 'avril 2026', 'mai 2026', 'juin 2026'])[k],
      m.montant, (date '2025-10-01' + (k - 1) * interval '1 month')::date + floor(public._demo_alea(m.eleve_id::text || k) * 8)::integer, k
    from generate_series(1, 9) k
  ) as x
  where m.annee_id = a1 and m.montant is not null
    and not (x.rang >= 8 and public._demo_alea(m.eleve_id::text || 'impaye') < 0.08);

  insert into public.paiements_eleves (etablissement_id, eleve_id, annee_id, libelle, montant, mode, date_paiement)
  select e, m.eleve_id, a2, x.libelle, x.montant,
    (array['especes', 'mobile_money', 'mobile_money', 'virement'])[1 + floor(public._demo_alea(m.eleve_id::text || x.libelle || '27') * 4)::integer],
    date '2026-09-14' + floor(public._demo_alea(m.eleve_id::text || 'jour' || x.libelle) * 14)::integer
  from _mens m
  cross join lateral (values
    ('Frais d''inscription', 25000, 0.9),
    ('Mensualité · octobre 2026', m.montant, 0.55)
  ) as x(libelle, montant, part)
  where m.annee_id = a2 and m.montant is not null and public._demo_alea(m.eleve_id::text || 'paye' || x.libelle) < x.part;

  insert into public.candidatures (etablissement_id, annee_id, niveau_id, serie_id, prenom, nom, sexe, date_naissance, lieu_naissance,
                                   etablissement_origine, moyenne_origine, tuteur_nom, tuteur_telephone, statut, date_test, note_test, commentaire)
  select e, a2, (select id from public.niveaux where etablissement_id = e and code = v.niv),
    (select id from public.series where etablissement_id = e and code = v.ser),
    v.prenom, v.nom, v.sexe, v.naissance::date, v.lieu, v.origine, v.moy, v.tuteur, v.tel, v.statut, v.test::date, v.note, v.comm
  from (values
    ('6E', null, 'Khadija', 'Sarr', 'F', '2014-03-12', 'Dakar', 'École Sainte-Bernadette', 15.2, 'Ibrahima Sarr', '77 402 11 58', 'soumise', null, null, null),
    ('6E', null, 'Oumar', 'Diallo', 'M', '2014-07-02', 'Pikine', 'École Liberté 6', 12.8, 'Aminata Diallo', '78 551 20 33', 'en_etude', null, null, 'Bulletins du CM2 reçus'),
    ('2NDE', 'S', 'Ndèye Maguette', 'Fall', 'F', '2010-11-21', 'Thiès', 'CEM Malick Sy', 14.1, 'Moustapha Fall', '76 318 90 12', 'test_planifie', '2026-10-02', null, 'Test de positionnement en mathématiques'),
    ('1ERE', 'S2', 'Saliou', 'Ndour', 'M', '2009-05-17', 'Rufisque', 'Lycée de Rufisque', 13.4, 'Awa Ndour', '77 620 44 81', 'admise', '2026-09-18', 14.5, 'Admis après test'),
    ('3E', null, 'Rama', 'Seck', 'F', '2011-01-30', 'Dakar', 'CEM Grand Yoff', 11.2, 'Pape Seck', '70 118 72 40', 'liste_attente', '2026-09-18', 10.5, 'Classe de 3e complète'),
    ('TLE', 'S2', 'Moustapha', 'Kane', 'M', '2008-08-08', 'Kaolack', 'Lycée Valdiodio Ndiaye', 8.9, 'Fatou Kane', '77 903 15 26', 'refusee', '2026-09-18', 7.0, 'Niveau insuffisant en sciences'),
    ('BTS', 'PRO', 'Cheikh Tidiane', 'Bâ', 'M', '2005-04-14', 'Dakar', 'Lycée Technique Maurice Delafosse', 13.8, 'Amadou Bâ', '77 501 22 33', 'admise', '2026-09-20', 14.0, 'Admis en BTS Informatique & Gestion'),
    ('L1', 'SUP', 'Aïcha', 'Touré', 'F', '2005-11-03', 'Saint-Louis', 'Lycée Charles de Gaulle', 14.2, 'Mamadou Touré', '78 412 99 00', 'admise', '2026-09-22', 15.0, 'Admise en Licence 1 Sciences de Gestion')
  ) as v(niv, ser, prenom, nom, sexe, naissance, lieu, origine, moy, tuteur, tel, statut, test, note, comm);

  if p_utilisateur_parent is not null then
    select i.eleve_id into v_enfant1 from public.inscriptions i join _cls cl on cl.id = i.classe_id
    where i.annee_id = a2 and cl.cle = '6A' and i.statut = 'passant' order by i.eleve_id limit 1;
    select i.eleve_id into v_enfant2 from public.inscriptions i join _cls cl on cl.id = i.classe_id
    where i.annee_id = a2 and cl.cle = '1S' and i.statut = 'passant' order by i.eleve_id limit 1;
    insert into public.comptes_famille (id, etablissement_id, type, prenom, nom, telephone, email)
    values (p_utilisateur_parent, e, 'parent', 'Mariama', 'Diagne', '77 455 23 10', (select email from auth.users where id = p_utilisateur_parent));
    insert into public.liens_famille (compte_id, eleve_id, lien)
    select p_utilisateur_parent, x, 'mere' from unnest(array[v_enfant1, v_enfant2]) x where x is not null;
  end if;

  insert into public.annonces (etablissement_id, titre, contenu, cible, classe_id, auteur_id, publiee_le) values
    (e, 'Rentrée 2026-2027 le lundi 5 octobre',
     'Les cours reprennent le lundi 5 octobre à 8 h. Les emplois du temps sont consultables sur le portail. Pensez à régler les frais d''inscription avant la rentrée.',
     'tous', null, null, '2026-09-21 09:00'),
    (e, 'Réunion parents-professeurs de 3e A',
     'Réunion d''information sur le BFEM le samedi 17 octobre à 10 h, salle polyvalente.',
     'classe', (select id from _cls where cle = '3A' and annee = a2), null, '2026-09-25 10:00'),
    (e, 'Conseil pédagogique de rentrée',
     'Conseil pédagogique le vendredi 2 octobre à 15 h : répartition des classes, progression commune, calendrier des compositions.',
     'personnel', null, null, '2026-09-24 08:30');

  insert into public.documents_emis (etablissement_id, eleve_id, annee_id, type, numero, contenu, emis_le)
  select e, x.eleve_id, x.annee_id, x.type,
    x.prefixe || '-2026-' || lpad(public.prochain_numero(e, 'doc-' || x.prefixe || '-2026')::text, 4, '0'),
    jsonb_build_object(
      'eleve', jsonb_build_object('prenom', el.prenom, 'nom', el.nom, 'matricule', el.matricule, 'sexe', el.sexe,
                                  'date_naissance', el.date_naissance, 'lieu_naissance', el.lieu_naissance),
      'classe', cl.nom, 'annee', an.libelle, 'date_inscription', i.date_inscription, 'date_entree', el.date_entree,
      'moyenne', d.moyenne_annuelle, 'decision', d.decision_finale,
      'sortie', case when x.type = 'exeat' then (select jsonb_build_object('date', m.date_mouvement, 'type', m.type, 'motif', m.motif)
                                                 from public.mouvements m where m.eleve_id = el.id and m.type not in ('entree', 'transfert_entrant')
                                                 order by m.date_mouvement desc limit 1) end,
      'reste_du', case when x.type = 'exeat' then 0 end,
      'tuteur', case when x.type = 'carte_scolaire' then jsonb_build_object('nom', el.tuteur_nom, 'telephone', el.tuteur_telephone) end),
    x.emis_le
  from (
    select el.id as eleve_id, a1 as annee_id, 'exeat' as type, 'EX' as prefixe, timestamptz '2026-04-13 11:00' as emis_le
    from _el el where el.cas = 'depart'
    union all
    select i.eleve_id, a1, 'attestation_reussite', 'AR', timestamptz '2026-07-27 10:00'
    from public.decisions d join public.inscriptions i on i.id = d.inscription_id join _cls cl on cl.id = i.classe_id
    where i.annee_id = a1 and cl.cle = 'TS2' and d.decision_finale = 'admis'
    union all
    (select i.eleve_id, a2, 'certificat_scolarite', 'CS', timestamptz '2026-09-28 09:30'
     from public.inscriptions i where i.annee_id = a2 order by i.eleve_id limit 3)
    union all
    select i.eleve_id, a2, 'carte_scolaire', 'CI', timestamptz '2026-09-28 11:00'
    from public.inscriptions i join _cls cl on cl.id = i.classe_id
    where i.annee_id = a2 and cl.cle = '3A'
  ) x
  join public.eleves el on el.id = x.eleve_id
  join public.inscriptions i on i.eleve_id = x.eleve_id and i.annee_id = x.annee_id
  join public.classes cl on cl.id = i.classe_id
  join public.annees_scolaires an on an.id = x.annee_id
  left join public.decisions d on d.inscription_id = i.id;

  insert into public.billets (etablissement_id, eleve_id, annee_id, type, emis_le, motif, details, minutes_retard, heure_retour)
  select e, x.eleve_id, x.annee_id, x.type, x.emis_le, x.motif, x.details, x.minutes, x.retour
  from (
    select i.eleve_id, a1 as annee_id, (array['retard', 'sortie', 'visite_medicale', 'entree'])[1 + (row_number() over (order by i.eleve_id))::int % 4] as type,
      timestamptz '2026-03-10 08:20' + (row_number() over (order by i.eleve_id)) * interval '3 days' as emis_le,
      null::text as motif, null::text as details, null::smallint as minutes, null::time as retour
    from public.inscriptions i where i.annee_id = a1 order by i.eleve_id limit 12
  ) x;
  update public.billets set
    motif = case type when 'retard' then 'Transport en commun en retard' when 'sortie' then 'Rendez-vous médical en ville'
                      when 'visite_medicale' then 'Maux de tête' else 'Retour après absence justifiée' end,
    details = case type when 'sortie' then 'Mère de l''élève' when 'visite_medicale' then 'Infirmerie' end,
    minutes_retard = case when type = 'retard' then 15 end,
    heure_retour = case when type in ('sortie', 'visite_medicale') then time '11:00' end
  where etablissement_id = e and motif is null;

  insert into public.billets (etablissement_id, eleve_id, annee_id, type, emis_le, motif, details, minutes_retard, heure_retour)
  select e, x.eleve_id, a2, x.type, date_trunc('day', now()) + x.decalage, x.motif, x.details, x.minutes, x.retour
  from (
    select (select i.eleve_id from public.inscriptions i join _cls cl on cl.id = i.classe_id where i.annee_id = a2 and cl.cle = '3A' order by i.eleve_id limit 1 offset 0) as eleve_id,
      'retard' as type, interval '8 hours 12 minutes' as decalage, 'Embouteillages' as motif, null as details, 12::smallint as minutes, null::time as retour
    union all
    select (select i.eleve_id from public.inscriptions i join _cls cl on cl.id = i.classe_id where i.annee_id = a2 and cl.cle = '3A' order by i.eleve_id limit 1 offset 1),
      'retard', interval '8 hours 25 minutes', 'Réveil tardif', null, 25, null
    union all
    select coalesce(v_enfant1, (select i.eleve_id from public.inscriptions i where i.annee_id = a2 order by i.eleve_id limit 1 offset 2)),
      'visite_medicale', interval '10 hours 5 minutes', 'Fièvre en cours de mathématiques', 'Infirmerie', null, time '11:00'
    union all
    select (select i.eleve_id from public.inscriptions i where i.annee_id = a2 order by i.eleve_id limit 1 offset 3),
      'sortie', interval '11 hours 40 minutes', 'Rendez-vous chez le dentiste', 'Père de l''élève', null, time '15:00'
    union all
    select (select i.eleve_id from public.inscriptions i where i.annee_id = a2 order by i.eleve_id limit 1 offset 4),
      'entree', interval '8 hours', 'Retour après deux jours d''absence (certificat médical)', null, null, null
  ) x
  where x.eleve_id is not null;

end;
$$;
