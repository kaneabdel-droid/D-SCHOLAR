// Transfert des demandes "Assistance / Support" vers la boîte support commune à tous
// les produits DembaSolution (SIGGIE, D-QUINCA, D-INTRANTS, D-AGROBUSINESS, D-SCHOLAR), via l'API
// Resend. Même fichier dans chaque dépôt : le garder identique d'un produit à l'autre.
//
// Reply-To = email du client : un simple "Répondre" depuis la messagerie lui répond
// directement. Ne lève jamais : renvoie false en cas d'échec, l'appelant enregistre de
// toute façon la demande en base pour qu'aucune ne soit perdue.

const SUPPORT_INBOX = process.env.SUPPORT_INBOX_EMAIL || 'support@dembasolution.com'
const SUPPORT_FROM = process.env.SUPPORT_FROM_EMAIL || 'DembaSolution Support <noreply@dembasolution.com>'

export const SUJET_MAX = 200
export const MESSAGE_MAX = 5000

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function transfererAuSupport(params: {
  produit: string
  email: string
  organisation: string
  sujet: string
  message: string
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('RESEND_API_KEY manquant : demande support enregistrée mais non transférée par email')
    return false
  }

  const html = `
    <p><strong>Produit :</strong> ${escapeHtml(params.produit)}<br/>
    <strong>Organisation :</strong> ${escapeHtml(params.organisation)}<br/>
    <strong>Utilisateur :</strong> ${escapeHtml(params.email)}</p>
    <p><strong>Sujet :</strong> ${escapeHtml(params.sujet)}</p>
    <hr/>
    <p style="white-space:pre-wrap">${escapeHtml(params.message)}</p>
  `
  const text =
    `Produit : ${params.produit}\nOrganisation : ${params.organisation}\n` +
    `Utilisateur : ${params.email}\nSujet : ${params.sujet}\n\n${params.message}`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: SUPPORT_FROM,
        to: [SUPPORT_INBOX],
        reply_to: params.email,
        subject: `[${params.produit}] ${params.sujet} — ${params.organisation}`,
        html,
        text,
      }),
    })
    if (!res.ok) {
      console.error('Envoi Resend échoué', res.status, await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error('Envoi Resend échoué', err)
    return false
  }
}
