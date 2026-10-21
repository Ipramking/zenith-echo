import { speakNaira } from '../banking/parsers.js'

const DIGIT_NAMES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

const INTENTS = [
  { id: 'electricity', pattern: /\b(electric|electricity|light|nepa|meter|prepaid|power bill|disco)\b/ },
  { id: 'data', pattern: /\b(data|bundle|internet|subscription|\d+\s?(gb|mb)|gig)\b/ },
  { id: 'airtime', pattern: /\b(airtime|recharge|top ?up|credit|call card|recharge card)\b/ },
  { id: 'balance', pattern: /\b(balance|how much (do i have|money do i have|is (left )?in my account))\b/ },
  { id: 'history', pattern: /\b(history|transactions?|statement|recent payments?|what did i (buy|spend|send))\b/ },
  { id: 'transfer', pattern: /\b(send|transfer|pay|give)\b/ },
]

export function detectIntent(text) {
  const lower = text.toLowerCase()
  return INTENTS.find((intent) => intent.pattern.test(lower))?.id ?? null
}

export function isCommand(text, command) {
  const lower = text.toLowerCase().trim()
  const patterns = {
    cancel: /\b(cancel|stop|forget it|never ?mind|abort)\b/,
    back: /\b(go back|previous|back)\b/,
    repeat: /\b(repeat|say (that )?again|what did you say|pardon)\b/,
    help: /\b(help|what can (you|i) (do|say)|options)\b/,
    restart: /\b(start over|start again|restart)\b/,
    yes: /^(yes|yeah|yep|yup|sure|ok|okay|confirm|proceed|go ahead|correct|that'?s (right|correct)|send it|do it)\b/,
    no: /^(no|nope|wrong|incorrect|not (right|correct))\b/,
    skip: /^(skip|none|nothing|no note|no remark|no)\b/,
  }
  return patterns[command].test(lower)
}

export function spellDigits(digits) {
  return digits
    .split('')
    .map((d) => DIGIT_NAMES[Number(d)])
    .join(' ')
}

export function groupDigits(digits) {
  if (digits.length === 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  if (digits.length === 11) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function titleCase(word) {
  return word.charAt(0) + word.slice(1).toLowerCase()
}

export function toSpeech(text) {
  return text
    .replace(/₦\s?([\d,]+(?:\.\d{1,2})?)/g, (match, amount) => speakNaira(Number(amount.replace(/,/g, ''))))
    .replace(/\d[\d -]{5,}\d/g, (match) =>
      match
        .split(/[\s-]+/)
        .map((group) => spellDigits(group))
        .join(', '),
    )
    .replace(/(\d+)\s?GB\b/g, '$1 gigabytes')
    .replace(/(\d+)\s?MB\b/g, '$1 megabytes')
    .replace(/\bkWh\b/g, 'kilowatt hours')
    .replace(/\b[A-Z]{4,}\b/g, titleCase)
}

const ORDINALS = {
  first: 1,
  one: 1,
  second: 2,
  two: 2,
  third: 3,
  three: 3,
  fourth: 4,
  four: 4,
  fifth: 5,
  five: 5,
  sixth: 6,
  six: 6,
  last: -1,
}

export function pickOption(text, options) {
  const lower = text.toLowerCase()
  const byLabel = options.find((option) =>
    [option.label, ...(option.aliases ?? [])].some((name) => lower.includes(name.toLowerCase())),
  )
  if (byLabel) return byLabel

  const numberMatch = lower.match(/\b(?:option|number|plan)?\s*(\d)\b/)
  const ordinalMatch = lower.match(/\b(first|second|third|fourth|fifth|sixth|last|one|two|three|four|five|six)\b/)
  const index = numberMatch ? Number(numberMatch[1]) : ordinalMatch ? ORDINALS[ordinalMatch[1]] : null
  if (index === -1) return options.at(-1)
  if (index && index <= options.length) return options[index - 1]
  if (/\bcheapest\b/.test(lower)) return options[0]
  return null
}