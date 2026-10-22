import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { checkPin, hashPin, newSalt } from '../lib/pin'

/** Main profile. Anything else the person needs comes from the optional extras. */
export type ProfileId = 'blind' | 'standard'
export type Extra = 'hardOfHearing' | 'tremor' | 'simpleWords'
/** voice: talk to Echo and tap normally. touchRead: tap once to hear an item, double tap to activate it. */
export type Interaction = 'voice' | 'touchRead'
export type Privacy = 'normal' | 'whisper' | 'headphones'

export interface Settings {
  // already used by the accessibility layer
  profile: ProfileId
  theme: 'light' | 'dark'
  scale: number // text size multiplier, one of SCALE_STEPS
  largeTargets: boolean
  tremorGuard: boolean // steady taps + cancel countdown before a payment is sent
  voice: boolean // spoken guidance
  captions: boolean
  haptics: boolean // vibration cues
  // from the first spec
  speechRate: 'slow' | 'normal' | 'fast'
  autoListen: boolean
  holdMs: 500 | 1000 | 1500
  countdownSeconds: 3 | 5 | 10
  voiceLimit: number
  onboarded: boolean
  // added for the controls that spec lists
  holdToConfirm: boolean
  reduceMotion: boolean
  soundCues: boolean
  voiceName: string // '' = the browser's default English voice
  language: 'en' | 'pcm' | 'yo' | 'ha' | 'ig' // only English is available so far
  captionSize: 'normal' | 'large' | 'xl'
  flashAlerts: boolean
  longerTimeouts: boolean
  silentBalance: boolean
  biometrics: boolean
  dailyLimit: number
  pinHash: string
  pinSalt: string
  // from the second spec
  interaction: Interaction
  extras: Extra[]
  /** Replaces the old privacyMode and headphonesOnly switches. */
  privacy: Privacy
  /** Listen for "Hey Ziva" while the app is open. */
  wakeWord: boolean
}

export const SCALE_STEPS = [0.9, 1, 1.15, 1.3, 1.5, 1.75] as const
export const VOICE_LIMITS = [10000, 20000, 50000] as const
export const DAILY_LIMITS = [50000, 100000, 200000, 500000, 1000000] as const

export const BASE: Settings = {
  profile: 'standard',
  theme: 'light',
  scale: 1,
  largeTargets: false,
  tremorGuard: false,
  voice: false,
  captions: false,
  haptics: false,
  speechRate: 'normal',
  autoListen: false,
  holdMs: 1000,
  countdownSeconds: 5,
  voiceLimit: 50000,
  onboarded: false,
  holdToConfirm: false,
  reduceMotion: false,
  soundCues: false,
  voiceName: '',
  language: 'en',
  captionSize: 'normal',
  flashAlerts: false,
  longerTimeouts: false,
  silentBalance: false,
  biometrics: true,
  dailyLimit: 500000,
  pinHash: '',
  pinSalt: '',
  interaction: 'voice',
  extras: [],
  privacy: 'normal',
  wakeWord: false,
}

/** Keys a profile, an extra or an interaction mode is allowed to (re)set. PIN, limits and privacy choices are left alone. */
const PROFILE_KEYS = [
  'theme', 'scale', 'largeTargets', 'tremorGuard', 'voice', 'captions', 'haptics', 'speechRate', 'autoListen', 'holdMs',
  'countdownSeconds', 'holdToConfirm', 'reduceMotion', 'soundCues', 'captionSize', 'flashAlerts', 'longerTimeouts', 'wakeWord',
] as const satisfies readonly (keyof Settings)[]

interface Def<T extends string> {
  id: T
  title: string
  blurb: string
  defaults: Partial<Settings>
}

