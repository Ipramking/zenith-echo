import { useCallback } from 'react'
import { useAccessibility } from './context'
import { cue } from './feedback'

export default function useFeedback() {
  const { settings } = useAccessibility()
  return useCallback((name) => cue(name, { haptics: settings.haptics }), [settings.haptics])
}