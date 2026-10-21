import { randomUUID } from 'node:crypto'
import { formatNaira } from '../banking/parsers.js'
import { HttpError } from '../errors.js'
import { buyAirtime, buyData, buyElectricity } from '../services/bills.js'
import { getAccount } from '../services/ledger.js'
import { consumeTicket, enabledMethods, voiceLimit } from '../services/security.js'
import { sendTransfer } from '../services/transfers.js'
import { FLOWS, SLOT_WORDS } from './flows.js'
import { detectIntent, groupDigits, isCommand, toSpeech } from './language.js'

const SESSION_TTL = 15 * 60 * 1000
const sessions = new Map()

const HELP =
  'You can say: send money, buy airtime, buy data, pay electricity, check my balance, or read my transactions. ' +
  'While paying, you can say go back, repeat, change the amount, or cancel.'

const DEPENDENTS = {
  account: ['name'],
  bank: ['name'],
  phone: ['network', 'plan'],
  network: ['plan'],
  disco: ['customer'],
  meter: ['customer'],
}

function blankSession(id = randomUUID()) {
  return {
    id,
    status: 'idle',
    intent: null,
    slots: {},
    step: null,
    options: null,
    action: null,
    authorisation: null,
    receipt: null,
    message: { text: 'Hello. What would you like to do today?', tone: 'info' },
    updatedAt: Date.now(),
  }
}

function sweep() {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.updatedAt > SESSION_TTL) sessions.delete(id)
  }
}

export function getSession(id) {
  sweep()
  if (id && sessions.has(id)) return sessions.get(id)
  const session = blankSession()
  sessions.set(session.id, session)
  return session
}

function say(session, text, tone = 'info', extra = {}) {
  session.message = { text, tone, ...extra }
}

function flowOf(session) {
  return session.intent ? FLOWS[session.intent] : null
}

function clearSlot(session, key) {
  delete session.slots[key]
  for (const dependent of DEPENDENTS[key] ?? []) clearSlot(session, dependent)
}

function displayValues(flow, slots) {
  return Object.fromEntries(
    flow.slots.filter((slot) => slots[slot.key] !== undefined).map((slot) => [slot.key, slot.display(slots[slot.key])]),
  )
}

async function advance(session, notes = []) {
  const flow = flowOf(session)
  for (const slot of flow.slots) {
    if (session.slots[slot.key] !== undefined) continue

    if (slot.resolve) {
      const result = await slot.resolve(session.slots)
      if (result.error) {
        result.clear?.forEach((key) => clearSlot(session, key))
        return advance(session, [...notes, result.error])
      }
      session.slots[slot.key] = result.value
      if (result.note) notes.push(result.note)
      continue
    }

    if (slot.autofill) {
      const result = slot.autofill(session.slots)
      if (result) {
        session.slots[slot.key] = result.value
        if (result.note) notes.push(result.note)
        continue
      }
    }

    session.status = 'collecting'
    session.step = slot.key
    session.options = slot.options?.(session.slots) ?? null
    const question = slot.ask(session.slots, session.options ?? [])
    const tone = notes.some((n) => /must|can't|minimum|maximum|not found|doesn't|does not|check/i.test(n)) ? 'error' : 'info'
    say(session, [...notes, question].join(' '), tone)
    return
  }

  session.status = 'confirming'
  session.step = 'confirm'
  session.options = null
  const summary = flow.summary(session.slots, displayValues(flow, session.slots))
  say(session, [...notes, summary, 'Shall I go ahead? Say yes to confirm, or tell me what to change.'].join(' '), 'success')
}

async function startFlow(session, intent, text = '') {
  const flow = FLOWS[intent]
  session.intent = intent
  session.slots = {}
  session.action = null
  session.authorisation = null
  session.receipt = null
  const notes = [`You're on the ${flow.title.toLowerCase()} screen.`]

  const first = flow.slots[0]
  if (text && (intent === 'transfer' || intent === 'airtime' || intent === 'data')) {
    const result = first.parse(text, session.slots, first.options?.(session.slots, text) ?? null)
    const isShortcut = result?.value && (result.note || /\b(my|myself|for me)\b/i.test(text))
    if (isShortcut) {
      session.slots[first.key] = result.value
      Object.assign(session.slots, result.also ?? {})
      if (result.note) notes.push(result.note)
    }
  }
  await advance(session, notes)
}

function answerBalance(session) {
  const { balance } = getAccount()
  session.status = 'done'
  session.intent = null
  session.step = null
  session.options = null
  say(session, `Your available balance is ${formatNaira(balance)}.`, 'info', { sensitive: true })
}

