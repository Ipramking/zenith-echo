import { useRef } from 'react'
import { useAccessibility } from '../a11y/context'
import useFeedback from '../a11y/useFeedback'

const REPEAT_WINDOW = 600

export default function SafeButton({ onPress, className = 'control', children, ...rest }) {
  const { settings } = useAccessibility()
  const feedback = useFeedback()
  const lastPress = useRef(0)

  function handleClick(event) {
    const now = Date.now()
    if (settings.tremorGuard && now - lastPress.current < REPEAT_WINDOW) return
    lastPress.current = now
    feedback('tap')
    onPress?.(event)
  }

  return (
    <button type="button" className={className} onClick={handleClick} {...rest}>
      {children}
    </button>
  )
}