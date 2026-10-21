import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { lookupName } from '../banking/directory'
import { createInitialState, nextSlot, reducer } from './checklist'

export default function useTransferChecklist(balance) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState)
  const active = nextSlot(state)

  useEffect(() => {
    if (active !== 'name') return undefined
    let cancelled = false
    lookupName(state.account, state.bank.id).then((name) => {
      if (cancelled) return
      dispatch(name ? { type: 'lookupDone', name } : { type: 'lookupFailed' })
    })
    return () => {
      cancelled = true
    }
  }, [active, state.account, state.bank])

  const say = useCallback((text) => dispatch({ type: 'say', text, balance }), [balance])

  const actions = useMemo(
    () => ({
      say,
      setAccount: (digits) => dispatch({ type: 'setAccount', digits }),
      setBank: (bankId) => dispatch({ type: 'setBank', bankId }),
      setAmount: (amount) => dispatch({ type: 'setAmount', amount, balance }),
      setNote: (note) => dispatch({ type: 'setNote', note }),
      skipNote: () => dispatch({ type: 'skipNote' }),
      edit: (slot) => dispatch({ type: 'edit', slot }),
      back: () => dispatch({ type: 'back' }),
      repeat: () => dispatch({ type: 'repeat' }),
      cancel: () => dispatch({ type: 'cancel' }),
      restart: () => dispatch({ type: 'restart' }),
    }),
    [say, balance],
  )

  return { state, active, ...actions }
}