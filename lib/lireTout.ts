// PostgREST renvoie au plus 1 000 lignes par requête (réglage par défaut de
// Supabase) : les lectures qui peuvent dépasser (paiements, inscriptions,
// absences d'une grande école ou d'un groupe) passent par cette pagination.
type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>

export async function lireTout<T>(requete: (de: number, a: number) => Page<T>, taille = 1000): Promise<T[]> {
  const lignes: T[] = []
  for (let de = 0; ; de += taille) {
    const { data, error } = await requete(de, de + taille - 1)
    if (error || !data) break
    lignes.push(...data)
    if (data.length < taille) break
  }
  return lignes
}
