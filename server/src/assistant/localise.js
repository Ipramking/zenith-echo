import { toSpeech } from './language.js'

const PIDGIN = [
  [/Hello\. What would you like to do today\?/g, 'How far! Wetin you wan do today?'],
  [/You're on the (.+?) screen\./g, 'You don enter $1 page.'],
  [/Which phone number\? Say the 11 digits, or say 'my number'\./g, "Which phone number? Call the 11 numbers, or talk 'my number'."],
  [/Which network is it\? MTN, Airtel, Glo or 9mobile\?/g, 'Which network be dat? MTN, Airtel, Glo abi 9mobile?'],
  [/That's an? (\S+) number\./g, 'Na $1 number be dis.'],
  [/How much airtime\?/g, 'How much airtime you want?'],
  [/How much would you like to send\?/g, 'How much you wan send?'],
  [/How much electricity do you want to buy\?/g, 'How much light you wan buy?'],
  [
    /Please provide the 10-digit account number, or say the name of a saved contact\./g,
    'Abeg call the 10-digit account number, or talk the name of person wey you don save.',
  ],
  [/Which bank is the account with\?/g, 'Which bank the account dey?'],
  [/Did you mean (.+?)\?/g, 'You mean $1?'],
  [/Account name: (.+?)\./g, 'Account name na $1.'],
  [/Found your saved contact, (.+?)\./g, 'I see $1 for your saved people.'],
  [/Any note for this transfer\? Say the note, or say 'skip'\./g, "You get any note for dis transfer? Talk am, or talk 'skip'."],
  [/Here are the (\S+) plans\./g, 'See the $1 plans.'],
  [/Which one\?/g, 'Which one you want?'],
  [/Which electricity company\? For example Ikeja Electric, Eko or Abuja\./g, 'Which light company? Like Ikeja Electric, Eko abi Abuja.'],
  [/What is the meter number\?/g, 'Wetin be the meter number?'],
  [/This meter belongs to (.+?), (.+?)\./g, 'Dis meter na $1 own, for $2.'],
  [/You are sending (.+?) to (.+?), account (.+?) at (.+?)(, note: .+?)?\./g, 'You wan send $1 give $2, account $3 for $4$5.'],
  [/You are buying (.+?) at (₦[\d,.]+) on (.+?) for (.+?)\./g, 'You wan buy $1 for $2 on $3, for $4.'],
  [/You are buying (.+?) airtime for (.+?)\./g, 'You wan buy $1 airtime for $2.'],
  [/You are paying (.+?) for (.+?) prepaid meter (.+?), owned by (.+?)\./g, 'You wan pay $1 for $2 prepaid meter $3, wey be $4 own.'],
  [/Shall I go ahead\? Say yes to confirm, or tell me what to change\./g, 'Make I go ahead? Talk yes make I continue, or tell me wetin you wan change.'],
  [
    /Please confirm with your fingerprint or face, or type your PIN on the keypad\./g,
    'Abeg use your finger or face confirm am, or type your PIN for the keypad.',
  ],
  [/Please type your PIN on the keypad to confirm\./g, 'Abeg type your PIN for the keypad make we confirm.'],
  [/Because this is above (.+?), please type your PIN on the keypad\./g, 'As e pass $1, abeg type your PIN for the keypad.'],
  [/Transfer successful\. (.+?) has been sent to (.+?)\./g, 'Transfer don go. $1 don reach $2.'],
  [/Done\. (.+?) airtime has been sent to (.+?)\./g, 'E don do. $1 airtime don enter $2.'],
  [/Done\. (.+?) has been added to (.+?)\./g, 'E don do. $1 don enter $2.'],
  [/Payment successful\. Your token is (.+?)\. That is (.+?)\./g, 'Payment don go. Your token na $1. Na $2.'],
  [/Your new balance is (.+?)\./g, 'Wetin remain for your account na $1.'],
  [/Your available balance is (.+?)\./g, 'Wetin dey your account na $1.'],
  [/Here are your last (\d+) transactions\./g, 'See your last $1 transactions.'],
  [/Cancelled\. Nothing was sent\. What would you like to do next\?/g, 'I don cancel am. No money comot. Wetin you wan do next?'],
  [/Sorry, I didn't get that\./g, 'Sorry, I no catch wetin you talk.'],
  [/I heard (\d+) digits?\./g, 'I hear $1 numbers.'],
  [/The account number must be exactly 10 digits\./g, 'Account number suppose be 10 numbers.'],
  [/A phone number has 11 digits\./g, 'Phone number get 11 numbers.'],
  [/The minimum is (.+?)\./g, 'The smallest na $1.'],
  [/The maximum is (.+?)\./g, 'The highest na $1.'],
  [/Your balance can't cover (.+?)\./g, 'Your money no reach $1.'],
  [/That account number doesn't match (.+?)\./g, 'Dat account number no match $1.'],
  [/What would you like to change\? You can say (.+?)\. Or say yes to confirm\./g, 'Wetin you wan change? You fit talk $1. Or talk yes make I continue.'],
  [
    /You can say: send money, buy airtime, buy data, pay electricity, check my balance, or read my transactions\. While paying, you can say go back, repeat, change the amount, or cancel\./g,
    'You fit talk: send money, buy airtime, buy data, pay light, check my balance, or read my transactions. When you dey pay, you fit talk go back, repeat, change the amount, or cancel.',
  ],
]

const PRIVATE = {
  en: {
    balance: 'Your balance is on your screen.',
    token: 'Your token is on your screen.',
    amount: 'the amount',
    number: 'the number ending in',
  },
  pcm: {
    balance: 'Your balance dey your screen.',
    token: 'Your token dey your screen.',
    amount: 'the money',
    number: 'the number wey end with',
  },
}

const PUBLIC_PRICE = /(\bat|above|minimum is|maximum is|smallest na|highest na|pass|for) $/

export function localise(text, language) {
  if (language !== 'pcm') return text
  return PIDGIN.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), text)
}

export function redact(text, language) {
  const words = PRIVATE[language] ?? PRIVATE.en
  return text
    .replace(/(Your (new|available) balance is|Wetin remain for your account na|Wetin dey your account na) ₦[\d,.]+\./g, words.balance)
    .replace(/(Your token is|Your token na) [\d-]+\./g, words.token)
    .replace(/₦[\d,]+(\.\d{1,2})?/g, (match, decimals, offset, whole) =>
      PUBLIC_PRICE.test(whole.slice(Math.max(0, offset - 16), offset)) ? match : words.amount,
    )
    .replace(/\b\d[\d ]{8,}\d\b/g, (match) => {
      const digits = match.replace(/\D/g, '')
      return digits.length >= 10 ? `${words.number} ${digits.slice(-4)}` : match
    })
    .replace(/\b[A-Z]{2,}(?: [A-Z]{2,})+\b/g, (name) => name.split(' ')[0].charAt(0) + name.split(' ')[0].slice(1).toLowerCase())
}

export function buildMessage(text, language) {
  const shown = localise(text, language)
  const hidden = redact(shown, language)
  return {
    text: shown,
    speech: toSpeech(shown),
    privateSpeech: toSpeech(hidden),
    sensitive: hidden !== shown,
  }
}