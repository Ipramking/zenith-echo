import { Delete } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEcho } from '../voice/echo'
import { pinPadMounted } from '../voice/fill'

const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']

function shuffled(): number[] {
  const a = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * PIN entry on a big keypad. The keys stay in the same place every time, so customers learn where each digit is.
 * Each key is labelled with its digit ("Five"). Progress is announced as "digit 2 of 4 entered", never the digit itself.
 */
export function PinPad({ onComplete, length = 6, shuffle = false }: { onComplete: (code: string) => void; length?: number; shuffle?: boolean }) {
  const echo = useEcho()
  const [digits, setDigits] = useState('')
  useEffect(() => {
    pinPadMounted(true)
    return () => pinPadMounted(false)
  }, [])
  const [status, setStatus] = useState('')
  const layout = useMemo(() => (shuffle ? shuffled() : [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]), [shuffle])
  const done = useRef(onComplete)
  done.current = onComplete
  const say = useRef(echo.say)
  say.current = echo.say

  const announce = useCallback((text: string) => {
    setStatus(text)
    void say.current(text, { force: true, volume: 0.2, noCaption: true })
  }, [])

  // A ref holds the digits so each press is announced exactly once (state updaters can run twice in dev).
  const digitsRef = useRef('')
  const set = (v: string) => {
    digitsRef.current = v
    setDigits(v)
  }

  const press = useCallback(
    (d: string) => {
      const cur = digitsRef.current
      if (cur.length >= length) return
      set(cur + d)
      announce(`Digit ${cur.length + 1} of ${length} entered`)
    },
    [length, announce],
  )
  const back = useCallback(() => {
    const cur = digitsRef.current
    if (!cur) return
    set(cur.slice(0, -1))
    announce(`Digit deleted. ${cur.length - 1} of ${length} entered`)
  }, [length, announce])
  useEffect(() => {
    if (digits.length !== length) return
    const t = window.setTimeout(() => done.current(digits), 300)
    return () => window.clearTimeout(t)
  }, [digits, length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press, back])

  const key = (d: number) => (
    <button key={d} type="button" className="key" aria-label={WORDS[d]} onClick={() => press(String(d))}>
      {d}
    </button>
  )

  return (
    <div className="pinpad">
      <div className="dots" role="img" aria-label={`${digits.length} of ${length} digits entered`}>
        {Array.from({ length }, (_, i) => (
          <span key={i} className={i < digits.length ? 'filled' : ''} />
        ))}
      </div>
      <p className="sr" role="status" aria-live="polite">{status}</p>
      <div className="keypad">
        {layout.slice(0, 9).map(key)}
        <span />
        {key(layout[9])}
        <button type="button" className="key del" onClick={back} aria-label="Delete last digit">
          <Delete size={26} strokeWidth={1.7} />
        </button>
      </div>
    </div>
  )
}
