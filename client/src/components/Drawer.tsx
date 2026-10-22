import { ArrowLeftRight, History, LayoutList, LogOut, Mail, Receipt, Settings, Smartphone, Tv, Wifi, Zap, type LucideIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { PROFILE } from '../lib/data'
import { INBOX } from '../lib/data'
import { useNav } from '../state/nav'
import { ZMark } from './Logo'

/** Slide-in menu, like the reference app's side drawer. */
export function Drawer() {
  const { drawer, setDrawer, setTab, startTransfer, openRecharge, openBill, openAccount, openInbox, setPhase } = useNav()

  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (drawer) titleRef.current?.focus({ preventScroll: true }) // opening the menu is a new screen: focus its title
  }, [drawer])

  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer, setDrawer])

  if (!drawer) return null

  const items: { label: string; Icon: LucideIcon; run: () => void; badge?: number }[] = [
    { label: 'Overview', Icon: LayoutList, run: () => setTab('home') },
    { label: 'Transfer', Icon: ArrowLeftRight, run: () => startTransfer() },
    { label: 'Airtime Recharge', Icon: Smartphone, run: () => openRecharge('airtime') },
    { label: 'Data Bundles', Icon: Wifi, run: () => openRecharge('data') },
    { label: 'Bill Payment', Icon: Receipt, run: () => setTab('bills') },
    { label: 'Electricity', Icon: Zap, run: () => openBill('electricity') },
    { label: 'Cable TV', Icon: Tv, run: () => openBill('cable') },
    { label: 'Transaction History', Icon: History, run: () => openAccount('sav') },
    { label: 'Messages', Icon: Mail, run: openInbox, badge: INBOX.length },
    { label: 'Settings', Icon: Settings, run: () => setTab('more') },
  ]

  return (
    <div className="drawer-wrap" onClick={() => setDrawer(false)}>
      <aside className="drawer" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <span className="drawer-mark"><ZMark size={22} /></span>
          <h2 className="sr" ref={titleRef} tabIndex={-1}>Menu</h2>
          <p>{PROFILE.fullName}</p>
        </div>
        <ul>
          {items.map(({ label, Icon, run, badge }) => (
            <li key={label}>
              <button type="button" onClick={run}>
                <Icon size={20} strokeWidth={1.6} />
                {label}
                {badge ? <i className="badge">{badge}</i> : null}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="signout" onClick={() => setPhase('welcome')}>
          <LogOut size={18} /> Sign Out
        </button>
      </aside>
    </div>
  )
}
