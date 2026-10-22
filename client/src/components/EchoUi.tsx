import { Check, Mic, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PinPad } from './PinPad'
import { HELP_LIST } from '../voice/commands'
import { message, useEcho } from '../voice/echo'
import { useSettings } from '../state/settings'
import { Sheet } from './Parts'

/** What Echo is saying, shown as text. Every reply is captioned; other announcements only when Captions is on. */
export function CaptionBar() {
  const { caption } = useEcho()
  const { settings } = useSettings()
  if (!caption) return null
  return (
    <div className="caption-bar" data-size={settings.captionSize} aria-live="polite">
      <b>Echo</b>
      <span>{caption}</span>
    </div>
  )
}

/** One bright flash for people who can't hear an alert. Remounting on each key replays the animation. */
export function FlashLayer() {
  const { flashKey } = useEcho()
  if (!flashKey) return null
  return <div key={flashKey} className="flash" aria-hidden="true" />
}

/** "Talk to Echo": speak a command, or type it, and see what Echo understood and did. */
export function AskSheet() {
  const { askOpen, closeAsk, listening, canListen, runCommand, reply, mic, openAsk, chooseOption, approveAssistant } = useEcho()
  const [text, setText] = useState('')
  const [help, setHelp] = useState(false)
  const [pinRound, setPinRound] = useState(0)
  const [pinNote, setPinNote] = useState('')
  if (!askOpen) return null
  const assistant = reply?.assistant

  const send = () => {
    const t = text.trim()
    if (!t) return
    setText('')
    void runCommand(t)
  }

  return (
    <Sheet title="Talk to Echo" onClose={closeAsk}>
      <div className="ask">
        {canListen && mic !== 'denied' ? (
          <button type="button" className={'ask-mic' + (listening ? ' live' : '')} onClick={() => !listening && openAsk(true)} aria-label={listening ? 'Listening' : 'Tap to speak'}>
            <Mic size={34} />
            <span>{listening ? 'Listening…' : 'Tap to speak'}</span>
          </button>
        ) : (
          <p className="ask-note">{mic === 'denied' ? 'Microphone is blocked in this browser.' : 'Voice input isn’t supported in this browser.'} You can type a command instead.</p>
        )}
        {reply && (
          <div className="ask-reply" aria-live="polite">
            {reply.heard && <p className="heard">You said: “{reply.heard}”</p>}
            <p>{reply.message.text}</p>
          </div>
        )}
        {assistant && assistant.checklist.length > 0 && (
          <section className="echo-checklist" aria-label={`${assistant.title ?? 'Payment'} checklist`}>
            <h3>{assistant.title}</h3>
            <ul>
              {assistant.checklist.map((item) => (
                <li key={item.key} className={item.done ? 'is-done' : item.current ? 'is-current' : ''}>
                  <span className="cl-tick" aria-hidden="true">{item.done ? <Check size={18} /> : null}</span>
                  <span className="cl-label">{item.label}{item.optional ? ' (optional)' : ''}</span>
                  <span className="cl-value">{item.value ?? (item.current ? 'Needed now' : 'Waiting')}</span>
                  <span className="sr">{item.done ? ', done' : item.current ? ', needed now' : ', waiting'}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {assistant?.options && assistant.status === 'collecting' && (
          <div className="echo-options" role="group" aria-label="Choose one">
            {assistant.options.map((o) => (
              <button key={o.id} type="button" className="echo-option" onClick={() => void chooseOption(o.id)}>
                {o.label}
              </button>
            ))}
          </div>
        )}
        {assistant?.status === 'authorising' && (
          <div className="echo-approve">
            <p className="fp-hint" aria-live="polite">
              {assistant.authorisation?.required === 'pin' && assistant.authorisation.limit
                ? 'This payment needs your PIN. Type it on the keypad.'
                : 'Type your 4-digit PIN on the keypad to approve.'}
            </p>
            {pinNote && <p className="ob-note" role="status" aria-live="polite">{pinNote}</p>}
            <PinPad
              key={pinRound}
              length={4}
              onComplete={async (code) => {
                const ok = await approveAssistant(code)
                setPinNote(ok ? '' : 'Wrong PIN. Try again.')
                setPinRound((r) => r + 1)
              }}
            />
          </div>
        )}
        <form
          className="ask-type"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a command, e.g. check my balance" aria-label="Type a command" />
          <button type="submit" className="icon-btn dark" aria-label="Send" disabled={!text.trim()}>
            <Send size={20} />
          </button>
        </form>
        <button type="button" className="text-link" onClick={() => setHelp((h) => !h)} aria-expanded={help}>
          {help ? 'Hide commands' : 'What can I say?'}
        </button>
        {help && <CommandList />}
        <p className="fine">Echo can open screens and fill in a transfer, but it can never approve a payment. You always confirm with your PIN or fingerprint.</p>
      </div>
    </Sheet>
  )
}

export function CommandList() {
  return (
    <ul className="cmds">
      {HELP_LIST.map((h) => (
        <li key={h.say}>
          <b>“{h.say}”</b>
          <span>{h.does}</span>
        </li>
      ))}
    </ul>
  )
}

/** On Home: what Echo last heard and said, so the conversation can be read as well as heard. */
export function EchoLastReply() {
  const { reply, wakeActive } = useEcho()
  return (
    <section className="echo-last" aria-label="Echo">
      <p className="orb-hint" role="status" aria-live="polite">
        {wakeActive ? 'Echo is listening. Say “Hey Ziva”, or tap Echo below.' : 'Tap Echo below to talk.'}
      </p>
      {reply && (
        <div className="orb-reply" role="status" aria-live="polite">
          {reply.heard && <small>You said: “{reply.heard}”</small>}
          <span>{reply.message.text}</span>
        </div>
      )}
    </section>
  )
}

/** The big round Echo button on Home. Tap to talk; it pulses while listening. */
export function EchoOrb() {
  const echo = useEcho()
  const { settings } = useSettings()
  const { listening, canListen, mic, wakeActive, reply } = echo

  // A reply from earlier (say, the setup practice) isn't news when you arrive on Home.
  const clear = echo.clearReply
  useEffect(() => clear(), [clear])

  const tap = async () => {
    if (listening) return
    echo.clearReply()
    if (!canListen || mic === 'denied') {
      echo.openAsk(false) // no speech recognition here: type a command instead
      return
    }
    const r = await echo.listen(8000)
    if (r.text) await echo.runCommand(r.text)
    else {
      const m = message(r.error === 'not-allowed' ? 'The microphone is blocked. Use the keyboard instead.' : "I didn't catch that. Tap and try again.")
      echo.showReply(null, m)
      void echo.respond(m)
    }
  }

  return (
    <section className="orb-wrap" aria-label="Echo">
      <button type="button" className={'orb' + (listening ? ' live' : '')} onClick={tap} aria-label={listening ? 'Echo is listening' : 'Talk to Echo'} aria-pressed={listening}>
        <i aria-hidden="true" />
        <Mic size={42} aria-hidden="true" />
        <span>Echo</span>
      </button>
      <p className="orb-hint" role="status" aria-live="polite">
        {listening ? 'Listening…' : settings.wakeWord && wakeActive ? 'Tap to talk, or say “Hey Ziva”' : 'Tap to talk'}
      </p>
      {reply && (
        <div className="orb-reply" role="status" aria-live="polite">
          {reply.heard && <small>You said: “{reply.heard}”</small>}
          <span>{reply.message.text}</span>
        </div>
      )}
    </section>
  )
}