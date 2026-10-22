import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { moneyWords, naira } from '../lib/format'
import { SCALE_STEPS, useSettings } from '../state/settings'
import { useNav } from '../state/nav'
import { useStore } from '../state/store'
import type { Receipt } from '../lib/types'
import { approveWithPin, choose, inConversation, premiumSpeech, talk, wantsAssistant, type AssistantReceipt, type AssistantReply } from './assistant'
import { HELP_LIST, parseCommand, type Dest } from './commands'

// Minimal typings: SpeechRecognition isn't in TypeScript's DOM lib yet.
interface RecResult { 0: { transcript: string }; isFinal?: boolean }
interface RecEvent { resultIndex?: number; results: ArrayLike<RecResult> }
interface Rec {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: RecEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type RecCtor = new () => Rec
const getRec = (): RecCtor | null => {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const RATE = { slow: 0.8, normal: 1, fast: 1.25 } as const
/** "Hey Ziva", with a few spellings speech recognition tends to produce. Anything after it is the command. */
const WAKE = /\b(?:hey|hi|okay|ok)[\s,]*(?:ziva|zeva|zeeva|ziba|zeeba|siva|seva)\b[\s,.!?]*(.*)$/i

export type Cue = 'success' | 'error' | 'info' | 'listen' | 'tick'
export interface ListenResult { text: string | null; error?: string }

/**
 * Every reply Echo gives. `text` is shown as a caption. `speech` has the full detail (balances, names, amounts).
 * `privateSpeech` is safe to say out loud in public. Which one is played depends on the privacy mode.
 */
export interface Message { text: string; speech: string; privateSpeech: string }
export const message = (text: string, speech = text, privateSpeech = speech): Message => ({ text, speech, privateSpeech })

export interface Reply { heard: string | null; message: Message; assistant?: AssistantReply }

interface Echo {
  caption: string | null
  speaking: boolean
  listening: boolean
  /** True while "Hey Ziva" listening is running. */
  wakeActive: boolean
  canSpeak: boolean
  canListen: boolean
  mic: 'unknown' | 'granted' | 'denied'
  voices: SpeechSynthesisVoice[]
  reply: Reply | null
  askOpen: boolean
  flashKey: number
  openAsk: (listenNow?: boolean) => void
  closeAsk: () => void
  /** Call from a tap: browsers keep speech silent until the user has touched the page. */
  unlock: () => void
  /** Announce something (screen names, prompts). Captioned if captions are on, spoken if spoken guidance is on or `force`. */
  say: (text: string, opts?: { force?: boolean; volume?: number }) => Promise<void>
  /**
   * Give a reply: captioned, then spoken as `speech`, quietly, or as `privateSpeech` depending on privacy mode.
   * Replies to commands are always captioned; pass `{ caption: false }` for announcements, which follow the Captions setting.
   */
  respond: (m: Message, opts?: { caption?: boolean }) => Promise<void>
  stop: () => void
  listen: (timeoutMs?: number) => Promise<ListenResult>
  requestMic: () => Promise<boolean>
  cue: (k: Cue) => void
  buzz: (pattern: number | number[]) => void
  flash: () => void
  /** Sound + vibration + flash, each only if the user turned it on. */
  alertUser: (kind: 'success' | 'error' | 'info') => void
  runCommand: (text: string) => Promise<Message>
  /** Put a message on screen as Echo's latest reply (without speaking it). */
  showReply: (heard: string | null, m: Message) => void
  clearReply: () => void
  feelBalance: () => void
  headphones: () => Promise<boolean | null>
  /** Pick one of the options Echo offered (a bank, a network, a data plan). */
  chooseOption: (id: string) => Promise<void>
  /** Approve the payment Echo is waiting on. Returns false if the PIN was wrong. */
  approveAssistant: (pin: string) => Promise<boolean>
}

const C = createContext<Echo | null>(null)

/** Balance in thousands as pulses: one pulse per count for each digit, a long buzz for zero, a longer pause between digits. */
function balancePattern(balance: number): number[] {
  const digits = String(Math.min(99999, Math.round(balance / 1000))).split('').map(Number)
  const p: number[] = [] // vibrate() alternates on, off, on, off...
  for (const d of digits) {
    const pulses = d === 0 ? [650] : Array<number>(d).fill(160)
    pulses.forEach((on, j) => p.push(on, j === pulses.length - 1 ? 600 : 160))
  }
  p.pop() // no trailing pause
  return p
}

async function micPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  try {
    const r = await navigator.permissions?.query({ name: 'microphone' as PermissionName })
    return r?.state ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

export function EchoProvider({ children }: { children: ReactNode }) {
  const { settings, update, verifyPin } = useSettings()
  const verifyRef = useRef(verifyPin)
  verifyRef.current = verifyPin
  const store = useStore()
  const nav = useNav()

  // Latest values for callbacks that outlive a render (speech end, timers).
  const sRef = useRef(settings)
  sRef.current = settings
  const stRef = useRef(store)
  stRef.current = store
  const nRef = useRef(nav)
  nRef.current = nav

  const [caption, setCaption] = useState<string | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const [wakeActive, setWakeActive] = useState(false)
  const [mic, setMic] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [reply, setReply] = useState<Reply | null>(null)
  const [askOpen, setAskOpen] = useState(false)
  const [flashKey, setFlashKey] = useState(0)
  const capTimer = useRef<number | undefined>(undefined)
  const audio = useRef<AudioContext | null>(null)
  const listeningRef = useRef(false)
  const speakingRef = useRef(false)
  const micRef = useRef(mic)
  micRef.current = mic
  const player = useRef<HTMLAudioElement | null>(null)
  const assistantRef = useRef<AssistantReply | null>(null)

  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window
  const canListen = typeof window !== 'undefined' && !!getRec()

  useEffect(() => {
    if (!canSpeak) return
    const load = () => setVoices(window.speechSynthesis.getVoices())
    load()
    window.speechSynthesis.addEventListener?.('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', load)
  }, [canSpeak])

  useEffect(() => () => window.clearTimeout(capTimer.current), [])

  const showCaption = useCallback((text: string) => {
    setCaption(text)
    window.clearTimeout(capTimer.current)
    capTimer.current = window.setTimeout(() => setCaption(null), Math.max(4500, text.length * 70))
  }, [])

  const unlock = useCallback(() => {
    if (!canSpeak) return
    try {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      window.speechSynthesis.speak(u)
    } catch {
      /* ignore */
    }
  }, [canSpeak])

  /** Speech only: no caption. */
  const speak = useCallback(
    (text: string, opts?: { force?: boolean; volume?: number }) => {
      const s = sRef.current
      if (!text || !(s.voice || opts?.force) || !canSpeak) return Promise.resolve()
      window.speechSynthesis.cancel()
      return new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(text)
        const all = window.speechSynthesis.getVoices()
        const chosen = (s.voiceName && all.find((v) => v.name === s.voiceName)) || all.find((v) => v.lang === 'en-NG') || all.find((v) => v.lang.startsWith('en-GB')) || all.find((v) => v.lang.startsWith('en'))
        if (chosen) u.voice = chosen
        u.lang = chosen?.lang ?? 'en-GB'
        u.rate = RATE[s.speechRate]
        u.volume = opts?.volume ?? 1
        let done = false
        const finish = () => {
          if (done) return
          done = true
          window.clearTimeout(guard)
          speakingRef.current = false
          setSpeaking(false)
          resolve()
        }
        // Some browsers never fire onend (no voices installed); don't hang the caller.
        const guard = window.setTimeout(finish, 1800 + (text.length * 95) / u.rate)
        u.onend = finish
        u.onerror = finish
        speakingRef.current = true
        setSpeaking(true)
        window.speechSynthesis.speak(u)
      })
    },
    [canSpeak],
  )

  const say = useCallback(
    (text: string, opts?: { force?: boolean; volume?: number }) => {
      if (sRef.current.captions) showCaption(text)
      return speak(text, opts)
    },
    [showCaption, speak],
  )

  const stop = useCallback(() => {
    player.current?.pause()
    player.current = null
    if (canSpeak) window.speechSynthesis.cancel()
    speakingRef.current = false
    setSpeaking(false)
  }, [canSpeak])

  // ---- sound, vibration, flash
  const tone = useCallback((freq: number, ms: number, at = 0) => {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return
      audio.current ??= new Ctx()
      const ctx = audio.current
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = freq
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at)
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + at + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + ms / 1000)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + at)
      o.stop(ctx.currentTime + at + ms / 1000 + 0.05)
    } catch {
      /* audio not available */
    }
  }, [])

  const cue = useCallback(
    (k: Cue) => {
      if (!sRef.current.soundCues) return
      if (k === 'success') {
        tone(660, 120)
        tone(880, 180, 0.13)
      } else if (k === 'error') {
        tone(220, 220)
        tone(180, 260, 0.2)
      } else if (k === 'listen') tone(740, 90)
      else if (k === 'tick') tone(520, 60)
      else tone(600, 80)
    },
    [tone],
  )

  const buzz = useCallback((pattern: number | number[]) => {
    if (!sRef.current.haptics) return
    try {
      navigator.vibrate?.(pattern)
    } catch {
      /* not supported */
    }
  }, [])

  const flash = useCallback(() => {
    if (sRef.current.flashAlerts) setFlashKey((k) => k + 1)
  }, [])

  const alertUser = useCallback(
    (kind: 'success' | 'error' | 'info') => {
      cue(kind)
      buzz(kind === 'error' ? [120, 60, 120] : kind === 'success' ? [40, 40, 90] : 30)
      flash()
    },
    [cue, buzz, flash],
  )

  // ---- headphones (best effort: browsers only reveal device names once the microphone is allowed)
  const headphones = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const outs = devices.filter((d) => d.kind === 'audiooutput')
      if (!outs.length || outs.every((d) => !d.label)) return null // browser won't say
      return outs.some((d) => /head(phone|set)|earphone|earbud|airpod|buds|bluetooth|wired/i.test(d.label))
    } catch {
      return null
    }
  }, [])

  /** Echo's own voice from the server, falling back to the phone's voice if the server can't be reached. */
  const speakReply = useCallback(
    async (text: string, volume = 1) => {
      const s = sRef.current
      if (!text || !s.voice) return
      let url = ''
      try {
        url = URL.createObjectURL(await premiumSpeech(text))
      } catch {
        await speak(text, { volume })
        return
      }
      if (canSpeak) window.speechSynthesis.cancel()
      player.current?.pause()
      const clip = new Audio(url)
      player.current = clip
      clip.volume = volume
      clip.playbackRate = RATE[s.speechRate]
      speakingRef.current = true
      setSpeaking(true)
      await new Promise<void>((resolve) => {
        clip.onended = () => resolve()
        clip.onerror = () => resolve()
        clip.onpause = () => resolve()
        clip.play().catch(() => resolve())
      })
      URL.revokeObjectURL(url)
      if (player.current === clip) player.current = null
      speakingRef.current = false
      setSpeaking(false)
    },
    [canSpeak, speak],
  )

  /**
   * Every reply: show message.text as a caption. With headphones on, play message.speech. In whisper mode, play
   * message.speech at low volume. Otherwise play message.privateSpeech. ("Headphones" mode means "I'm wearing them".)
   */
  const respond = useCallback(
    async (m: Message, opts?: { caption?: boolean }) => {
      if (opts?.caption !== false || sRef.current.captions) showCaption(m.text)
      const privacy = sRef.current.privacy
      const onHeadphones = privacy === 'headphones' || (await headphones()) === true
      if (onHeadphones) await speakReply(m.speech)
      else if (privacy === 'whisper') await speakReply(m.speech, 0.15)
      else await speakReply(m.privateSpeech)
    },
    [headphones, showCaption, speakReply],
  )

  // ---- microphone + one-shot recognition
  const requestMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      setMic('granted')
      return true
    } catch {
      setMic('denied')
      return false
    }
  }, [])

  // Only one recognizer can run at a time, so the "Hey Ziva" one steps aside while a command is being listened for.
  const pauseWake = useRef<() => void>(() => {})
  const resumeWake = useRef<() => void>(() => {})

  const listen = useCallback(
    (timeoutMs = 9000) =>
      new Promise<ListenResult>((resolve) => {
        const Rec = getRec()
        if (!Rec) return resolve({ text: null, error: 'unsupported' })
        if (listeningRef.current) return resolve({ text: null, error: 'busy' })
        if (canSpeak) window.speechSynthesis.cancel() // don't hear ourselves
        pauseWake.current()
        const rec = new Rec()
        rec.lang = 'en-NG'
        rec.continuous = false
        rec.interimResults = false
        rec.maxAlternatives = 1
        let finished = false
        const done = (r: ListenResult) => {
          if (finished) return
          finished = true
          window.clearTimeout(timer)
          listeningRef.current = false
          setListening(false)
          try {
            rec.stop()
          } catch {
            /* already stopped */
          }
          resumeWake.current()
          resolve(r)
        }
        const timer = window.setTimeout(() => done({ text: null, error: 'timeout' }), timeoutMs)
        rec.onresult = (e) => done({ text: e.results[0]?.[0]?.transcript ?? null })
        rec.onerror = (e) => {
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setMic('denied')
          done({ text: null, error: e.error })
        }
        rec.onend = () => done({ text: null, error: 'no-speech' })
        listeningRef.current = true
        setListening(true)
        cue('listen')
        try {
          rec.start()
        } catch {
          done({ text: null, error: 'start-failed' })
        }
      }),
    [canSpeak, cue],
  )

  const feelBalance = useCallback(() => {
    buzz(balancePattern(stRef.current.accounts[0].balance))
  }, [buzz])

  // ---- commands. Voice can open screens and fill a form, but never approves a payment.
  const execute = useCallback(
    async (input: string): Promise<Message> => {
      const cmd = parseCommand(input)
      const n = nRef.current
      const st = stRef.current
      const s = sRef.current
      const simple = s.extras.includes('simpleWords')
      const out = async (m: Message) => {
        await respond(m)
        return m
      }
      const plain = (normal: string, easy: string) => message(simple ? easy : normal)
      if (!cmd) return out(plain(`Sorry, I didn't understand "${input}". Say help to hear what I can do.`, 'I did not understand. Say help.'))

      switch (cmd.type) {
        case 'balance': {
          const sav = st.accounts[0]
          const end = sav.number.slice(-4)
          const kind = sav.type.toLowerCase()
          if (s.silentBalance) {
            buzz(balancePattern(sav.balance))
            return out(message(`${sav.type} ending in ${end}: ${naira(sav.balance)}. Sent by vibration.`, '', ''))
          }
          return out(
            simple
              ? message(`${sav.type} ${end}: ${naira(sav.balance)}.`, `Your savings has ${moneyWords(sav.balance)}.`, 'Your balance is on the screen.')
              : message(
                  `${sav.type} ending in ${end}: ${naira(sav.balance)}. All accounts together: ${naira(st.total)}.`,
                  `Your ${kind} ending in ${end} has ${moneyWords(sav.balance)}. Across all your accounts you have ${moneyWords(st.total)}.`,
                  `Your ${kind} ending in ${end}. I have not read the balance out loud. It is on the screen.`,
                ),
          )
        }
        case 'last': {
          const t = st.txns[0]
          if (!t) return out(message('You have no transactions yet.'))
          const dir = t.amount > 0 ? 'credit' : 'debit'
          return out(
            simple
              ? message(`Last: ${dir} of ${naira(Math.abs(t.amount))}.`, `Your last one was a ${dir} of ${moneyWords(Math.abs(t.amount))}.`, 'Your last transaction is on the screen.')
              : message(`Last transaction: ${dir} of ${naira(Math.abs(t.amount))}. ${t.desc}.`, `Your last transaction was a ${dir} of ${moneyWords(Math.abs(t.amount))}. ${t.desc}.`, 'Your latest transaction is on the screen. I have not read it out loud.'),
          )
        }
        case 'help':
          return out(
            simple
              ? message('You can say: check my balance. Send money. Open airtime. Help.', 'You can say: check my balance. Send money to a contact. Open airtime. I can not pay for you.')
              : message(
                  `You can say: ${HELP_LIST.slice(0, 6).map((h) => h.say).join('. ')}. Echo can never approve a payment for you. You always confirm with your PIN or fingerprint.`,
                ),
          )
        case 'stop':
          stop()
          return message('Stopped.')
        case 'lock':
          n.setPhase('passcode')
          return message('Locked.')
        case 'approve':
          return out(plain("I can't approve payments by voice. Please confirm on the screen with your fingerprint or PIN.", 'I can not pay for you. Tap confirm, then use your PIN.'))
        case 'textSize': {
          const i = SCALE_STEPS.findIndex((x) => x === s.scale)
          const next = SCALE_STEPS[Math.max(0, Math.min(SCALE_STEPS.length - 1, (i < 0 ? 1 : i) + (cmd.dir === 'bigger' ? 1 : -1)))]
          update({ scale: next })
          return out(message(`Text size is now ${Math.round(next * 100)} percent.`))
        }
        case 'theme':
          update({ theme: cmd.value })
          return out(message(`${cmd.value === 'dark' ? 'Dark' : 'Light'} mode on.`))
        case 'go': {
          const to: Dest | 'back' = cmd.to
          if (to === 'back') {
            if (n.page) n.closePage()
            else n.setTab('home')
            return out(message('Going back.'))
          }
          if (to === 'home') n.setTab('home')
          else if (to === 'transfer') n.startTransfer()
          else if (to === 'airtime' || to === 'data') n.openRecharge(to)
          else if (to === 'electricity' || to === 'cable') n.openBill(to)
          else if (to === 'bills') n.setTab('bills')
          else if (to === 'history') n.openAccount('sav')
          else if (to === 'settings') n.setTab('more')
          else if (to === 'messages') n.openInbox()
          return out(message(`Opening ${to === 'data' ? 'data bundles' : to}.`))
        }
        case 'send': {
          const q = cmd.who.toLowerCase()
          const match = st.beneficiaries.find((b) => b.kind === 'bank' && (b.nickname?.toLowerCase() === q || b.name.toLowerCase().includes(q) || (b.nickname && q.includes(b.nickname.toLowerCase()))))
          if (!match) return out(plain(`I couldn't find "${cmd.who}" in your saved contacts. You can add one in Settings under Saved contacts.`, `I could not find ${cmd.who}. Add them in Settings, under Saved contacts.`))
          n.startTransfer({ name: match.name, bank: match.bank ?? 'Zenith Bank', accountNumber: match.accountNumber ?? '', amount: cmd.amount, viaVoice: true })
          const who = match.nickname ?? match.name
          const over = cmd.amount !== undefined && cmd.amount > s.voiceLimit
          const amountText = cmd.amount ? ` for ${naira(cmd.amount)}` : ''
          const amountSpeech = cmd.amount ? ` for ${moneyWords(cmd.amount)}` : ''
          const pin = over ? ` That is above your voice limit of ${moneyWords(s.voiceLimit)}, so I'll ask for your PIN.` : ''
          return out(
            simple
              ? message(`Transfer to ${who}${amountText}. Check it, then confirm.`, `Opening a transfer to ${who}${amountSpeech}. Check it, then confirm. I can not send it for you.${over ? ' I will ask for your PIN.' : ''}`, 'Opening your transfer. Check it on the screen, then confirm. I can not send it for you.')
              : message(
                  `Transfer to ${who}${amountText}. Check the details, then confirm on screen.${pin}`,
                  `Opening a transfer to ${who}${amountSpeech}. Check the details, then confirm on screen.${pin} I can't send it for you.`,
                  "Opening your transfer. Check the details on the screen, then confirm with your PIN. I can't send it for you.",
                ),
          )
        }
      }
    },
    [respond, stop, update, buzz],
  )

  /** Payments Echo completed on the server also go into this app's history, with this app's balance read back. */
  const record = useCallback((r: AssistantReceipt): number | null => {
    const st = stRef.current
    const acct = st.accounts[0]
    const receipt: Receipt = {
      ref: r.id,
      at: r.date,
      kind: r.type,
      title: r.description,
      amount: r.amount,
      fee: 0,
      credit: false,
      from: `${acct.type} - ${acct.number}`,
      rows: r.token ? [['Description', r.description], ['Token', r.token]] : [['Description', r.description]],
      token: r.token,
      units: r.units !== undefined ? `${r.units} kWh` : undefined,
    }
    if (!st.post(acct.id, r.description, -r.amount, receipt)) return null
    return acct.balance - r.amount
  }, [])

  const runRef = useRef<(text: string) => Promise<Message>>(async () => message(''))

  const runAssistant = useCallback(
    async (heard: string | null, call: () => Promise<AssistantReply>): Promise<Message> => {
      let r: AssistantReply
      try {
        r = await call()
      } catch (err) {
        const reason = err instanceof Error ? err.message : ''
        const m = message(/fetch|network/i.test(reason) ? 'I can’t reach Echo right now. Check your internet connection and try again.' : reason || 'Something went wrong.')
        setReply({ heard, message: m, assistant: assistantRef.current ?? undefined })
        alertUser('error')
        await respond(m)
        return m
      }
      assistantRef.current = r
      let { text, speech } = r.message
      if (r.status === 'done' && r.receipt) {
        const local = record(r.receipt)
        if (local !== null) {
          const lead = /(Your new balance is|Wetin remain for your account na) /
          text = text.replace(new RegExp(lead.source + '₦[\\d,]+(?:\\.\\d{1,2})?\\.'), (_, l: string) => `${l} ${naira(local)}.`)
          speech = speech.replace(new RegExp(lead.source + '[^.]+\\.'), (_, l: string) => `${l} ${moneyWords(local)}.`)
        }
        alertUser('success')
      } else if (r.message.tone === 'error') alertUser('error')
      const m = message(text, speech, r.message.privateSpeech)
      setAskOpen(true)
      setReply({ heard, message: m, assistant: r })
      await respond(m)
      const s = sRef.current
      const keepTalking = (r.status === 'collecting' || r.status === 'confirming') && s.voice && s.interaction === 'voice' && !!getRec() && micRef.current !== 'denied'
      if (keepTalking && assistantRef.current === r) {
        const next = await listen(9000)
        if (next.text && assistantRef.current === r) await runRef.current(next.text)
      }
      return m
    },
    [alertUser, listen, record, respond],
  )

  const runCommand = useCallback(
    async (text: string) => {
      const local = parseCommand(text)
      const talking = inConversation(assistantRef.current)
      const keepLocal = local && (talking ? ['lock', 'textSize', 'theme'] : ['stop', 'lock', 'textSize', 'theme']).includes(local.type)
      if (/\b(remain|elo lo ku|melo lo ku)\b/i.test(text) && !talking) return runRef.current('check my balance')
      if (!keepLocal && (talking || !local || wantsAssistant(text))) return runAssistant(text, () => talk(text))
      const m = await execute(text)
      setReply({ heard: text, message: m })
      return m
    },
    [execute, runAssistant],
  )
  runRef.current = runCommand

  const chooseOption = useCallback(async (id: string) => {
    await runAssistant(null, () => choose(id))
  }, [runAssistant])

  const approveAssistant = useCallback(
    async (pin: string) => {
      if (!(await verifyRef.current(pin))) return false
      await runAssistant(null, () => approveWithPin(pin))
      return true
    },
    [runAssistant],
  )

  // Stable identities, so components can depend on them without re-running when Echo's state changes.
  const showReply = useCallback((heard: string | null, m: Message) => setReply({ heard, message: m }), [])
  const clearReply = useCallback(() => setReply(null), [])

  const openAsk = useCallback(
    (listenNow?: boolean) => {
      setAskOpen(true)
      setReply(null)
      if (listenNow && getRec()) {
        void (async () => {
          const r = await listen(8000)
          if (r.text) await runCommand(r.text)
          else setReply({ heard: null, message: message(r.error === 'not-allowed' ? 'Microphone is blocked. You can type a command instead.' : "I didn't catch that. Tap the microphone to try again, or type a command.") })
        })()
      }
    },
    [listen, runCommand],
  )

  // ---- "Hey Ziva": continuous listening while the app is open, only if the microphone is already allowed
  const wakeOn = useRef(false)
  const wakePaused = useRef(false)
  const wakeRec = useRef<Rec | null>(null)
  const wakeTimer = useRef<number | undefined>(undefined)
  const onWake = useRef<(rest: string) => void>(() => {})
  onWake.current = (rest: string) => {
    cue('listen')
    buzz(30)
    void (async () => {
      if (rest) {
        await runCommand(rest)
        return
      }
      await say('Yes?')
      const r = await listen(8000)
      if (r.text) await runCommand(r.text)
    })()
  }

  const stopWakeRec = useCallback(() => {
    window.clearTimeout(wakeTimer.current)
    const r = wakeRec.current
    wakeRec.current = null
    if (r) {
      r.onend = null
      r.onerror = null
      r.onresult = null
      try {
        r.abort()
      } catch {
        /* already stopped */
      }
    }
    setWakeActive(false)
  }, [])

  const startWakeRec = useCallback(async () => {
    const Rec = getRec()
    if (!Rec || !wakeOn.current || wakePaused.current || wakeRec.current) return
    const granted = micRef.current === 'granted' || (await micPermission()) === 'granted'
    if (!granted || !wakeOn.current || wakePaused.current || wakeRec.current) return
    const rec = new Rec()
    rec.lang = 'en-NG'
    rec.continuous = true
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (e) => {
      if (speakingRef.current) return // don't react to our own voice
      for (let i = e.resultIndex ?? 0; i < e.results.length; i++) {
        const m = WAKE.exec(e.results[i][0].transcript)
        if (m) onWake.current((m[1] ?? '').trim())
      }
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setMic('denied')
        wakeOn.current = false
        stopWakeRec()
      }
    }
    // The browser ends continuous recognition every so often: start it again.
    rec.onend = () => {
      wakeRec.current = null
      setWakeActive(false)
      if (wakeOn.current && !wakePaused.current) wakeTimer.current = window.setTimeout(() => void startWakeRec(), 700)
    }
    wakeRec.current = rec
    try {
      rec.start()
      setWakeActive(true)
    } catch {
      wakeRec.current = null
    }
  }, [stopWakeRec])

  pauseWake.current = () => {
    wakePaused.current = true
    stopWakeRec()
  }
  resumeWake.current = () => {
    wakePaused.current = false
    if (wakeOn.current) wakeTimer.current = window.setTimeout(() => void startWakeRec(), 400)
  }

  useEffect(() => {
    wakeOn.current = settings.wakeWord && nav.phase === 'app' && canListen
    if (wakeOn.current) void startWakeRec()
    else stopWakeRec()
    return () => {
      wakeOn.current = false
      stopWakeRec()
    }
  }, [settings.wakeWord, nav.phase, canListen, mic, startWakeRec, stopWakeRec])

  const value = useMemo<Echo>(
    () => ({
      caption, speaking, listening, wakeActive, canSpeak, canListen, mic, voices, reply, askOpen, flashKey,
      openAsk,
      closeAsk: () => setAskOpen(false),
      unlock, say, respond, stop, listen, requestMic, cue, buzz, flash, alertUser, runCommand, feelBalance, headphones,
      showReply,
      clearReply,
      chooseOption,
      approveAssistant,
    }),
    [caption, speaking, listening, wakeActive, canSpeak, canListen, mic, voices, reply, askOpen, flashKey, openAsk, unlock, say, respond, stop, listen, requestMic, cue, buzz, flash, alertUser, runCommand, feelBalance, headphones, showReply, clearReply, chooseOption, approveAssistant],
  )

  return <C.Provider value={value}>{children}</C.Provider>
}

export function useEcho(): Echo {
  const v = useContext(C)
  if (!v) throw new Error('useEcho outside EchoProvider')
  return v
}
