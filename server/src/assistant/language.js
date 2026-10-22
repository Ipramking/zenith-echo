import { speakNaira } from '../banking/parsers.js'

const DIGIT_NAMES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

const INTENTS = [
  {
    id: 'electricity',
    pattern: /\b(electric|electricity|light|nepa|meter|prepaid|power bill|disco|ina|owo ina|mona)\b/,
  },
  { id: 'data', pattern: /\b(data|bundle|internet|subscription|\d+\s?(gb|mb)|gig|ayelujara)\b/ },
  { id: 'airtime', pattern: /\b(airtime|recharge|top ?up|credit|call card|recharge card|kaadi|kadi|kaadi ipe)\b/ },
  {
    id: 'balance',
    pattern:
      /\b(balance|how much (do i have|money do i have|is (left )?in my account|remain|dey my account)|wetin remain|my money remain|elo lo ku|melo lo ku|owo melo lo wa)\b/,
  },
  {
    id: 'history',
    pattern: /\b(history|transactions?|statement|recent payments?|what did i (buy|spend|send)|wetin i (buy|spend|send))\b/,
  },
  { id: 'transfer', pattern: /\b(send|transfer|pay|give|fi owo ranse|fi owo ran|ranse owo|fi owo|san owo)\b/ },
]

const PIDGIN_MARKERS = /\b(abeg|wan|dey|una|wetin|comot|sabi|oya|na im|abi|sef|make i|i go|give am|send am|do am|don|e don|no be|wey|how far|pikin|oga|chop)\b/
const YORUBA_MARKERS = /\b(e kaaro|e kaasan|e ku|owo|fi|ranse|elo|melo|ku|jowo|beeni|beeko|rara|mo fe|mi|ra|kaadi|ina|ese|o se)\b/

export function plain(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function detectLanguage(text, sttLanguage, current = 'en') {
  const lower = plain(text)
  const stt = String(sttLanguage ?? '').toLowerCase()
  if (['yo', 'yor'].includes(stt)) return 'yo'
  const yorubaHits = (lower.match(new RegExp(YORUBA_MARKERS, 'g')) ?? []).length
  if (yorubaHits >= 2) return 'yo'
  if (PIDGIN_MARKERS.test(lower)) return 'pcm'
  if (/\b(i want to|i would like|please|could you|can you|i need to|i am)\b/.test(lower)) return 'en'
  return current
}

export function detectIntent(text) {
  const lower = plain(text)
  return INTENTS.find((intent) => intent.pattern.test(lower))?.id ?? null
}

export function isCommand(text, command) {
  const lower = plain(text)
  const patterns = {
    cancel: /\b(cancel|stop|forget it|never ?mind|abort|leave am|forget am|fagile|da duro)\b/,
    back: /\b(go back|previous|back|pada seyin)\b/,
    repeat: /\b(repeat|say (that )?again|what did you say|pardon|talk am again|say am again|tun so)\b/,
    help: /\b(help|what can (you|i) (do|say)|options|ran mi lowo|wetin i fit talk)\b/,
    restart: /\b(start over|start again|restart)\b/,
    yes: /^(yes|yeah|yep|yup|sure|ok|okay|confirm|proceed|go ahead|correct|that'?s (right|correct)|send it|do it|oya|na so|ehen|beeni|send am|do am|e ti dara|o dara)\b/,
    no: /^(no|nope|wrong|incorrect|not (right|correct)|rara|beeko|no be am)\b/,
    skip: /^(skip|none|nothing|no note|no remark|no|no need|rara)\b/,
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
    .replace(/\b1\s?GB\b/g, '1 gigabyte')
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

