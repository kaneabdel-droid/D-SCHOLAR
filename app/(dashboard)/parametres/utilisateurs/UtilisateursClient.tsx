'use client'

import { useState, useTransition } from 'react'
import { Plus, UserCheck, UserX } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { btnPrimary, btnSecondary, cardClass, hintClass, inputClass, labelClass } from '@/components/ui/styles'
import type { Dictionary } from '@/dictionaries'
import { fmt } from '@/lib/i18n'
import { ROLES, type Role } from '@/lib/roles'
import { changerRole, changerStatut, creerUtilisateur } from './actions'

export type Utilisateur = {
  id: string
  nom: string | null
  prenom: string | null
  email: string | null
  telephone: string | null
  role: Role
  actif: boolean
}

function nomComplet(u: Utilisateur) {
  return [u.prenom, u.nom].filter(Boolean).join(' ') || u.email || '—'
}

export default function UtilisateursClient({
  utilisateurs,
  moi,
  estDirection,
  dict,
}: {
  utilisateurs: Utilisateur[]
  moi: string
  estDirection: boolean
  dict: Dictionary
}) {
  const t = dict.utilisateurs
  const c = dict.common
  const [ouvert, setOuvert] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, startTransition] = useTransition()

  const soumettre = (formData: FormData) => {
    setErreur(null)
    startTransition(async () => {
      const res = await creerUtilisateur(formData)
      if (res.error) setErreur(res.error)
      else {
        toast.success(c.created)
        setOuvert(false)
      }
    })
  }

  const role = (u: Utilisateur, nouveau: Role) =>
    startTransition(async () => {
      const res = await changerRole(u.id, nouveau)
      if (res.error) toast.error(res.error)
      else toast.success(t.roleSaved)
    })

  const statut = (u: Utilisateur) => {
    if (u.actif && !confirm(fmt(t.confirmDesactiver, { nom: nomComplet(u) }))) return
    startTransition(async () => {
      const res = await changerStatut(u.id, !u.actif)
      if (res.error) toast.error(res.error)
      else toast.success(u.actif ? t.deactivated : t.reactivated)
    })
  }

  return (
    <section className={cardClass}>
      <div className="flex flex-col gap-3 border-b border-surface-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-base font-semibold text-foreground">{t.title}</h2>
          <p className="mt-0.5 text-sm text-foreground-muted">{estDirection ? t.desc : t.directionOnly}</p>
        </div>
        {estDirection && (
          <button type="button" onClick={() => setOuvert(true)} className={`${btnPrimary} shrink-0`}>
            <Plus className="h-4 w-4" /> {t.newButton}
          </button>
        )}
      </div>

      {utilisateurs.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-foreground-muted">{t.empty}</p>
      ) : (
        <ul className="divide-y divide-surface-border">
          {utilisateurs.map((u) => {
            const estMoi = u.id === moi
            return (
              <li key={u.id} className={`flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center ${u.actif ? '' : 'opacity-60'}`}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                    {(u.prenom?.[0] ?? '') + (u.nom?.[0] ?? '') || '?'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {nomComplet(u)}
                      {estMoi && <span className="ms-2 text-xs font-normal text-foreground-muted">({t.you})</span>}
                    </p>
                    <p className="truncate text-xs text-foreground-muted">{[u.email, u.telephone].filter(Boolean).join(' · ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:shrink-0">
                  {estDirection && !estMoi ? (
                    <select
                      value={u.role}
                      onChange={(e) => role(u, e.target.value as Role)}
                      disabled={enCours}
                      aria-label={t.role}
                      className={`${inputClass} mt-0 w-full py-1.5 sm:w-56`}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{dict.roles[r]}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="rounded-full bg-background px-3 py-1 text-xs font-medium text-foreground">{dict.roles[u.role]}</span>
                  )}
                  {estDirection && !estMoi && (
                    <button
                      type="button"
                      onClick={() => statut(u)}
                      disabled={enCours}
                      className={`${btnSecondary} shrink-0 py-1.5 ${u.actif ? 'hover:text-danger' : 'hover:text-success'}`}
                      title={u.actif ? t.desactiver : t.reactiver}
                    >
                      {u.actif ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      <span className="hidden md:inline">{u.actif ? t.desactiver : t.reactiver}</span>
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Modal
        open={ouvert}
        onClose={() => setOuvert(false)}
        title={t.newTitle}
        closeLabel={c.close}
        footer={
          <>
            <button type="button" onClick={() => setOuvert(false)} className={btnSecondary}>{c.cancel}</button>
            <button type="submit" form="form-utilisateur" disabled={enCours} className={btnPrimary}>{enCours ? c.creating : c.create}</button>
          </>
        }
      >
        <form id="form-utilisateur" action={soumettre} className="space-y-4">
          {erreur && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erreur}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="u-prenom" className={labelClass}>{t.prenom}</label>
              <input id="u-prenom" name="prenom" className={inputClass} />
            </div>
            <div>
              <label htmlFor="u-nom" className={labelClass}>{t.nom}</label>
              <input id="u-nom" name="nom" required className={inputClass} />
            </div>
          </div>
          <div>
            <label htmlFor="u-email" className={labelClass}>{t.email}</label>
            <input id="u-email" name="email" type="email" required autoComplete="off" className={inputClass} />
          </div>
          <div>
            <label htmlFor="u-tel" className={labelClass}>{t.telephone} <span className="font-normal text-foreground-muted">({c.optional})</span></label>
            <input id="u-tel" name="telephone" type="tel" className={inputClass} />
          </div>
          <div>
            <label htmlFor="u-role" className={labelClass}>{t.role}</label>
            <select id="u-role" name="role" required defaultValue="enseignant" className={inputClass}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{dict.roles[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="u-password" className={labelClass}>{t.password}</label>
            <input id="u-password" name="password" type="text" required minLength={8} autoComplete="new-password" className={inputClass} />
            <p className={hintClass}>{t.passwordHint}</p>
          </div>
        </form>
      </Modal>
    </section>
  )
}
