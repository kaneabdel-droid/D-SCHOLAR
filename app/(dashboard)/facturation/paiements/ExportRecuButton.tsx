'use client'

import { FileText } from 'lucide-react'
import jsPDF from 'jspdf'

export default function ExportRecuButton({
  paiement,
  dict
}: {
  paiement: any
  dict: any
}) {
  const handleExport = () => {
    const doc = new jsPDF('p', 'mm', 'a5') // Reçu en format A5

    // En-tête
    doc.setFontSize(18)
    doc.text("REÇU DE PAIEMENT", 105, 20, { align: 'center' })
    
    doc.setFontSize(10)
    doc.text(`N° Reçu : ${paiement.numero_recu || 'N/A'}`, 14, 35)
    doc.text(`Date : ${new Date(paiement.date_paiement).toLocaleDateString('fr-FR')}`, 14, 42)

    // Ligne de séparation
    doc.line(14, 48, 196, 48)

    // Informations de l'élève
    doc.setFontSize(12)
    doc.text("Informations de l'élève", 14, 60)
    doc.setFontSize(10)
    doc.text(`Nom : ${paiement.eleves?.nom}`, 14, 68)
    doc.text(`Prénom : ${paiement.eleves?.prenom}`, 14, 75)
    doc.text(`Matricule : ${paiement.eleves?.matricule || 'N/A'}`, 14, 82)

    // Informations du paiement
    doc.setFontSize(12)
    doc.text("Détails du paiement", 105, 60)
    doc.setFontSize(10)
    doc.text(`Motif : ${paiement.libelle}`, 105, 68)
    const modeStr = dict.facturation.paiements.modes[paiement.mode as keyof typeof dict.facturation.paiements.modes] || paiement.mode
    doc.text(`Moyen de paiement : ${modeStr}`, 105, 75)
    
    // Encadré pour le montant
    doc.setFillColor(243, 244, 246) // Gris clair
    doc.rect(14, 100, 182, 30, 'F')
    
    doc.setFontSize(14)
    doc.text("Montant payé :", 20, 118)
    
    doc.setFontSize(22)
    doc.setTextColor(37, 99, 235) // Bleu primaire
    doc.text(`${paiement.montant.toLocaleString('fr-FR')} FCFA`, 190, 120, { align: 'right' })
    
    // Remise de la couleur noire
    doc.setTextColor(0, 0, 0)
    
    // Signature
    doc.setFontSize(10)
    doc.text("Signature / Cachet :", 140, 150)
    
    // Bas de page
    doc.setFontSize(8)
    doc.setTextColor(107, 114, 128)
    doc.text("Document généré par D-Scholar", 105, 195, { align: 'center' })

    doc.save(`Recu_${paiement.numero_recu || paiement.id.slice(0,8)}.pdf`)
  }

  return (
    <button 
      onClick={handleExport} 
      title="Télécharger le reçu (PDF)"
      className="btn-ghost p-1.5 text-foreground-muted hover:text-primary"
    >
      <FileText className="h-4 w-4" />
    </button>
  )
}
