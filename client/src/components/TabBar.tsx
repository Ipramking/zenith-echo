import { CreditCard, House, LayoutGrid, Mic, Repeat2, Smartphone } from 'lucide-react'
import { useNav, type Tab } from '../state/nav'
import { useEcho } from '../voice/echo'

const TABS: { id: Tab; label: string; Icon: typeof House }[] = [
  { id: 'home', label: 'Home', Icon: House },
  { id: 'bills', label: 'Pay Bills', Icon: CreditCard },
  { id: 'airtime', label: 'Airtime', Icon: Smartphone },
  { id: 'transfer', label: 'Transfer', Icon: Repeat2 },
  { id: 'more', label: 'More', Icon: LayoutGrid },
]

export function TabBar() {
  const { tab, setTab } = useNav()
  const echo = useEcho()
  const tabButton = ({ id, label, Icon }: (typeof TABS)[number]) => (
    <button key={id} type="button" className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
      <Icon size={24} strokeWidth={tab === id ? 2.4 : 1.7} />
      <span>{label}</span>
    </button>
  )
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.slice(0, 2).map(tabButton)}
      <button
        type="button"
        className={'tab-echo' + (echo.listening || echo.wakeActive ? ' live' : '')}
        onClick={() => echo.startListening()}
        aria-label={echo.speaking ? 'Echo is speaking. Tap to talk' : 'Talk to Echo'}
      >
        <span className="tab-echo-orb" aria-hidden="true">
          <Mic size={26} />
        </span>
        <span>Echo</span>
      </button>
      {TABS.slice(2).map(tabButton)}
    </nav>
  )
}
