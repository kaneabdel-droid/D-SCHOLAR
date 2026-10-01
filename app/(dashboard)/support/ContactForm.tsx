'use client'

import { useState, useTransition } from 'react'
import { Send, CheckCircle2 } from 'lucide-react'
import type { Dictionary } from '@/dictionaries'
import { envoyerMessageSupport } from './actions'

const champ =
  'block w-full rounded-md border-0 bg-background px-3 py-2 text-sm text-foreground shadow-sm ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-inset focus:ring-primary disabled:opacity-50'

export default function ContactForm({ t }: { t: Dictionary['supportPage'] }) {
  const [isPending, startTransition] = useTransition()
  const [envoye, setEnvoye] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const result = await envoyerMessageSupport(formData)
      if (result.error) {
        setError(result.error)
      } else {
        form.reset()
        setEnvoye(true)
      }
    })
  }

  if (envoye) {
    return (
      <div className="rounded-md border border-success/20 bg-success/10 p-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-success" />
        <h3 className="text-lg font-medium text-success">{t.sentTitle}</h3>
        <p className="mt-2 text-sm text-foreground-muted">{t.sentDesc}</p>
        <button
          type="button"
          onClick={() => setEnvoye(false)}
          className="mt-4 text-sm font-medium text-primary hover:text-primary-hover"
        >
          {t.sendAnother}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-md border border-danger/20 bg-danger/10 p-4">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="sujet" className="block text-sm font-medium text-foreground">
          {t.subject}
        </label>
        <input
          type="text"
          id="sujet"
          name="sujet"
          required
          maxLength={200}
          disabled={isPending}
          placeholder={t.subjectPlaceholder}
          className={`mt-2 ${champ}`}
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-foreground">
          {t.message}
        </label>
        <textarea
          id="message"
          name="message"
          rows={6}
          required
          maxLength={5000}
          disabled={isPending}
          placeholder={t.messagePlaceholder}
          className={`mt-2 ${champ}`}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {isPending ? t.sending : (
            <>
              <Send className="h-4 w-4 rtl:-scale-x-100" />
              {t.send}
            </>
          )}
        </button>
      </div>
    </form>
  )
}
