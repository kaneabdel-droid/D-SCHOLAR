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

-- Signature étendue (compte parent) : l'ancienne version à deux paramètres est retirée.
drop function if exists public.creer_demo(uuid, uuid);

create or replace function public.creer_demo(p_etablissement_id uuid, p_utilisateur_enseignant uuid, p_utilisateur_parent uuid default null)
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
  v_enfant1 uuid;
  v_enfant2 uuid;
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
    -- Poids nul : le test est noté et visible, mais ne compte pas dans la moyenne.
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

  -- ─── Années et périodes ──────────────────────────────────────────────────
  -- Découpage par cycle : semestres au moyen et au secondaire (défaut de l'année),
  -- trimestres au préscolaire et à l'élémentaire. Périodes créées ouvertes, puis
  -- 2025-2026 verrouillée en fin de génération (le trigger verifier_periode_ouverte
  -- refuserait sinon les notes).
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
    select en.id as ens_id, en.matiere_id, cl.cle, p.id as per_id, p.rang, p.decoupage, p.date_debut, p.date_fin,
           t.id as type_id, t.code as type_code, t.nombre_par_periode as nb
    from public.enseignements en
    join _cls cl on cl.id = en.classe_id and cl.annee = a1
    join public.niveaux nv on nv.etablissement_id = e and nv.code = cl.niv
    -- Périodes du découpage du cycle de la classe (trimestres ou semestres).
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
            + case when el.cas = 'repechage' then 0 else (public._demo_alea(el.id::text || r.matiere_id::text) - 0.5) * 3 end
            + (public._demo_alea(el.id::text || v_eval::text) - 0.5) * case when el.cas = 'repechage' then 1.5 else 5 end
          )) * (case r.type_code when 'TEST' then 10 else 20 end) / 20.0 * 4
        ) / 4
      from _el el
      where el.cle = r.cle
        -- coalesce : el.cas est NULL pour la plupart des élèves, et « not (NULL and …) »
        -- vaut NULL, ce qui exclurait ces élèves. Arrivé le 5 janvier : pas noté sur
        -- une période commencée avant ; parti le 13 avril : pas noté sur une période
        -- qui se termine après.
        and not (coalesce(el.cas, '') = 'transfert' and r.date_debut < date '2026-01-05')
        and not (coalesce(el.cas, '') = 'depart' and r.date_fin > date '2026-04-13');
    end loop;
  end loop;

  -- Absence justifiée (maladie) à la composition de Mathématiques de la 2e période.
  update public.notes n set valeur = null, absent = true, absence_justifiee = true
  from public.evaluations ev, public.enseignements en, public.matieres m, public.periodes p, public.types_evaluation t, _el el
  where n.evaluation_id = ev.id and ev.enseignement_id = en.id and en.matiere_id = m.id and m.code = 'MATH'
    and ev.periode_id = p.id and p.annee_id = a1 and p.rang = 2
    and ev.type_id = t.id and t.code = 'COMPO'
    and n.eleve_id = el.id and el.cas = 'absent_compo';

  -- Absence non justifiée au 1er devoir de Français de la dernière période (absentéiste).
  update public.notes n set valeur = null, absent = true, absence_justifiee = false
  from public.evaluations ev, public.enseignements en, public.matieres m, public.periodes p, public.types_evaluation t, _el el
  where n.evaluation_id = ev.id and ev.enseignement_id = en.id and en.matiere_id = m.id and m.code = 'FR'
    and ev.periode_id = p.id and p.annee_id = a1 and p.date_fin = date '2026-07-10'
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

  -- ─── Clôture de 2025-2026 : notes publiées, périodes verrouillées ────────
  update public.evaluations ev set publiee = true from public.periodes p where ev.periode_id = p.id and p.annee_id = a1;
  update public.periodes set verrouillee = true where annee_id = a1;

  -- ─── Services proposés aux élèves ────────────────────────────────────────
  insert into public.services (etablissement_id, type, nom, tarif, periodicite) values
    (e, 'restauration', 'Cantine (déjeuner)', 15000, 'mensuel'),
    (e, 'transport', 'Bus scolaire · circuit Parcelles / Grand Yoff', 12000, 'mensuel'),
    (e, 'transport', 'Bus scolaire · circuit Ouakam / Yoff', 12000, 'mensuel'),
    (e, 'tenue', 'Tenue scolaire (2 ensembles)', 25000, 'unique'),
    (e, 'fournitures', 'Kit de fournitures', 18000, 'annuel'),
    (e, 'activite', 'Club informatique', 5000, 'trimestriel');

  -- ─── Frais de scolarité (inscription + scolarité annuelle par cycle) ─────
  insert into public.frais_scolarite (etablissement_id, annee_id, niveau_id, libelle, montant, date_echeance)
  select e, a.id, null, 'Frais d''inscription', 25000, a.date_debut
  from public.annees_scolaires a where a.id in (a1, a2);
  insert into public.frais_scolarite (etablissement_id, annee_id, niveau_id, libelle, montant, date_echeance)
  select distinct e, cla.annee_id, n.id, 'Scolarité annuelle',
    case n.cycle when 'elementaire' then 180000 when 'moyen' then 225000 else 270000 end,
    (select date_debut + 30 from public.annees_scolaires where id = cla.annee_id)
  from public.classes cla join public.niveaux n on n.id = cla.niveau_id
  where cla.etablissement_id = e;

  -- ─── Souscriptions aux services (rentrée 2026-2027) ─────────────────────
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

  -- ─── Paiements des familles ──────────────────────────────────────────────
  -- 2025-2026 : scolarité soldée pour la plupart, trois familles avec un reste dû.
  insert into public.paiements_eleves (etablissement_id, eleve_id, annee_id, libelle, montant, mode, date_paiement)
  select e, i.eleve_id, a1, x.libelle, x.montant,
    (array['especes', 'mobile_money', 'mobile_money', 'virement'])[1 + floor(public._demo_alea(i.eleve_id::text || x.libelle) * 4)::integer],
    x.date_p
  from public.inscriptions i
  join public.classes cla on cla.id = i.classe_id
  join public.niveaux n on n.id = cla.niveau_id
  cross join lateral (values
    ('Frais d''inscription', 25000, date '2025-09-22'),
    ('Scolarité · 1re tranche', (case n.cycle when 'elementaire' then 180000 when 'moyen' then 225000 else 270000 end) / 3, date '2025-10-20'),
    ('Scolarité · 2e tranche', (case n.cycle when 'elementaire' then 180000 when 'moyen' then 225000 else 270000 end) / 3, date '2026-01-12'),
    ('Scolarité · 3e tranche', (case n.cycle when 'elementaire' then 180000 when 'moyen' then 225000 else 270000 end) / 3, date '2026-04-13')
  ) as x(libelle, montant, date_p)
  where i.annee_id = a1
    and not (x.libelle = 'Scolarité · 3e tranche' and public._demo_alea(i.eleve_id::text || 'impaye') < 0.06);

  -- Rentrée 2026-2027 : inscription réglée par la plupart, 1re tranche par certains.
  insert into public.paiements_eleves (etablissement_id, eleve_id, annee_id, libelle, montant, mode, date_paiement)
  select e, i.eleve_id, a2, x.libelle, x.montant,
    (array['especes', 'mobile_money', 'mobile_money', 'virement'])[1 + floor(public._demo_alea(i.eleve_id::text || x.libelle || '27') * 4)::integer],
    date '2026-09-14' + floor(public._demo_alea(i.eleve_id::text || 'jour' || x.libelle) * 14)::integer
  from public.inscriptions i
  join public.classes cla on cla.id = i.classe_id
  join public.niveaux n on n.id = cla.niveau_id
  cross join lateral (values
    ('Frais d''inscription', 25000, 0.9),
    ('Scolarité · 1re tranche', (case n.cycle when 'elementaire' then 180000 when 'moyen' then 225000 else 270000 end) / 3, 0.55)
  ) as x(libelle, montant, part)
  where i.annee_id = a2 and public._demo_alea(i.eleve_id::text || 'paye' || x.libelle) < x.part;

  -- ─── Admissions pour la rentrée 2026-2027 ────────────────────────────────
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
    ('TLE', 'S2', 'Moustapha', 'Kane', 'M', '2008-08-08', 'Kaolack', 'Lycée Valdiodio Ndiaye', 8.9, 'Fatou Kane', '77 903 15 26', 'refusee', '2026-09-18', 7.0, 'Niveau insuffisant en sciences')
  ) as v(niv, ser, prenom, nom, sexe, naissance, lieu, origine, moy, tuteur, tel, statut, test, note, comm);

  -- ─── Compte parent de démonstration (deux enfants) ───────────────────────
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

  -- ─── Annonces (notifient le personnel et les familles concernés) ─────────
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

  -- ─── Documents émis (numérotés, vérifiables par QR code) ─────────────────
  -- Le contenu est l'instantané imprimé (identité, classe, année…), comme à
  -- l'émission depuis l'application (app/(dashboard)/attestations/actions.ts).
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
    -- Exeat de l'élève parti en cours d'année
    select el.id as eleve_id, a1 as annee_id, 'exeat' as type, 'EX' as prefixe, timestamptz '2026-04-13 11:00' as emis_le
    from _el el where el.cas = 'depart'
    union all
    -- Attestations de réussite des bacheliers
    select i.eleve_id, a1, 'attestation_reussite', 'AR', timestamptz '2026-07-27 10:00'
    from public.decisions d join public.inscriptions i on i.id = d.inscription_id join _cls cl on cl.id = i.classe_id
    where i.annee_id = a1 and cl.cle = 'TS2' and d.decision_finale = 'admis'
    union all
    -- Certificats de scolarité de rentrée
    (select i.eleve_id, a2, 'certificat_scolarite', 'CS', timestamptz '2026-09-28 09:30'
     from public.inscriptions i where i.annee_id = a2 order by i.eleve_id limit 3)
    union all
    -- Cartes d'identité scolaires de la 3e A
    select i.eleve_id, a2, 'carte_scolaire', 'CI', timestamptz '2026-09-28 11:00'
    from public.inscriptions i join _cls cl on cl.id = i.classe_id
    where i.annee_id = a2 and cl.cle = '3A'
  ) x
  join public.eleves el on el.id = x.eleve_id
  join public.inscriptions i on i.eleve_id = x.eleve_id and i.annee_id = x.annee_id
  join public.classes cl on cl.id = i.classe_id
  join public.annees_scolaires an on an.id = x.annee_id
  left join public.decisions d on d.inscription_id = i.id;

  -- ─── Billets de la surveillance (numéro attribué par trigger) ────────────
  -- Année écoulée : quelques billets datés ; année en cours : la main courante
  -- du jour, pour que la page Billets ne soit pas vide à l'ouverture.
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

revoke execute on function public.creer_demo(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public._demo_creer_eleve(uuid, integer, text, integer, date) from public, anon, authenticated;
