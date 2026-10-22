import { Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { HoldButton } from '../components/HoldButton'
import { CommandList } from '../components/EchoUi'
import { PickerSheet } from '../components/Fields'
import { PinPad } from '../components/PinPad'
import { Header, Sheet } from '../components/Parts'
import { ActionRow, ChoiceRow, Section, StepperRow, ToggleRow } from '../components/Rows'
import { BANKS, lookupAccountName, ZENITH } from '../lib/data'
import { initials, money } from '../lib/format'
import type { Beneficiary } from '../lib/types'
import { useNav } from '../state/nav'
import { DAILY_LIMITS, EXTRAS, INTERACTIONS, PROFILES, SCALE_STEPS, VOICE_LIMITS, profileLabel, useSettings, type Extra, type Interaction, type ProfileId } from '../state/settings'
import { useStore } from '../state/store'
import { useEcho } from '../voice/echo'

type SheetId = 'profile' | 'voice' | 'pin' | 'practice' | 'commands' | 'resetAll' | 'resetDemo' | 'about' | 'add' | null


export function Settings() {
  const { settings: s, update, setExtra, resetAll } = useSettings()
  const { hideBalance, setHideBalance, beneficiaries, removeBeneficiary, resetDemo } = useStore()
  const { setPhase, toast, startTutorial } = useNav()
  const echo = useEcho()
  const [sheet, setSheet] = useState<SheetId>(null)
  const [rename, setRename] = useState<Beneficiary | null>(null)
  const [del, setDel] = useState<Beneficiary | null>(null)
  const close = () => setSheet(null)

  const scaleIdx = Math.max(0, SCALE_STEPS.findIndex((x) => x === s.scale))
  const contacts = beneficiaries.filter((b) => b.kind === 'bank')

  return (
    <div className="page">
      <Header title="Settings" menu />
      <div className="scroll settings">
        <Section id="set-profile" title="My profile">
          <ActionRow label="Current profile" value={profileLabel(s)} onClick={() => setSheet('profile')} />
          <ChoiceRow label="How I use Echo" hint="Touch and read: tap once to hear an item, double tap to use it. Don't use it together with a screen reader." value={s.interaction} onChange={(v) => update({ interaction: v, ...(v === 'touchRead' ? { voice: true, autoListen: false, wakeWord: false } : {}) })} options={INTERACTIONS.map((i) => ({ value: i.id, label: i.title }))} />
          {EXTRAS.map((x) => (
            <ToggleRow key={x.id} label={x.title} hint={x.blurb} on={s.extras.includes(x.id)} onChange={(v) => setExtra(x.id, v)} />
          ))}
          <ActionRow label="Change profile" hint="Re-applies a profile's defaults for text, voice, hearing and touch." onClick={() => setSheet('profile')} />
        </Section>

        <Section id="set-display" title="Display">
          <StepperRow
            label="Text size"
            text={`Step ${scaleIdx + 1} of ${SCALE_STEPS.length} · ${Math.round(SCALE_STEPS[scaleIdx] * 100)}%`}
            onMinus={() => update({ scale: SCALE_STEPS[scaleIdx - 1] })}
            onPlus={() => update({ scale: SCALE_STEPS[scaleIdx + 1] })}
            minusDisabled={scaleIdx === 0}
            plusDisabled={scaleIdx === SCALE_STEPS.length - 1}
          />
          <ChoiceRow label="Theme" value={s.theme} onChange={(v) => update({ theme: v })} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
          <ToggleRow label="Large buttons" hint="Bigger tap areas everywhere." on={s.largeTargets} onChange={(v) => update({ largeTargets: v })} />
          <ToggleRow label="Reduce motion" hint="Turns off sliding and fading." on={s.reduceMotion} onChange={(v) => update({ reduceMotion: v })} />
        </Section>

        <Section id="set-voice" title="Voice and sound">
          <ToggleRow label="Spoken guidance" hint="Echo reads screens and results aloud." on={s.voice} onChange={(v) => update({ voice: v })} />
          <ActionRow label="Voice" value={s.voiceName || 'Default'} onClick={() => setSheet('voice')} hint={echo.canSpeak ? undefined : 'This browser has no speech voices.'} />
          <ChoiceRow label="Speech speed" value={s.speechRate} onChange={(v) => update({ speechRate: v })} options={[{ value: 'slow', label: 'Slow' }, { value: 'normal', label: 'Normal' }, { value: 'fast', label: 'Fast' }]} />
          <ToggleRow label="Sound cues" hint="Short tones for success, errors and listening." on={s.soundCues} onChange={(v) => update({ soundCues: v })} />
          <ToggleRow label="Listen automatically after Echo speaks" hint="Echo opens the microphone on the Home screen so you can answer with your voice." on={s.autoListen} onChange={(v) => update({ autoListen: v })} />
          <ToggleRow
            label="Hey Ziva listening"
            hint="Echo listens for “Hey Ziva” while the app is open. Needs the microphone, and your browser may send the audio to its speech service."
            on={s.wakeWord}
            onChange={(v) => {
              update({ wakeWord: v })
              if (v && echo.mic !== 'granted') void echo.requestMic()
            }}
          />
          <ChoiceRow
            label="Language"
            value={s.language}
            onChange={(v) => update({ language: v })}
            options={[
              { value: 'en', label: 'English' },
              { value: 'pcm', label: 'Pidgin', note: 'Coming soon', disabled: true },
              { value: 'yo', label: 'Yoruba', note: 'Coming soon', disabled: true },
              { value: 'ha', label: 'Hausa', note: 'Coming soon', disabled: true },
              { value: 'ig', label: 'Igbo', note: 'Coming soon', disabled: true },
            ]}
          />
          <ActionRow label="Test Echo’s voice" onClick={() => void echo.say("Hello, I'm Echo. This is how I sound with your settings.", { force: true })} />
        </Section>

        <Section id="set-hearing" title="Hearing">
          <ToggleRow label="Captions" hint="Shows what Echo says as text." on={s.captions} onChange={(v) => update({ captions: v })} />
          <ChoiceRow label="Caption size" value={s.captionSize} onChange={(v) => update({ captionSize: v })} options={[{ value: 'normal', label: 'Normal' }, { value: 'large', label: 'Large' }, { value: 'xl', label: 'Extra large' }]} />
          <ToggleRow label="Vibration cues" hint="Phones that can vibrate buzz for success and errors." on={s.haptics} onChange={(v) => update({ haptics: v })} />
          <ToggleRow label="Flash the screen for alerts" on={s.flashAlerts} onChange={(v) => update({ flashAlerts: v })} />
          <ActionRow label="Test the alerts" hint="Plays whichever cues you have turned on." onClick={() => echo.alertUser('success')} />
        </Section>

        <Section id="set-touch" title="Touch and movement">
          <ToggleRow label="Steady taps" hint="Ignores an accidental second tap, and adds a countdown you can cancel before a payment is sent." on={s.tremorGuard} onChange={(v) => update({ tremorGuard: v })} />
          <ToggleRow label="Press and hold to confirm" hint="Confirming a payment needs a deliberate hold, not a tap." on={s.holdToConfirm} onChange={(v) => update({ holdToConfirm: v })} />
          <ChoiceRow label="Hold time" value={s.holdMs} onChange={(v) => update({ holdMs: v })} options={[{ value: 500, label: '0.5 s' }, { value: 1000, label: '1 s' }, { value: 1500, label: '1.5 s' }]} />
          <ChoiceRow label="Cancel countdown" hint="Time to change your mind before a payment goes." value={s.countdownSeconds} onChange={(v) => update({ countdownSeconds: v })} options={[{ value: 3, label: '3 s' }, { value: 5, label: '5 s' }, { value: 10, label: '10 s' }]} />
          <ToggleRow label="Longer time limits" hint="Messages stay on screen longer and the app waits longer before locking itself." on={s.longerTimeouts} onChange={(v) => update({ longerTimeouts: v })} />
          <ActionRow label="Practice area" hint="Try holding to confirm and speaking to Echo, with nothing at stake." onClick={() => setSheet('practice')} />
        </Section>

        <Section id="set-privacy" title="Privacy">
          <ToggleRow label="Hide balances on screen" on={hideBalance} onChange={setHideBalance} />
          <ChoiceRow
            label="Privacy mode"
            hint="Normal: private details stay on screen unless headphones are detected. Whisper: Echo says everything, quietly. Headphones: I am wearing headphones, so Echo says everything."
            value={s.privacy}
            onChange={(v) => update({ privacy: v })}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'whisper', label: 'Whisper' },
              { value: 'headphones', label: 'Headphones' },
            ]}
          />
          <ToggleRow label="Silent balance by vibration" hint="Feel your balance as pulses, counted in thousands of naira. Needs a phone that can vibrate." on={s.silentBalance} onChange={(v) => update({ silentBalance: v })} />
          <ActionRow label="Feel my balance now" onClick={() => { echo.feelBalance(); toast(s.haptics ? 'Balance sent by vibration' : 'Turn on Vibration cues to feel it') }} />
        </Section>

        <Section id="set-security" title="Security">
          <ToggleRow label="Fingerprint or face" hint="Used to approve payments. Simulated in this demo." on={s.biometrics} onChange={(v) => update({ biometrics: v })} />
          <ActionRow label="Change PIN" onClick={() => setSheet('pin')} />
          <ChoiceRow
            label="Voice payment limit"
            hint="Payments you start by voice above this amount always ask for your PIN, never fingerprint. Your voice can never approve a payment on its own."
            value={s.voiceLimit}
            onChange={(v) => update({ voiceLimit: v })}
            options={VOICE_LIMITS.map((v) => ({ value: v as number, label: money(v) }))}
          />
          <ChoiceRow label="Daily limit" hint="The most you can send out in one day." value={s.dailyLimit} onChange={(v) => update({ dailyLimit: v })} options={DAILY_LIMITS.map((v) => ({ value: v as number, label: money(v) }))} />
        </Section>

        <Section id="set-contacts" title="Saved contacts">
          {contacts.length === 0 && <p className="row muted">No saved contacts yet. Add one, then say “send money to” and its nickname.</p>}
          {contacts.map((c) => (
            <div key={c.id} className="row contact">
              <span className="avatar sm" aria-hidden="true">{initials(c.nickname ?? c.name)}</span>
              <span className="row-text">
                <b>{c.nickname ?? c.name}</b>
                <small>{c.name} · {c.bank}</small>
              </span>
              <button type="button" className="pill-btn" onClick={() => setRename(c)} aria-label={`Rename ${c.nickname ?? c.name}`}>Rename</button>
              <button type="button" className="pill-btn danger" onClick={() => setDel(c)} aria-label={`Delete ${c.nickname ?? c.name}`}><Trash2 size={16} /> Delete</button>
            </div>
          ))}
          <ActionRow label="Add a contact" hint="Give someone a voice nickname like “My Mechanic”." onClick={() => setSheet('add')} />
        </Section>

        <Section id="set-help" title="Help">
          <ActionRow label="Replay the tutorial" onClick={startTutorial} />
          <ActionRow label="List of voice commands" onClick={() => setSheet('commands')} />
          <ActionRow label="Reset all settings" hint="Clears your PIN and settings and starts setup again." danger onClick={() => setSheet('resetAll')} />
          <ActionRow label="Reset demo data" hint="Restores the sample accounts and transactions." onClick={() => setSheet('resetDemo')} />
          <ActionRow label="About Zenith Echo" onClick={() => setSheet('about')} />
          <ActionRow label="Lock app" onClick={() => setPhase('passcode')} />
          <ActionRow label="Sign Out" danger onClick={() => setPhase('welcome')} />
        </Section>
      </div>

      {sheet === 'profile' && <ProfileSheet onClose={close} />}
      {sheet === 'voice' && <VoiceSheet onClose={close} />}
      {sheet === 'pin' && <PinSheet onClose={close} />}
      {sheet === 'practice' && <PracticeSheet onClose={close} />}
      {sheet === 'commands' && (
        <Sheet title="Voice commands" onClose={close}>
          <CommandList />
        </Sheet>
      )}
      {sheet === 'add' && <ContactSheet onClose={close} />}
      {rename && <RenameSheet b={rename} onClose={() => setRename(null)} />}
      {del && (
        <ConfirmSheet
          title="Delete contact"
          body={`Delete “${del.nickname ?? del.name}”? Echo will no longer know who that is.`}
          confirm="Delete"
          onClose={() => setDel(null)}
          onConfirm={() => { removeBeneficiary(del.id); toast('Contact deleted'); setDel(null) }}
        />
      )}
      {sheet === 'resetAll' && (
        <ConfirmSheet
          title="Reset all settings"
          body="This clears your PIN and every accessibility and security setting, then starts setup again. Your sample accounts are not changed."
          confirm="Reset everything"
          onClose={close}
          onConfirm={() => { resetAll(); setSheet(null); setPhase('onboarding') }}
        />
      )}
      {sheet === 'resetDemo' && (
        <ConfirmSheet title="Reset demo data" body="Restores the sample accounts, transactions and contacts." confirm="Reset" onClose={close} onConfirm={() => { resetDemo(); toast('Demo data reset'); setSheet(null) }} />
      )}
      {sheet === 'about' && (
        <Sheet title="About Zenith Echo" onClose={close}>
          <p className="about">
            Zenith Echo is a front-end prototype that recreates the look and flow of a mobile banking app, with accessibility built in. All names, balances and
            transactions are made up and stored only in this browser. It does not connect to any bank and is not affiliated with Zenith Bank.
          </p>
        </Sheet>
      )}
    </div>
  )
}