export const PROFILES: Def<ProfileId>[] = [
  {
    id: 'blind',
    title: 'Blind or low vision',
    blurb: 'Echo speaks every screen. Big text and a dark, high-contrast look.',
    defaults: { voice: true, autoListen: true, haptics: true, soundCues: true, largeTargets: true, scale: 1.5, theme: 'dark' },
  },
  { id: 'standard', title: 'Standard', blurb: 'The app as it normally looks. You can change anything later in Settings.', defaults: {} },
]

export const EXTRAS: Def<Extra>[] = [
  {
    id: 'hardOfHearing',
    title: 'Hard of hearing',
    blurb: 'Captions for everything Echo says, vibration, screen flashes and slower speech.',
    defaults: { captions: true, captionSize: 'large', haptics: true, flashAlerts: true, soundCues: true, speechRate: 'slow' },
  },
  {
    id: 'tremor',
    title: 'Tremors or difficulty tapping',
    blurb: 'Bigger buttons, steady taps, press-and-hold to confirm and time to cancel.',
    defaults: { tremorGuard: true, holdToConfirm: true, largeTargets: true, longerTimeouts: true, haptics: true, scale: 1.15 },
  },
  { id: 'simpleWords', title: 'Simple words', blurb: 'Echo uses short, plain sentences.', defaults: {} },
]

export const INTERACTIONS: Def<Interaction>[] = [
  {
    id: 'voice',
    title: 'Voice',
    blurb: 'Talk to Echo, or say “Hey Ziva”. Tapping works as normal.',
    defaults: { voice: true, autoListen: true, wakeWord: true },
  },
  {
    id: 'touchRead',
    title: 'Touch and read',
    blurb: 'Tap once to hear what is under your finger. Double tap to use it.',
    defaults: { voice: true },
  },
]

type Patch = Partial<Settings>

/** Layers defaults onto settings: switches only ever turn on, the text size only grows, other values replace. */
function overlay(into: Settings, d: Patch): Patch {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(d)) {
    const cur = (into as unknown as Record<string, unknown>)[k]
    if (k === 'scale') out[k] = Math.max(Number(cur), Number(v))
    else if (typeof v === 'boolean') out[k] = Boolean(cur) || v
    else out[k] = v
  }
  return out as Patch
}

/** Everything a profile + extras + interaction choice sets, starting again from the plain defaults. */
export function compose(profile: ProfileId, extras: Extra[], interaction: Interaction): Patch {
  let s: Settings = { ...BASE, ...Object.fromEntries(PROFILE_KEYS.map((k) => [k, BASE[k]])) }
  const layers: Patch[] = [
    PROFILES.find((p) => p.id === profile)!.defaults,
    INTERACTIONS.find((i) => i.id === interaction)!.defaults,
    ...extras.map((e) => EXTRAS.find((x) => x.id === e)!.defaults),
  ]
  for (const l of layers) s = { ...s, ...overlay(s, l) }
  // In Touch and read there's no hands-free listening: opening the microphone would fight with the finger.
  if (interaction === 'touchRead') s = { ...s, autoListen: false, wakeWord: false }
  const patch = Object.fromEntries(PROFILE_KEYS.map((k) => [k, s[k]])) as Patch
  return { ...patch, profile, extras, interaction }
}

const KEY = 'zenith-echo:settings:v1'

/** Reads saved settings, upgrading older shapes (single profile string, two privacy switches). */
function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as Record<string, unknown>
      let extras = Array.isArray(s.extras) ? (s.extras as Extra[]) : []
      if (s.profile === 'lowVisionHoh') {
        s.profile = 'blind'
        extras = [...extras, 'hardOfHearing']
      } else if (s.profile === 'tremor') {
        s.profile = 'standard'
        extras = [...extras, 'tremor']
      }
      if (s.headphonesOnly && !s.privacy) s.privacy = 'headphones'
      delete s.privacyMode
      delete s.headphonesOnly
      return { ...BASE, ...(s as Partial<Settings>), extras: [...new Set(extras)] }
    }
  } catch {
    /* storage blocked or corrupt */
  }
  return { ...BASE }
}

