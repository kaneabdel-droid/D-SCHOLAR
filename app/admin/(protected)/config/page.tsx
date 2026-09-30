import { createAdminClient } from '@/utils/supabase/admin'
import ChariowProduitsEditor from './ChariowProduitsEditor'

export default async function AdminConfigPage() {
  const supabase = createAdminClient()
  const { data } = await supabase.from('chariow_produits').select('palier, pourcentage, product_id').eq('pourcentage', 100)

  return (
    <div>
      <h1 className="mb-2 font-heading text-2xl font-bold text-foreground">Configuration</h1>
      <p className="mb-6 text-sm text-foreground-muted">
        Provider actif : <strong>{process.env.PAYMENT_PROVIDER_ACTIF === 'moneroo' ? 'Moneroo' : 'Chariow'}</strong> (variable PAYMENT_PROVIDER_ACTIF).
      </p>
      <section className="rounded-2xl border border-surface-border bg-surface p-5">
        <h2 className="font-heading text-lg font-semibold">Produits Chariow</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Abonnement mensuel : chaque paiement couvre un mois, au prix du produit Chariow du palier (prix exact indiqué). Un champ vide utilise la variable d&apos;environnement indiquée (CHARIOW_PRODUCT_Scholar_Elem / _MS / _FULL, dans .env.local et sur Vercel).
        </p>
        <ChariowProduitsEditor produits={data ?? []} />
      </section>
    </div>
  )
}