/* ---------------- sheets ---------------- */

function ConfirmSheet({ title, body, confirm, onConfirm, onClose }: { title: string; body: string; confirm: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="about">{body}</p>
      <div className="sheet-actions">
        <button type="button" className="btn ghost-dark" onClick={onClose}>Cancel</button>
        <button type="button" className="btn solid red" onClick={onConfirm}>{confirm}</button>
      </div>
    </Sheet>
  )
}

function ProfileSheet({ onClose }: { onClose: () => void }) {
  const { settings, applyProfile } = useSettings()
  const { toast } = useNav()
  const [pick, setPick] = useState<ProfileId>(settings.profile)
  const [extras, setExtras] = useState<Extra[]>(settings.extras)
  const [mode, setMode] = useState<Interaction>(settings.interaction)
  return (
    <Sheet title="Change profile" onClose={onClose}>
      <p className="set-sub">Main profile</p>
      <div className="ob-choices tight" role="radiogroup" aria-label="Main profile">
        {PROFILES.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={pick === p.id} className={'ob-choice' + (pick === p.id ? ' on' : '')} onClick={() => setPick(p.id)}>
            <b>{p.title}</b>
            <span>{p.blurb}</span>
          </button>
        ))}
      </div>
      <p className="set-sub">Extras (choose any)</p>
      <div className="ob-choices tight" role="group" aria-label="Extras">
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
      <p className="set-sub">How I use Echo</p>
      <div className="ob-choices tight" role="radiogroup" aria-label="How I use Echo">
        {INTERACTIONS.map((i) => (
          <button key={i.id} type="button" role="radio" aria-checked={mode === i.id} className={'ob-choice' + (mode === i.id ? ' on' : '')} onClick={() => setMode(i.id)}>
            <b>{i.title}</b>
            <span>{i.blurb}</span>
          </button>
        ))}
      </div>
      <p className="fine">Applying resets your text, voice, hearing and touch settings to what these choices set. Your PIN, limits and privacy choices stay as they are.</p>
      <button type="button" className="btn solid red" onClick={() => { applyProfile(pick, extras, mode); toast('Profile applied'); onClose() }}>Apply</button>
    </Sheet>
  )
}
function VoiceSheet({ onClose }: { onClose: () => void }) {
  const { settings, update } = useSettings()
  const { voices, say } = useEcho()
  const options = useMemo(() => {
    const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'))
    return [{ value: '', label: 'Default', note: 'Best English voice available' }, ...(english.length ? english : voices).map((v) => ({ value: v.name, label: v.name, note: v.lang }))]
  }, [voices])
  return (
    <PickerSheet
      title="Choose a voice"
      options={options}
      value={settings.voiceName}
      searchable={options.length > 8}
      onPick={(v) => {
        update({ voiceName: v })
        window.setTimeout(() => void say('Hello, this is my voice.', { force: true }), 80)
      }}
      onClose={onClose}
    />
  )
}

