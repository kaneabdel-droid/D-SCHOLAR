import Link from 'next/link'
import { BadgeCheck, CircleX, OctagonAlert } from 'lucide-react'
import LanguageSelector from '@/components/LanguageSelector'
import { createClient } from '@/utils/supabase/server'
import { intlLocale } from '@/lib/i18n'
import type { TypeDocument } from '@/lib/documents'
import { getDictionary, getLocale } from '@/dictionaries'

type Resultat = { type: string; numero: string; emis_le: string; annule: boolean; eleve: string; matricule: string; etablissement: string; annee: string | null }

// Page ouverte par le QR code d'un document : n'affiche que ce qui figure déjà
// sur le papier (rpc verifier_document, accessible sans session).
export default async function VerifierDocumentPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const t = dict.verification
  const supabase = await createClient()
  const { data } = await supabase.rpc('verifier_document', { p_code: decodeURIComponent(code).slice(0, 32) })
  const doc = ((data ?? []) as Resultat[])[0] ?? null
  const etat = !doc ? 'inconnu' : doc.annule ? 'annule' : 'valide'
  const style = {
    valide: { icone: BadgeCheck, teinte: 'bg-success/10 text-success', titre: t.valide },
    annule: { icone: OctagonAlert, teinte: 'bg-warning/10 text-warning', titre: t.annule },
    inconnu: { icone: CircleX, teinte: 'bg-danger/10 text-danger', titre: t.inconnu },
  }[etat]

  return (
    <div className="relative min-h-dvh bg-background px-4 py-12">
      <div className="absolute top-4 end-4"><LanguageSelector currentLang={locale} /></div>
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-surface-border bg-surface p-8 shadow-sm">
        <div className="text-center">
          <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${style.teinte}`}><style.icone className="h-7 w-7" /></span>
          <h1 className="mt-5 font-heading text-2xl font-bold text-foreground">{style.titre}</h1>
          <p className="mt-1 font-mono text-xs text-foreground-muted" dir="ltr">{decodeURIComponent(code).toUpperCase()}</p>
        </div>
        {doc && (
          <dl className="mt-6 divide-y divide-surface-border rounded-xl border border-surface-border text-sm">
            {[
              [t.document, dict.documents.types[doc.type as TypeDocument] ?? doc.type],
              [t.numero, doc.numero],
              [t.eleve, `${doc.eleve} · ${doc.matricule}`],
              [t.etablissement, doc.etablissement],
              [t.annee, doc.annee ?? '—'],
              [t.emisLe, new Date(doc.emis_le).toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'long', year: 'numeric' })],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-foreground-muted">{k}</dt>
                <dd className="text-end font-medium text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="mt-6 text-center text-xs text-foreground-muted">{etat === 'inconnu' ? t.aideInconnu : t.aide}</p>
        <p className="mt-4 text-center"><Link href="/verifier" className="text-sm font-medium text-primary hover:underline">{t.autre}</Link></p>
      </div>
    </div>
  )
}
