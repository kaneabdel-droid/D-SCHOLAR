'use server'

import { createClient } from '@/utils/supabase/server'
import { requireParametrage } from '@/lib/auth/getCurrentUserContext'
import { revalidatePath } from 'next/cache'

export async function importerDonneesScholar(
  typeId: 'eleves' | 'enseignants' | 'classes',
  records: any[]
): Promise<{ succes: number; erreurs: number; details: string[] }> {
  try {
    const context = await requireParametrage()
    const supabase = await createClient()

    const etablissementId = context.etablissementId
    const anneeActiveId = context.anneeActive?.id

    let succes = 0
    let erreurs = 0
    const details: string[] = []

    if (!records || !Array.isArray(records) || records.length === 0) {
      return { succes: 0, erreurs: 0, details: ['Aucun enregistrement valide à importer.'] }
    }

    if (typeId === 'eleves') {
      // Préparer cache des classes si anneeActive existe pour inscription automatique optionnelle
      const classesMap = new Map<string, string>() // nom normalisé -> classe_id
      if (anneeActiveId) {
        const { data: classesList } = await supabase
          .from('classes')
          .select('id, nom')
          .eq('etablissement_id', etablissementId)
          .eq('annee_id', anneeActiveId)
        if (classesList) {
          for (const c of classesList) {
            classesMap.set(c.nom.trim().toLowerCase(), c.id)
          }
        }
      }

      for (let i = 0; i < records.length; i++) {
        const row = records[i]
        const prenom = (row.prenom || row.first_name || '').toString().trim()
        const nom = (row.nom || row.last_name || '').toString().trim()
        let matricule = (row.matricule || row.id_scolaire || '').toString().trim()

        if (!prenom || !nom) {
          erreurs++
          details.push(`Ligne ${i + 1} : Prénom et Nom obligatoires pour l'élève.`)
          continue
        }

        if (!matricule) {
          matricule = `MAT-${Date.now().toString().slice(-6)}-${(i + 1).toString().padStart(3, '0')}`
        }

        let sexe = (row.sexe || 'M').toString().toUpperCase().trim()
        if (sexe !== 'M' && sexe !== 'F') {
          sexe = sexe.startsWith('F') ? 'F' : 'M'
        }

        const dateNaissance = row.date_naissance ? row.date_naissance.toString().trim() : null
        const lieuNaissance = row.lieu_naissance ? row.lieu_naissance.toString().trim() : null
        const adresse = row.adresse ? row.adresse.toString().trim() : null
        const tuteurNom = (row.tuteur_nom || row.parent_nom || '').toString().trim() || null
        const tuteurTelephone = (row.tuteur_telephone || row.parent_telephone || '').toString().trim() || null

        const { data: eleveData, error: eleveError } = await supabase
          .from('eleves')
          .upsert(
            {
              etablissement_id: etablissementId,
              matricule,
              prenom,
              nom,
              sexe,
              date_naissance: dateNaissance || null,
              lieu_naissance: lieuNaissance || null,
              adresse: adresse || null,
              tuteur_nom: tuteurNom || null,
              tuteur_telephone: tuteurTelephone || null,
              statut: 'actif'
            },
            { onConflict: 'etablissement_id,matricule' }
          )
          .select('id')
          .single()

        if (eleveError) {
          erreurs++
          details.push(`Ligne ${i + 1} (${prenom} ${nom}) : ${eleveError.message}`)
          continue
        }

        // Inscription dans une classe si fournie
        const nomClasse = (row.classe || row.classe_nom || '').toString().trim()
        if (nomClasse && anneeActiveId && eleveData?.id) {
          const classeId = classesMap.get(nomClasse.toLowerCase())
          if (classeId) {
            await supabase.from('inscriptions').upsert(
              {
                etablissement_id: etablissementId,
                eleve_id: eleveData.id,
                annee_id: anneeActiveId,
                classe_id: classeId,
                statut: 'nouveau',
                date_inscription: new Date().toISOString().split('T')[0]
              },
              { onConflict: 'eleve_id,annee_id' }
            )
          }
        }

        succes++
      }

      revalidatePath('/eleves')
      revalidatePath('/dashboard')
    } else if (typeId === 'enseignants') {
      for (let i = 0; i < records.length; i++) {
        const row = records[i]
        const prenom = (row.prenom || row.first_name || '').toString().trim()
        const nom = (row.nom || row.last_name || '').toString().trim()

        if (!prenom || !nom) {
          erreurs++
          details.push(`Ligne ${i + 1} : Prénom et Nom obligatoires pour l'enseignant.`)
          continue
        }

        const civilite = (row.civilite || 'M.').toString().trim()
        const telephone = (row.telephone || row.tel || '').toString().trim() || null
        const email = (row.email || '').toString().trim() || null
        const adresse = (row.adresse || '').toString().trim() || null
        let statut = (row.statut || 'titulaire').toString().toLowerCase().trim()
        if (statut !== 'titulaire' && statut !== 'vacataire') statut = 'titulaire'

        const { error: ensError } = await supabase.from('enseignants').insert({
          etablissement_id: etablissementId,
          civilite,
          prenom,
          nom,
          telephone,
          email,
          adresse,
          statut,
          actif: true
        })

        if (ensError) {
          erreurs++
          details.push(`Ligne ${i + 1} (${prenom} ${nom}) : ${ensError.message}`)
        } else {
          succes++
        }
      }

      revalidatePath('/enseignants')
    } else if (typeId === 'classes') {
      if (!anneeActiveId) {
        return {
          succes: 0,
          erreurs: records.length,
          details: ["Aucune année scolaire active configurée. Activez d'abord une année dans Paramètres > Années."]
        }
      }

      // Récupérer les niveaux existants de l'établissement
      const { data: niveaux } = await supabase
        .from('niveaux')
        .select('id, code, nom')
        .eq('etablissement_id', etablissementId)

      const defautNiveauId = niveaux && niveaux.length > 0 ? niveaux[0].id : null

      if (!defautNiveauId) {
        return {
          succes: 0,
          erreurs: records.length,
          details: ["Aucun niveau scolaire défini dans l'établissement. Créez d'abord les niveaux dans Paramètres > Niveaux."]
        }
      }

      for (let i = 0; i < records.length; i++) {
        const row = records[i]
        const nom = (row.nom || row.classe || row.libelle || '').toString().trim()

        if (!nom) {
          erreurs++
          details.push(`Ligne ${i + 1} : Nom de la classe obligatoire.`)
          continue
        }

        // Trouver niveau_id
        let niveauId = defautNiveauId
        const niveauRef = (row.niveau || row.niveau_code || '').toString().trim().toLowerCase()
        if (niveauRef && niveaux) {
          const match = niveaux.find(
            n => n.code.toLowerCase() === niveauRef || n.nom.toLowerCase() === niveauRef
          )
          if (match) niveauId = match.id
        }

        const capaciteRaw = parseInt(row.capacite, 10)
        const capacite = !isNaN(capaciteRaw) && capaciteRaw > 0 ? capaciteRaw : 40

        const { error: classeError } = await supabase.from('classes').upsert(
          {
            etablissement_id: etablissementId,
            annee_id: anneeActiveId,
            niveau_id: niveauId,
            nom,
            capacite
          },
          { onConflict: 'annee_id,nom' }
        )

        if (classeError) {
          erreurs++
          details.push(`Ligne ${i + 1} (${nom}) : ${classeError.message}`)
        } else {
          succes++
        }
      }

      revalidatePath('/classes')
    }

    return { succes, erreurs, details }
  } catch (err: any) {
    return {
      succes: 0,
      erreurs: records.length,
      details: [`Erreur inattendue : ${err?.message || 'Erreur inconnue'}`]
    }
  }
}
