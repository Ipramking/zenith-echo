import { Check, Copy, Download, Fingerprint, Share2, X } from 'lucide-react'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { Logo } from '../components/Logo'
import { HoldButton } from '../components/HoldButton'
import { Header, Sheet } from '../components/Parts'
import { PinPad } from '../components/PinPad'
import { money, moneyWords, naira } from '../lib/format'
import { receiptPng, receiptRows, receiptText } from '../lib/receipt'
import { useFlow } from '../state/flow'
import { useNav } from '../state/nav'
import { useSettings } from '../state/settings'
import { useStore } from '../state/store'
import { message, useEcho } from '../voice/echo'

function Dialog({ title, onClose, children, footer }: { title: string; onClose?: () => void; children: ReactNode; footer?: ReactNode }) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true }) // a new dialog is a new screen: focus its title
  }, [])
  useEffect(() => {
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="dialog-wrap">
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog-head">
          <h2 ref={titleRef} tabIndex={-1}>{title}</h2>
          {onClose && (
            <button type="button" className="icon-btn dark" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          )}
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  )
}

/* ---------------- 1. confirm ---------------- */

function Confirm() {
  const { flow, back, setStage } = useFlow()
  const { account } = useStore()
  const { settings } = useSettings()
  const i = flow!.intent!
  const acct = account(i.accountId)
  return (
    <Dialog
      title="Confirm Transaction"
      onClose={back}
      footer={
        <>
          <button type="button" className="flat" onClick={back}>CANCEL</button>
          {settings.holdToConfirm ? (
            <HoldButton label="HOLD TO CONFIRM" holdMs={settings.holdMs} onConfirm={() => setStage('auth')} className="flat-hold" />
          ) : (
            <button type="button" className="flat primary" onClick={() => setStage('auth')}>CONFIRM</button>
          )}
        </>
      }
    >
      <p className="confirm-label">You are about to pay</p>
      <p className="confirm-amount">{naira(i.amount)}</p>
      <p className="confirm-title">{i.title}</p>
      <dl className="review">
        <dt>From</dt>
        <dd>{acct.type} - {acct.number}</dd>
        {i.rows.map(([k, v], n) => (
          <Fragment key={n}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </Fragment>
        ))}
        <dt>Fee + VAT</dt>
        <dd>{naira(i.fee)}</dd>
        <dt>Total</dt>
        <dd><b>{naira(i.amount + i.fee)}</b></dd>
      </dl>
      <p className="fine">Check the details carefully. Completed transactions can't be reversed.</p>
      {settings.holdToConfirm && <p className="fine hold-hint">Press and hold the confirm button for {settings.holdMs / 1000} {settings.holdMs === 1000 ? 'second' : 'seconds'}. Letting go early cancels.</p>}
    </Dialog>
  )
}

/* ---------------- 2. authorize (biometrics, passcode fallback) ---------------- */

type Scan = 'idle' | 'scanning' | 'ok'

