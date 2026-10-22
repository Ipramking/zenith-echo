export type Dest = 'home' | 'transfer' | 'airtime' | 'data' | 'electricity' | 'cable' | 'bills' | 'history' | 'settings' | 'messages'

export type Command =
  | { type: 'balance' }
  | { type: 'last' }
  | { type: 'help' }
  | { type: 'stop' }
  | { type: 'lock' }
  | { type: 'approve' } // someone tried to approve a payment by voice: always refused
  | { type: 'go'; to: Dest | 'back' }
  | { type: 'send'; who: string; amount?: number }
  | { type: 'textSize'; dir: 'bigger' | 'smaller' }
  | { type: 'theme'; value: 'dark' | 'light' }

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100,
}

/** "5000", "5,000", "5k", "5 thousand", "five thousand" -> number. */
export function parseAmount(s: string): number | undefined {
  const t = s.toLowerCase().replace(/[₦]|ngn|naira|\bn(?=\d)/g, ' ')
  const digits = t.match(/(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|million)?/)
  if (digits) {
    const base = parseFloat(digits[1].replace(/,/g, ''))
    const mult = digits[2] === 'million' ? 1_000_000 : digits[2] ? 1000 : 1
    return base * mult || undefined
  }
  const words = t.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|hundred)\b(?:\s+(hundred|thousand))?/)
  if (words) {
    const base = WORD_NUMBERS[words[1]]
    return words[2] === 'thousand' ? base * 1000 : words[2] === 'hundred' ? base * 100 : base
  }
  return undefined
}

export function parseCommand(input: string): Command | null {
  const raw = input.toLowerCase().trim()
  const t = raw.replace(/[.!?]/g, '').replace(/\s+/g, ' ')
  if (!t) return null

  const send = t.match(/^(?:please )?(?:send|transfer|pay)\s+(.+)$/)
  if (send) {
    const rest = send[1]
    const toMatch = rest.match(/\b(?:to|for)\s+(.+)$/)
    const amount = parseAmount(rest)
    const whoRaw = toMatch ? toMatch[1] : rest
    const who = whoRaw
      .replace(/[₦]|\bngn\b|\bnaira\b/g, ' ')
      .replace(/\b\d[\d,]*(?:\.\d+)?\s*(?:k|thousand|million)?\b/g, ' ')
      .replace(/\b(?:money|some|a|the|please)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    // "send money" with no name falls through to opening the transfer screen
    return who ? { type: 'send', who, amount } : { type: 'go', to: 'transfer' }
  }

  if (/\b(confirm|approve|authori[sz]e|go ahead|pay now|yes pay|complete (the )?(payment|transfer))\b/.test(t)) return { type: 'approve' }
  if (/^(stop|cancel|quiet|be quiet|shut up|enough|silence)$/.test(t)) return { type: 'stop' }
  if (/\b(last|latest|recent)\s+(transaction|payment|transfer|debit|credit)s?\b/.test(t)) return { type: 'last' }
  if (/\bbalance\b|how much (money )?do i have|how much is in my account/.test(t)) return { type: 'balance' }
  if (/\b(help|what can i say|what can you do|commands?)\b/.test(t)) return { type: 'help' }
  if (/\b(lock( the)? app|log ?out|sign ?out)\b/.test(t)) return { type: 'lock' }
  if (/\b(bigger|larger|increase)\b.*\b(text|font|letters)\b|\b(text|font)\b.*\b(bigger|larger)\b/.test(t)) return { type: 'textSize', dir: 'bigger' }
  if (/\b(smaller|decrease|reduce)\b.*\b(text|font|letters)\b|\b(text|font)\b.*\bsmaller\b/.test(t)) return { type: 'textSize', dir: 'smaller' }
  if (/\bdark (mode|theme)\b/.test(t)) return { type: 'theme', value: 'dark' }
  if (/\blight (mode|theme)\b/.test(t)) return { type: 'theme', value: 'light' }

  if (/\bgo back\b|^back$/.test(t)) return { type: 'go', to: 'back' }
  if (/\b(home|overview|main screen)\b/.test(t)) return { type: 'go', to: 'home' }
  if (/\b(airtime|recharge|top ?up)\b/.test(t)) return { type: 'go', to: 'airtime' }
  if (/\bdata( bundle| plan)?s?\b/.test(t)) return { type: 'go', to: 'data' }
  if (/\b(electricity|light bill|nepa|prepaid meter|meter)\b/.test(t)) return { type: 'go', to: 'electricity' }
  if (/\b(cable|dstv|gotv|startimes)\b/.test(t)) return { type: 'go', to: 'cable' }
  if (/\btransfer\b/.test(t)) return { type: 'go', to: 'transfer' }
  if (/\bbills?\b/.test(t)) return { type: 'go', to: 'bills' }
  if (/\b(history|transactions|statement)\b/.test(t)) return { type: 'go', to: 'history' }
  if (/\bsettings?\b/.test(t)) return { type: 'go', to: 'settings' }
  if (/\b(messages?|inbox)\b/.test(t)) return { type: 'go', to: 'messages' }
  return null
}

export const HELP_LIST: { say: string; does: string }[] = [
  { say: 'Check my balance', does: 'Reads your balance. Privacy settings apply.' },
  { say: 'Read my last transaction', does: 'Reads your most recent transaction.' },
  { say: 'Send 5000 naira to Auntie Bukky', does: 'Opens a transfer to a saved contact with the amount filled in. You still confirm it yourself.' },
  { say: 'Open transfer, airtime, data, electricity, cable TV, bills, history, messages or settings', does: 'Goes to that screen.' },
  { say: 'Go home / Go back', does: 'Navigates.' },
  { say: 'Bigger text / Smaller text', does: 'Changes the text size.' },
  { say: 'Dark mode / Light mode', does: 'Changes the theme.' },
  { say: 'Lock the app', does: 'Locks Zenith Echo.' },
  { say: 'Stop', does: 'Stops Echo speaking.' },
  { say: 'Help', does: 'Lists these commands.' },
]
