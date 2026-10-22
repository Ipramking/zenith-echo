import { useEffect, useRef } from 'react'
import { BANKS, DISCOS, ZENITH } from '../lib/data'

export type FillKind = 'transfer' | 'airtime' | 'data' | 'electricity'

export interface FillValues {
  account?: string
  bank?: string
  name?: string
  amount?: number
  note?: string
  phone?: string
  network?: string
  plan?: string
  provider?: string
  meter?: string
}

export interface Fill {
  kind: FillKind
  values: FillValues
  submit: number
}

type Listener = (fill: Fill) => void

let current: Fill | null = null
const listeners = new Set<Listener>()
let lastVoiceNavigation = 0
let pinPads = 0

export function pinPadMounted(open: boolean) {
  pinPads = Math.max(0, pinPads + (open ? 1 : -1))
}

export function pinPadOpen() {
  return pinPads > 0
}

export function publishFill(kind: FillKind, values: FillValues, submit = false) {
  const previous = current && current.kind === kind ? current : null
  current = { kind, values: { ...previous?.values, ...values }, submit: submit ? Date.now() : (previous?.submit ?? 0) }
  listeners.forEach((listener) => listener(current!))
}

export function clearFill() {
  current = null
}

export function markVoiceNavigation() {
  lastVoiceNavigation = Date.now()
}

export function navigatedByVoice() {
  return Date.now() - lastVoiceNavigation < 2500
}

/** Screens call this to receive what the user said: fields to fill, and a signal to submit once they confirm. */
export function useVoiceFill(kind: FillKind, apply: (values: FillValues) => void, submit: () => void) {
  const applyRef = useRef(apply)
  applyRef.current = apply
  const submitRef = useRef(submit)
  submitRef.current = submit
  const handled = useRef(current?.kind === kind ? current.submit : 0)

  useEffect(() => {
    const listener = (fill: Fill) => {
      if (fill.kind !== kind) return
      applyRef.current(fill.values)
      if (fill.submit && fill.submit !== handled.current) {
        handled.current = fill.submit
        window.setTimeout(() => submitRef.current(), 700)
      }
    }
    listeners.add(listener)
    if (current?.kind === kind) applyRef.current(current.values)
    return () => {
      listeners.delete(listener)
    }
  }, [kind])
}

const BANK_NAMES: Record<string, string> = {
  zenith: ZENITH,
  gtbank: 'Guaranty Trust Bank Plc',
  access: 'Access Bank Plc',
  firstbank: 'First Bank of Nigeria Limited',
  uba: 'United Bank for Africa Plc',
  fidelity: 'Fidelity Bank Plc',
  fcmb: 'First City Monument Bank Plc',
  union: 'Union Bank of Nigeria Plc',
  sterling: 'Sterling Bank Plc',
  wema: 'Wema Bank Plc',
  stanbic: 'Stanbic IBTC Bank Plc',
  ecobank: 'Ecobank Nigeria Plc',
  polaris: 'Polaris Bank Limited',
  keystone: 'Keystone Bank Limited',
  opay: 'OPay Digital Services',
  kuda: 'Kuda Microfinance Bank',
  moniepoint: 'Moniepoint Microfinance Bank',
  palmpay: 'PalmPay Limited',
}

export function bankNameFor(id: string): string {
  const name = BANK_NAMES[id]
  if (name && (name === ZENITH || BANKS.includes(name))) return name
  return BANKS.find((b) => b.toLowerCase().startsWith(id.slice(0, 4))) ?? name ?? id
}

const DISCO_CODES: Record<string, string> = {
  ikedc: 'IKEDC',
  ekedc: 'EKEDC',
  aedc: 'AEDC',
  phed: 'PHED',
  ibedc: 'IBEDC',
  kedco: 'KEDCO',
  eedc: 'EEDC',
}

export function discoNameFor(id: string, fallback: string): string {
  const code = DISCO_CODES[id]
  return DISCOS.find((d) => code && d.includes(`(${code})`)) ?? fallback
}