function Auth() {
  const { flow, back, setStage } = useFlow()
  const { settings, verifyPin } = useSettings()
  const echo = useEcho()
  const i = flow!.intent!
  // Started by voice and above the voice limit: only the PIN will do, never the fingerprint.
  const forcePin = !!i.viaVoice && i.amount > settings.voiceLimit
  const bio = settings.biometrics && !forcePin
  const [mode, setMode] = useState<'bio' | 'pin'>(bio ? 'bio' : 'pin')
  const [scan, setScan] = useState<Scan>('idle')
  const [msg, setMsg] = useState('')
  const [round, setRound] = useState(0)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  // With "steady taps" on, there's a countdown to cancel before the payment is sent.
  const approved = () => setStage(settings.tremorGuard ? 'countdown' : 'processing')

  // Simulated sensor: a short scan, a beat on the success tick, then on.
  const verify = () => {
    if (scan !== 'idle') return
    setScan('scanning')
    echo.buzz(30)
    timers.current.push(
      window.setTimeout(() => {
        setScan('ok')
        echo.alertUser('success')
        timers.current.push(window.setTimeout(approved, 550))
      }, 1100),
    )
  }

  return (
    <Sheet title="Authorize Transaction" onClose={back} bare>
      <p className="auth-sum">
        <b>{naira(i.amount + i.fee)}</b>
        <span>{i.title}</span>
      </p>
      {mode === 'bio' ? (
        <div className="auth-bio">
          <button type="button" className={'fp ' + scan} onClick={verify} aria-label="Verify with fingerprint">
            <i /><i />
            {scan === 'ok' ? <Check size={54} strokeWidth={2.2} /> : <Fingerprint size={58} strokeWidth={1.3} />}
          </button>
          <p className="fp-hint" aria-live="polite">
            {scan === 'idle' ? 'Touch the sensor to confirm it’s you' : scan === 'scanning' ? 'Scanning…' : 'Verified'}
          </p>
          <button type="button" className="text-link" onClick={() => setMode('pin')} disabled={scan !== 'idle'}>Use PIN instead</button>
        </div>
      ) : (
        <div className="auth-pin">
          <p className="fp-hint" aria-live="polite">
            {forcePin ? `Above your voice limit of ${money(settings.voiceLimit)}, so your PIN is needed.` : 'Enter your 4-digit PIN'}
          </p>
          {msg && <p className="ob-note" role="status" aria-live="polite">{msg}</p>}
          <PinPad
            key={round}
            length={4}
            onComplete={async (code) => {
              if (await verifyPin(code)) approved()
              else {
                echo.alertUser('error')
                setMsg('Wrong PIN. Try again.')
                void echo.say('Wrong PIN. Try again.')
                setRound((r) => r + 1)
              }
            }}
          />
          {bio && (
            <button type="button" className="text-link" onClick={() => setMode('bio')}>Use fingerprint instead</button>
          )}
        </div>
      )}
    </Sheet>
  )
}

/* ---------------- 2b. cancel countdown (steady taps) ---------------- */

function Countdown() {
  const { cancel, setStage } = useFlow()
  const { settings } = useSettings()
  const echo = useEcho()
  const [n, setN] = useState<number>(settings.countdownSeconds)

  useEffect(() => {
    void echo.say(`Sending in ${settings.countdownSeconds} seconds. Tap Cancel to stop.`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (n <= 0) {
      setStage('processing')
      return
    }
    const t = window.setTimeout(() => {
      echo.cue('tick')
      if (n - 1 > 0 && n - 1 <= 3) void echo.say(String(n - 1))
      setN(n - 1)
    }, 1000)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n])

  return (
    <Dialog title="Sending your payment">
      <p className="confirm-label">Your payment will be sent in</p>
      <div className="count" role="timer" aria-label={`${n} seconds`}>{n}</div>
      <button type="button" className="btn cancel-big" onClick={cancel}>CANCEL PAYMENT</button>
      <p className="fine">Nothing has been sent yet.</p>
    </Dialog>
  )
}
/* ---------------- 3. processing ---------------- */

function Processing() {
  const { complete } = useFlow()
  useEffect(() => {
    const t = window.setTimeout(complete, 1700)
    return () => window.clearTimeout(t)
  }, [complete])
  return (
    <Dialog title="Processing">
      <div className="spinner" role="progressbar" aria-label="Processing" />
      <p className="success-msg" role="status" aria-live="polite">Processing your transaction</p>
      <p className="fine">Please don't close this screen.</p>
    </Dialog>
  )
}

/* ---------------- 4. success ---------------- */

function CheckRing() {
  return (
    <svg className="check-ring" viewBox="0 0 56 56" aria-hidden="true">
      <circle cx="28" cy="28" r="25" />
      <path d="M17 29.5l7.5 7.5L40 20.5" />
    </svg>
  )
}

function TokenCard({ token, units }: { token: string; units?: string }) {
  const { toast } = useNav()
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token.replace(/\s/g, ''))
      toast('Token copied')
    } catch {
      toast('Could not copy. Select the token instead.')
    }
  }
  return (
    <div className="token">
      <small>Your token</small>
      <b>{token}</b>
      {units && <span>{units}</span>}
      <button type="button" className="text-link" onClick={copy}><Copy size={14} /> Copy token</button>
    </div>
  )
}

