import { ChevronLeft, Mic } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { WaveBg } from '../components/Art'
import { HoldButton } from '../components/HoldButton'
import { Logo } from '../components/Logo'
import { PinPad } from '../components/PinPad'
import { useNav } from '../state/nav'
import { EXTRAS, INTERACTIONS, PROFILES, SCALE_STEPS, useSettings, type Extra, type Interaction, type Privacy, type ProfileId } from '../state/settings'
import { useEcho } from '../voice/echo'
import { clickByVoice } from '../voice/voiceClick'

type StepId = 'welcome' | 'mode' | 'profile' | 'extras' | 'hear' | 'mic' | 'privacy' | 'display' | 'secure' | 'practice' | 'ready'

const ORDER: StepId[] = ['extras', 'hear', 'secure']

/** The text-size screen is skipped for the blind or low vision profile, which already gets big text and a dark theme. */
const stepsFor = (p: ProfileId): StepId[] => ORDER.filter((s) => !(s === 'display' && p === 'blind'))

/** Steps before the profile is applied are always spoken, because spoken guidance may not be on yet. */
const ALWAYS_SPOKEN: StepId[] = ['mode', 'profile', 'extras']

const SAMPLE = "Hello, I'm Echo. Can you hear me clearly? Say yes, or say louder."

const PROMPT: Record<Exclude<StepId, 'welcome' | 'hear'>, (touch: boolean, tremor: boolean) => string> = {
  mode: () => 'How do you want to use Echo? Voice, or Touch and read.',
  profile: () => 'Choose your main profile: blind or low vision, or standard.',
  extras: () => 'Anything else that would help? Say hard of hearing, tremors, or simple words. Or say next.',
  mic: () => 'Echo needs your microphone to hear you. Tap Allow microphone, or skip.',
  privacy: () => 'Privacy mode. Normal, Whisper or Headphones. This decides how Echo says your balance and other private details.',
  display: () => 'Choose your text size and theme.',
  secure: () => 'Now type a 4-digit PIN on the keypad. Never say it out loud.',
  practice: (touch, tremor) => (tremor ? 'Practice. Press and hold the button until it fills.' : touch ? 'Practice. Tap once to hear a button. Tap it twice to use it.' : 'Practice. Try saying: check my balance.'),
  ready: () => "You're ready. Say help anytime.",
}

const PRIVACY: { id: Privacy; title: string; blurb: string }[] = [
  { id: 'normal', title: 'Normal', blurb: 'Echo keeps private details like your balance on the screen, unless it can tell you are wearing headphones.' },
  { id: 'whisper', title: 'Whisper', blurb: 'Echo says everything, but quietly.' },
  { id: 'headphones', title: 'Headphones', blurb: 'I am wearing headphones. Echo says everything to me.' },
]

