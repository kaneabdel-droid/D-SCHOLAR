-- Ajout des cycles 'professionnel' et 'superieur' aux contraintes existantes

-- 1. Mettre à jour la contrainte sur la table niveaux
alter table public.niveaux drop constraint if exists niveaux_cycle_check;
alter table public.niveaux add constraint niveaux_cycle_check 
  check (cycle in ('prescolaire', 'elementaire', 'moyen', 'secondaire', 'professionnel', 'superieur'));

-- 2. Mettre à jour la fonction creer_annee_scolaire qui vérifie les clés json du découpage
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
                or key not in ('prescolaire', 'elementaire', 'moyen', 'secondaire', 'professionnel', 'superieur')) then
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
