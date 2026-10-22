import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { genRef, genToken } from '../lib/format'
import type { Intent, Receipt } from '../lib/types'
import { useNav } from './nav'
import { useStore } from './store'
import { setFlowCloser } from '../voice/fill'

export type Stage = 'confirm' | 'auth' | 'countdown' | 'processing' | 'success' | 'receipt'

interface FlowState {
  stage: Stage
  intent: Intent | null
  receipt: Receipt | null
  /** 'history' when a receipt was opened from the transaction list rather than after paying. */
  origin: 'flow' | 'history'
  saved: boolean
}

interface Flow {
  flow: FlowState | null
  start: (intent: Intent) => void
  setStage: (s: Stage) => void
  back: () => void
  /** Posts the transaction and moves to the success dialog. */
  complete: () => void
  /** Cancelled during the countdown: closes the flow without posting anything. */
  cancel: () => void
  finish: () => void
  openReceipt: (r: Receipt) => void
  saveBeneficiary: () => void
}

const Ctx = createContext<Flow | null>(null)

export function FlowProvider({ children }: { children: ReactNode }) {
  const { post, account, addBeneficiary } = useStore()
  const { toast, bump } = useNav()
  const [flow, setFlow] = useState<FlowState | null>(null)
  // Synchronous mirror of `flow`, so a timer callback never acts on a stale stage.
  const ref = useRef<FlowState | null>(null)
  const api = useRef({ post, account, addBeneficiary, toast, bump })
  api.current = { post, account, addBeneficiary, toast, bump }

  const set = useCallback((f: FlowState | null) => {
    ref.current = f
    setFlow(f)
  }, [])

  useEffect(() => {
    setFlowCloser(() => {
      const open = !!ref.current
      if (open) {
        set(null)
        api.current.bump()
      }
      return open
    })
    return () => setFlowCloser(null)
  }, [set])

  const value = useMemo<Flow>(
    () => ({
      flow,
      start: (intent) => set({ stage: 'confirm', intent, receipt: null, origin: 'flow', saved: false }),
      setStage: (stage) => ref.current && set({ ...ref.current, stage }),
      back: () => {
        const f = ref.current
        if (!f) return
        if (f.stage === 'confirm') set(null)
        else if (f.stage === 'auth') set({ ...f, stage: 'confirm' })
        else if (f.stage === 'receipt') f.origin === 'flow' ? set({ ...f, stage: 'success' }) : set(null)
      },
      complete: () => {
        const f = ref.current
        if (!f || f.stage !== 'processing' || !f.intent) return
        const i = f.intent
        const { post, account, toast } = api.current
        const acct = account(i.accountId)
        const receipt: Receipt = {
          ref: genRef(),
          at: new Date().toISOString(),
          kind: i.kind,
          title: i.title,
          amount: i.amount,
          fee: i.fee,
          credit: false,
          own: !!i.creditAccountId,
          from: `${acct.type} - ${acct.number}`,
          rows: i.rows,
          token: i.token ? genToken() : undefined,
          units: i.token?.units,
        }
        if (!post(i.accountId, i.desc, -i.amount, receipt)) {
          toast('Insufficient funds')
          set(null)
          return
        }
        if (i.fee > 0) post(i.accountId, i.feeDesc ?? 'NIP Charge + VAT', -i.fee)
        if (i.creditAccountId) post(i.creditAccountId, i.creditDesc ?? i.desc, i.amount)
        set({ ...f, stage: 'success', receipt })
      },
      cancel: () => {
        set(null)
        api.current.toast('Payment cancelled. Nothing was sent.')
      },
      finish: () => {
        set(null)
        api.current.bump()
      },
      openReceipt: (receipt) => set({ stage: 'receipt', intent: null, receipt, origin: 'history', saved: false }),
      saveBeneficiary: () => {
        const f = ref.current
        const b = f?.intent?.saveBeneficiary
        if (!f || !b) return
        api.current.toast(api.current.addBeneficiary(b) ? 'Saved as beneficiary' : 'Already in your beneficiaries')
        set({ ...f, saved: true })
      },
    }),
    [flow, set],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useFlow(): Flow {
  const v = useContext(Ctx)
  if (!v) throw new Error('useFlow outside FlowProvider')
  return v
}
