import { useCallback, useMemo, useState } from 'react'
import { AccountContext } from './accountContext'

const OWNER = { account: '1004453179', bankName: 'Zenith Bank' }

const SEED_TRANSACTIONS = [
  { id: 'TX1003', type: 'debit', amount: 3000, counterparty: 'MTN AIRTIME', date: '2026-10-20T07:55:00' },
  { id: 'TX1002', type: 'debit', amount: 12500, counterparty: 'IKEJA ELECTRIC PREPAID', date: '2026-10-19T18:40:00' },
  { id: 'TX1001', type: 'credit', amount: 150000, counterparty: 'SALARY ECHO LABS LTD', date: '2026-10-18T09:12:00' },
]

export default function AccountProvider({ children }) {
  const [balance, setBalance] = useState(482500)
  const [transactions, setTransactions] = useState(SEED_TRANSACTIONS)

  const send = useCallback(
    ({ account, bank, name, amount, note }) => {
      if (amount > balance) return null
      const receipt = {
        id: `TX${Date.now()}`,
        type: 'debit',
        amount,
        counterparty: name,
        account,
        bankName: bank.name,
        note,
        date: new Date().toISOString(),
        balanceAfter: balance - amount,
      }
      setBalance((current) => current - amount)
      setTransactions((current) => [receipt, ...current])
      return receipt
    },
    [balance],
  )

  const value = useMemo(() => ({ owner: OWNER, balance, transactions, send }), [balance, transactions, send])

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}