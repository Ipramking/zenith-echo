import { Check, ChevronDown } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { NETWORKS } from '../lib/data'
import { MASK, naira } from '../lib/format'
import { useStore } from '../state/store'
import { Sheet } from './Parts'

export interface PickerOption {
  value: string
  label: string // main line
  top?: string // small line above the label
  note?: string // small line under the label
  disabled?: boolean
}

/** Bottom sheet with a radio list and optional search, like the reference app's "Select Bank". */
export function PickerSheet({ title, options, value, onPick, onClose, searchable, empty }: {
  title: string
  options: PickerOption[]
  value?: string
  onPick: (v: string) => void
  onClose: () => void
  searchable?: boolean
  empty?: ReactNode
}) {
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase()
    return n ? options.filter((o) => o.label.toLowerCase().includes(n) || o.top?.toLowerCase().includes(n)) : options
  }, [options, q])
  return (
    <Sheet title={title} onClose={onClose}>
      {searchable && <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label={`Search ${title}`} />}
      <ul className="picker" role="listbox" aria-label={title}>
        {shown.map((o) => (
          <li key={o.value}>
            <button type="button" role="option" aria-selected={o.value === value} disabled={o.disabled} onClick={() => { onPick(o.value); onClose() }}>
              <span className="picker-text">
                {o.top && <small>{o.top}</small>}
                <span className={o.top ? 'big' : ''}>{o.label}</span>
                {o.note && <small className="note">{o.note}</small>}
              </span>
              <i className={'radio' + (o.value === value ? ' on' : '')} />
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="empty"><p>{empty ?? 'No results'}</p></li>}
      </ul>
    </Sheet>
  )
}

/** A dropdown-looking field that opens a PickerSheet. */
export function SelectField({ label, value, placeholder, onOpen, disabled }: { label: string; value?: string; placeholder: string; onOpen: () => void; disabled?: boolean }) {
  return (
    <div className="field">
      <span>{label}</span>
      <button type="button" className={'select' + (value ? '' : ' placeholder')} onClick={onOpen} disabled={disabled}>
        <span>{value || placeholder}</span>
        <ChevronDown size={18} />
      </button>
    </div>
  )
}

/** "Select Source Account": shows the chosen account and opens the balances sheet. */
export function SourceAccountField({ value, onChange, label = 'Select Source Account' }: { value: string; onChange: (id: string) => void; label?: string }) {
  const { accounts, hideBalance } = useStore()
  const [open, setOpen] = useState(false)
  const sel = accounts.find((a) => a.id === value)
  return (
    <>
      <SelectField label={label} value={sel ? `${sel.type} - ${sel.number}` : undefined} placeholder="Select Account" onOpen={() => setOpen(true)} />
      {sel && <p className="avail">Available balance <b>{hideBalance ? MASK : naira(sel.balance)}</b></p>}
      {open && (
        <PickerSheet
          title="Select Source Account"
          value={value}
          onPick={onChange}
          onClose={() => setOpen(false)}
          options={accounts.map((a) => ({
            value: a.id,
            top: `${a.type} - ${a.number}`,
            label: hideBalance ? MASK : naira(a.balance),
            note: a.spendable ? undefined : 'Not available for debit',
            disabled: !a.spendable,
          }))}
        />
      )}
    </>
  )
}

/** Square option tiles with a red tick on the selected one ("Own Account / Zenith Bank / Other Banks"). */
export function ModeTiles<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="modes" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={o.id === value} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>
            {o.id === value && <i className="tick"><Check size={13} strokeWidth={3} /></i>}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Mobile operator tiles. Marks are simple CSS lettering, not the carriers' logo artwork. */
export function NetworkTiles({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="field">
      <span>Select Mobile Operator</span>
      <div className="ops" role="radiogroup" aria-label="Mobile operator">
        {NETWORKS.map((n) => (
          <button key={n.id} type="button" role="radio" aria-checked={n.id === value} className={n.id === value ? 'on' : ''} onClick={() => onChange(n.id)}>
            <i style={{ background: n.bg, color: n.fg }} className={'op-' + n.id}>{n.mark}</i>
            {n.name}
          </button>
        ))}
      </div>
    </div>
  )
}
