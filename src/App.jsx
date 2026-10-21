import { useState } from 'react'
import { useAccessibility } from './a11y/context'
import ProfilePicker from './components/ProfilePicker'
import AccessibilityPanel from './components/AccessibilityPanel'

export default function App() {
  const { settings } = useAccessibility()
  const [view, setView] = useState('home')

  if (!settings.profile) {
    return (
      <div className="app">
        <ProfilePicker />
      </div>
    )
  }

  if (view === 'settings') {
    return (
      <div className="app">
        <AccessibilityPanel onClose={() => setView('home')} />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">
          Zenith <span>Echo</span>
        </h1>
        <button className="control" onClick={() => setView('settings')}>
          Accessibility
        </button>
      </header>
      <main>
        <section className="card" aria-labelledby="balance-label">
          <p id="balance-label" className="label">
            Available balance
          </p>
          <p className="amount">₦482,500.00</p>
        </section>
      </main>
    </div>
  )
}