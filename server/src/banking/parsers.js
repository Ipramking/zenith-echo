const DIGIT_WORDS = {
  zero: '0',
  oh: '0',
  o: '0',
  nil: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
}

const REPEATS = { double: 2, triple: 3 }

export function parseDigits(text) {
  const tokens = text
    .toLowerCase()
    .replace(/(\d)/g, ' $1 ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  let result = ''
  let repeat = 1
  for (const token of tokens) {
    if (REPEATS[token]) {
      repeat = REPEATS[token]
      continue
    }
    const digit = /^\d$/.test(token) ? token : DIGIT_WORDS[token]
    if (digit !== undefined) {
      result += digit.repeat(repeat)
    }
    repeat = 1
  }
  return result
}

const UNITS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
}

const SHORT_SCALES = ['k', 'm', 'mil']

const SCALES = { hundred: 100, thousand: 1000, k: 1000, million: 1000000, m: 1000000, mil: 1000000 }

function wordsToNumber(tokens) {
  let total = 0
  let current = 0
  let found = false
  for (const token of tokens) {
    const isShortScale = SHORT_SCALES.includes(token)
    const isNumberWord =
      /^\d+(\.\d+)?$/.test(token) || token in UNITS || (token in SCALES && !(isShortScale && !current))
    if (!isNumberWord) {
      if (found) break
      continue
    }
    if (/^\d+(\.\d+)?$/.test(token)) {
      current += Number(token)
      found = true
    } else if (token in UNITS) {
      current += UNITS[token]
      found = true
    } else if (token === 'hundred') {
      current = (current || 1) * 100
      found = true
    } else if (token in SCALES) {
      total += (current || 1) * SCALES[token]
      current = 0
      found = true
    }
  }
  return found ? total + current : null
}

export function parseAmount(text) {
  const tokens = text
    .toLowerCase()
    .replace(/₦/g, ' ')
    .replace(/(\d),(\d)/g, '$1$2')
    .replace(/(\d)\s*(k|m|mil)\b/g, '$1 $2')
    .replace(/\ba (hundred|thousand|million)\b/g, 'one $1')
    .replace(/[^a-z0-9. ]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && token !== 'and' && token !== 'naira')
  const value = wordsToNumber(tokens)
  if (value === null || !Number.isFinite(value) || value <= 0) return null
  return Math.round(value * 100) / 100
}

export function formatNaira(amount) {
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function maskAccount(account) {
  return `account ending in ${account.slice(-4)}`
}

export function groupAccount(account) {
  return [account.slice(0, 3), account.slice(3, 6), account.slice(6)].filter(Boolean).join(' ')
}

const SPOKEN_DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

export function speakAccount(account) {
  return [account.slice(0, 3), account.slice(3, 6), account.slice(6)]
    .filter(Boolean)
    .map((group) => group.split('').map((d) => SPOKEN_DIGITS[d]).join(' '))
    .join(', ')
}

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

function underThousand(n) {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const parts = []
  if (hundreds) parts.push(`${ONES[hundreds]} hundred`)
  if (rest) {
    const words = rest < 20 ? ONES[rest] : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? ` ${ONES[rest % 10]}` : ''}`
    parts.push(hundreds ? `and ${words}` : words)
  }
  return parts.join(' ')
}

export function speakNaira(amount) {
  const whole = Math.floor(amount)
  const kobo = Math.round((amount - whole) * 100)
  if (whole === 0 && kobo === 0) return 'zero naira'
  const groups = [
    [Math.floor(whole / 1000000000), 'billion'],
    [Math.floor((whole % 1000000000) / 1000000), 'million'],
    [Math.floor((whole % 1000000) / 1000), 'thousand'],
    [whole % 1000, ''],
  ]
  const words = groups
    .filter(([value]) => value)
    .map(([value, label]) => `${underThousand(value)}${label ? ` ${label}` : ''}`)
    .join(' ')
  const naira = whole ? `${words} naira` : ''
  const koboText = kobo ? `${underThousand(kobo)} kobo` : ''
  return [naira, koboText].filter(Boolean).join(' and ')
}
