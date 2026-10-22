import { useCallback, useEffect, useRef, useState } from 'react'
import { useEcho } from '../voice/echo'

/**
 * Press and hold until the bar fills, then it fires once. Releasing early cancels, so a tremor or an
 * accidental brush can't confirm anything. Works with a finger, a mouse, or holding Space/Enter.
 */
export function HoldButton({ label, holdMs, onConfirm, autoFocus, className = '' }: { label: string; holdMs: number; onConfirm: () => void; autoFocus?: boolean; className?: string }) {
  const { cue, buzz } = useEcho()
  const [p, setP] = useState(0)
  const raf = useRef(0)
  const t0 = useRef(0)
  const holding = useRef(false)
  const fired = useRef(false)
  const confirm = useRef(onConfirm)
  confirm.current = onConfirm

  const tick = useCallback(
    (t: number) => {
      if (!holding.current) return
      const v = Math.min(1, (t - t0.current) / holdMs)
      setP(v)
      if (v >= 1) {
        holding.current = false
        fired.current = true
        buzz(60)
        cue('success')
        confirm.current()
        return
      }
      raf.current = requestAnimationFrame(tick)
    },
    [holdMs, buzz, cue],
  )

  const begin = () => {
    if (holding.current || fired.current) return
    holding.current = true
    t0.current = performance.now()
    raf.current = requestAnimationFrame(tick)
  }
  const end = () => {
    holding.current = false
    cancelAnimationFrame(raf.current)
    if (!fired.current) setP(0)
  }

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const secs = holdMs / 1000
  return (
    <button
      type="button"
      className={'hold ' + className}
      autoFocus={autoFocus}
      aria-label={`${label}. Press and hold for ${secs} ${secs === 1 ? 'second' : 'seconds'}.`}
      onPointerDown={(e) => {
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId) // keeps the hold alive if the finger drifts off the button
        } catch {
          /* some browsers refuse; holding still works without it */
        }
        begin()
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault()
          begin()
        }
      }}
      onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && end()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="hold-fill" style={{ transform: `scaleX(${p})` }} aria-hidden="true" />
      <span className="hold-label">{p >= 1 ? 'Confirmed' : p > 0 ? 'Keep holding…' : label}</span>
      <span className="hold-sub" aria-hidden="true">Hold for {secs}s</span>
    </button>
  )
}
