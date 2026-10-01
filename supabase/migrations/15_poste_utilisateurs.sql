-- Intitulé de poste du personnel, affiché à la place du libellé du rôle.
-- Le rôle (utilisateurs.role) reste seul à porter les droits (RLS, lib/roles.ts) ;
-- le poste n'est qu'un libellé libre, propre au pays et au cycle : pour le rôle
-- « censeur », Directeur à l'élémentaire, Censeur au collège, Proviseur au lycée,
-- et tout autre intitulé utilisé ailleurs (Principal, Préfet des études…).
alter table public.utilisateurs
  add column if not exists poste varchar(100);
