'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { btnPrimary, btnSecondary, hintClass, inputClass, labelClass } from '@/components/ui/styles'
import { creerDemo } from './actions'

export default function CreerDemoButton() {
  const router = useRouter()
  const [ouvert, setOuvert] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()

  const soumettre = (formData: FormData) => {
    setMessage(null)
    const v = (n: string) => (formData.get(n) as string | null) ?? ''
    startTransition(async () => {
      const res = await creerDemo(v('direction'), v('enseignant'), v('parent'), v('dg'), v('password'))
      if (res.error) setMessage(res.error)
      else {
        toast.success('Établissement de démonstration créé')
        setOuvert(false)
        router.refresh()
      }
    })
  }

  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className={btnSecondary}>
        <Sparkles className="h-4 w-4 text-secondary" /> Créer la démo
      </button>
      <Modal
        open={ouvert}
        onClose={() => setOuvert(false)}
        title="Établissement de démonstration"
        closeLabel="Fermer"
        footer={
          <>
            <button type="button" onClick={() => setOuvert(false)} className={btnSecondary}>Annuler</button>
            <button type="submit" form="form-demo" disabled={enCours} className={btnPrimary}>{enCours ? 'Génération… (quelques secondes)' : 'Générer'}</button>
          </>
        }
      >
        <form id="form-demo" action={soumettre} className="space-y-4">
          <p className="text-sm text-foreground-muted">
            Crée « Groupe scolaire Les Palmiers (démo) » : année 2025-2026 complète (notes, absences, passages, redoublements, repêchages,
            examens) et rentrée 2026-2027 (classes, emplois du temps), avec un accès offert d&apos;un an.
          </p>
          {message && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{message}</p>}
          <div>
            <label className={labelClass} htmlFor="demo-direction">Compte direction (Mme Awa Ndoye)</label>
            <input id="demo-direction" name="direction" type="email" required autoComplete="off" defaultValue="demo.direction@dembasolution.com" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="demo-enseignant">Compte enseignant (M. Ibrahima Ndiaye, Maths + PC)</label>
            <input id="demo-enseignant" name="enseignant" type="email" required autoComplete="off" defaultValue="demo.ndiaye@dembasolution.com" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="demo-parent">Compte parent (Mme Mariama Diagne, deux enfants)</label>
            <input id="demo-parent" name="parent" type="email" required autoComplete="off" defaultValue="demo.parent@dembasolution.com" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="demo-dg">Compte directeur général (M. Cheikh Diop, groupe de 3 sites)</label>
            <input id="demo-dg" name="dg" type="email" required autoComplete="off" defaultValue="demo.dg@dembasolution.com" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="demo-password">Mot de passe des quatre comptes</label>
            <input id="demo-password" name="password" type="text" required minLength={8} autoComplete="new-password" className={inputClass} />
            <p className={hintClass}>Au moins 8 caractères.</p>
          </div>
        </form>
      </Modal>
    </>
  )
}