function PinSheet({ onClose }: { onClose: () => void }) {
  const { setPin, verifyPin } = useSettings()
  const echo = useEcho()
  const { toast } = useNav()
  const [stage, setStage] = useState<'current' | 'new' | 'confirm'>('current')
  const [fresh, setFresh] = useState('')
  const [msg, setMsg] = useState('')
  const [round, setRound] = useState(0)
  const title = stage === 'current' ? 'Enter your current PIN' : stage === 'new' ? 'Enter a new 4-digit PIN' : 'Enter the new PIN again'
  return (
    <Sheet title="Change PIN" onClose={onClose}>
      <p className="fp-hint" aria-live="polite">{title}</p>
      {msg && <p className="ob-note" role="status" aria-live="polite">{msg}</p>}
      <div className="auth-pin">
        <PinPad
          key={stage + round}
          length={4}
          shuffle={false}
          onComplete={async (code) => {
            if (stage === 'current') {
              if (await verifyPin(code)) { setMsg(''); setStage('new') }
              else { echo.alertUser('error'); setMsg('That isn’t your current PIN.'); setRound((r) => r + 1) }
            } else if (stage === 'new') {
              setFresh(code); setMsg(''); setStage('confirm')
            } else if (code === fresh) {
              await setPin(code)
              echo.alertUser('success')
              toast('PIN changed')
              onClose()
            } else {
              echo.alertUser('error'); setMsg('Those PINs didn’t match. Try the new PIN again.'); setStage('new'); setRound((r) => r + 1)
            }
          }}
        />
      </div>
    </Sheet>
  )
}

