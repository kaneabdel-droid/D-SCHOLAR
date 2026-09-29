'use client'

import { useState, useTransition } from 'react'
import { btnPrimary, hintClass, inputClass, labelClass } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import { activerCompte } from './actions'

export default function ActiverForm({ codeInitial, dict }: { codeInitial: string; dict: Dictionary }) {
  const t = dict.activation
  const [mode, setMode] = useState<'telephone' | 'email'>('telephone')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()
  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          setErreur(null)
          const r = await activerCompte(fd)
          if (r?.error) setErreur(r.error)
        })
      }
      className="space-y-4 text-start"
    >
      {erreur && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}
      <div>
        <label htmlFor="code" className={labelClass}>{t.code}</label>
        <input id="code" name="code" required defaultValue={codeInitial} dir="ltr" autoComplete="off" className={`${inputClass} font-mono uppercase tracking-widest`} />
        <p className={hintClass}>{t.aideCode}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor="prenom" className={labelClass}>{dict.eleves.form.prenom}</label><input id="prenom" name="prenom" autoComplete="given-name" className={inputClass} /></div>
        <div><label htmlFor="nom" className={labelClass}>{dict.eleves.form.nom}</label><input id="nom" name="nom" autoComplete="family-name" className={inputClass} /></div>
      </div>
      <div>
        <div className="flex gap-1 rounded-lg bg-background p-1 text-sm">
          {(['telephone', 'email'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`flex-1 rounded-md px-3 py-1.5 font-medium ${mode === m ? 'bg-surface text-foreground shadow-xs' : 'text-foreground-muted'}`}>
              {t.modes[m]}
            </button>
          ))}
        </div>
        {mode === 'telephone' ? (
          <input key="tel" name="telephone" type="tel" required dir="ltr" autoComplete="tel" placeholder="77 123 45 67" aria-label={t.modes.telephone} className={inputClass} />
        ) : (
          <input key="mail" name="email" type="email" required dir="ltr" autoComplete="email" aria-label={t.modes.email} className={inputClass} />
        )}
        <p className={hintClass}>{mode === 'telephone' ? t.aideTelephone : t.aideEmail}</p>
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>{t.motDePasse}</label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
        <p className={hintClass}>{t.aideMotDePasse}</p>
      </div>
      <button type="submit" disabled={enCours} className={`${btnPrimary} w-full`}>{enCours ? t.activation : t.activer}</button>
    </form>
  )
}
