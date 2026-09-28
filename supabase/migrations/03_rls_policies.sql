-- Policies RLS du lot 1.
--
-- etablissements / utilisateurs : lecture seule pour `authenticated`. Aucune
-- policy d'écriture : la création d'établissements et de comptes passe par le
-- client service-role (console /admin, et Paramètres → Utilisateurs pour la
-- direction, rôle vérifié côté serveur). Les infos d'établissement modifiables
-- par la direction passent par la RPC modifier_infos_etablissement() (04), qui
-- ne touche jamais palier / statut / abonnement.

alter table public.etablissements enable row level security;
alter table public.utilisateurs enable row level security;

create policy "select_etablissements" on public.etablissements for select
  using (id = public.current_etablissement_id());

-- Tout le personnel voit ses collègues (listes d'enseignants, affectations...).
create policy "select_utilisateurs" on public.utilisateurs for select
  using (id = auth.uid() or etablissement_id = public.current_etablissement_id());

-- Référentiel : lecture par tout le personnel de l'établissement, écriture par
-- direction / censeur. Même gabarit pour chaque table.
do $$
declare
  t text;
  tables text[] := array[
    'annees_scolaires', 'periodes', 'series', 'options', 'matieres', 'coefficients', 'salles'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select using (etablissement_id = public.current_etablissement_id())',
      'select_' || t, t
    );
    execute format(
      'create policy %I on public.%I for insert with check (etablissement_id = public.current_etablissement_id() and public.can_manage_parametres())',
      'insert_' || t, t
    );
    execute format(
      'create policy %I on public.%I for update using (etablissement_id = public.current_etablissement_id() and public.can_manage_parametres()) with check (etablissement_id = public.current_etablissement_id() and public.can_manage_parametres())',
      'update_' || t, t
    );
    execute format(
      'create policy %I on public.%I for delete using (etablissement_id = public.current_etablissement_id() and public.can_manage_parametres())',
      'delete_' || t, t
    );
  end loop;
end $$;

-- Niveaux : même gabarit, plus la restriction par palier sur l'écriture — un
-- établissement au palier Élémentaire ne peut pas ouvrir un niveau du secondaire.
alter table public.niveaux enable row level security;

create policy "select_niveaux" on public.niveaux for select
  using (etablissement_id = public.current_etablissement_id());
create policy "insert_niveaux" on public.niveaux for insert
  with check (etablissement_id = public.current_etablissement_id() and public.can_manage_parametres() and public.cycle_autorise(cycle));
create policy "update_niveaux" on public.niveaux for update
  using (etablissement_id = public.current_etablissement_id() and public.can_manage_parametres())
  with check (etablissement_id = public.current_etablissement_id() and public.can_manage_parametres() and public.cycle_autorise(cycle));
create policy "delete_niveaux" on public.niveaux for delete
  using (etablissement_id = public.current_etablissement_id() and public.can_manage_parametres());
