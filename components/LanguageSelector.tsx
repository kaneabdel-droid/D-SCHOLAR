'use client'

import { useState, useTransition } from 'react'
import { setLanguage } from '@/app/actions/i18n'
import { Check, Globe } from 'lucide-react'

const LANGUAGES = [
  { code: 'fr', name: 'Français' },
  { code: 'en', name: 'English' },
  { code: 'ar', name: 'العربية' },
]

export default function LanguageSelector({ currentLang }: { currentLang: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSelect = (code: string) => {
    setIsOpen(false)
    if (code === currentLang) return

    startTransition(async () => {
      await setLanguage(code)
      window.location.reload()
    })
  }

  const currentLangObj = LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0]

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-2 rounded-md hover:bg-black/5 transition-colors text-foreground-muted hover:text-foreground"
        title="Français · English · العربية"
      >
        <Globe className="w-5 h-5" />
        <span className="text-sm font-medium hidden sm:inline-block uppercase">{currentLangObj.code}</span>
      </button>

      {isOpen && (
        <div className="absolute end-0 mt-2 w-48 bg-surface border border-surface-border rounded-lg shadow-xl z-50 py-1">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              disabled={isPending}
              className={`w-full text-start px-4 py-2 text-sm flex items-center justify-between hover:bg-black/5 transition-colors ${
                currentLang === lang.code ? 'text-primary font-bold' : 'text-foreground'
              }`}
            >
              {lang.name}
              {currentLang === lang.code && <Check className="w-4 h-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
