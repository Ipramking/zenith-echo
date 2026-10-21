import { badRequest } from '../errors.js'

const owner = {
  name: 'AMARA OKEKE',
  account: '1004453179',
    phone: '08031234567',
  bankName: 'Zenith Bank',
}

const state = {
  balance: 482500,
  transactions: [
    {
      id: 'TX1003',
      type: 'debit',
      category: 'airtime',
      amount: 3000,
      description: 'MTN airtime 0803 *** 4471',
      date: '2026-10-20T07:55:00.000Z',
    },
    {
      id: 'TX1002',
      type: 'debit',
      category: 'electricity',
      amount: 12500,
      description: 'Ikeja Electric prepaid',
      date: '2026-10-19T18:40:00.000Z',
    },
    {
      id: 'TX1001',
      type: 'credit',
      category: 'transfer',
      amount: 150000,
      description: 'Salary from ECHO LABS LTD',
      date: '2026-10-18T09:12:00.000Z',
    },
  ],
}

let counter = 0

function reference() {
  counter += 1
  return `ZE${Date.now().toString().slice(-8)}${String(counter).padStart(3, '0')}`
}

export function getAccount({ limit = 10 } = {}) {
  return {
    owner,
    balance: state.balance,
    transactions: state.transactions.slice(0, limit),
  }
}

export function debit({ amount, category, description, details = {} }) {
  if (amount > state.balance) {
    throw badRequest('Insufficient funds', { balance: state.balance, amount })
  }
  state.balance = Math.round((state.balance - amount) * 100) / 100
  const entry = {
    id: reference(),
    type: 'debit',
    category,
    amount,
    description,
    date: new Date().toISOString(),
    balanceAfter: state.balance,
    ...details,
  }
  state.transactions.unshift(entry)
  return entry
}