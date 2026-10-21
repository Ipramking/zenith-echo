import { useEffect, useRef, useState } from 'react'
import { useAccessibility } from '../a11y/context'
import useFeedback from '../a11y/useFeedback'

const HOLD_MS = 1000

export default function HoldButton({ onConfirm, children, className = 'cta' }) {
  const { settings } = useAccessibility()
  const feedback = useFeedback()
  const [progress, setProgress] = useState(0)
  const frame = useRef(0)
  const started = useRef(0)
  const done = useRef(false)
  const holdRequired = settings.tremorGuard

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  function tick(time) {
    const value = Math.min(1, (time - started.current) / HOLD_MS)
    setProgress(value)
    if (value >= 1) {
      done.current = true
      feedback('success')
      onConfirm?.()
      return
    }
    frame.current = requestAnimationFrame(tick)
  }

  function handlePointerDown(event) {
    if (!holdRequired) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    done.current = false
    setProgress(0)
    feedback('tap')
    started.current = performance.now()
    frame.current = requestAnimationFrame(tick)
  }

  function stop() {
    cancelAnimationFrame(frame.current)
    if (!done.current) setProgress(0)
  }

  function handleClick(event) {
    if (holdRequired && event.detail !== 0) return
    feedback('success')
    onConfirm?.()
  }

  return (
    <button
      type="button"
      className={`${className} hold`}
      style={{ '--progress': progress }}
      onPointerDown={handlePointerDown}
      onPointerUp={stop}
      onPointerCancel={stop}
      onContextMenu={(event) => holdRequired && event.preventDefault()}
      onClick={handleClick}
    >
      <span className="hold-fill" aria-hidden="true" />
      <span>{children}</span>
      {holdRequired && <span className="hold-hint">Press and hold</span>}
    </button>
  )
}