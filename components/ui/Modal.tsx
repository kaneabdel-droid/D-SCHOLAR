'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

// Modale partagée : feuille qui monte du bas sur mobile, fenêtre centrée à
// partir de sm. Le contenu défile si la hauteur d'écran est faible.
export default function Modal({
  open,
  onClose,
  title,
  closeLabel,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  closeLabel: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'md' | 'lg'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`rise-in relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-surface-border bg-surface shadow-2xl sm:rounded-2xl ${
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md'
        }`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-surface-border px-5 py-4">
          <h3 className="font-heading text-lg font-semibold text-foreground">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-foreground-muted hover:bg-primary-soft hover:text-foreground" aria-label={closeLabel}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-surface-border bg-background/60 px-5 py-3 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>
  )
}