interface Ctx {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  /** Resets the accessibility keys to what this profile, extras and interaction mode set. PIN, limits and privacy stay. */
  applyProfile: (profile: ProfileId, extras?: Extra[], interaction?: Interaction) => void
  /** Turns an extra on (applying its defaults) or off (only the flag; your other choices are kept). */
  setExtra: (extra: Extra, on: boolean) => void
  /** Wipes every setting, including the PIN, and returns to first-run setup. */
  resetAll: () => void
  hasPin: boolean
  setPin: (pin: string) => Promise<void>
  verifyPin: (pin: string) => Promise<boolean>
}

const C = createContext<Ctx | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load)
  const ref = useRef(settings)

  const commit = useCallback((next: Settings) => {
    ref.current = next
    setSettings(next)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      /* ignore */
    }
  }, [settings])

  // Push display settings onto <html> so CSS can react to them.
  useEffect(() => {
    const el = document.documentElement
    el.dataset.theme = settings.theme
    el.dataset.large = String(settings.largeTargets)
    el.dataset.motion = settings.reduceMotion ? 'reduce' : 'full'
    el.dataset.caps = settings.captionSize
    el.dataset.interaction = settings.interaction
    el.style.setProperty('--scale', String(settings.scale))
  }, [settings.theme, settings.largeTargets, settings.reduceMotion, settings.captionSize, settings.interaction, settings.scale])

  // Steady taps: ignore a second tap on the same control that lands right after the first.
  // Not in Touch and read, where activating already takes a deliberate second tap.
  useEffect(() => {
    if (!settings.tremorGuard || settings.interaction === 'touchRead') return
    let last: { el: Element; t: number } | null = null
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest('button, a, [role="button"], [role="switch"], [role="radio"], [role="checkbox"], [role="option"]')
      if (!el) return
      const now = performance.now()
      const gap = el.classList.contains('key') ? 250 : 700 // keypad digits repeat legitimately (1122)
      if (last && last.el === el && now - last.t < gap) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      last = { el, t: now }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [settings.tremorGuard, settings.interaction])

  const value = useMemo<Ctx>(
    () => ({
      settings,
      update: (patch) => commit({ ...ref.current, ...patch }),
      applyProfile: (profile, extras, interaction) => {
        const cur = ref.current
        commit({ ...cur, ...compose(profile, extras ?? cur.extras, interaction ?? cur.interaction) })
      },
      setExtra: (extra, on) => {
        const cur = ref.current
        const extras = on ? [...new Set([...cur.extras, extra])] : cur.extras.filter((x) => x !== extra)
        const turnOn = on ? overlay(cur, EXTRAS.find((x) => x.id === extra)!.defaults) : {}
        commit({ ...cur, ...turnOn, extras })
      },
      resetAll: () => commit({ ...BASE }),
      hasPin: !!settings.pinHash,
      setPin: async (pin) => {
        const salt = newSalt()
        commit({ ...ref.current, pinSalt: salt, pinHash: await hashPin(pin, salt) })
      },
      // With no PIN set yet (dev shortcuts skip setup) any 4 digits pass.
      verifyPin: async (pin) => {
        const s = ref.current
        return !s.pinHash || checkPin(pin, s.pinSalt, s.pinHash)
      },
    }),
    [settings, commit],
  )

  return <C.Provider value={value}>{children}</C.Provider>
}

export function useSettings(): Ctx {
  const v = useContext(C)
  if (!v) throw new Error('useSettings outside SettingsProvider')
  return v
}

/** Short label like "Blind or low vision + Hard of hearing". */
export function profileLabel(s: Pick<Settings, 'profile' | 'extras'>): string {
  const main = PROFILES.find((p) => p.id === s.profile)?.title ?? 'Standard'
  const extras = s.extras.map((e) => EXTRAS.find((x) => x.id === e)?.title).filter(Boolean)
  return [main, ...extras].join(' + ')
}
