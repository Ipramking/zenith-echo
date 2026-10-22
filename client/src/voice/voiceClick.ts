const IGNORE = new Set(['a', 'an', 'the', 'i', 'i’m', 'im', 'to', 'of', 'or', 'and', 'please', 'it', 'is', 'my', 'me', 'you', 'can', 'want', 'would', 'like'])

const SYNONYMS: [RegExp, RegExp][] = [
  [/^(yes|yeah|yep|i can|i can hear you|loud and clear|clear)\b/i, /^yes/i],
  [/\b(louder|slower|can't hear|cannot hear|too fast|repeat)\b/i, /louder|slower/i],
  [/\b(captions?|read|text)\b/i, /captions/i],
  [/^(no|none|nothing|nope|none of these|no thanks)\b/i, /none of these|^skip$/i],
  [/^(next|continue|done|go on|move on|okay|ok|that's all|that is all|finish|proceed)\b/i, /^(next|continue|done|go to home|none of these|keep my pin)/i],
  [/^(skip)\b/i, /^skip$/i],
  [/^(back|go back|previous)\b/i, /^back$/i],
  [/\b(hard of hearing|deaf|hearing)\b/i, /hard of hearing/i],
  [/\b(tremor|tremors|shaking|shake|tapping)\b/i, /tremors/i],
  [/\b(simple|plain|easy) words?\b/i, /simple words/i],
]

const nameOf = (el: HTMLElement) => (el.getAttribute('aria-label') || el.querySelector('b')?.textContent || el.innerText || '').replace(/\s+/g, ' ').trim()
const tokens = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9' ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !IGNORE.has(w))

/** Hands-free: say what is written on a button and Echo presses it. Returns the button it pressed. */
export function clickByVoice(spoken: string, root: ParentNode = document): HTMLElement | null {
  // Never press PIN keys by voice: a PIN is only ever typed.
  const buttons = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled])')).filter(
    (b) => b.offsetParent !== null && !b.closest('.pinpad, .keypad'),
  )
  if (!buttons.length) return null

  for (const [said, target] of SYNONYMS) {
    if (!said.test(spoken)) continue
    const match = buttons.find((b) => target.test(nameOf(b)))
    if (match) {
      match.click()
      return match
    }
  }

  const heard = new Set(tokens(spoken))
  let best: HTMLElement | null = null
  let bestScore = 0
  for (const b of buttons) {
    const name = tokens(nameOf(b).split(/[.\n]/)[0])
    if (!name.length) continue
    const score = name.filter((w) => heard.has(w)).length / name.length
    if (score > bestScore) {
      best = b
      bestScore = score
    }
  }
  if (best && bestScore >= 0.5) {
    best.click()
    return best
  }
  return null
}
