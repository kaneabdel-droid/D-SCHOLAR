#!/usr/bin/env node
/**
 * Agent CLI d'importation de données existantes pour D-SCHOLAR
 * 
 * Usage :
 *   node scripts/importer-donnees.mjs --etablissement="Groupe Scolaire Excellence" --type=eleves --fichier=./eleves.csv
 *   node scripts/importer-donnees.mjs --etablissement="Groupe Scolaire Excellence" --type=enseignants --fichier=./profs.csv
 *   node scripts/importer-donnees.mjs --etablissement="Groupe Scolaire Excellence" --type=classes --fichier=./classes.csv
 *   node scripts/importer-donnees.mjs --modele=eleves
 *   node scripts/importer-donnees.mjs --modele=enseignants
 *   node scripts/importer-donnees.mjs --modele=classes
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, '..')

function chargerEnv() {
  const envPath = path.join(appRoot, '.env.local')
  if (fs.existsSync(envPath)) {
    const lignes = fs.readFileSync(envPath, 'utf8').split('\n')
    for (const ligne of lignes) {
      const idx = ligne.indexOf('=')
      if (idx > 0 && !ligne.trim().startsWith('#')) {
        const k = ligne.slice(0, idx).trim()
        const v = ligne.slice(idx + 1).trim()
        if (!process.env[k]) process.env[k] = v
      }
    }
  }
}
chargerEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Erreur : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis dans .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})

const MODELES = {
  eleves: `matricule;prenom;nom;sexe;date_naissance;lieu_naissance;tuteur_nom;tuteur_telephone;adresse;classe
MAT-2026-001;Ibrahima;Diallo;M;2014-05-12;Dakar;Amadou Diallo;+221 77 123 45 67;Mermoz Pyrotechnie;6E A
MAT-2026-002;Fatou;Ndiaye;F;2013-09-24;Thiès;Marième Fall;+221 78 234 56 78;Fann Résidence;5E B
MAT-2026-003;Cheikh;Sarr;M;2015-02-18;Saint-Louis;Ousmane Sarr;+221 76 345 67 89;Ouakam Cité Avion;CM2 A
MAT-2026-004;Awa;Ba;F;2016-11-03;Kaolack;Aminata Diop;+221 70 456 78 90;Sacré-Coeur 3;CE1`,

  enseignants: `civilite;prenom;nom;telephone;email;statut;specialite
M.;Babacar;Fall;+221 77 555 11 22;b.fall@gmail.com;titulaire;Mathématiques
Mme;Khady;Diop;+221 78 666 33 44;khady.diop@yahoo.fr;titulaire;Français
M.;Moussa;Seck;+221 76 777 55 66;moussa.seck@hotmail.com;vacataire;Sciences Physiques
Mlle;Aïcha;Touré;+221 70 888 77 88;aicha.toure@gmail.com;titulaire;Anglais`,

  classes: `nom;niveau_code;capacite
6E A;6E;40
6E B;6E;40
5E A;5E;38
5E B;5E;38
CM2 A;CM2;35
CE1;CE1;30`
}

function parserCSV(contenu) {
  const texte = contenu.replace(/^\uFEFF/, '').trim()
  if (!texte) return []
  const delim = texte.indexOf(';') !== -1 ? ';' : ','
  const lignes = texte.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lignes.length < 2) return []

  const enTetes = lignes[0].split(delim).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase())
  const resultats = []

  for (let i = 1; i < lignes.length; i++) {
    const rawCols = lignes[i].split(delim)
    const obj = {}
    enTetes.forEach((h, idx) => {
      const val = (rawCols[idx] ?? '').trim().replace(/^["']|["']$/g, '')
      obj[h] = val
    })
    resultats.push(obj)
  }
  return resultats
}

const args = Object.fromEntries(
  process.argv.slice(2).map(arg => {
    const [k, v] = arg.replace(/^--/, '').split('=')
    return [k, v ?? true]
  })
)

if (args.modele) {
  const type = String(args.modele).toLowerCase()
  if (!MODELES[type]) {
    console.error(`Modèle inconnu "${type}". Disponibles : ${Object.keys(MODELES).join(', ')}`)
    process.exit(1)
  }
  const nomFichier = `modele_import_scholar_${type}.csv`
  fs.writeFileSync(nomFichier, MODELES[type], 'utf8')
  console.log(`✓ Fichier modèle généré avec succès : ${nomFichier}`)
  process.exit(0)
}

async function executerImport() {
  const cible = args.etablissement || args.entreprise
  const type = (args.type || 'eleves').toLowerCase()
  const cheminFichier = args.fichier

  if (!cible || !cheminFichier) {
    console.log(`
Agent CLI d'Importation — D-SCHOLAR
-----------------------------------
Usage :
  node scripts/importer-donnees.mjs --etablissement="<ID_OU_NOM>" --type=<eleves|enseignants|classes> --fichier=<chemin.csv>
  node scripts/importer-donnees.mjs --modele=<eleves|enseignants|classes>
    `)
    process.exit(1)
  }

  if (!fs.existsSync(cheminFichier)) {
    console.error(`Fichier introuvable : ${cheminFichier}`)
    process.exit(1)
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cible)
  let requete = supabase.from('etablissements').select('id, nom')
  if (isUuid) {
    requete = requete.eq('id', cible)
  } else {
    requete = requete.ilike('nom', `%${cible}%`)
  }
  const { data: etabs, error: errEtab } = await requete
  if (errEtab || !etabs || etabs.length === 0) {
    console.error(`Aucun établissement scolaire trouvé pour "${cible}"`)
    process.exit(1)
  }
  const etab = etabs[0]

  // Année scolaire active
  const { data: annee } = await supabase.from('annees_scolaires').select('id, libelle').eq('etablissement_id', etab.id).eq('active', true).maybeSingle()

  console.log(`Établissement identifié : ${etab.nom} (${etab.id})`)
  if (annee) console.log(`Année scolaire active : ${annee.libelle} (${annee.id})`)
  console.log(`Type d'import : ${type}`)

  const contenu = fs.readFileSync(cheminFichier, 'utf8')
  const records = cheminFichier.endsWith('.json') ? JSON.parse(contenu) : parserCSV(contenu)
  console.log(`Nombre de lignes détectées : ${records.length}`)

  let succes = 0
  let erreurs = 0

  if (type === 'eleves') {
    for (const item of records) {
      try {
        const prenom = (item.prenom || '').trim()
        const nom = (item.nom || '').trim()
        if (!prenom || !nom) {
          erreurs++
          continue
        }
        const matricule = (item.matricule || '').trim() || `MAT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random()*1000)}`
        const sexe = (item.sexe || 'M').trim().toUpperCase() === 'F' ? 'F' : 'M'
        const dateNaissance = item.date_naissance || null
        const lieuNaissance = (item.lieu_naissance || '').trim() || null
        const adresse = (item.adresse || '').trim() || null
        const tuteurNom = (item.tuteur_nom || item.tuteur || '').trim() || null
        const tuteurTelephone = (item.tuteur_telephone || item.telephone || '').trim() || null

        // 1. Insertion ou mise à jour élève
        const { data: eleve, error: errEleve } = await supabase.from('eleves').upsert({
          etablissement_id: etab.id,
          matricule,
          prenom,
          nom,
          sexe,
          date_naissance: dateNaissance,
          lieu_naissance: lieuNaissance,
          adresse,
          tuteur_nom: tuteurNom,
          tuteur_telephone: tuteurTelephone,
          statut: 'actif'
        }, { onConflict: 'etablissement_id, matricule' }).select('id').single()

        if (errEleve) throw errEleve

        // 2. Inscription dans la classe si précisée et année active
        const nomClasse = (item.classe || '').trim()
        if (nomClasse && annee && eleve) {
          const { data: classe } = await supabase.from('classes').select('id').eq('etablissement_id', etab.id).eq('annee_id', annee.id).ilike('nom', nomClasse).maybeSingle()
          if (classe) {
            await supabase.from('inscriptions').upsert({
              etablissement_id: etab.id,
              eleve_id: eleve.id,
              classe_id: classe.id,
              annee_id: annee.id,
              statut: 'inscrit'
            }, { onConflict: 'eleve_id, annee_id' })
          }
        }

        succes++
      } catch (e) {
        console.error(`Erreur élève "${item.prenom} ${item.nom}" :`, e.message)
        erreurs++
      }
    }
  } else if (type === 'enseignants') {
    for (const item of records) {
      try {
        const prenom = (item.prenom || '').trim()
        const nom = (item.nom || '').trim()
        if (!prenom || !nom) {
          erreurs++
          continue
        }
        const civilite = (item.civilite || 'M.').trim()
        const telephone = (item.telephone || '').trim() || null
        const email = (item.email || '').trim() || null
        const statut = ['vacataire', 'titulaire'].includes((item.statut || '').toLowerCase()) ? item.statut.toLowerCase() : 'titulaire'

        const { error } = await supabase.from('enseignants').insert({
          etablissement_id: etab.id,
          civilite,
          prenom,
          nom,
          telephone,
          email,
          statut,
          actif: true
        })
        if (error) throw error
        succes++
      } catch (e) {
        console.error(`Erreur enseignant "${item.prenom} ${item.nom}" :`, e.message)
        erreurs++
      }
    }
  } else if (type === 'classes') {
    if (!annee) {
      console.error('Aucune année scolaire active pour cet établissement.')
      process.exit(1)
    }
    for (const item of records) {
      try {
        const nom = (item.nom || '').trim()
        if (!nom) {
          erreurs++
          continue
        }
        const codeNiveau = (item.niveau_code || item.niveau || '6E').trim()
        const capacite = parseInt(item.capacite || '40', 10) || 40

        // Trouver le niveau correspondant
        let niveauId = null
        const { data: niv } = await supabase.from('niveaux').select('id').eq('etablissement_id', etab.id).ilike('code', codeNiveau).maybeSingle()
        if (niv) {
          niveauId = niv.id
        } else {
          // Niveau par défaut
          const { data: anyNiv } = await supabase.from('niveaux').select('id').eq('etablissement_id', etab.id).limit(1).maybeSingle()
          niveauId = anyNiv?.id || null
        }

        if (!niveauId) {
          console.warn(`Aucun niveau trouvé pour la classe "${nom}"`)
          erreurs++
          continue
        }

        const { error } = await supabase.from('classes').upsert({
          etablissement_id: etab.id,
          annee_id: annee.id,
          niveau_id: niveauId,
          nom,
          capacite
        }, { onConflict: 'annee_id, nom' })

        if (error) throw error
        succes++
      } catch (e) {
        console.error(`Erreur classe "${item.nom}" :`, e.message)
        erreurs++
      }
    }
  }

  console.log(`\nImportation terminée pour ${etab.nom} :`)
  console.log(`✓ Lignes importées avec succès : ${succes}`)
  if (erreurs > 0) console.log(`✗ Échecs ou ignorées : ${erreurs}`)
}

executerImport()
