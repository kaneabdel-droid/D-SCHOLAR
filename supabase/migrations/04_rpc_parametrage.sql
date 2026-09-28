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
