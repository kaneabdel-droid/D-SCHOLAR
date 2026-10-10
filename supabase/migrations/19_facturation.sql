-- Module Facturation pour D-Scholar

-- 1. Table factures_eleves
create table public.factures_eleves (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  annee_id uuid references public.annees_scolaires(id) on delete cascade not null,
  eleve_id uuid references public.eleves(id) on delete cascade not null,
  motif varchar(150) not null, -- ex: "Scolarité Octobre", "Inscription", "Cantine"
  montant integer not null check (montant > 0),
  date_echeance date not null,
  statut varchar(20) not null default 'en_attente' check (statut in ('en_attente', 'partiel', 'paye')),
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);

create index idx_factures_eleves_etablissement on public.factures_eleves(etablissement_id);
create index idx_factures_eleves_eleve on public.factures_eleves(eleve_id, annee_id);

-- 2. Modification de paiements_eleves (déjà existant) pour lier à une facture
alter table public.paiements_eleves
add column facture_id uuid references public.factures_eleves(id) on delete set null;

-- 3. Fonction et Trigger pour mettre à jour le statut de la facture
create or replace function public.maj_statut_facture() returns trigger
language plpgsql security definer as $$
declare
  v_total_paye integer;
  v_montant_facture integer;
begin
  if new.facture_id is not null then
    -- Récupérer le montant de la facture
    select montant into v_montant_facture from public.factures_eleves where id = new.facture_id;
    
    -- Calculer le total payé pour cette facture
    select coalesce(sum(montant), 0) into v_total_paye from public.paiements_eleves where facture_id = new.facture_id;
    
    -- Mettre à jour le statut
    if v_total_paye >= v_montant_facture then
      update public.factures_eleves set statut = 'paye' where id = new.facture_id;
    elsif v_total_paye > 0 then
      update public.factures_eleves set statut = 'partiel' where id = new.facture_id;
    else
      update public.factures_eleves set statut = 'en_attente' where id = new.facture_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_paiement_maj_facture
after insert or update of montant, facture_id on public.paiements_eleves
for each row execute function public.maj_statut_facture();

create trigger trg_paiement_maj_facture_delete
after delete on public.paiements_eleves
for each row execute function public.maj_statut_facture(); -- Note: in a delete trigger, we should handle OLD.facture_id, so let's adjust the function.

-- Correction de la fonction pour gérer INSERT/UPDATE/DELETE
create or replace function public.maj_statut_facture() returns trigger
language plpgsql security definer as $$
declare
  v_facture_id uuid;
  v_total_paye integer;
  v_montant_facture integer;
begin
  if TG_OP = 'DELETE' then
    v_facture_id := old.facture_id;
  else
    v_facture_id := new.facture_id;
  end if;

  if v_facture_id is not null then
    select montant into v_montant_facture from public.factures_eleves where id = v_facture_id;
    select coalesce(sum(montant), 0) into v_total_paye from public.paiements_eleves where facture_id = v_facture_id;
    
    if v_total_paye >= v_montant_facture then
      update public.factures_eleves set statut = 'paye' where id = v_facture_id;
    elsif v_total_paye > 0 then
      update public.factures_eleves set statut = 'partiel' where id = v_facture_id;
    else
      update public.factures_eleves set statut = 'en_attente' where id = v_facture_id;
    end if;
  end if;

  if TG_OP = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

-- 4. Fonction et Trigger pour alimenter la trésorerie automatiquement (Optionnel mais demandé)
create or replace function public.generer_mouvement_tresorerie_paiement() returns trigger
language plpgsql security definer as $$
declare
  v_compte_caisse_id uuid;
begin
  -- On cherche le compte de caisse principal de l'établissement
  select id into v_compte_caisse_id from public.comptes_tresorerie 
  where etablissement_id = new.etablissement_id and type = 'caisse' 
  order by created_at asc limit 1;

  -- Si un compte caisse existe, on crée le mouvement
  if v_compte_caisse_id is not null then
    insert into public.mouvements_tresorerie (
      etablissement_id, annee_id, compte_id, type_mouvement, montant, 
      date_mouvement, libelle, reference_piece, paiement_eleve_id, created_by
    ) values (
      new.etablissement_id, new.annee_id, v_compte_caisse_id, 'recette', new.montant,
      new.date_paiement, new.libelle, coalesce(new.numero_recu, new.reference), new.id, coalesce(new.created_by, auth.uid())
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_paiement_tresorerie on public.paiements_eleves;
create trigger trg_paiement_tresorerie
after insert on public.paiements_eleves
for each row execute function public.generer_mouvement_tresorerie_paiement();

-- 5. RLS Policies
alter table public.factures_eleves enable row level security;

drop policy if exists "Lecture des factures par le personnel" on public.factures_eleves;
create policy "Lecture des factures par le personnel" on public.factures_eleves
for select using (etablissement_id = public.current_etablissement_id());

drop policy if exists "Modif des factures par direction/intendant" on public.factures_eleves;
create policy "Modif des factures par direction/intendant" on public.factures_eleves
for all using (
  etablissement_id = public.current_etablissement_id() 
  and public.current_role() in ('direction', 'intendant', 'secretariat')
);
