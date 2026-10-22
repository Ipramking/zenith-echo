const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const MASK = '**********.**'

export function naira(n: number): string {
  return 'NGN' + Math.abs(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** `NGN50,000`: no kobo, for limits and plan prices. */
export const money = (n: number): string => naira(n).replace('.00', '')

/** Amount as it should be spoken, e.g. `248,350 naira and 75 kobo`. */
export function moneyWords(n: number): string {
  const whole = Math.floor(n)
  const kobo = Math.round((n - whole) * 100)
  return `${whole.toLocaleString('en-NG')} naira${kobo ? ` and ${kobo} kobo` : ''}`
}

export function signedNaira(n: number): string {
  return (n < 0 ? '-' : '+') + naira(n)
}

/** "Jun 03, 2022 10:57AM" */
export function fmtDate(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const hh = String(h % 12 === 0 ? 12 : h % 12).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()} ${hh}:${mm}${h < 12 ? 'AM' : 'PM'}`
}

export function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

/** NIP transfer fee + 7.5% VAT, by amount band */
export function nipCharge(amount: number): number {
  const fee = amount <= 5000 ? 10 : amount <= 50000 ? 25 : 50
  return Math.round(fee * 1.075 * 100) / 100
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('')

/** Transaction reference, e.g. ZE240915123456789012 */
export function genRef(): string {
  return 'ZE' + digits(18)
}

/** 20-digit prepaid electricity token, grouped 4-4-4-4-4 */
export function genToken(): string {
  return digits(20).replace(/(\d{4})(?=\d)/g, '$1 ')
}

/** "21 Oct 2026, 07:22 PM" */
export function fmtLong(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${String(h % 12 || 12).padStart(2, '0')}:${mm} ${h < 12 ? 'AM' : 'PM'}`
}

/** "7:22pm, 21 October 2026" (transaction history rows) */
export function fmtHist(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const month = d.toLocaleString('en-GB', { month: 'long' })
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}, ${d.getDate()} ${month} ${d.getFullYear()}`
}

/** Stable pseudo-hash of a string, used to give seeded transactions stable references. */
export function hashStr(s: string): number {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}
