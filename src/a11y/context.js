import { createContext, useContext } from 'react'

export const AccessibilityContext = createContext(null)

export function useAccessibility() {
  return useContext(AccessibilityContext)
}