import { getDictionary, getLocale } from '@/dictionaries'
import { createClient } from '@/utils/supabase/server'
import { PieChart } from 'lucide-react'
import ExportTresorerieButton from './ExportTresorerieButton'
import { requireParametrage } from '@/lib/auth/getCurrentUserContext'

export default async function BilanPage() {
  await requireParametrage()
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())

  const [
    { data: bilanData },
    { data: mouvements }
  ] = await Promise.all([
    supabase.from('vue_resultat_tresorerie').select('*').single(),
    supabase.from('mouvements_tresorerie').select('*, comptes_tresorerie(nom)').order('date_mouvement', { ascending: false }).limit(50)
  ])

  const recettes = bilanData?.total_recettes || 0
  const depenses = bilanData?.total_depenses || 0
  const resultat = bilanData?.resultat_net || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{dict.tresorerie.bilan.title}</h2>
        <ExportTresorerieButton 
          bilan={{ recettes, depenses, resultat }} 
          mouvements={mouvements || []} 
          dict={dict} 
        />
      </div>
      
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-surface-border bg-surface p-4 shadow-sm">
          <p className="text-sm font-medium text-foreground-muted">{dict.tresorerie.bilan.recettes}</p>
          <p className="mt-2 text-3xl font-bold text-success">{recettes.toLocaleString('fr-FR')} FCFA</p>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface p-4 shadow-sm">
          <p className="text-sm font-medium text-foreground-muted">{dict.tresorerie.bilan.depenses}</p>
          <p className="mt-2 text-3xl font-bold text-danger">{depenses.toLocaleString('fr-FR')} FCFA</p>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface p-4 shadow-sm">
          <p className="text-sm font-medium text-foreground-muted">{dict.tresorerie.bilan.resultat}</p>
          <p className={`mt-2 text-3xl font-bold ${resultat >= 0 ? 'text-success' : 'text-danger'}`}>{resultat.toLocaleString('fr-FR')} FCFA</p>
        </div>
      </div>
      
      <div className="rounded-xl border border-surface-border bg-surface p-8 text-center text-foreground-muted">
        <PieChart className="mx-auto h-12 w-12 opacity-20" />
        <p className="mt-4 text-sm">Les graphiques de rentabilité et d'évolution apparaîtront ici prochainement.</p>
      </div>
    </div>
  )
}
