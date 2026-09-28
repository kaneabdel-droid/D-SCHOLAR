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
