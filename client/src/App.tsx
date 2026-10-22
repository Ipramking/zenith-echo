import { useEffect, useRef } from 'react'
import { Drawer } from './components/Drawer'
import { AskSheet, CaptionBar, FlashLayer } from './components/EchoUi'
import { StatusBar } from './components/Parts'
import { TabBar } from './components/TabBar'
import { BILL_CATEGORIES } from './lib/data'
import { Bills } from './screens/Bills'
import { Passcode, Splash, Welcome } from './screens/Entry'
import { FlowHost } from './screens/Flow'
import { Account, Home, Inbox } from './screens/Home'
import { Onboarding } from './screens/Onboarding'
import { Recharge } from './screens/Recharge'
import { Settings } from './screens/Settings'
import { Transfer } from './screens/Transfer'
import { FlowProvider, useFlow } from './state/flow'
import { NavProvider, useNav } from './state/nav'
import { SettingsProvider, useSettings } from './state/settings'
import { StoreProvider } from './state/store'
import { EchoProvider, useEcho } from './voice/echo'
import { useTouchRead } from './voice/touchread'
import { navigatedByVoice } from './voice/fill'

function Screens() {
  const { phase, tab, page, resetKey } = useNav()

  if (phase === 'splash') return <Splash />
  if (phase === 'onboarding') return <Onboarding />
  if (phase === 'welcome') return <Welcome />
  if (phase === 'passcode') return <Passcode />

  if (page?.name === 'account') return <div className="screen"><Account key={page.accountId} accountId={page.accountId} /></div>
  if (page?.name === 'inbox') return <div className="screen"><Inbox /></div>

  return (
    // resetKey remounts the tab screens after a payment completes, so every form starts empty again
    <div className="screen" key={resetKey}>
      {tab === 'home' && <Home />}
      {tab === 'bills' && <Bills />}
      {tab === 'airtime' && <Recharge />}
      {tab === 'transfer' && <Transfer />}
      {tab === 'more' && <Settings />}
      <TabBar />
    </div>
  )
}

function useScreenName(): string {
  const { tab, page, recharge, billCat } = useNav()
  if (page) return page.name === 'account' ? 'Transaction history' : 'Messages'
  if (tab === 'home') return 'Home'
  if (tab === 'bills') return BILL_CATEGORIES.find((c) => c.id === billCat)?.name ?? 'Bill payment'
  if (tab === 'airtime') return recharge === 'data' ? 'Data bundles' : 'Airtime recharge'
  if (tab === 'transfer') return 'Transfer'
  return 'Settings'
}

/** Behaviour that spans screens: auto-lock, and Echo announcing where you are and what just happened. */
function useAppBehaviour() {
  useTouchRead()
  const { phase, tab, page, toastMsg, setPhase } = useNav()
  const { settings } = useSettings()
  const { flow } = useFlow()
  const echo = useEcho()
  const name = useScreenName()
  const flowRef = useRef(flow)
  flowRef.current = flow
  const echoRef = useRef(echo)
  echoRef.current = echo

  // Lock after a stretch of inactivity (longer if "longer time limits" is on). Never mid-payment.
  useEffect(() => {
    if (phase !== 'app') return
    const limit = (settings.longerTimeouts ? 6 : 2) * 60_000
    let t = window.setTimeout(lock, limit)
    function lock() {
      const st = flowRef.current?.stage
      if (st === 'processing' || st === 'countdown') {
        t = window.setTimeout(lock, 15_000)
        return
      }
      setPhase('passcode')
    }
    const reset = () => {
      window.clearTimeout(t)
      t = window.setTimeout(lock, limit)
    }
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'echo-activity'] as const
    events.forEach((e) => window.addEventListener(e, reset, { capture: true, passive: true }))
    return () => {
      window.clearTimeout(t)
      events.forEach((e) => window.removeEventListener(e, reset, { capture: true }))
    }
  }, [phase, settings.longerTimeouts, setPhase])

  // Announce the screen. On Home, optionally open the microphone afterwards ("listen automatically").
  useEffect(() => {
    if (phase !== 'app') return
    const e = echoRef.current
    let cancelled = false
    if (navigatedByVoice()) return
    void (async () => {
      const onHome = tab === 'home' && !page
      await e.say(onHome ? 'Home. What would you like to do? Say send money, buy airtime, or buy data.' : name)
      if (cancelled || !onHome || !settings.voice || !settings.autoListen || settings.wakeWord || !e.canListen || e.mic === 'denied') return
      const r = await e.listen(8000)
      if (!cancelled && r.text) await e.runCommand(r.text)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, name])

  // Toasts are announced and, if turned on, buzz and flash too.
  useEffect(() => {
    if (!toastMsg) return
    echoRef.current.alertUser('info')
    void echoRef.current.say(toastMsg)
  }, [toastMsg])
}

function Shell() {
  const { phase, toastMsg } = useNav()
  useAppBehaviour()
  return (
    <main className="stage">
      <div className="device" data-phase={phase}>
        <Screens />
        {phase === 'app' && <Drawer />}
        {phase === 'app' && <AskSheet />}
        {phase === 'app' && <FlowHost />}
        <CaptionBar />
        <FlashLayer />
        <StatusBar />
        <div className="home-indicator" aria-hidden="true" />
        {toastMsg && <div className="toast" role="status" aria-live="polite">{toastMsg}</div>}
      </div>
      <p className="caption">Zenith Echo · front-end prototype · demo data only</p>
    </main>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <StoreProvider>
        <NavProvider>
          <EchoProvider>
            <FlowProvider>
              <Shell />
            </FlowProvider>
          </EchoProvider>
        </NavProvider>
      </StoreProvider>
    </SettingsProvider>
  )
}
