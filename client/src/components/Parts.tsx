import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronLeft, EllipsisVertical, FileText, Menu, Mic, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { fmtDate, fmtHist, MASK, naira, signedNaira } from '../lib/format'
import { txnLabel } from '../lib/receipt'
import { useNav } from '../state/nav'
import { useSettings } from '../state/settings'
import { useStore, type Txn } from '../state/store'
import { useEcho } from '../voice/echo'

export function StatusBar() {
  // Only visible inside the desktop phone frame (see .status-bar in styles.css).
  const now = new Date()
  const t = `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`
  return (
    <div className="status-bar" aria-hidden="true">
      <span>{t}</span>
      <span className="sb-icons">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5" width="3" height="7" rx="1" /><rect x="10" y="2.5" width="3" height="9.5" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none"><rect x=".5" y=".5" width="22" height="11" rx="3.5" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="19" height="8" rx="2.2" fill="currentColor" /><rect x="23.5" y="4" width="2" height="4" rx="1" fill="currentColor" opacity=".5" /></svg>
      </span>
    </div>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={'toggle' + (on ? ' on' : '')} onClick={() => onChange(!on)}>
      <span />
    </button>
  )
}

/** Red page header. `back` gives a chevron, `menu` the drawer button; `right` is any trailing controls. */
export function Header({ title, back, menu, right, big }: { title: ReactNode; back?: () => void; menu?: boolean; right?: ReactNode; big?: boolean }) {
  const { setDrawer } = useNav()
  const { settings } = useSettings()
  const { openAsk } = useEcho()
  // Every new screen moves focus to its title, so a screen reader starts reading there.
  const titleRef = useRef<HTMLHeadingElement>(null)
  const titleKey = typeof title === 'string' ? title : ''
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true })
  }, [titleKey])
  return (
    <header className="hero">
      <div className="hero-row">
        {back && (
          <button type="button" className="icon-btn lead" onClick={back} aria-label="Back">
            <ChevronLeft size={28} />
          </button>
        )}
        {menu && (
          <button type="button" className="icon-btn lead" onClick={() => setDrawer(true)} aria-label="Open menu">
            <Menu size={24} />
          </button>
        )}
        <h1 ref={titleRef} tabIndex={-1} className={big ? 'hero-title big' : 'hero-title'}>{title}</h1>
        {settings.voice && (
          <button type="button" className="icon-btn" onClick={() => openAsk(true)} aria-label="Talk to Echo">
            <Mic size={22} />
          </button>
        )}
        {right}
      </div>
    </header>
  )
}

export function KebabButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="icon-btn" onClick={onClick} aria-label="More options">
      <EllipsisVertical size={22} />
    </button>
  )
}

export function Money({ value }: { value: number }) {
  const { hideBalance } = useStore()
  return <>{hideBalance ? MASK : naira(value)}</>
}

/** Compact row used on the home screen. Opens the receipt when tapped. */
export function TxnRow({ t, onOpen }: { t: Txn; onOpen?: () => void }) {
  const { hideBalance } = useStore()
  const credit = t.amount > 0
  return (
    <li>
      <button type="button" className="txn" onClick={onOpen}>
        <span className={'txn-ico ' + (credit ? 'cr' : 'dr')}>{credit ? <ArrowDownLeft size={14} strokeWidth={2.4} /> : <ArrowUpRight size={14} strokeWidth={2.4} />}</span>
        <div className="txn-main">
          <time>{fmtDate(t.at)}</time>
          <p>{t.desc}</p>
        </div>
        <div className="txn-amt">
          <b className={credit ? 'cr' : 'dr'}>{signedNaira(t.amount)}</b>
          <small>{hideBalance ? MASK : naira(t.balanceAfter)}</small>
        </div>
      </button>
    </li>
  )
}

/** History row: coloured left border (red debit, green credit) that expands to show details. */
export function HistoryRow({ t, onReceipt }: { t: Txn; onReceipt: () => void }) {
  const { hideBalance } = useStore()
  const [open, setOpen] = useState(false)
  const credit = t.amount > 0
  return (
    <li className={'hist ' + (credit ? 'cr' : 'dr')}>
      <button type="button" className="hist-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="hist-top">
          <time>{fmtHist(t.at)}</time>
          <b>{naira(Math.abs(t.amount))}</b>
        </span>
        <span className="hist-type">
          {txnLabel(t.desc, t.receipt?.kind)}
          <ChevronDown size={16} className={open ? 'flip' : ''} />
        </span>
      </button>
      {open && (
        <div className="hist-body">
          <p>{t.desc}</p>
          <small>Balance after {hideBalance ? MASK : naira(t.balanceAfter)}</small>
          <button type="button" className="text-link" onClick={onReceipt}><FileText size={14} /> View receipt</button>
        </div>
      )}
    </li>
  )
}

/** Bottom sheet. `bare` skips its own backdrop, for use inside the flow layer which already dims the screen. */
export function Sheet({ title, onClose, children, bare }: { title: string; onClose: () => void; children: ReactNode; bare?: boolean }) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className={'sheet-wrap' + (bare ? ' bare' : '')} onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 ref={titleRef} tabIndex={-1}>{title}</h2>
          <button type="button" className="icon-btn dark" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
