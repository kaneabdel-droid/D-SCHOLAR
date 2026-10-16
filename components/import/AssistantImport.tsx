'use client'

import React, { useState } from 'react'
import {
  UploadCloud,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  GraduationCap,
  Users,
  BookOpen,
  FileText
} from 'lucide-react'

export interface TypeImportOption {
  id: string
  titre: string
  description: string
  icone: 'eleves' | 'enseignants' | 'classes' | 'general'
  modeleCSV: string
  nomFichierModele: string
}

interface AssistantImportProps {
  nomApplication: string
  titreModule: string
  optionsTypes: TypeImportOption[]
  onImporter: (typeId: string, records: any[]) => Promise<{ succes: number; erreurs: number; details?: string[] }>
}

export function AssistantImport({
  nomApplication,
  titreModule,
  optionsTypes,
  onImporter
}: AssistantImportProps) {
  const [typeSelectionne, setTypeSelectionne] = useState<string>(optionsTypes[0]?.id || '')
  const [fichierNom, setFichierNom] = useState<string | null>(null)
  const [lignesApercu, setLignesApercu] = useState<any[]>([])
  const [colonnesApercu, setColonnesApercu] = useState<string[]>([])
  const [totalLignes, setTotalLignes] = useState<number>(0)
  const [donneesCompletes, setDonneesCompletes] = useState<any[]>([])
  const [enCours, setEnCours] = useState<boolean>(false)
  const [rapport, setRapport] = useState<{ succes: number; erreurs: number; details?: string[] } | null>(null)
  const [erreurLecture, setErreurLecture] = useState<string | null>(null)

  const optionCourante = optionsTypes.find(o => o.id === typeSelectionne) || optionsTypes[0]

  const telechargerModele = () => {
    if (!optionCourante) return
    const blob = new Blob([optionCourante.modeleCSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', optionCourante.nomFichierModele)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const parserTexte = (texte: string) => {
    const propre = texte.replace(/^\uFEFF/, '').trim()
    if (!propre) throw new Error('Le fichier est vide.')
    const separateur = propre.indexOf(';') !== -1 ? ';' : ','
    const lignes = propre.split(/\r?\n/).filter(l => l.trim().length > 0)
    if (lignes.length < 2) throw new Error('Le fichier doit contenir au moins une ligne d’en-tête et une ligne de données.')

    const entetes = lignes[0].split(separateur).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase())
    const records: any[] = []

    for (let i = 1; i < lignes.length; i++) {
      const parts = lignes[i].split(separateur)
      const obj: Record<string, string> = {}
      entetes.forEach((h, idx) => {
        obj[h] = (parts[idx] ?? '').trim().replace(/^["']|["']$/g, '')
      })
      records.push(obj)
    }
    return { entetes, records }
  }

  const gererFichier = (file: File) => {
    setErreurLecture(null)
    setRapport(null)
    setFichierNom(file.name)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const contenu = e.target?.result as string
        let entetes: string[] = []
        let records: any[] = []

        if (file.name.endsWith('.json')) {
          records = JSON.parse(contenu)
          if (!Array.isArray(records) || records.length === 0) throw new Error('Le format JSON doit être un tableau non vide.')
          entetes = Object.keys(records[0])
        } else {
          const parsed = parserTexte(contenu)
          entetes = parsed.entetes
          records = parsed.records
        }

        setColonnesApercu(entetes)
        setLignesApercu(records.slice(0, 5))
        setTotalLignes(records.length)
        setDonneesCompletes(records)
      } catch (err: any) {
        setErreurLecture(err.message || 'Impossible de lire le fichier.')
        setDonneesCompletes([])
        setLignesApercu([])
        setTotalLignes(0)
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  const lancerImportation = async () => {
    if (donneesCompletes.length === 0) return
    setEnCours(true)
    setRapport(null)
    try {
      const res = await onImporter(typeSelectionne, donneesCompletes)
      setRapport(res)
    } catch (err: any) {
      setRapport({ succes: 0, erreurs: donneesCompletes.length, details: [err.message || 'Erreur inconnue'] })
    } finally {
      setEnCours(false)
    }
  }

  const getIcone = (type: string) => {
    switch (type) {
      case 'eleves': return <GraduationCap className="h-5 w-5 text-indigo-600" />
      case 'enseignants': return <Users className="h-5 w-5 text-emerald-600" />
      case 'classes': return <BookOpen className="h-5 w-5 text-blue-600" />
      default: return <FileText className="h-5 w-5 text-primary" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-surface-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">{titreModule}</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              Importez les listes d'élèves, enseignants et classes existants dans {nomApplication}.
            </p>
          </div>
          <button
            onClick={telechargerModele}
            className="inline-flex items-center gap-2 rounded-lg border border-surface-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted hover:text-primary shadow-xs"
          >
            <Download className="h-4 w-4" />
            Télécharger le modèle CSV ({optionCourante?.titre})
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-semibold text-foreground">
          1. Sélectionnez les données à importer :
        </label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {optionsTypes.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setTypeSelectionne(opt.id)
                setRapport(null)
              }}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                typeSelectionne === opt.id
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-surface-border bg-surface hover:border-surface-border-strong hover:bg-surface-muted/50'
              }`}
            >
              <div className="mt-0.5 rounded-lg bg-surface-muted p-2">
                {getIcone(opt.icone)}
              </div>
              <div>
                <div className="font-semibold text-foreground">{opt.titre}</div>
                <div className="text-xs text-foreground-muted mt-0.5">{opt.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-semibold text-foreground">
          2. Téléversez votre fichier (CSV ou JSON) :
        </label>
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            if (e.dataTransfer.files?.[0]) gererFichier(e.dataTransfer.files[0])
          }}
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-surface-border bg-surface-muted/30 p-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
        >
          <div className="rounded-full bg-primary/10 p-4 text-primary">
            <UploadCloud className="h-8 w-8" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">
            {fichierNom ? (
              <span className="font-semibold text-primary">{fichierNom}</span>
            ) : (
              'Glissez-déposez votre fichier ici, ou cliquez pour parcourir'
            )}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            Format CSV (séparateur point-virgule ou virgule) ou JSON • Encodage UTF-8
          </p>
          <input
            type="file"
            accept=".csv, .txt, .json"
            onChange={(e) => {
              if (e.target.files?.[0]) gererFichier(e.target.files[0])
            }}
            className="hidden"
          />
        </label>
      </div>

      {erreurLecture && (
        <div className="flex items-center gap-3 rounded-xl border border-danger/20 bg-danger/10 p-4 text-sm text-danger">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{erreurLecture}</span>
        </div>
      )}

      {lignesApercu.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-foreground">
              3. Aperçu des données ({totalLignes} ligne{totalLignes > 1 ? 's' : ''} détectée{totalLignes > 1 ? 's' : ''}) :
            </label>
            <span className="text-xs text-foreground-muted">5 premières lignes affichées</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-surface-border bg-surface">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-surface-border bg-surface-muted/60 text-foreground font-semibold">
                <tr>
                  {colonnesApercu.map((col) => (
                    <th key={col} className="px-3 py-2.5">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-foreground-muted">
                {lignesApercu.map((ligne, idx) => (
                  <tr key={idx} className="hover:bg-surface-muted/30">
                    {colonnesApercu.map((col) => (
                      <td key={col} className="px-3 py-2 whitespace-nowrap">
                        {ligne[col] || <span className="text-foreground-muted/50 italic">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={lancerImportation}
              disabled={enCours}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-white shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              {enCours ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importation en cours...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Importer les {totalLignes} enregistrements
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {rapport && (
        <div className={`rounded-xl border p-5 ${
          rapport.erreurs === 0
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100'
        }`}>
          <div className="flex items-center gap-3 font-semibold">
            {rapport.erreurs === 0 ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
            )}
            <span>
              Résultat : {rapport.succes} enregistrement{rapport.succes > 1 ? 's' : ''} importé{rapport.succes > 1 ? 's' : ''} avec succès.
              {rapport.erreurs > 0 && ` (${rapport.erreurs} ignoré(s) ou en erreur)`}
            </span>
          </div>

          {rapport.details && rapport.details.length > 0 && (
            <ul className="mt-3 list-disc pl-6 text-xs space-y-1 opacity-90">
              {rapport.details.slice(0, 10).map((d, i) => (
                <li key={i}>{d}</li>
              ))}
              {rapport.details.length > 10 && (
                <li>... et {rapport.details.length - 10} autre(s) anomalie(s).</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
