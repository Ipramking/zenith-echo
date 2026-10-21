import { SCALES } from '../a11y/profiles'
import { useAccessibility } from '../a11y/context'
import useFocusOnMount from '../a11y/useFocusOnMount'

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
          <button
            className="control"
            onClick={() => update({ scale: Math.max(0, settings.scale - 1) })}
            disabled={settings.scale === 0}
            aria-label="Decrease text size"
          >
            A−
          </button>
          <span className="readout" aria-live="polite">
            {percent === 0 ? 'Default' : `+${percent}%`}
          </span>
          <button
            className="control"
            onClick={() => update({ scale: Math.min(SCALES.length - 1, settings.scale + 1) })}
            disabled={settings.scale === SCALES.length - 1}
            aria-label="Increase text size"
          >
            A+
          </button>
        </div>
      </section>

      <section className="card stack" aria-labelledby="feedback-title">
        <h2 id="feedback-title" className="section-title">
          Display and feedback
        </h2>
        <button
          className="toggle"
          aria-pressed={isLight}
          onClick={() => update({ theme: isLight ? 'dark' : 'light' })}
        >
          <span>Light mode</span>
          <span className="toggle-state" aria-hidden="true">
            {isLight ? 'On' : 'Off'}
          </span>
        </button>
        {TOGGLES.map((toggle) => (
          <button
            key={toggle.key}
            className="toggle"
            aria-pressed={settings[toggle.key]}
            onClick={() => update({ [toggle.key]: !settings[toggle.key] })}
          >
            <span>{toggle.label}</span>
            <span className="toggle-state" aria-hidden="true">
              {settings[toggle.key] ? 'On' : 'Off'}
            </span>
          </button>
        ))}
      </section>

      <button
        className="control wide"
        onClick={() => {
          resetProfile()
          onClose()
        }}
      >
        Change my profile
      </button>
      <button className="cta" onClick={onClose}>
        Done
      </button>
    </main>
  )
}