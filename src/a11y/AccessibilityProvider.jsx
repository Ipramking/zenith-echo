import { useEffect, useMemo, useState } from 'react'
import { AccessibilityContext } from './context'
import { DEFAULT_SETTINGS, PROFILES, SCALES } from './profiles'

const STORAGE_KEY = 'echo-accessibility'

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    return true
  } catch {
    return false
  }
}

export default function AccessibilityProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.theme
    root.dataset.targets = settings.largeTargets ? 'large' : 'standard'
    root.style.setProperty('--scale', SCALES[settings.scale] ?? 1)
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', settings.theme === 'dark' ? '#121212' : '#FFFFFF')
    saveSettings(settings)
  }, [settings])

  const value = useMemo(
    () => ({
      settings,
      update: (changes) => setSettings((current) => ({ ...current, ...changes })),
      chooseProfile: (id) => {
        const profile = PROFILES.find((p) => p.id === id)
        setSettings({ ...DEFAULT_SETTINGS, ...(profile?.settings ?? {}), profile: id })
      },
      resetProfile: () => setSettings((current) => ({ ...current, profile: null })),
    }),
    [settings],
  )

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>
}