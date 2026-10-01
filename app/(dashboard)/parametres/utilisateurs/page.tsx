import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { getDictionary, getLocale } from '@/dictionaries'
import { PALIERS } from '@/lib/abonnements/paliers'
import { postesSuggeres } from '@/lib/roles'
import UtilisateursClient, { type Utilisateur } from './UtilisateursClient'

export default async function UtilisateursPage() {
  const context = await getCurrentUserContext()
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())

  // Le RLS (select_utilisateurs) limite déjà aux collègues de l'établissement.
  const { data } = await supabase
    .from('utilisateurs')
    .select('*') // inclut poste (migration 15) sans échouer avant son application
    .order('nom')

  // Postes proposés : ceux des cycles de l'abonnement, puis ceux déjà utilisés
  // dans l'établissement (intitulés créés librement, ex. pour d'autres pays).
  const suggestions = [...new Set([
    ...postesSuggeres(PALIERS[context.palier].cyclesAutorises, dict.postes),
    ...(data ?? []).map((u) => u.poste?.trim()).filter((p): p is string => Boolean(p)),
  ])]

  return (
    <UtilisateursClient
      utilisateurs={(data ?? []) as Utilisateur[]}
      moi={context.userId}
      estDirection={context.role === 'direction'}
      suggestions={suggestions}
      dict={dict}
    />
  )
}
