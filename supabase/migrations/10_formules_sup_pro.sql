-- Ajout des formules et cycles "superieur" et "professionnel"

-- 1. Mise à jour de la contrainte sur le cycle des niveaux
alter table public.niveaux drop constraint if exists niveaux_cycle_check;
alter table public.niveaux add constraint niveaux_cycle_check
  check (cycle in ('prescolaire', 'elementaire', 'moyen', 'secondaire', 'superieur', 'professionnel'));

-- 2. Mise à jour de la contrainte sur le palier de l'établissement
alter table public.etablissements drop constraint if exists etablissements_palier_check;
alter table public.etablissements add constraint etablissements_palier_check
  check (palier in ('elementaire', 'secondaire', 'complet', 'superieur'));

-- 3. Mise à jour de la fonction public.cycles_du_palier
create or replace function public.cycles_du_palier(p_palier text) returns text[]
language sql immutable as $$
  select case p_palier
    when 'elementaire' then array['prescolaire', 'elementaire']
    when 'secondaire' then array['moyen', 'secondaire', 'professionnel']
    when 'complet' then array['prescolaire', 'elementaire', 'moyen', 'secondaire']
    when 'superieur' then array['superieur']
    else array[]::text[]
  end
$$;

-- 4. Mise à jour de la fonction creer_annee_scolaire
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
     or exists (select 1 from jsonb_each_text(coalesce(p_decoupage_cycles, '{}')) 
                where value not in ('trimestre', 'semestre')
                or key not in ('prescolaire', 'elementaire', 'moyen', 'secondaire', 'superieur', 'professionnel')) then
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

-- 5. Mise à jour de la contrainte de frais_scolarite
alter table public.frais_scolarite drop constraint if exists frais_scolarite_cycle_check;
alter table public.frais_scolarite add constraint frais_scolarite_cycle_check
  check (cycle in ('prescolaire', 'elementaire', 'moyen', 'secondaire', 'superieur', 'professionnel'));

-- 6. Mise à jour du référentiel initial pour inclure les nouveaux niveaux
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
    ('secondaire', 'TLE', 'Terminale', 16, true),
    
    -- Nouveaux niveaux (Professionnel)
    ('professionnel', 'CAP', 'CAP', 17, true),
    ('professionnel', 'BEP', 'BEP', 18, true),
    ('professionnel', 'BT', 'BT', 19, true),
    ('professionnel', 'BTS', 'BTS', 20, true),
    
    -- Nouveaux niveaux (Supérieur)
    ('superieur', 'L1', 'Licence 1', 21, true),
    ('superieur', 'L2', 'Licence 2', 22, true),
    ('superieur', 'L3', 'Licence 3', 23, true),
    ('superieur', 'M1', 'Master 1', 24, true),
    ('superieur', 'M2', 'Master 2', 25, true)
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

  -- Matières communes, puis celles propres au primaire ou au secondaire/pro/sup
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
