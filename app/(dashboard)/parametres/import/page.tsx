import { requireParametrage } from '@/lib/auth/getCurrentUserContext'
import { AssistantImport, type TypeImportOption } from '@/components/import/AssistantImport'
import { importerDonneesScholar } from './actions'

const OPTIONS_SCHOLAR: TypeImportOption[] = [
  {
    id: 'eleves',
    titre: 'Élèves & Inscriptions',
    description: 'Importez la liste complète des élèves (matricule, nom, prénom, sexe, tuteur) avec affectation optionnelle à une classe.',
    icone: 'eleves',
    nomFichierModele: 'modele_import_eleves.csv',
    modeleCSV: `matricule,prenom,nom,sexe,date_naissance,lieu_naissance,adresse,tuteur_nom,tuteur_telephone,classe
MAT001,Mamadou,Diallo,M,2012-05-14,Dakar,Medina rue 6,Amadou Diallo,771234567,6eme A
MAT002,Fatou,Sow,F,2012-09-22,Thies,Quartier Escale,Aissatou Sow,782345678,6eme A
MAT003,Ibrahima,Ba,M,2011-03-10,Saint-Louis,Pikine,Ousmane Ba,703456789,5eme B`
  },
  {
    id: 'enseignants',
    titre: 'Corps Enseignant',
    description: 'Importez les professeurs titulaires et vacataires avec leurs coordonnées.',
    icone: 'enseignants',
    nomFichierModele: 'modele_import_enseignants.csv',
    modeleCSV: `civilite,prenom,nom,telephone,email,statut,adresse
M.,Abdoulaye,Ndiaye,775551122,a.ndiaye@ecole.sn,titulaire,Grand Yoff Dakar
Mme,Aminata,Diop,784443322,a.diop@ecole.sn,titulaire,Mermoz Dakar
M.,Cheikh,Fall,706667788,c.fall@ecole.sn,vacataire,Castors Dakar`
  },
  {
    id: 'classes',
    titre: 'Classes & Salles',
    description: "Importez les divisions de classes pour l'année scolaire active.",
    icone: 'classes',
    nomFichierModele: 'modele_import_classes.csv',
    modeleCSV: `nom,niveau,capacite
6eme A,6eme,45
6eme B,6eme,45
5eme A,5eme,40
5eme B,5eme,40
Terminale S2,Terminale,35`
  }
]

export default async function ImportScholarPage() {
  const context = await requireParametrage()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Importation des données existantes
        </h1>
        <p className="text-sm text-foreground-muted mt-1">
          Intégrez rapidement vos élèves, enseignants et classes existants dans {context.etablissementNom || 'votre établissement'}.
        </p>
      </div>

      <AssistantImport
        nomApplication="D-Scholar"
        titreModule="Scolarité & Pédagogie"
        optionsTypes={OPTIONS_SCHOLAR}
        onImporter={importerDonneesScholar as any}
      />
    </div>
  )
}
