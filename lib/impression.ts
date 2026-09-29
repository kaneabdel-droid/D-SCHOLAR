// Impression des documents (bulletins, relevés, attestations, reçus) par le
// navigateur : « Imprimer » → « Enregistrer au format PDF ». Contrairement à une
// bibliothèque PDF embarquée, le navigateur relie les lettres arabes et écrit de
// droite à gauche : un seul rendu pour le français, l'anglais et l'arabe
// (même choix que D-AGROBUSINESS, lib/impression.ts).

export type Cellule = string | number | null | undefined

export const echapper = (v: Cellule) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const STYLES = `
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', 'Noto Sans Arabic', Tahoma, Arial, sans-serif; margin: 0; color: #0f172a; font-size: 12px; }
  .page { padding: 14mm 14mm 12mm; page-break-after: always; min-height: 100vh; position: relative; }
  .page:last-child { page-break-after: auto; }
  .entete { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #2447b8; padding-bottom: 8px; margin-bottom: 14px; }
  .entete h1 { font-size: 17px; margin: 0; color: #0f1b3d; }
  .entete p { margin: 2px 0; color: #475569; }
  .titre { text-align: center; font-size: 18px; font-weight: 700; letter-spacing: .04em; margin: 18px 0 12px; color: #0f1b3d; text-transform: uppercase; }
  .sous-titre { text-align: center; color: #475569; margin-top: -6px; margin-bottom: 14px; }
  .grille { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin-bottom: 12px; }
  .grille p { margin: 0; } .grille b { color: #0f172a; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #0f1b3d; color: #fff; padding: 6px 7px; text-align: start; font-weight: 600; }
  td { border-bottom: 1px solid #e2e8f0; padding: 5px 7px; }
  td.n, th.n { text-align: center; direction: ltr; unicode-bidi: plaintext; }
  tr.total td { font-weight: 700; background: #eef2fb; }
  .bloc { margin-top: 14px; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; }
  .mention { display: inline-block; padding: 3px 10px; border-radius: 999px; background: #e8eefc; color: #2447b8; font-weight: 700; }
  .texte { font-size: 13.5px; line-height: 1.8; margin: 18px 0; text-align: justify; }
  .signatures { display: flex; justify-content: space-between; gap: 24px; margin-top: 36px; }
  .signatures div { flex: 1; text-align: center; }
  .signatures .ligne { height: 48px; border-bottom: 1px solid #0f172a; margin-bottom: 6px; }
  .verification { position: absolute; bottom: 12mm; inset-inline-start: 14mm; display: flex; align-items: center; gap: 10px; font-size: 10px; color: #475569; }
  .verification svg { width: 72px; height: 72px; }
  .num { direction: ltr; unicode-bidi: plaintext; }
  @page { size: A4; margin: 0; }
`

// Ouvre une fenêtre d'impression avec les pages données (une <div class="page">
// par document). Renvoie false si le navigateur a bloqué la fenêtre.
export function imprimerPages(titre: string, pages: string[], lang: string) {
  const w = window.open('', '_blank')
  if (!w) return false
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  w.document.write(
    `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><title>${echapper(titre)}</title><style>${STYLES}</style></head><body>${pages.join('')}</body></html>`
  )
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 350)
  return true
}

export function tableauHtml(colonnes: string[], lignes: Cellule[][], total?: Cellule[]) {
  const td = (v: Cellule) => `<td${typeof v === 'number' || /^[\d\s.,/-]+$/.test(String(v ?? '')) ? ' class="n"' : ''}>${echapper(v)}</td>`
  return `<table><thead><tr>${colonnes.map((c, i) => `<th${i > 0 ? ' class="n"' : ''}>${echapper(c)}</th>`).join('')}</tr></thead><tbody>${lignes
    .map((l) => `<tr>${l.map(td).join('')}</tr>`)
    .join('')}${total ? `<tr class="total">${total.map(td).join('')}</tr>` : ''}</tbody></table>`
}

export type EnteteEtablissement = { nom: string; sigle?: string | null; adresse?: string | null; ville?: string | null; telephone?: string | null; email?: string | null }

export function enteteHtml(e: EnteteEtablissement, droite = '') {
  const coord = [e.adresse, e.ville].filter(Boolean).join(', ')
  const contact = [e.telephone, e.email].filter(Boolean).join(' · ')
  return `<div class="entete"><div><h1>${echapper(e.nom)}</h1>${coord ? `<p>${echapper(coord)}</p>` : ''}${contact ? `<p class="num">${echapper(contact)}</p>` : ''}</div><div style="text-align:end">${droite}</div></div>`
}