function answerHistory(session) {
  const { transactions } = getAccount({ limit: 5 })
  const lines = transactions.map((t, i) => {
    const sign = t.type === 'credit' ? 'received' : 'spent'
    const day = new Date(t.date).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })
    return `${i + 1}. ${day}: ${sign} ${formatNaira(t.amount)}, ${t.description}.`
  })
  session.status = 'done'
  session.intent = null
  session.step = null
  session.options = null
  say(session, `Here are your last ${lines.length} transactions. ${lines.join(' ')}`, 'info', { sensitive: true })
}

async function routeIntent(session, intent, text) {
  if (intent === 'balance') return answerBalance(session)
  if (intent === 'history') return answerHistory(session)
  return startFlow(session, intent, text)
}

function findCorrection(session, text) {
  const flow = flowOf(session)
  const lower = text.toLowerCase()
  if (!/\b(change|wrong|actually|instead|not|no)\b/.test(lower)) return null
  return (
    flow.slots.find(
      (slot) => slot.parse && session.slots[slot.key] !== undefined && SLOT_WORDS[slot.key]?.test(lower),
    ) ?? null
  )
}

function previousSlot(session) {
  const flow = flowOf(session)
  const index = session.step === 'confirm' ? flow.slots.length : flow.slots.findIndex((s) => s.key === session.step)
  return flow.slots
    .slice(0, index)
    .reverse()
    .find((slot) => slot.parse && session.slots[slot.key] !== undefined)
}

async function fillCurrent(session, text, choice) {
  const flow = flowOf(session)
  const slot = flow.slots.find((s) => s.key === session.step)
  const options = session.options

  let result
  if (choice && options) {
    const picked = options.find((o) => o.id === choice)
    result = picked ? slot.parse(picked.label, session.slots, options) ?? { value: picked.id } : null
  } else {
    result = slot.parse(text, session.slots, options)
  }

  if (result?.ask) {
    session.options = result.options
    say(session, result.ask, 'warning')
    return true
  }
  if (result?.error) {
    say(session, `${result.error} ${slot.ask(session.slots, options ?? [])}`, 'error')
    return true
  }
  if (result?.value !== undefined) {
    session.slots[slot.key] = result.value
    Object.assign(session.slots, result.also ?? {})
    await advance(session, result.note ? [result.note] : [])
    return true
  }
  return false
}

export async function handle(input) {
  const session = getSession(input.sessionId)
  session.updatedAt = Date.now()
  const text = String(input.text ?? '').trim().slice(0, 300)
  const flow = flowOf(session)

  if (input.intent) {
    if (!FLOWS[input.intent] && !['balance', 'history'].includes(input.intent)) {
      throw new HttpError(400, 'Unknown intent')
    }
    await routeIntent(session, input.intent, '')
    return respond(session)
  }

  if (text && isCommand(text, 'cancel')) {
    Object.assign(session, blankSession(session.id), { status: 'cancelled' })
    say(session, 'Cancelled. Nothing was sent. What would you like to do next?', 'warning')
    return respond(session)
  }
  if (text && isCommand(text, 'repeat')) return respond(session)
  if (text && isCommand(text, 'help')) {
    const slot = flow?.slots.find((s) => s.key === session.step)
    const current = slot?.ask ? slot.ask(session.slots, session.options ?? []) : ''
    say(session, `${HELP} ${current}`.trim())
    return respond(session)
  }
  if (text && flow && isCommand(text, 'restart')) {
    await startFlow(session, session.intent)
    return respond(session)
  }

  if (!flow || ['idle', 'done', 'cancelled'].includes(session.status) || session.status === 'authorising') {
    if (session.status === 'authorising' && !text) return respond(session)
    const intent = text ? detectIntent(text) : null
    if (!intent) {
      say(session, `Sorry, I didn't get that. ${HELP}`, 'warning')
      return respond(session)
    }
    await routeIntent(session, intent, text)
    return respond(session)
  }

  if (text && isCommand(text, 'back')) {
    const previous = previousSlot(session)
    if (!previous) {
      say(session, `This is the first step. ${flow.slots[0].ask(session.slots, session.options ?? [])}`)
      return respond(session)
    }
    clearSlot(session, previous.key)
    await advance(session)
    return respond(session)
  }

  if (session.status === 'confirming') {
    if (isCommand(text, 'yes') && !findCorrection(session, text)) {
      requestAuthorisation(session, flow.action(session.slots))
      return respond(session)
    }
    const lower = text.toLowerCase()
    const target = findCorrection(session, text) ?? flow.slots.find((s) => s.parse && SLOT_WORDS[s.key]?.test(lower))
    if (target) {
      clearSlot(session, target.key)
      session.step = target.key
      session.options = target.options?.(session.slots) ?? null
      if (!(await fillCurrent(session, text.replace(SLOT_WORDS[target.key], ' '), null))) await advance(session)
      return respond(session)
    }
    const editable = flow.slots.filter((s) => s.parse).map((s) => s.label.toLowerCase())
    say(session, `What would you like to change? You can say ${editable.join(', ')}. Or say yes to confirm.`, 'warning')
    return respond(session)
  }

  const correction = findCorrection(session, text)
  if (correction && correction.key !== session.step) {
    clearSlot(session, correction.key)
    await advance(session)
    await fillCurrent(session, text.replace(SLOT_WORDS[correction.key], ' '), null)
    return respond(session)
  }

  if (await fillCurrent(session, text, input.choice)) return respond(session)

  const otherIntent = detectIntent(text)
  if (otherIntent && otherIntent !== session.intent) {
    await routeIntent(session, otherIntent, text)
    return respond(session)
  }

  const slot = flow.slots.find((s) => s.key === session.step)
  say(session, `Sorry, I didn't get that. ${slot.ask(session.slots, session.options ?? [])}`, 'warning')
  return respond(session)
}

