import { CreditCard, House, LayoutGrid, Repeat2, Smartphone } from 'lucide-react'
import { useNav, type Tab } from '../state/nav'

const TABS: { id: Tab; label: string; Icon: typeof House }[] = [
  { id: 'home', label: 'Home', Icon: House },
  { id: 'bills', label: 'Pay Bills', Icon: CreditCard },
  { id: 'airtime', label: 'Airtime', Icon: Smartphone },
  { id: 'transfer', label: 'Transfer', Icon: Repeat2 },
  { id: 'more', label: 'More', Icon: LayoutGrid },
]

export function TabBar() {
  const { tab, setTab } = useNav()
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map(({ id, label, Icon }) => (
        <button key={id} type="button" className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
          <Icon size={24} strokeWidth={tab === id ? 2.4 : 1.7} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
