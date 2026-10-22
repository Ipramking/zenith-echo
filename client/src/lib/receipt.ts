import { fmtLong, naira } from './format'
import { KIND_LABEL, type Receipt } from './types'

/** The label/value lines of a receipt, in order. Shared by the receipt screen, the shared text and the PNG. */
export function receiptRows(r: Receipt): [string, string][] {
  const rows: [string, string][] = [
    ['Transaction type', KIND_LABEL[r.kind]],
    ['Date', fmtLong(r.at)],
    ['Reference', r.ref],
    [r.credit ? 'Credited to' : 'Debited from', r.from],
    ...r.rows,
  ]
  if (r.fee > 0) {
    rows.push(['Fee + VAT', naira(r.fee)])
    rows.push(['Total debited', naira(r.amount + r.fee)])
  }
  if (r.units) rows.push(['Units', r.units])
  return rows
}

/** Short type label for the history list ("Interbank Transfer", "Card Purchase", ...). */
export function txnLabel(desc: string, kind?: Receipt['kind']): string {
  if (kind && kind !== 'credit' && kind !== 'debit') return KIND_LABEL[kind]
  const d = desc.toLowerCase()
  if (d.includes('charge')) return 'Bank Charges'
  if (d.includes('airtime')) return 'Airtime Purchase'
  if (d.includes('dstv') || d.includes('gotv')) return 'Cable TV'
  if (d.includes('salary')) return 'Salary'
  if (d.includes('interest')) return 'Interest Credit'
  if (d.includes('cheque')) return 'Cheque Deposit'
  if (d.startsWith('pos') || d.startsWith('mc loc')) return 'Card Purchase'
  if (d.startsWith('nip')) return 'Interbank Transfer'
  if (d.startsWith('trf')) return 'Bank Transfer'
  return 'Transaction'
}

export function receiptText(r: Receipt): string {
  const lines = [`Zenith Echo - ${r.title}`, naira(r.amount) + (r.credit ? ' (credit)' : ''), '', ...receiptRows(r).map(([k, v]) => `${k}: ${v}`)]
  if (r.token) lines.push(`Token: ${r.token}`)
  lines.push('', 'Demo receipt from a prototype app.')
  return lines.join('\n')
}

const FONT = '"Poppins", system-ui, sans-serif'

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? line + ' ' + word : word
    if (line && ctx.measureText(next).width > maxW) {
      out.push(line)
      line = word
    } else line = next
  }
  if (line) out.push(line)
  return out
}

/** Renders the receipt to a PNG so it can be downloaded or shared as an image. */
export async function receiptPng(r: Receipt): Promise<Blob> {
  try {
    await document.fonts.ready
  } catch {
    /* fall back to the system font */
  }
  const W = 750
  const PAD = 48
  const VALUE_W = 430
  const rows = receiptRows(r)

  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = `500 22px ${FONT}`
  const laid = rows.map(([k, v]) => ({ k, lines: wrap(measure, v, VALUE_W) }))
  const rowsH = laid.reduce((n, l) => n + Math.max(1, l.lines.length) * 30 + 22, 0)
  const tokenH = r.token ? 150 : 0
  const H = 330 + rowsH + tokenH + 110

  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#d10a10'
  ctx.fillRect(0, 0, W, 130)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.font = `700 34px ${FONT}`
  ctx.fillText('ZENITH ECHO', PAD, 66)
  ctx.font = `400 22px ${FONT}`
  ctx.fillText('Transaction Receipt', PAD, 102)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#12872a'
  ctx.font = `600 22px ${FONT}`
  ctx.fillText(r.credit ? 'CREDIT' : 'SUCCESSFUL', W / 2, 190)
  ctx.fillStyle = '#222'
  ctx.font = `700 52px ${FONT}`
  ctx.fillText(naira(r.amount), W / 2, 252)
  ctx.fillStyle = '#777'
  ctx.font = `400 22px ${FONT}`
  ctx.fillText(r.title.length > 52 ? r.title.slice(0, 50) + '…' : r.title, W / 2, 292)

  let y = 330
  ctx.strokeStyle = '#e8e8e8'
  ctx.lineWidth = 2
  for (const { k, lines } of laid) {
    ctx.beginPath()
    ctx.moveTo(PAD, y)
    ctx.lineTo(W - PAD, y)
    ctx.stroke()
    ctx.textAlign = 'left'
    ctx.fillStyle = '#8b8b8b'
    ctx.font = `400 21px ${FONT}`
    ctx.fillText(k, PAD, y + 36)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#222'
    ctx.font = `500 22px ${FONT}`
    lines.forEach((ln, i) => ctx.fillText(ln, W - PAD, y + 36 + i * 30))
    y += Math.max(1, lines.length) * 30 + 22
  }

  if (r.token) {
    y += 20
    ctx.fillStyle = '#fdecec'
    ctx.fillRect(PAD, y, W - PAD * 2, 110)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#d10a10'
    ctx.font = `500 20px ${FONT}`
    ctx.fillText('YOUR TOKEN', W / 2, y + 36)
    ctx.fillStyle = '#222'
    ctx.font = `700 32px ui-monospace, Consolas, monospace`
    ctx.fillText(r.token, W / 2, y + 82)
    y += 130
  }

  ctx.textAlign = 'center'
  ctx.fillStyle = '#9a9a9a'
  ctx.font = `400 18px ${FONT}`
  ctx.fillText('Demo receipt. Zenith Echo is a prototype and not a real bank document.', W / 2, H - 40)

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('png failed'))), 'image/png'))
}
