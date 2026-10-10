-- Module Ressources Humaines / Salaires

-- 1. Ajout d'informations salariales à la table enseignants existante
alter table public.enseignants add column salaire_de_base integer;
alter table public.enseignants add column taux_horaire integer;

-- 2. Table pour tracer les paiements de salaires / vacations
create table public.paiements_salaires (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  annee_id uuid references public.annees_scolaires(id) on delete cascade not null,
  enseignant_id uuid references public.enseignants(id) on delete cascade not null,
  mois_concerne varchar(20) not null, -- ex: "Octobre 2026"
  montant integer not null check (montant > 0),
  mode_paiement varchar(20) not null default 'virement' check (mode_paiement in ('especes', 'mobile_money', 'virement', 'cheque', 'autre')),
  date_paiement date not null default current_date,
  reference varchar(100),
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);

create index idx_paiements_salaires_etablissement on public.paiements_salaires(etablissement_id);
create index idx_paiements_salaires_enseignant on public.paiements_salaires(enseignant_id);

-- 3. Trigger pour alimenter la trésorerie automatiquement (en dépense)
create or replace function public.generer_mouvement_tresorerie_salaire() returns trigger
language plpgsql security definer as $$
declare
  v_compte_id uuid;
  v_nom_enseignant text;
  v_prenom_enseignant text;
begin
  -- On cherche le compte de caisse ou banque
  if new.mode_paiement = 'especes' then
    select id into v_compte_id from public.comptes_tresorerie 
    where etablissement_id = new.etablissement_id and type = 'caisse' 
    order by created_at asc limit 1;
  else
    select id into v_compte_id from public.comptes_tresorerie 
    where etablissement_id = new.etablissement_id and type = 'banque' 
    order by created_at asc limit 1;
  end if;

  -- Si on n'a pas trouvé, on prend le premier compte existant
  if v_compte_id is null then
    select id into v_compte_id from public.comptes_tresorerie 
    where etablissement_id = new.etablissement_id
    order by created_at asc limit 1;
  end if;

  -- Récupérer le nom de l'enseignant pour le libellé
  select nom, prenom into v_nom_enseignant, v_prenom_enseignant 
  from public.enseignants where id = new.enseignant_id;

  -- Si un compte existe, on crée le mouvement de DEPENSE
  if v_compte_id is not null then
    insert into public.mouvements_tresorerie (
      etablissement_id, annee_id, compte_id, type_mouvement, montant, 
      date_mouvement, libelle, reference_piece, created_by
    ) values (
      new.etablissement_id, new.annee_id, v_compte_id, 'depense', new.montant,
      new.date_paiement, 'Salaire/Vacation ' || v_prenom_enseignant || ' ' || v_nom_enseignant || ' - ' || new.mois_concerne, new.reference, coalesce(new.created_by, auth.uid())
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_paiement_salaire_tresorerie on public.paiements_salaires;
create trigger trg_paiement_salaire_tresorerie
after insert on public.paiements_salaires
for each row execute function public.generer_mouvement_tresorerie_salaire();

-- 4. RLS Policies
alter table public.paiements_salaires enable row level security;

drop policy if exists "Lecture des salaires par direction/intendant" on public.paiements_salaires;
create policy "Lecture des salaires par direction/intendant" on public.paiements_salaires
for select using (
  etablissement_id = public.current_etablissement_id() 
  and public.current_role() in ('direction', 'intendant', 'secretariat')
);

drop policy if exists "Modif des salaires par direction/intendant" on public.paiements_salaires;
create policy "Modif des salaires par direction/intendant" on public.paiements_salaires
for all using (
  etablissement_id = public.current_etablissement_id() 
  and public.current_role() in ('direction', 'intendant', 'secretariat')
);
