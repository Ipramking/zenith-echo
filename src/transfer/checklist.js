import { findBanks, isValidNuban } from '../banking/banks'
import { bankById, findBeneficiary } from '../banking/directory'
import { formatNaira, parseAmount, parseDigits } from '../banking/parsers'

export const ORDER = ['account', 'bank', 'amount', 'note']

export const PROMPTS = {
  account: 'Please provide the 10-digit account number.',
  bank: 'Which bank is the account registered with?',
  name: 'Checking the account name.',
  amount: 'How much would you like to transfer?',
  note: "Any remarks? Say a short note, or say 'skip'.",
  review: 'Everything is ready. Please review and confirm.',
}

const HELP = "You can say cancel, go back, repeat, or skip for the note."

const AMOUNT_CUE = /(\d\s*k\b|\bk\b|naira|thousand|hundred|million|₦)/i

export function createInitialState() {
  return {
    account: '',
    bank: null,
    name: null,
    amount: null,
    note: '',
    noteDone: false,
    candidates: [],
    ended: false,
    message: { tone: 'info', text: PROMPTS.account },
    messageId: 0,
  }
}

export function nextSlot(state) {
  if (!state.account) return 'account'
  if (!state.bank) return 'bank'
  if (!state.name) return 'name'
  if (!state.amount) return 'amount'
  if (!state.noteDone) return 'note'
  return 'review'
}

function withMessage(state, tone, text) {
  return { ...state, message: { tone, text }, messageId: state.messageId + 1 }
}

function prompted(state, prefix = '', tone = 'info') {
  return withMessage(state, tone, `${prefix}${PROMPTS[nextSlot(state)]}`)
}

function applyAccount(state, digits) {
  if (digits.length === 0) {
    return { state, error: "I didn't catch any numbers. " }
  }
  if (digits.length !== 10) {
    const heard = digits.length === 1 ? '1 digit' : `${digits.length} digits`
    return { state, error: `I heard ${heard}. The account number must be exactly 10 digits. ` }
  }
  if (state.bank && !isValidNuban(digits, state.bank)) {
    return { state, error: `That number doesn't match ${state.bank.name}. Please check it. ` }
  }
  return { state: { ...state, account: digits, name: null } }
}

function applyBank(state, bank) {
  if (state.account && !isValidNuban(state.account, bank)) {
    return { state: { ...state, candidates: [] }, error: `That account number doesn't match ${bank.name}. ` }
  }
  return { state: { ...state, bank, name: null, candidates: [] } }
}

function applyAmount(state, amount, balance) {
  if (amount === null) {
    return { state, error: "I didn't catch an amount. " }
  }
  if (amount > balance) {
    return { state, error: `Your balance can't cover ${formatNaira(amount)}. Try a smaller amount. ` }
  }
  return { state: { ...state, amount } }
}

function clearSlot(state, slot) {
  if (slot === 'account') return { ...state, account: '', name: null }
  if (slot === 'bank') return { ...state, bank: null, name: null, candidates: [] }
  if (slot === 'amount') return { ...state, amount: null }
  if (slot === 'note') return { ...state, note: '', noteDone: false }
  return state
}

function previousSlot(active) {
  if (active === 'review') return 'note'
  if (active === 'name') return 'bank'
  const index = ORDER.indexOf(active)
  return index > 0 ? ORDER[index - 1] : null
}

function finish(state, before, error) {
  if (error) return prompted(state, error, 'error')
  if (state === before) return prompted(state, "Sorry, I didn't get that. ", 'error')
  return prompted(state, '', 'success')
}

