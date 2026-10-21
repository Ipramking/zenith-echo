import { useState } from 'react'
import { useAccessibility } from './a11y/context'
import ProfilePicker from './components/ProfilePicker'
import AccessibilityPanel from './components/AccessibilityPanel'
import HomeScreen from './components/HomeScreen'

const SCREENS = {
  home: HomeScreen,
  settings: AccessibilityPanel,
}

export default function App() {
  const { settings } = useAccessibility()
  const [view, setView] = useState('home')
  const Screen = SCREENS[view] ?? HomeScreen

  return (
    <div className="app">
      {settings.profile ? (
        <Screen navigate={setView} onClose={() => setView('home')} />
      ) : (
        <ProfilePicker />
      )}
    </div>
  )
}