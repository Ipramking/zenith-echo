import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSettings } from './settings'

export type Phase = 'splash' | 'onboarding' | 'welcome' | 'passcode' | 'app'
export type Tab = 'home' | 'bills' | 'airtime' | 'transfer' | 'more'
export type Page = { name: 'account'; accountId: string } | { name: 'inbox' }
export type RechargeMode = 'airtime' | 'data'

export interface Prefill {
  mode?: 'own' | 'zenith' | 'other'
  name: string
  bank: string
  accountNumber: string
  amount?: number
  viaVoice?: boolean
}

interface Nav {
  phase: Phase
  setPhase: (p: Phase) => void
  tab: Tab
  setTab: (t: Tab) => void
  page: Page | null
  openAccount: (id: string) => void
  openInbox: () => void
  closePage: () => void
  /** Bumped when a flow finishes, so the tab screens remount with empty forms. */
  resetKey: number
  bump: () => void
  drawer: boolean
  setDrawer: (v: boolean) => void
  recharge: RechargeMode
  openRecharge: (m: RechargeMode) => void
  billCat: string | null
  setBillCat: (c: string | null) => void
  openBill: (cat: string) => void
  prefill: Prefill | null
  startTransfer: (p?: Prefill) => void
  /** True while the tutorial is being replayed from Settings (an existing PIN can be kept). */
  replay: boolean
  startTutorial: () => void
  toastMsg: string | null
  toast: (msg: string) => void
}

const Ctx = createContext<Nav | null>(null)

/** Dev only: open the dev server at e.g. /#account to jump straight to a screen. */
function devStart(): { phase: Phase; tab: Tab; page: Page | null } {
  const base = { phase: 'splash' as Phase, tab: 'home' as Tab, page: null as Page | null }
  if (!import.meta.env.DEV) return base
  const h = location.hash.replace('#', '')
  if (h === 'welcome' || h === 'passcode' || h === 'onboarding') return { ...base, phase: h }
  if (h === 'account') return { ...base, phase: 'app', page: { name: 'account', accountId: 'sav' } }
  if (h === 'inbox') return { ...base, phase: 'app', page: { name: 'inbox' } }
  if (['home', 'bills', 'airtime', 'transfer', 'more'].includes(h)) return { ...base, phase: 'app', tab: h as Tab }
  return base
}

export function NavProvider({ children }: { children: ReactNode }) {
  const [start] = useState(devStart)
  const [phase, setPhase] = useState<Phase>(start.phase)
  const [tab, setTabState] = useState<Tab>(start.tab)
  const [page, setPage] = useState<Page | null>(start.page)
  const [resetKey, setResetKey] = useState(0)
  const [drawer, setDrawer] = useState(false)
  const [recharge, setRecharge] = useState<RechargeMode>('airtime')
  const [billCat, setBillCat] = useState<string | null>(null)
  const [prefill, setPrefill] = useState<Prefill | null>(null)
  const [replay, setReplay] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const { settings } = useSettings()
  const toastMs = useRef(2600)
  toastMs.current = settings.longerTimeouts ? 9000 : 2600

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const toast = useCallback((msg: string) => {
    setToastMsg(msg)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToastMsg(null), toastMs.current)
  }, [])

  const value = useMemo<Nav>(() => {
    const go = (t: Tab) => {
      setPage(null)
      setDrawer(false)
      setTabState(t)
    }
    return {
      phase,
      setPhase: (p) => {
        setDrawer(false)
        if (p !== 'onboarding') setReplay(false)
        setPhase(p)
      },
      tab,
      setTab: (t) => {
        if (t === 'bills') setBillCat(null)
        go(t)
      },
      page,
      openAccount: (accountId) => {
        setDrawer(false)
        setPage({ name: 'account', accountId })
      },
      openInbox: () => {
        setDrawer(false)
        setPage({ name: 'inbox' })
      },
      closePage: () => setPage(null),
      resetKey,
      bump: () => setResetKey((k) => k + 1),
      drawer,
      setDrawer,
      recharge,
      openRecharge: (m) => {
        setRecharge(m)
        go('airtime')
      },
      billCat,
      setBillCat,
      openBill: (c) => {
        setBillCat(c)
        go('bills')
      },
      prefill,
      startTransfer: (p) => {
        setPrefill(p ?? null)
        setResetKey((k) => k + 1) // rebuild the form so a new prefill (e.g. from a voice command) replaces what was typed
        go('transfer')
      },
      replay,
      startTutorial: () => {
        setReplay(true)
        setDrawer(false)
        setPage(null)
        setPhase('onboarding')
      },
      toastMsg,
      toast,
    }
  }, [phase, tab, page, resetKey, drawer, recharge, billCat, prefill, replay, toastMsg, toast])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useNav(): Nav {
  const v = useContext(Ctx)
  if (!v) throw new Error('useNav outside NavProvider')
  return v
}
