// Supabase-js classe ses propres échecs réseau transitoires sous des erreurs
// nommées "Retryable" (AuthRetryableFetchError côté auth, comportement analogue
// côté PostgREST) — un signal explicite de la librairie que ce type d'échec est
// censé être retenté, pas traité comme définitif. Rien dans le code applicatif
// ne le faisait, d'où des "fetch failed" occasionnels sur des appels par ailleurs
// sains (confirmé : aucune restriction réseau côté Supabase, appels identiques
// systématiquement réussis en dehors de l'environnement serverless de Vercel).
export async function withRetry<T>(fn: () => PromiseLike<T>, attempts = 3, delayMs = 300): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt))
      }
    }
  }
  throw lastError
}

// Variante pour un appel Supabase qui renvoie normalement { data, error } sans
// jamais lever d'exception (insert/update/delete/select, auth.admin.*) : un
// échec réseau qui, lui, lève une exception (le cas visé par withRetry) est
// ramené à la même forme { data: null, error } après épuisement des tentatives,
// avec un .message exploitable comme les erreurs Postgrest/Auth normales, pour
// que l'appelant garde un seul chemin à gérer (`if (error) return { error:
// error.message }`).
export async function withRetryResult<R extends { data: unknown; error: { message: string } | null }>(
  fn: () => PromiseLike<R>,
  attempts = 3,
  delayMs = 300
): Promise<R | { data: null; error: { message: string } }> {
  try {
    return await withRetry(fn, attempts, delayMs)
  } catch (error) {
    // Loggé ici (point central unique) plutôt que dans chaque appelant : sans ça,
    // un échec réseau qui épuise les tentatives est invisible dans les logs de
    // production pour la plupart des actions (elles renvoient juste { error }
    // sans jamais l'avoir loggé elles-mêmes).
    console.error('withRetryResult: échec après', attempts, 'tentative(s):', error)
    return { data: null, error: { message: error instanceof Error ? error.message : String(error) } }
  }
}
