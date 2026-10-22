import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

/** A settings section: heading plus a card of rows. One scrolling page, no nested menus. */
export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="set-sec" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <div className="set-card">{children}</div>
    </section>
  )
}

/** Full-width switch row. On/Off is written out as text so it never relies on colour or a tiny knob. */
export function ToggleRow({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="row trow" onClick={() => onChange(!on)}>
      <span className="row-text">
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </span>
      <span className={'onoff ' + (on ? 'on' : 'off')}>{on ? 'On' : 'Off'}</span>
    </button>
  )
}

export interface Choice<T> {
  value: T
  label: string
  note?: string
  disabled?: boolean
}

/** A question with a few big answer buttons side by side (or stacked when they're long). */
export function ChoiceRow<T extends string | number>({ label, hint, value, options, onChange }: { label: string; hint?: string; value: T; options: Choice<T>[]; onChange: (v: T) => void }) {
  return (
    <div className="row crow" role="radiogroup" aria-label={label}>
      <span className="row-text">
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </span>
      <div className="choices">
        {options.map((o) => (
          <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} disabled={o.disabled} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
            {o.label}
            {o.note && <small>{o.note}</small>}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ActionRow({ label, hint, value, onClick, danger }: { label: string; hint?: string; value?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" className={'row arow' + (danger ? ' danger' : '')} onClick={onClick}>
      <span className="row-text">
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </span>
      {value && <span className="row-value">{value}</span>}
      <ChevronRight size={18} className="chev" aria-hidden="true" />
    </button>
  )
}

/** Plain "A−  Step 3 of 6  A+" control for text size. */
export function StepperRow({ label, hint, text, onMinus, onPlus, minusDisabled, plusDisabled }: { label: string; hint?: string; text: string; onMinus: () => void; onPlus: () => void; minusDisabled?: boolean; plusDisabled?: boolean }) {
  return (
    <div className="row srow" role="group" aria-label={label}>
      <span className="row-text">
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </span>
      <div className="stepper">
        <button type="button" onClick={onMinus} disabled={minusDisabled} aria-label={`${label}: smaller`}>A−</button>
        <output aria-live="polite">{text}</output>
        <button type="button" onClick={onPlus} disabled={plusDisabled} aria-label={`${label}: larger`}>A+</button>
      </div>
    </div>
  )
}