export function Onboarding() {
  const { settings, update, applyProfile } = useSettings()
  const { setPhase, setTab, replay } = useNav()
  const echo = useEcho()

  const [step, setStep] = useState<StepId>('welcome')
  const [trail, setTrail] = useState<StepId[]>([])
  const [mode, setMode] = useState<Interaction | null>(replay ? settings.interaction : null)
  const [picked, setPicked] = useState<ProfileId | null>(replay ? settings.profile : null)
  const [extras, setExtras] = useState<Extra[]>(replay ? settings.extras : [])
  const innerBack = useRef<(() => boolean) | null>(null) // a step with its own sub-screens can handle Back itself
  const welcomed = useRef(false)

  const live = picked ?? settings.profile
  const steps = stepsFor(live)
  const n = steps.indexOf(step) + 1
  const stepsRef = useRef(steps)
  stepsRef.current = steps

  const go = (to: StepId) => {
    setTrail((t) => [...t, step])
    setStep(to)
  }
  const next = (profile: ProfileId = settings.profile) => {
    const list = stepsFor(profile)
    const at = list.indexOf(step)
    if (at === list.length - 1) {
      finish()
      return
    }
    go(list[at + 1])
  }
  const back = () => {
    if (innerBack.current?.()) return
    const prev = trail[trail.length - 1]
    if (!prev) return
    setTrail((t) => t.slice(0, -1))
    setStep(prev)
  }
  const finish = () => {
    update({ onboarded: true })
    setPhase('app')
    setTab(replay ? 'more' : 'home')
  }

  // Hands-free setup: saying what is on a button presses it, and Echo says what changed.
  const echoRef = useRef(echo)
  echoRef.current = echo
  useEffect(() => {
    echo.setVoiceHandler((text) => {
      const pressed = clickByVoice(text, document.querySelector('.ob') ?? document)
      if (!pressed) return false
      const role = pressed.getAttribute('role')
      if (role === 'checkbox' || role === 'radio') {
        window.setTimeout(() => {
          const name = (pressed.querySelector('b')?.textContent ?? pressed.textContent ?? '').trim()
          const on = pressed.getAttribute('aria-checked') === 'true'
          void echoRef.current.say(`${name}, ${on ? 'selected' : 'removed'}. Say next when you are ready.`, { force: true })
        }, 120)
      }
      return true
    })
    return () => echo.setVoiceHandler(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Speak the step counter (always) and the prompt (when spoken guidance is on), and move focus to the heading.
  useEffect(() => {
    if (step === 'welcome') return
    const list = stepsRef.current
    const greeting = welcomed.current ? '' : 'Welcome to Zenith Echo. I am Ziva, your banking assistant. Let us set things up together. '
    welcomed.current = true
    const counter = `${greeting}Step ${list.indexOf(step) + 1} of ${list.length}.`
    const touch = settings.interaction === 'touchRead'
    if (step === 'hear') void echo.say(`${counter} ${SAMPLE}`, { force: true })
    else void echo.say(settings.voice || ALWAYS_SPOKEN.includes(step) ? `${counter} ${PROMPT[step](touch, settings.extras.includes('tremor') || extras.includes('tremor'))}` : counter, { force: true })
    document.querySelector<HTMLElement>('.ob-main h1')?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  if (step === 'welcome') {
    return (
      <div className="screen entry ob-welcome-screen">
        <WaveBg />
        <button
          type="button"
          className="ob-welcome"
          data-tr-direct
          autoFocus
          onClick={() => {
            echo.unlock() // this tap is what lets the browser play Echo's voice
            if (!replay) {
              applyProfile('blind', [], 'touchRead')
              update({ privacy: 'whisper', wakeWord: true, voice: true })
            }
            setMode('touchRead')
            setPicked('blind')
            void echo.requestMic()
            go('extras')
          }}
        >
          <Logo size={84} />
          <h1>Welcome to Zenith Echo</h1>
          <span className="ob-tap">Tap anywhere to start</span>
        </button>
      </div>
    )
  }

  const applyAndNext = (chosen: Extra[]) => {
    applyProfile(picked ?? 'blind', chosen, mode ?? 'touchRead')
    update({ privacy: settings.privacy || 'whisper' })
    next(picked ?? 'blind')
  }

  return (
    <div className="screen ob">
      <div className="ob-top">
        <button type="button" className="ob-back" onClick={back}>
          <ChevronLeft size={28} aria-hidden="true" /> Back
        </button>
        <p className="ob-step" role="status" aria-live="polite">Step {n} of {steps.length}</p>
      </div>
      <div className="ob-main">
        {step === 'mode' && (
          <>
            <h1 tabIndex={-1}>How do you want to use Echo?</h1>
            <div className="ob-choices" role="radiogroup" aria-label="How you use Echo">
              {INTERACTIONS.map((i) => (
                <button key={i.id} type="button" role="radio" aria-checked={mode === i.id} className={'ob-choice' + (mode === i.id ? ' on' : '')} onClick={() => setMode(i.id)}>
                  <b>{i.title}</b>
                  <span>{i.blurb}</span>
                </button>
              ))}
            </div>
            <div className="ob-actions">
              <button
                type="button"
                className="ob-btn"
                disabled={!mode}
                onClick={() => {
                  // Applied straight away so Touch and read already works on the next screens.
                  update({ interaction: mode!, voice: true })
                  next()
                  if (mode === 'touchRead') void echo.say('Touch and read is on. Tap once to hear what is under your finger. Double tap to use it.', { force: true })
                }}
              >
                Next
              </button>
              <button type="button" className="ob-skip" onClick={() => { setMode('voice'); update({ interaction: 'voice' }); next() }}>Skip</button>
            </div>
          </>
        )}

        {step === 'profile' && (
          <>
            <h1 tabIndex={-1}>Choose your main profile</h1>
            <div className="ob-choices" role="radiogroup" aria-label="Main profile">
              {PROFILES.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={picked === p.id} className={'ob-choice' + (picked === p.id ? ' on' : '')} onClick={() => setPicked(p.id)}>
                  <b>{p.title}</b>
                  <span>{p.blurb}</span>
                </button>
              ))}
            </div>
            <div className="ob-actions">
              <button type="button" className="ob-btn" disabled={!picked} onClick={() => next(picked!)}>Next</button>
              <button type="button" className="ob-skip" onClick={() => { setPicked('standard'); next('standard') }}>Skip</button>
            </div>
          </>
        )}

        {step === 'extras' && (
          <>
            <h1 tabIndex={-1}>Anything else that would help?</h1>
            <p className="ob-lead">Choose as many as you like.</p>
            <div className="ob-choices" role="group" aria-label="Extras">
              {EXTRAS.map((x) => {
                const on = extras.includes(x.id)
                return (
                  <button key={x.id} type="button" role="checkbox" aria-checked={on} className={'ob-choice' + (on ? ' on' : '')} onClick={() => setExtras((cur) => (on ? cur.filter((e) => e !== x.id) : [...cur, x.id]))}>
                    <b>{x.title}</b>
                    <span>{x.blurb}</span>
                  </button>
                )
              })}
            </div>
            <div className="ob-actions">
              <button type="button" className="ob-btn" onClick={() => applyAndNext(extras)}>{extras.length ? 'Next' : 'None of these'}</button>
              <button type="button" className="ob-skip" onClick={() => { setExtras([]); applyAndNext([]) }}>Skip</button>
            </div>
          </>
        )}

        {step === 'hear' && <Hear onNext={() => next()} />}
        {step === 'mic' && <Mic1 onNext={() => next()} />}

        {step === 'privacy' && (
          <>
            <h1 tabIndex={-1}>Privacy mode</h1>
            <p className="ob-lead">How should Echo say private details, like your balance?</p>
            <div className="ob-choices" role="radiogroup" aria-label="Privacy mode">
              {PRIVACY.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={settings.privacy === p.id} className={'ob-choice' + (settings.privacy === p.id ? ' on' : '')} onClick={() => update({ privacy: p.id })}>
                  <b>{p.title}</b>
                  <span>{p.blurb}</span>
                </button>
              ))}
            </div>
            <div className="ob-actions">
              <button type="button" className="ob-btn" onClick={() => next()}>Next</button>
              <button type="button" className="ob-skip" onClick={() => { update({ privacy: 'normal' }); next() }}>Skip</button>
            </div>
          </>
        )}

        {step === 'display' && <Display onNext={() => next()} />}
        {step === 'secure' && <Secure onNext={() => next()} innerBack={innerBack} />}
        {step === 'practice' && <Practice onNext={() => next()} />}

        {step === 'ready' && (
          <>
            <h1 tabIndex={-1}>You’re ready</h1>
            <p className="ob-lead">Say “help” anytime to hear what Echo can do. You can change everything later in Settings.</p>
            <div className="ob-actions">
              <button type="button" className="ob-btn" onClick={finish}>{replay ? 'Back to Settings' : 'Go to Home'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ---------------- can you hear me ---------------- */

function Hear({ onNext }: { onNext: () => void }) {
  const { settings, update } = useSettings()
  const echo = useEcho()
  const play = () => window.setTimeout(() => void echo.say(SAMPLE, { force: true }), 60)
  const rates = ['slow', 'normal', 'fast'] as const

  const slower = () => {
    const i = rates.indexOf(settings.speechRate)
    if (i > 0) update({ speechRate: rates[i - 1] })
    else void echo.say("That's the slowest I can go. If it's still too quiet, turn up your device volume.", { force: true })
    if (i > 0) play()
  }

  return (
    <>
      <h1 tabIndex={-1}>Can you hear me?</h1>
      <p className="ob-lead">Echo just said a short sentence.</p>
      <div className="ob-stack">
        <button type="button" className="ob-btn" onClick={onNext}>Yes, I can hear you</button>
        <button type="button" className="ob-btn alt" onClick={slower}>Louder / slower</button>
        <button type="button" className="ob-btn alt" onClick={() => { update({ captions: true }); onNext() }}>I’d rather read captions</button>
      </div>
      <div className="ob-speed" role="radiogroup" aria-label="Speech speed">
        <span>Speech speed</span>
        {rates.map((r) => (
          <button key={r} type="button" role="radio" aria-checked={settings.speechRate === r} className={settings.speechRate === r ? 'on' : ''} onClick={() => { update({ speechRate: r }); play() }}>
            {r[0].toUpperCase() + r.slice(1)}
          </button>
        ))}
      </div>
      <div className="ob-actions">
        <button type="button" className="ob-skip" onClick={play}>Play it again</button>
        <button type="button" className="ob-skip" onClick={onNext}>Skip</button>
      </div>
    </>
  )
}

/* ---------------- microphone ---------------- */

function Mic1({ onNext }: { onNext: () => void }) {
  const echo = useEcho()
  const [phase, setPhase] = useState<'ask' | 'test'>(echo.mic === 'granted' ? 'test' : 'ask')
  const [heard, setHeard] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const allow = async () => {
    setBusy(true)
    const ok = await echo.requestMic()
    setBusy(false)
    if (ok) {
      setPhase('test')
      setNote('')
      void echo.say('Microphone is on. Now tap the button and say hello.')
    } else setNote('The microphone is blocked. You can still use Echo by tapping, and turn the microphone on later in your browser settings.')
  }

  const test = async () => {
    setHeard(null)
    setNote('')
    const r = await echo.listen(7000)
    if (r.text) {
      setHeard(r.text)
      void echo.say(`I heard: ${r.text}`)
    } else setNote(r.error === 'unsupported' ? 'This browser can’t turn speech into text, so voice commands won’t work here. Echo can still speak to you.' : 'I didn’t hear anything. Try again, or skip this step.')
  }

  return (
    <>
      <h1 tabIndex={-1}>{phase === 'ask' ? 'Echo needs your microphone to hear you' : 'Say “hello”'}</h1>
      <p className="ob-lead">
        {phase === 'ask'
          ? 'Your microphone is only used while Echo is listening for a command, or for “Hey Ziva” if you turn that on. The audio is not saved by this app. Your browser may send it to its speech service.'
          : 'Tap the button, then say hello so we can check Echo hears you.'}
      </p>
      {!echo.canListen && <p className="ob-note" aria-live="polite">This browser doesn’t support voice input. You can skip this step.</p>}
      {heard && <p className="ob-heard" role="status" aria-live="polite">I heard: “{heard}”</p>}
      {note && <p className="ob-note" role="status" aria-live="polite">{note}</p>}
      <div className="ob-actions">
        {echo.canListen && phase === 'ask' && (
          <button type="button" className="ob-btn" disabled={busy} onClick={allow}>{busy ? 'Waiting…' : 'Allow microphone'}</button>
        )}
        {echo.canListen && phase === 'test' && (
          <button type="button" className={'ob-btn' + (echo.listening ? ' live' : '')} onClick={test} disabled={echo.listening}>
            <Mic size={26} aria-hidden="true" /> {echo.listening ? 'Listening…' : heard ? 'Try again' : 'Tap and say hello'}
          </button>
        )}
        {(heard || !echo.canListen) && <button type="button" className="ob-btn" onClick={onNext}>Next</button>}
        <button type="button" className="ob-skip" onClick={onNext}>Skip</button>
      </div>
    </>
  )
}

/* ---------------- text and display ---------------- */

function Display({ onNext }: { onNext: () => void }) {
  const { settings, update } = useSettings()
  const i = SCALE_STEPS.findIndex((s) => s === settings.scale)
  const idx = i < 0 ? 1 : i
  const set = (j: number) => update({ scale: SCALE_STEPS[Math.max(0, Math.min(SCALE_STEPS.length - 1, j))] })
  return (
    <>
      <h1 tabIndex={-1}>Text and display</h1>
      <div className="ob-preview" aria-label="Preview">
        <small>Available balance</small>
        <b>NGN248,350.75</b>
        <p>This is how text will look in Zenith Echo.</p>
      </div>
      <div className="ob-row" role="group" aria-label="Text size">
        <button type="button" disabled={idx === 0} onClick={() => set(idx - 1)} aria-label="Smaller text">A−</button>
        <output aria-live="polite">Text size {idx + 1} of {SCALE_STEPS.length}</output>
        <button type="button" disabled={idx === SCALE_STEPS.length - 1} onClick={() => set(idx + 1)} aria-label="Larger text">A+</button>
      </div>
      <div className="ob-row two" role="radiogroup" aria-label="Theme">
        <button type="button" role="radio" aria-checked={settings.theme === 'dark'} className={settings.theme === 'dark' ? 'on' : ''} onClick={() => update({ theme: 'dark' })}>Dark</button>
        <button type="button" role="radio" aria-checked={settings.theme === 'light'} className={settings.theme === 'light' ? 'on' : ''} onClick={() => update({ theme: 'light' })}>Light</button>
      </div>
      <div className="ob-actions">
        <button type="button" className="ob-btn" onClick={onNext}>Next</button>
        <button type="button" className="ob-skip" onClick={onNext}>Skip</button>
      </div>
    </>
  )
}

/* ---------------- secure your account ---------------- */

type Sub = 'keep' | 'bio' | 'create' | 'confirm'

function Secure({ onNext, innerBack }: { onNext: () => void; innerBack: React.RefObject<(() => boolean) | null> }) {
  const { settings, update, setPin, hasPin } = useSettings()
  const echo = useEcho()
  const [sub, setSub] = useState<Sub>(hasPin ? 'keep' : 'create')
  const [first, setFirst] = useState('')
  const [msg, setMsg] = useState('')
  const [round, setRound] = useState(0) // remounts the keypad to clear it

  useEffect(() => {
    // Back walks the sub-screens: confirm -> create -> fingerprint question -> (keep/new PIN) -> previous step.
    innerBack.current = () => {
      if (sub === 'confirm') {
        setSub('create')
        setMsg('')
        setRound((r) => r + 1)
        return true
      }
      if (sub === 'create' && hasPin) {
        setSub('keep')
        return true
      }
      if (sub === 'bio' && hasPin) {
        setSub('keep')
        return true
      }
      return false
    }
    return () => {
      innerBack.current = null
    }
  }, [sub, hasPin, innerBack])

  // Moving to a sub-screen is a new screen: focus its title.
  useEffect(() => {
    document.querySelector<HTMLElement>('.ob-main h1')?.focus()
  }, [sub])

  const say = (t: string) => void echo.say(t)

  if (sub === 'keep') {
    return (
      <>
        <h1 tabIndex={-1}>Keep your current PIN?</h1>
        <p className="ob-lead">Your voice can never approve a payment on its own.</p>
        <div className="ob-actions">
          <button type="button" className="ob-btn" onClick={onNext}>Keep my PIN</button>
          <button type="button" className="ob-btn alt" onClick={() => setSub('create')}>Set a new PIN</button>
        </div>
      </>
    )
  }

  if (sub === 'bio') {
    return (
      <>
        <h1 tabIndex={-1}>Use fingerprint or face to approve payments?</h1>
        <p className="ob-lead">Your voice can never approve a payment on its own. You always confirm with your PIN or fingerprint.</p>
        <div className="ob-actions">
          <button type="button" className="ob-btn" onClick={() => { update({ biometrics: true }); setSub('create'); say('Now create a 4-digit PIN.') }}>Yes, turn it on</button>
          <button type="button" className="ob-btn alt" onClick={() => { update({ biometrics: false }); setSub('create'); say('Now create a 4-digit PIN.') }}>Not now</button>
        </div>
      </>
    )
  }

  const creating = sub === 'create'
  return (
    <>
      <h1 tabIndex={-1}>{creating ? 'Create a 4-digit PIN' : 'Enter your PIN again'}</h1>
      <p className="ob-lead">{creating ? 'You’ll use this PIN to open the app and approve payments.' : 'Just to be sure you got it right.'}</p>
      {msg && <p className="ob-note" role="status" aria-live="polite">{msg}</p>}
      <div className="ob-pin">
        <PinPad
          key={sub + round}
          length={4}
          shuffle={false}
          onComplete={async (code) => {
            if (creating) {
              setFirst(code)
              setMsg('')
              setSub('confirm')
              say('Enter your PIN again.')
            } else if (code === first) {
              await setPin(code)
              echo.alertUser('success')
              say('PIN saved.')
              onNext()
            } else {
              echo.alertUser('error')
              setMsg('Those PINs didn’t match. Let’s try again.')
              say('Those PINs did not match. Let us try again.')
              setSub('create')
              setRound((r) => r + 1)
            }
          }}
        />
      </div>
      <p className="fine">{settings.biometrics ? 'Fingerprint or face is on.' : 'Fingerprint or face is off.'} The PIN can’t be skipped.</p>
    </>
  )
}

/* ---------------- practice ---------------- */

function Practice({ onNext }: { onNext: () => void }) {
  const { settings } = useSettings()
  const echo = useEcho()
  const holdVersion = settings.extras.includes('tremor')
  const touchVersion = !holdVersion && settings.interaction === 'touchRead'
  const [done, setDone] = useState(false)
  const [heard, setHeard] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const tryVoice = async () => {
    setNote('')
    const r = await echo.listen(8000)
    if (r.text) {
      setHeard(r.text)
      setDone(true)
      void echo.say(`I heard you say: ${r.text}. That is how you talk to Echo.`, { force: true })
    } else {
      const miss = r.error === 'unsupported' ? 'Voice input isn’t available in this browser.' : 'I didn’t catch that. Tap the button and try again.'
      setNote(miss)
      void echo.say(miss, { force: true })
    }
  }

  const doneText = holdVersion ? 'Well done. That is how confirming works.' : touchVersion ? 'Well done. You tapped twice, and that is how you use a button.' : 'Great. You can do that anytime.'

  return (
    <>
      <h1 tabIndex={-1}>Practice</h1>
      {holdVersion ? (
        <>
          <p className="ob-lead">To confirm something, press and hold the button until it fills. Letting go early cancels it.</p>
          <HoldButton label="Hold to confirm" holdMs={settings.holdMs} onConfirm={() => { setDone(true); void echo.say(doneText) }} />
        </>
      ) : touchVersion ? (
        <>
          <p className="ob-lead">Tap once to hear what a button does. Tap it twice to use it. Try it now.</p>
          <button type="button" className="ob-btn" onClick={() => { setDone(true); void echo.say(doneText) }}>Practice button</button>
        </>
      ) : (
        <>
          <p className="ob-lead">Try saying <b>“check my balance”</b>.</p>
          {echo.canListen ? (
            <button type="button" className={'ob-btn' + (echo.listening ? ' live' : '')} onClick={tryVoice} disabled={echo.listening}>
              <Mic size={26} aria-hidden="true" /> {echo.listening ? 'Listening…' : 'Tap and speak'}
            </button>
          ) : (
            <button type="button" className="ob-btn" onClick={() => { setDone(true); void echo.say(doneText, { force: true }) }}>I’m ready</button>
          )}
          {heard && <p className="ob-heard" aria-live="polite">I heard: “{heard}”</p>}
          {note && <p className="ob-note" role="status" aria-live="polite">{note}</p>}
        </>
      )}
      {done && <p className="ob-heard" role="status" aria-live="polite">{doneText}</p>}
      <div className="ob-actions">
        {done && <button type="button" className="ob-btn" onClick={onNext}>Next</button>}
        <button type="button" className="ob-skip" onClick={onNext}>Skip</button>
      </div>
    </>
  )
}