const EXECUTORS = {
  transfer: sendTransfer,
  airtime: buyAirtime,
  data: buyData,
  electricity: buyElectricity,
}

function receiptMessage(type, receipt) {
  const base = `${formatNaira(receipt.amount)}`
  if (type === 'transfer') return `Transfer successful. ${base} has been sent to ${receipt.recipient.name}.`
  if (type === 'airtime') return `Done. ${base} ${receipt.networkName} airtime has been sent to ${groupDigits(receipt.phone)}.`
  if (type === 'data') return `Done. ${receipt.plan.label} has been added to ${groupDigits(receipt.phone)}.`
  return `Payment successful. Your token is ${receipt.token}. That is ${receipt.units} kWh.`
}

function requestAuthorisation(session, action) {
  const methods = enabledMethods()
  const limit = voiceLimit()
  const required = action.amount > limit || !methods.biometric ? 'pin' : 'any'
  session.status = 'authorising'
  session.action = action
  session.authorisation = { required, methods, limit }

  if (!methods.pin && !methods.biometric) {
    say(session, 'You need to create a PIN before you can pay. Please set one up in Settings.', 'warning')
  } else if (action.amount > limit) {
    say(session, `Because this is above ${formatNaira(limit)}, please enter your PIN.`, 'info')
  } else if (required === 'pin') {
    say(session, 'Please enter your PIN to confirm.', 'info')
  } else {
    say(session, 'Please confirm with your fingerprint, or enter your PIN.', 'info')
  }
}

export async function execute({ sessionId, ticket }) {
  const session = sessions.get(sessionId)
  if (!session) throw new HttpError(404, 'Session expired. Please start again.')
  if (session.status !== 'authorising' || !session.action) {
    throw new HttpError(409, 'Nothing is waiting for authorisation')
  }
  consumeTicket({ ticket, sessionId, requiredMethod: session.authorisation?.required })
  session.updatedAt = Date.now()
  const { type, body } = session.action
  try {
    const receipt = await EXECUTORS[type](body)
    session.receipt = { type, ...receipt }
    session.status = 'done'
    session.action = null
    session.authorisation = null
    say(session, `${receiptMessage(type, receipt)} Your new balance is ${formatNaira(receipt.balanceAfter)}.`, 'success', {
      sensitive: true,
    })
  } catch (error) {
    session.status = 'confirming'
    session.action = null
    session.authorisation = null
    say(session, `That didn't go through: ${error.expose ? error.message : 'something went wrong'}. Nothing was sent.`, 'error')
  }
  return respond(session)
}

export function respond(session) {
  const flow = flowOf(session)
  const { text, tone, sensitive = false } = session.message
  return {
    sessionId: session.id,
    status: session.status,
    intent: session.intent,
    screen: flow?.screen ?? (session.receipt ? session.receipt.type : 'home'),
    title: flow?.title ?? null,
    step: session.step,
    checklist: flow
      ? flow.slots.map((slot) => ({
          key: slot.key,
          label: slot.label,
          value: session.slots[slot.key] !== undefined ? slot.display(session.slots[slot.key]) : null,
          done: session.slots[slot.key] !== undefined,
          current: slot.key === session.step,
          optional: Boolean(slot.optional),
        }))
      : [],
    options: session.options?.map(({ id, label }) => ({ id, label })) ?? null,
    action: session.status === 'authorising' ? session.action : null,
    authorisation: session.status === 'authorising' ? session.authorisation : null,
    receipt: session.receipt,
    message: { text, speech: toSpeech(text), tone, sensitive },
  }
}