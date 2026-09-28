import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { getDictionary, getLocale } from '@/dictionaries'
import UtilisateursClient, { type Utilisateur } from './UtilisateursClient'

export default async function UtilisateursPage() {
  const context = await getCurrentUserContext()
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())

  // Le RLS (select_utilisateurs) limite déjà aux collègues de l'établissement.
  const { data } = await supabase
    .from('utilisateurs')
    .select('id, nom, prenom, email, telephone, role, actif')
    .order('nom')

  return (
    <UtilisateursClient
      utilisateurs={(data ?? []) as Utilisateur[]}
      moi={context.userId}
      estDirection={context.role === 'direction'}
      dict={dict}
    />
  )
}
