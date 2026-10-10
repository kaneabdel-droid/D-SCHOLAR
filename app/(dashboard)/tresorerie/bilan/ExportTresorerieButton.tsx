'use client'

import { Download } from 'lucide-react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export default function ExportTresorerieButton({
  bilan,
  mouvements,
  dict
}: {
  bilan: { recettes: number, depenses: number, resultat: number }
  mouvements: any[]
  dict: any
}) {
  const handleExport = () => {
    const doc = new jsPDF()

    // En-tête
    doc.setFontSize(20)
    doc.text(dict.tresorerie.title, 14, 22)
    
    doc.setFontSize(11)
    doc.text(`Date de génération : ${new Date().toLocaleDateString('fr-FR')}`, 14, 30)

    // Résumé (Bilan)
    doc.setFontSize(14)
    doc.text(dict.tresorerie.bilan.title, 14, 45)
    
    doc.setFontSize(11)
    doc.text(`${dict.tresorerie.bilan.recettes}: ${bilan.recettes.toLocaleString('fr-FR')} FCFA`, 14, 55)
    doc.text(`${dict.tresorerie.bilan.depenses}: ${bilan.depenses.toLocaleString('fr-FR')} FCFA`, 14, 62)
    doc.text(`${dict.tresorerie.bilan.resultat}: ${bilan.resultat.toLocaleString('fr-FR')} FCFA`, 14, 69)

    // Tableau des mouvements
    doc.setFontSize(14)
    doc.text('Journal des derniers mouvements', 14, 85)

    const tableData = mouvements.map(m => [
      new Date(m.date_mouvement).toLocaleDateString('fr-FR'),
      m.type === 'recette' ? dict.tresorerie.mouvements.types.recette : 
        (m.type === 'depense' ? dict.tresorerie.mouvements.types.depense : m.type),
      m.libelle,
      m.comptes_tresorerie?.nom || '',
      m.type === 'depense' ? `-${m.montant.toLocaleString('fr-FR')}` : `+${m.montant.toLocaleString('fr-FR')}`
    ])

    // @ts-ignore
    doc.autoTable({
      startY: 90,
      head: [[
        dict.tresorerie.mouvements.date, 
        dict.tresorerie.mouvements.type, 
        dict.tresorerie.mouvements.libelle, 
        dict.tresorerie.mouvements.compte, 
        dict.tresorerie.mouvements.montant
      ]],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] }
    })

    doc.save('Bilan_Tresorerie.pdf')
  }

  return (
    <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
      <Download className="h-4 w-4" />
      Exporter le bilan (PDF)
    </button>
  )
}
