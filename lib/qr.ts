import QRCode from 'qrcode'

// QR code (SVG) imprimé sur les documents émis : il renvoie vers la page publique
// de vérification /verifier/[code].
export async function qrSvg(url: string) {
  return QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
}

export function urlVerification(code: string) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://scholar.dembasolution.com'
  return `${site}/verifier/${code}`
}
