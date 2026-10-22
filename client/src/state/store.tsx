import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { SEED_ACCOUNTS, SEED_BENEFICIARIES } from '../lib/data'
import { hashStr, naira, uid } from '../lib/format'
import type { Account, Beneficiary, Receipt } from '../lib/types'

export interface Txn {
  id: string
  accountId: string
  at: string // ISO
  desc: string
  amount: number // + credit, - debit
  balanceAfter: number
  receipt?: Receipt // present for payments made in the app; others are built on demand
}

interface Persisted {
  accounts: Account[]
  txns: Txn[]
  beneficiaries: Beneficiary[]
  hideBalance: boolean
}

interface Store extends Persisted {
  total: number
  account: (id: string) => Account
  /** Posts a transaction. Returns false (and changes nothing) if a debit exceeds the balance. */
  post: (accountId: string, desc: string, amount: number, receipt?: Receipt) => boolean
  /** Returns false if that beneficiary is already saved. */
  addBeneficiary: (b: Omit<Beneficiary, 'id'>) => boolean
  removeBeneficiary: (id: string) => void
  updateBeneficiary: (id: string, patch: Partial<Omit<Beneficiary, 'id'>>) => void
  /** Total sent out today through in-app payments (own-account moves excluded). */
  spentToday: () => number
  setHideBalance: (v: boolean) => void
  resetDemo: () => void
}

const KEY = 'zenith-echo:v2'
const round = (n: number) => Math.round(n * 100) / 100

// newest first: [account, minutes ago, description, signed amount]
const SEED: [string, number, string, number][] = [
  ['sav', 95, 'MTN Airtime Purchase 08031234567-2000123456', -1000],
  ['sav', 240, 'TRF FRM ADAEZE GRACE OBI TO CHIDERA NNAMDI OKAFOR', 25000],
  ['cur', 700, 'POS Prch-0044102938--TOTAL ENERGIES OBALENDE NG', -18400],
  ['sav', 1560, 'NIP/GTB/CHIDERA NNAMDI OKAFOR/USSD NIP Transfer from 08098765432', 5000],
  ['sav', 1700, 'MC Loc POS Prch-0081805924--LEKKI LANG   NG', -12500],
  ['cur', 2100, 'TRF FRM LIGHTHOUSE VENTURES LTD TO CHIDERA NNAMDI OKAFOR', 150000],
  ['sav', 2900, 'NIP/ZEN/CHIDERA NNAMDI OKAFOR/REF245282605000001200022053', 120],
  ['sav', 4400, 'DStv Payment 7012345678 - Compact', -10500],
  ['sav', 5800, 'NIP Charge + VAT', -53.75],
  ['sav', 5801, 'NIP/ZEN/IBRAHIM MUSA BELLO/Rent contribution', -60000],
  ['cur', 7000, 'Cheque Deposit 000412 - CLEARING', 220000],
  ['sav', 8600, 'Salary - OCT 2026', 185000],
  ['fd', 10000, 'Interest Credit - Fixed Deposit 5090012345', 41666.67],
  ['sav', 11500, 'Airtel Airtime Purchase 08031234567-2000123456', -500],
  ['sav', 14300, 'TRF FRM EMEKA CHUKWUDI NWOSU TO CHIDERA NNAMDI OKAFOR', 15000],
  ['cur', 15500, 'NIP/ZEN/CHIDERA NNAMDI OKAFOR/Office supplies', -9200],
  ['sav', 17200, 'POS Prch-0099182736--SHOPRITE SURULERE NG', -22340.5],
]

