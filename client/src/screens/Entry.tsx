import { CircleHelp, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ShapesBg, SwooshBg, WaveBg } from '../components/Art'
import { Logo, ZMark } from '../components/Logo'
import { Sheet } from '../components/Parts'
import { PinPad } from '../components/PinPad'
import { useNav } from '../state/nav'
import { useSettings } from '../state/settings'
import { useEcho } from '../voice/echo'

export function Splash() {
  const { setPhase } = useNav()
  const { settings } = useSettings()
  useEffect(() => {
    // First launch goes to setup; after that, straight to the login screen.
    const t = window.setTimeout(() => setPhase(settings.onboarded ? 'welcome' : 'onboarding'), 2200)
    return () => window.clearTimeout(t)
  }, [setPhase, settings.onboarded])
  return (
    <div className="screen entry splash">
      <WaveBg />
      <div className="splash-logo">
        <Logo size={92} />
      </div>
    </div>
  )
}

export function Welcome() {
  const { setPhase, toast } = useNav()
  useEffect(() => {
    document.querySelector<HTMLElement>('.welcome-bottom h1')?.focus()
  }, [])
  const unavailable = (what: string) => toast(`${what} isn't wired up in this demo`)
  return (
    <div className="screen entry welcome">
      <ShapesBg />
      <div className="welcome-top">
        <Logo size={56} />
      </div>
      <div className="welcome-bottom">
        <h1 tabIndex={-1}>Making Life Simple</h1>
        <p>Experience the freedom of banking on your own terms</p>
        <button type="button" className="btn solid" onClick={() => setPhase('passcode')}>Login</button>
        <button type="button" className="btn ghost" onClick={() => unavailable('Internet Banking')}>Internet Banking</button>
        <button type="button" className="btn ghost" onClick={() => unavailable('Account opening')}>Open an account</button>
        <div className="welcome-foot">
          <button type="button" className="link-btn" onClick={() => unavailable('Help & Enquiries')}>
            <CircleHelp size={16} /> Help &amp; Enquiries
          </button>
          <span>Echo demo · v0.2.0</span>
        </div>
      </div>
    </div>
  )
}

export function Passcode() {
  const { setPhase, toast } = useNav()
  const { verifyPin, resetAll } = useSettings()
  const echo = useEcho()
  const [msg, setMsg] = useState('')
  const [round, setRound] = useState(0)
  const [forgot, setForgot] = useState(false)

  useEffect(() => {
    document.querySelector<HTMLElement>('.pass-body h1')?.focus()
    void echo.say('Enter your 4-digit PIN.')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="screen entry passcode">
      <SwooshBg />
      <div className="pass-body">
        <Lock size={34} strokeWidth={1.8} />
        <h1 tabIndex={-1}>Enter your PIN to login</h1>
        <div className={'pass-pad' + (msg ? ' bad' : '')} key={round}>
          <PinPad
            length={4}
            onComplete={async (code) => {
              if (await verifyPin(code)) {
                echo.cue('success')
                setPhase('app')
              } else {
                echo.alertUser('error')
                void echo.say('Wrong PIN. Try again.')
                setMsg('Wrong PIN. Try again.')
                setRound((r) => r + 1)
              }
            }}
          />
        </div>
        <p className="pass-msg" role="status" aria-live="polite">{msg}</p>
        <button type="button" className="forgot link-btn center" onClick={() => setForgot(true)}>Forgot Passcode ?</button>
        <button type="button" className="link-btn center" onClick={() => toast('Help is not available in this demo')}>
          <CircleHelp size={17} /> Get Help
        </button>
      </div>
      <p className="demo-hint"><ZMark size={12} /> Demo build: your PIN is stored only on this device</p>

      {forgot && (
        <Sheet title="Forgot your PIN?" onClose={() => setForgot(false)}>
          <p className="about">This demo can’t send you a reset code. You can start setup again, which clears your PIN and settings. Your sample accounts are not changed.</p>
          <div className="sheet-actions">
            <button type="button" className="btn ghost-dark" onClick={() => setForgot(false)}>Cancel</button>
            <button type="button" className="btn solid red" onClick={() => { resetAll(); setForgot(false); setPhase('onboarding') }}>Start setup again</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