function PracticeSheet({ onClose }: { onClose: () => void }) {
  const { settings } = useSettings()
  const echo = useEcho()
  const [held, setHeld] = useState(0)
  const [heard, setHeard] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const speak = async () => {
    setNote('')
    const r = await echo.listen(8000)
    if (r.text) {
      setHeard(r.text)
      await echo.runCommand(r.text)
    } else setNote(r.error === 'unsupported' ? 'Voice input isn’t available in this browser.' : 'I didn’t catch that. Try again.')
  }

  return (
    <Sheet title="Practice area" onClose={onClose}>
      <div className="practice">
        <h3>Press and hold</h3>
        <p>Hold the button until it fills. Letting go early cancels it. Nothing is sent.</p>
        <HoldButton label="Hold to confirm" holdMs={settings.holdMs} onConfirm={() => setHeld((n) => n + 1)} />
        {held > 0 && <p className="ob-heard" role="status">Confirmed {held} {held === 1 ? 'time' : 'times'}. Release and hold again to keep practising.</p>}
        <h3>Talk to Echo</h3>
        <p>Try saying “check my balance”.</p>
        {echo.canListen ? (
          <button type="button" className="btn ghost-dark" onClick={speak} disabled={echo.listening}>{echo.listening ? 'Listening…' : 'Tap and speak'}</button>
        ) : (
          <button type="button" className="btn ghost-dark" onClick={() => void echo.openAsk(false)}>Type a command instead</button>
        )}
        {heard && <p className="ob-heard">I heard: “{heard}”</p>}
        {note && <p className="ob-note" role="status">{note}</p>}
      </div>
    </Sheet>
  )
}