function seed(): Persisted {
  const now = Date.now()
  const accounts = SEED_ACCOUNTS.map((a) => ({ ...a }))
  const bal = Object.fromEntries(accounts.map((a) => [a.id, a.balance])) as Record<string, number>
  const txns: Txn[] = []
  for (const [accountId, mins, desc, amount] of SEED) {
    txns.push({ id: uid(), accountId, at: new Date(now - mins * 60_000).toISOString(), desc, amount, balanceAfter: round(bal[accountId]) })
    bal[accountId] -= amount // walk backwards in time
  }
  return {
    accounts,
    txns,
    beneficiaries: SEED_BENEFICIARIES.map((b) => ({ ...b, id: uid() })),
    hideBalance: false,
  }
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...seed(), ...(JSON.parse(raw) as Partial<Persisted>) }
  } catch {
    /* storage blocked or corrupt: fall through to a fresh seed */
  }
  return seed()
}

/** Receipt for a transaction that wasn't made through a payment flow (seeded history, credits). */
export function receiptFor(t: Txn, accounts: Account[]): Receipt {
  if (t.receipt) return t.receipt
  const acct = accounts.find((a) => a.id === t.accountId)!
  const credit = t.amount > 0
  return {
    ref: 'ZE' + String(hashStr(t.id)).padStart(10, '0').slice(0, 10) + String(hashStr(t.desc)).padStart(8, '0').slice(0, 8),
    at: t.at,
    kind: credit ? 'credit' : 'debit',
    title: credit ? 'Credit alert' : 'Debit',
    amount: Math.abs(t.amount),
    fee: 0,
    credit,
    from: `${acct.type} - ${acct.number}`,
    rows: [
      ['Description', t.desc],
      ['Balance after', naira(t.balanceAfter)],
    ],
  }
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(load)
  // The ref is the source of truth so two calls in the same tick (transfer + its charge) see each other.
  const ref = useRef(state)

  const commit = useCallback((next: Persisted) => {
    ref.current = next
    setState(next)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* ignore */
    }
  }, [state])

  const post = useCallback(
    (accountId: string, desc: string, amount: number, receipt?: Receipt) => {
      const s = ref.current
      const acct = s.accounts.find((a) => a.id === accountId)
      if (!acct) return false
      if (amount < 0 && (!acct.spendable || acct.balance + amount < 0)) return false
      const balance = round(acct.balance + amount)
      const t: Txn = { id: uid(), accountId, at: new Date().toISOString(), desc, amount, balanceAfter: balance, receipt }
      commit({ ...s, accounts: s.accounts.map((a) => (a.id === accountId ? { ...a, balance } : a)), txns: [t, ...s.txns] })
      return true
    },
    [commit],
  )

  const value = useMemo<Store>(
    () => ({
      ...state,
      total: round(state.accounts.reduce((n, a) => n + a.balance, 0)),
      account: (id) => state.accounts.find((a) => a.id === id) ?? state.accounts[0],
      post,
      addBeneficiary: (b) => {
        const s = ref.current
        const dupe = s.beneficiaries.some((x) => x.kind === b.kind && (b.kind === 'bank' ? x.accountNumber === b.accountNumber && x.bank === b.bank : x.phone === b.phone))
        if (dupe) return false
        commit({ ...s, beneficiaries: [...s.beneficiaries, { ...b, id: uid() }] })
        return true
      },
      removeBeneficiary: (id) => commit({ ...ref.current, beneficiaries: ref.current.beneficiaries.filter((b) => b.id !== id) }),
      setHideBalance: (v) => commit({ ...ref.current, hideBalance: v }),
      updateBeneficiary: (id, patch) => commit({ ...ref.current, beneficiaries: ref.current.beneficiaries.map((b) => (b.id === id ? { ...b, ...patch } : b)) }),
      spentToday: () => {
        const midnight = new Date().setHours(0, 0, 0, 0)
        return round(
          ref.current.txns
            .filter((t) => t.receipt && !t.receipt.own && t.amount < 0 && new Date(t.at).getTime() >= midnight)
            .reduce((n, t) => n - t.amount + (t.receipt?.fee ?? 0), 0),
        )
      },
      resetDemo: () => commit(seed()),
    }),
    [state, post, commit],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore outside StoreProvider')
  return v
}
