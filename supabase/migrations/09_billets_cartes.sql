-- ═════════════════════════════════════════════════════════════════════════════
-- 09 · Billets de la surveillance et carte d'identité scolaire
-- À exécuter après 08_modules.sql (puis relancer 07_demo.sql).
-- ═════════════════════════════════════════════════════════════════════════════

-- ═══ 1. Billets (entrée, sortie, visite médicale, retard) ═══════════════════
-- Autorisations délivrées par la surveillance, numérotées (BE/BS/BV/BR-AAAA-0001)
-- et imprimées en deux volets (élève / souche de la surveillance).
create table if not exists public.billets (
  id uuid default gen_random_uuid() primary key,
  etablissement_id uuid references public.etablissements(id) on delete cascade not null,
  eleve_id uuid references public.eleves(id) on delete cascade not null,
  annee_id uuid references public.annees_scolaires(id) on delete cascade not null,
  type varchar(20) not null check (type in ('entree', 'sortie', 'visite_medicale', 'retard')),
  numero varchar(30),
  emis_le timestamptz not null default now(),
  motif text,
  -- Sortie : personne qui accompagne ; visite : lieu (infirmerie, centre de santé).
  details varchar(200),
  -- Retard : minutes de retard ; sortie / visite : heure de retour prévue.
  minutes_retard smallint check (minutes_retard is null or minutes_retard > 0),
  heure_retour time,
  absence_id uuid references public.absences(id) on delete set null,
  emis_par uuid default auth.uid(),
  constraint billet_numero_unique unique (etablissement_id, numero)
);
create index if not exists idx_billets_eleve on public.billets(eleve_id, emis_le desc);
create index if not exists idx_billets_etab on public.billets(etablissement_id, emis_le desc);

create or replace function public.attribuer_numero_billet() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_prefixe text := case new.type when 'entree' then 'BE' when 'sortie' then 'BS' when 'visite_medicale' then 'BV' else 'BR' end;
begin
  new.numero := v_prefixe || '-' || to_char(now(), 'YYYY') || '-'
    || lpad(public.prochain_numero(new.etablissement_id, 'billet-' || v_prefixe || '-' || to_char(now(), 'YYYY'))::text, 4, '0');
  return new;
end;
$$;
drop trigger if exists trg_billets_numero on public.billets;
create trigger trg_billets_numero before insert on public.billets
  for each row execute function public.attribuer_numero_billet();

-- Les familles sont prévenues d'une sortie, d'une visite médicale ou d'une
-- entrée (le retard l'est déjà par l'absence de type « retard » enregistrée).
create or replace function public.notifier_billet() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type <> 'retard' then
    insert into public.notifications (user_id, type, params, lien)
    select c, 'billet',
      jsonb_build_object('billet', new.type, 'eleve', (select prenom from public.eleves where id = new.eleve_id),
                         'heure', to_char(new.emis_le at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
      '/portail/' || new.eleve_id || '?vue=assiduite'
    from public.comptes_de_l_eleve(new.eleve_id) c;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_billets_notification on public.billets;
create trigger trg_billets_notification after insert on public.billets
  for each row execute function public.notifier_billet();

alter table public.billets enable row level security;
drop policy if exists select_billets on public.billets;
drop policy if exists insert_billets on public.billets;
drop policy if exists update_billets on public.billets;
drop policy if exists delete_billets on public.billets;
drop policy if exists famille_billets on public.billets;
create policy select_billets on public.billets for select using (etablissement_id = public.current_etablissement_id());
create policy insert_billets on public.billets for insert with check (
  etablissement_id = public.current_etablissement_id() and public.peut_ecrire(array['direction', 'censeur', 'surveillant']));
create policy update_billets on public.billets for update using (
  etablissement_id = public.current_etablissement_id() and public.peut_ecrire(array['direction', 'censeur', 'surveillant']))
  with check (etablissement_id = public.current_etablissement_id());
create policy delete_billets on public.billets for delete using (
  etablissement_id = public.current_etablissement_id() and public.peut_ecrire(array['direction', 'censeur', 'surveillant']));
create policy famille_billets on public.billets for select using (eleve_id in (select public.mes_eleves()));

-- ═══ 2. Carte d'identité scolaire ════════════════════════════════════════════
-- Document émis comme les attestations (numéro CI-AAAA-0001, QR de vérification).
alter table public.documents_emis drop constraint if exists documents_emis_type_check;
alter table public.documents_emis add constraint documents_emis_type_check check (type in (
  'certificat_scolarite', 'attestation_inscription', 'certificat_frequentation',
  'attestation_reussite', 'exeat', 'releve_notes', 'bulletin', 'carte_scolaire'));

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
    when 'attestation_reussite' then 'AR' when 'exeat' then 'EX' when 'releve_notes' then 'RN'
    when 'carte_scolaire' then 'CI' else 'BU' end;
  insert into public.documents_emis (etablissement_id, eleve_id, annee_id, type, numero, contenu)
  values (v_etab, p_eleve_id, p_annee_id, p_type,
          v_prefixe || '-' || to_char(now(), 'YYYY') || '-' || lpad(public.prochain_numero(v_etab, 'doc-' || v_prefixe || '-' || to_char(now(), 'YYYY'))::text, 4, '0'),
          coalesce(p_contenu, '{}'))
  returning * into v_doc;
  return v_doc;
end;
$$;

-- ═══ 3. Abonnements : deux paiements au plus par formule ═════════════════════
-- Comptant (100 %) ou deux tranches (50 % + 50 %). Les anciennes contraintes
-- (05_abonnements.sql) acceptaient aussi 3 tranches (50 / 25 / 25) ; NOT VALID :
-- les lignes déjà enregistrées ne sont pas revérifiées, seules les nouvelles.
alter table public.souscriptions drop constraint if exists souscriptions_plan_check;
alter table public.souscriptions add constraint souscriptions_plan_check
  check (plan in ('comptant', 'deux_tranches')) not valid;
alter table public.echeances_abonnement drop constraint if exists echeances_abonnement_pourcentage_check;
alter table public.echeances_abonnement add constraint echeances_abonnement_pourcentage_check
  check (pourcentage in (50, 100)) not valid;
-- Produits Chariow : un par formule × part (100 %, 50 %), soit 6 au total.
delete from public.chariow_produits where pourcentage not in (50, 100);
alter table public.chariow_produits drop constraint if exists chariow_produits_pourcentage_check;
alter table public.chariow_produits add constraint chariow_produits_pourcentage_check check (pourcentage in (50, 100));