function ContactSheet({ onClose }: { onClose: () => void }) {
  const { addBeneficiary } = useStore()
  const { toast } = useNav()
  const [nick, setNick] = useState('')
  const [bank, setBank] = useState(ZENITH)
  const [acct, setAcct] = useState('')
  const [picking, setPicking] = useState(false)
  const name = acct.length === 10 ? lookupAccountName(acct) : ''
  return (
    <Sheet title="Add a contact" onClose={onClose}>
      <label className="field">
        <span>Voice nickname</span>
        <input value={nick} maxLength={24} placeholder="e.g. My Mechanic" onChange={(e) => setNick(e.target.value)} />
      </label>
      <div className="field">
        <span>Bank</span>
        <button type="button" className="select" onClick={() => setPicking(true)}><span>{bank}</span></button>
      </div>
      <label className="field">
        <span>Account number</span>
        <input value={acct} inputMode="numeric" maxLength={10} placeholder="10 digits" onChange={(e) => setAcct(e.target.value.replace(/\D/g, ''))} />
      </label>
      {name && <p aria-live="polite" className="resolve ok">{name}</p>}
      <button
        type="button"
        className="btn solid red"
        disabled={!name || nick.trim().length < 2}
        onClick={() => {
          toast(addBeneficiary({ kind: 'bank', name, nickname: nick.trim(), bank, accountNumber: acct }) ? `Saved “${nick.trim()}”` : 'That account is already saved')
          onClose()
        }}
      >
        Save contact
      </button>
      {picking && <PickerSheet title="Select Bank" searchable value={bank} onPick={setBank} onClose={() => setPicking(false)} options={[ZENITH, ...BANKS].map((b) => ({ value: b, label: b }))} />}
    </Sheet>
  )
}

function RenameSheet({ b, onClose }: { b: Beneficiary; onClose: () => void }) {
  const { updateBeneficiary } = useStore()
  const { toast } = useNav()
  const [nick, setNick] = useState(b.nickname ?? '')
  useEffect(() => setNick(b.nickname ?? ''), [b])
  const ok = nick.trim().length >= 2
  const save = () => {
    if (!ok) return
    updateBeneficiary(b.id, { nickname: nick.trim() })
    toast(`Renamed to “${nick.trim()}”`)
    onClose()
  }
  return (
    <Sheet title="Rename contact" onClose={onClose}>
      <p className="about">{b.name} · {b.bank}</p>
      <label className="field">
        <span>Voice nickname</span>
        <input value={nick} maxLength={24} onChange={(e) => setNick(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </label>
      <button type="button" className="btn solid red" disabled={!ok} onClick={save}>Save name</button>
    </Sheet>
  )
}

