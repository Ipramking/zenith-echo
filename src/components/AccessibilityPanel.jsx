import { useState } from 'react'
import { SCALES } from '../a11y/profiles'
import { useAccessibility } from '../a11y/context'
import useFocusOnMount from '../a11y/useFocusOnMount'
import SafeButton from './SafeButton'
import HoldButton from './HoldButton'

const TOGGLES = [
  { key: 'largeTargets', label: 'Large buttons' },
  { key: 'tremorGuard', label: 'Steady taps' },
  { key: 'voice', label: 'Spoken guidance' },
  { key: 'captions', label: 'Captions' },
  { key: 'haptics', label: 'Vibration cues' },
]

export default function AccessibilityPanel({ onClose }) {
  const { settings, update, resetProfile } = useAccessibility()
  const headingRef = useFocusOnMount()
  const [practiceDone, setPracticeDone] = useState(false)
  const percent = Math.round((SCALES[settings.scale] - 1) * 100)
  const isLight = settings.theme === 'light'

  return (
    <main className="screen">
      <h1 className="screen-title" ref={headingRef} tabIndex={-1}>
        Accessibility
      </h1>

      <section className="card stack" aria-labelledby="text-size-title">
        <h2 id="text-size-title" className="section-title">
          Text size
        </h2>
        <div className="row">
          <SafeButton
            onPress={() => update({ scale: Math.max(0, settings.scale - 1) })}
            disabled={settings.scale === 0}
            aria-label="Decrease text size"
          >
            A−
          </SafeButton>
          <span className="readout" aria-live="polite">
            {percent === 0 ? 'Default' : `+${percent}%`}
          </span>
          <SafeButton
            onPress={() => update({ scale: Math.min(SCALES.length - 1, settings.scale + 1) })}
            disabled={settings.scale === SCALES.length - 1}
            aria-label="Increase text size"
          >
            A+
          </SafeButton>
        </div>
      </section>

      <section className="card stack" aria-labelledby="feedback-title">
        <h2 id="feedback-title" className="section-title">
          Display and feedback
        </h2>
        <SafeButton
          className="toggle"
          aria-pressed={isLight}
          onPress={() => update({ theme: isLight ? 'dark' : 'light' })}
        >
          <span>Light mode</span>
          <span className="toggle-state" aria-hidden="true">
            {isLight ? 'On' : 'Off'}
          </span>
        </SafeButton>
        {TOGGLES.map((toggle) => (
          <SafeButton
            key={toggle.key}
            className="toggle"
            aria-pressed={settings[toggle.key]}
            onPress={() => update({ [toggle.key]: !settings[toggle.key] })}
          >
            <span>{toggle.label}</span>
            <span className="toggle-state" aria-hidden="true">
              {settings[toggle.key] ? 'On' : 'Off'}
            </span>
          </SafeButton>
        ))}
      </section>

      <section className="card stack" aria-labelledby="practice-title">
        <h2 id="practice-title" className="section-title">
          Practice confirming
        </h2>
        <p className="label">
          {settings.tremorGuard
            ? 'Press and hold the button until it fills up.'
            : 'Tap the button to confirm.'}
        </p>
        <HoldButton onConfirm={() => setPracticeDone(true)}>Confirm</HoldButton>
        <p className="practice-status" role="status">
          {practiceDone ? 'Well done. This is how you will confirm a transfer.' : ''}
        </p>
      </section>

      <SafeButton
        className="control wide"
        onPress={() => {
          resetProfile()
          onClose()
        }}
      >
        Change my profile
      </SafeButton>
      <SafeButton className="cta" onPress={onClose}>
        Done
      </SafeButton>
    </main>
  )
}