function handleSpeech(state, text, balance) {
  const lower = text.toLowerCase().trim()
  const active = nextSlot(state)

  if (/\b(cancel|stop)\b/.test(lower)) {
    return { ...withMessage(createInitialState(), 'warning', 'Transfer cancelled. Nothing was sent.'), ended: true }
  }
  if (/\b(go back|back)\b/.test(lower)) {
    return reducer(state, { type: 'back' })
  }
  if (/\b(repeat|say again|again)\b/.test(lower)) {
    return reducer(state, { type: 'repeat' })
  }
  if (/\bhelp\b/.test(lower)) {
    return withMessage(state, 'info', `${HELP} ${PROMPTS[active]}`)
  }

  let next = state
  let error = ''
  let prefix = ''

  const beneficiary = !state.account ? findBeneficiary(text) : null
  if (beneficiary) {
    next = { ...next, account: beneficiary.account, bank: bankById(beneficiary.bankId), name: null, candidates: [] }
    prefix = `Found your saved contact, ${beneficiary.nickname}. `
  }

  const banks = beneficiary ? [] : findBanks(text)
  if (banks.length === 1) {
    const result = applyBank(next, banks[0])
    next = result.state
    error = result.error ?? error
  } else if (banks.length > 1) {
    return withMessage(
      { ...state, candidates: banks },
      'warning',
      `Did you mean ${banks.map((b) => b.name).join(' or ')}?`,
    )
  }

  const literal = (text.match(/\d[\d\s-]{8,}\d/g) ?? [])
    .map((match) => match.replace(/\D/g, ''))
    .find((digits) => digits.length >= 9)
  const withoutAccount = literal ? text.replace(/\d[\d\s-]{8,}\d/g, ' ') : text

  if (!beneficiary && !error) {
    if (literal) {
      const result = applyAccount(next, literal)
      next = result.state
      error = result.error ?? error
    } else if (active === 'account' && banks.length === 0 && !AMOUNT_CUE.test(text)) {
      const result = applyAccount(next, parseDigits(text))
      next = result.state
      error = result.error ?? error
    }
  }

  if (!error && (AMOUNT_CUE.test(withoutAccount) || (active === 'amount' && next === state))) {
    const amount = parseAmount(withoutAccount)
    if (amount !== null || active === 'amount') {
      const result = applyAmount(next, amount, balance)
      next = result.state
      error = result.error ?? error
    }
  }

  if (!error && next === state && active === 'note') {
    if (/^(skip|none|nothing|no)\b/.test(lower)) {
      next = { ...next, note: '', noteDone: true }
    } else {
      next = { ...next, note: text.trim().slice(0, 60), noteDone: true }
    }
  }

  if (error) return prompted(next, `${prefix}${error}`, 'error')
  if (next === state) return finish(state, state)
  return prompted(next, prefix, 'success')
}

export function reducer(state, action) {
  switch (action.type) {
    case 'say':
      return handleSpeech(state, action.text, action.balance)
    case 'setAccount': {
      const { state: next, error } = applyAccount(state, action.digits)
      return finish(next, state, error)
    }
    case 'setBank': {
      const bank = bankById(action.bankId)
      if (!bank) return state
      const { state: next, error } = applyBank(state, bank)
      return finish(next, state, error)
    }
    case 'setAmount': {
      const { state: next, error } = applyAmount(state, action.amount, action.balance)
      return finish(next, state, error)
    }
    case 'setNote':
      return prompted({ ...state, note: action.note.trim().slice(0, 60), noteDone: true }, '', 'success')
    case 'skipNote':
      return prompted({ ...state, note: '', noteDone: true }, '', 'success')
    case 'edit':
      return prompted(clearSlot(state, action.slot))
    case 'back': {
      const previous = previousSlot(nextSlot(state))
      if (!previous) return withMessage(state, 'info', `This is the first step. ${PROMPTS.account}`)
      return prompted(clearSlot(state, previous))
    }
    case 'repeat':
      return withMessage(state, state.message.tone, state.message.text)
    case 'lookupDone':
      return prompted({ ...state, name: action.name }, `Account name: ${action.name}. `, 'success')
    case 'lookupFailed':
      return prompted(
        { ...state, account: '', name: null },
        "I couldn't find that account. Let's check the number. ",
        'error',
      )
    case 'cancel':
      return { ...withMessage(createInitialState(), 'warning', 'Transfer cancelled. Nothing was sent.'), ended: true }
    case 'restart':
      return createInitialState()
    default:
      return state
  }
}