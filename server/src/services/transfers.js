import { BANKS, isValidNuban } from '../banking/banks.js'
import { bankById, BENEFICIARIES, lookupName } from '../banking/directory.js'
import { badRequest, notFound, requireAmount, requireDigits } from '../errors.js'
import { debit } from './ledger.js'

export function listBanks() {
  return BANKS.map(({ id, name, code }) => ({ id, name, code }))
}

export function listBeneficiaries() {
  return BENEFICIARIES.map(({ nickname, bankId, account }) => ({
    nickname,
    bankId,
    bankName: bankById(bankId)?.name,
    account,
  }))
}

function requireBank(bankId) {
  const bank = bankById(bankId)
  if (!bank) throw badRequest('Unknown bank')
  return bank
}

export async function resolveAccount({ account, bankId }) {
  const digits = requireDigits(account, 'Account number', { min: 10 })
  const bank = requireBank(bankId)
  if (!isValidNuban(digits, bank)) {
    throw badRequest(`That account number does not match ${bank.name}`)
  }
  const name = await lookupName(digits, bank.id)
  if (!name) throw notFound('Account not found')
  return { account: digits, bankId: bank.id, bankName: bank.name, name }
}

export async function sendTransfer({ account, bankId, amount, note }) {
  const recipient = await resolveAccount({ account, bankId })
  const value = requireAmount(amount, { min: 50, max: 1000000 })
  const narration = String(note ?? '').trim().slice(0, 60)
  return debit({
    amount: value,
    category: 'transfer',
    description: `Transfer to ${recipient.name}`,
    details: { recipient, note: narration },
  })
}