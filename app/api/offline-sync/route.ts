import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { revalidatePath } from 'next/cache'

export async function GET() {
  return NextResponse.json({ status: 'online', service: 'd-scholar-sync', timestamp: Date.now() })
}

export async function POST(req: NextRequest) {
  try {
    const context = await getCurrentUserContext()
    if (!context || !context.etablissementId) {
      return NextResponse.json({ success: false, error: 'Session non authentifiée' }, { status: 401 })
    }

    const body = await req.json()
    const { actionType, payload } = body
    const supabase = await createClient()

    if (actionType === 'paiement_eleve' || actionType === 'paiement') {
      const { inscription_id, montant, mode_paiement, reference, observation } = payload

      const { data, error } = await supabase
        .from('paiements')
        .insert({
          etablissement_id: context.etablissementId,
          inscription_id,
          montant: Number(montant) || 0,
          mode_paiement: mode_paiement || 'especes',
          reference: reference || null,
          date_paiement: new Date().toISOString(),
          observations: observation ? `${observation} [Sync Hors-Ligne]` : '[Sync Hors-Ligne]',
        })
        .select()
        .single()

      if (error) throw error

      revalidatePath('/paiements')
      revalidatePath('/dashboard')
      return NextResponse.json({ success: true, id: data.id })
    }

    if (actionType === 'pointage_presence' || actionType === 'presence') {
      const { seance_id, presences } = payload // presences: array of { eleve_id, statut }

      if (Array.isArray(presences)) {
        for (const p of presences) {
          await supabase.from('presences').upsert({
            etablissement_id: context.etablissementId,
            seance_id,
            eleve_id: p.eleve_id,
            statut: p.statut || 'present',
          })
        }
      }

      revalidatePath('/assiduite')
      return NextResponse.json({ success: true })
    }

    if (actionType === 'saisie_note' || actionType === 'note') {
      const { evaluation_id, notes } = payload // notes: array of { eleve_id, note }

      if (Array.isArray(notes)) {
        for (const n of notes) {
          await supabase.from('notes').upsert({
            etablissement_id: context.etablissementId,
            evaluation_id,
            eleve_id: n.eleve_id,
            valeur: Number(n.note) || 0,
          })
        }
      }

      revalidatePath('/notes')
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: `Action inconnue: ${actionType}` }, { status: 400 })
  } catch (error: any) {
    console.error('Erreur API offline-sync scholar:', error)
    return NextResponse.json({ success: false, error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}