function Success() {
  const { flow, finish, setStage, saveBeneficiary } = useFlow()
  const r = flow!.receipt!
  const canSave = !!flow!.intent?.saveBeneficiary && !flow!.saved
  return (
    <Dialog
      title="Transaction Successful"
      onClose={finish}
      footer={
        <>
          <button type="button" className="flat" onClick={() => setStage('receipt')}>VIEW RECEIPT</button>
          <button type="button" className="flat primary" onClick={finish}>CLOSE</button>
        </>
      }
    >
      <p className="success-msg" role="status" aria-live="polite">Your payment was successful</p>
      <CheckRing />
      <p className="confirm-amount">{naira(r.amount)}</p>
      <p className="confirm-title">{r.title}</p>
      {r.token && <TokenCard token={r.token} units={r.units} />}
      {canSave && (
        <button type="button" className="text-link" onClick={saveBeneficiary}>+Save as Beneficiary?</button>
      )}
      <p className="fine">Reference {r.ref}</p>
    </Dialog>
  )
}

/* ---------------- 5. receipt ---------------- */

function ReceiptPage() {
  const { flow, back } = useFlow()
  const { toast } = useNav()
  const r = flow!.receipt!

  const share = async () => {
    const text = receiptText(r)
    try {
      if (navigator.share) await navigator.share({ title: 'Zenith Echo receipt', text })
      else {
        await navigator.clipboard.writeText(text)
        toast('Receipt copied')
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast('Could not share the receipt')
    }
  }

  const download = async () => {
    try {
      const url = URL.createObjectURL(await receiptPng(r))
      const a = document.createElement('a')
      a.href = url
      a.download = `zenith-echo-receipt-${r.ref}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast('Receipt saved')
    } catch {
      toast('Could not create the receipt image')
    }
  }

  return (
    <div className="screen flow-page">
      <div className="page">
        <Header title="Transaction Receipt" back={back} />
        <div className="scroll">
          <article className="paper">
            <div className="paper-logo"><Logo size={34} /></div>
            <p className={'status ' + (r.credit ? 'cr' : 'ok')}>{r.credit ? 'Credit' : 'Successful'}</p>
            <p className="paper-amount">{naira(r.amount)}</p>
            <p className="paper-title">{r.title}</p>
            <dl className="receipt-rows">
              {receiptRows(r).map(([k, v], n) => (
                <Fragment key={n}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </Fragment>
              ))}
            </dl>
            {r.token && <TokenCard token={r.token} />}
            <p className="fine">Demo receipt. Zenith Echo is a prototype and not a real bank document.</p>
          </article>
        </div>
        <div className="receipt-actions">
          <button type="button" className="btn ghost-dark" onClick={share}><Share2 size={18} /> Share</button>
          <button type="button" className="btn solid red" onClick={download}><Download size={18} /> Download</button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- host ---------------- */

export function FlowHost() {
  const { flow } = useFlow()
  const { settings } = useSettings()
  const echo = useEcho()
  const stage = flow?.stage

  // Echo narrates each stage (spoken and/or captioned, depending on settings).
  useEffect(() => {
    const i = flow?.intent
    const r = flow?.receipt
    if (stage === 'confirm' && i) {
      const how = settings.holdToConfirm ? `Press and hold Confirm for ${settings.holdMs / 1000} seconds.` : 'Tap Confirm.'
      void echo.respond(
        message(`Confirm transaction. ${i.title}. Total ${naira(i.amount + i.fee)}. ${how}`, `Confirm transaction. ${i.title}. Total ${moneyWords(i.amount + i.fee)}. ${how}`, `Confirm transaction. Check the details on the screen. ${how}`),
        { caption: false },
      )
    } else if (stage === 'auth' && i) {
      const needPin = !settings.biometrics || (i.viaVoice && i.amount > settings.voiceLimit)
      void echo.say(needPin ? 'Enter your PIN to approve. Echo cannot approve payments for you.' : 'Touch the fingerprint sensor, or use your PIN. Echo cannot approve payments for you.')
    } else if (stage === 'success' && r) {
      echo.alertUser('success')
      void echo.respond(message(`Payment successful. ${naira(r.amount)}. ${r.title}.`, `Payment successful. ${moneyWords(r.amount)}. ${r.title}.`, 'Payment successful. The details are on the screen.'), { caption: false })
    } else if (stage === 'receipt' && r) void echo.say('Receipt.')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  if (!flow) return null
  if (flow.stage === 'receipt') return <ReceiptPage />
  return (
    <div className="flow-layer">
      <div className="dim" />
      {flow.stage === 'confirm' && <Confirm />}
      {flow.stage === 'auth' && <Auth />}
      {flow.stage === 'countdown' && <Countdown />}
      {flow.stage === 'processing' && <Processing />}
      {flow.stage === 'success' && <Success />}
    </div>
  )
}
