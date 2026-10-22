import { findBanks, isValidNuban } from '../banking/banks.js'
import { bankById, findBeneficiary, isKnownAccount } from '../banking/directory.js'
import { formatNaira, parseAmount, parseDigits } from '../banking/parsers.js'
import { DATA_PLANS, DISCOS, NETWORKS, detectNetwork, normalisePhone, validateMeter } from '../services/bills.js'
import { getAccount } from '../services/ledger.js'
import { resolveAccount } from '../services/transfers.js'
import { groupDigits, isCommand, pickOption } from './language.js'

const SIZE_WORDS = {
  '500mb': ['500 mb', 'five hundred mb', 'half gig', '500 megabytes'],
  '1gb': ['1 gig', 'one gig', '1 gigabyte', 'one gigabyte'],
  '2gb': ['2 gig', 'two gig', '2 gigabytes', 'two gigabytes'],
  '5gb': ['5 gig', 'five gig', '5 gigabytes', 'five gigabytes'],
  '10gb': ['10 gig', 'ten gig', '10 gigabytes', 'ten gigabytes'],
  '20gb': ['20 gig', 'twenty gig', '20 gigabytes', 'twenty gigabytes'],
}

function ownPhone(text) {
  return /\b(my (own )?(number|line|phone)|myself|for me|this (number|phone|line))\b/i.test(text)
}

function phoneSlot() {
  return {
    key: 'phone',
    label: 'Phone number',
    ask: () => "Which phone number? Say the 11 digits, or say 'my number'.",
    hint: "I need an 11-digit phone number that starts with zero, or you can say 'my number'.",
    display: (value) => groupDigits(value),
    parse: (text) => {
      if (ownPhone(text)) return { value: getAccount().owner.phone }
      const digits = parseDigits(text)
      if (!digits) return null
      try {
        return { value: normalisePhone(digits) }
      } catch {
        return { error: `I heard ${plural(digits.length, 'digit')}. A phone number has 11 digits.` }
      }
    },
  }
}

function networkSlot() {
  return {
    key: 'network',
    label: 'Network',
    ask: () => 'Which network is it? MTN, Airtel, Glo or 9mobile?',
    hint: "I didn't recognise that network.",
    display: (value) => NETWORKS.find((n) => n.id === value)?.name,
    options: () => NETWORKS.map((n) => ({ id: n.id, label: n.name, aliases: n.aliases })),
    autofill: (slots) => {
      const network = slots.phone ? detectNetwork(slots.phone) : null
      return network ? { value: network.id, note: `That's ${aOrAn(network.name)} ${network.name} number.` } : null
    },
    parse: (text, slots, options) => {
      const choice = pickOption(text, options)
      return choice ? { value: choice.id } : null
    },
  }
}

function aOrAn(word) {
  return /^(mtn|airtel|[aeiou])/i.test(word) ? 'an' : 'a'
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function checkBank(bankId, slots) {
  const bank = bankById(bankId)
  if (slots.account && !isKnownAccount(slots.account, bankId) && !isValidNuban(slots.account, bank)) {
    return { error: `That account number doesn't match ${bank.name}.` }
  }
  return { value: bankId }
}

function amountSlot({ min, max, label = 'Amount', question = 'How much?' }) {
  return {
    key: 'amount',
    label,
    ask: () => question,
    hint: "I didn't catch an amount. Say it like five thousand naira, or 5k.",
    display: (value) => formatNaira(value),
    parse: (text) => {
      const amount = parseAmount(text)
      if (amount === null) return null
      if (amount < min) return { error: `The minimum is ${formatNaira(min)}.` }
      if (amount > max) return { error: `The maximum is ${formatNaira(max)}.` }
      const { balance } = getAccount()
      if (amount > balance) return { error: `Your balance can't cover ${formatNaira(amount)}.` }
      return { value: amount }
    },
  }
}

export const FLOWS = {
  transfer: {
    title: 'Send money',
    screen: 'transfer',
    slots: [
      {
        key: 'account',
        label: 'Account number',
        ask: () => 'Please provide the 10-digit account number, or say the name of a saved contact.',
        hint: "I need the 10 digits of the account number. Say them one by one, like zero, eight, one, two.",
        display: (value) => groupDigits(value),
        parse: (text) => {
          const saved = findBeneficiary(text)
          if (saved) {
            return {
              value: saved.account,
              also: { bank: saved.bankId },
              note: `Found your saved contact, ${saved.nickname}.`,
            }
          }
          const digits = parseDigits(text)
          if (!digits) return null
          if (digits.length !== 10) {
            return { error: `I heard ${plural(digits.length, 'digit')}. The account number must be exactly 10 digits.` }
          }
          return { value: digits }
        },
      },
      {
        key: 'bank',
        label: 'Bank',
        ask: () => 'Which bank is the account with?',
        hint: "I didn't recognise that bank. Say a bank like Zenith, GTBank, Access, First Bank, UBA, OPay, Kuda or Moniepoint.",
        display: (value) => bankById(value)?.name,
        options: (slots, text) => {
          const matches = text ? findBanks(text) : []
          return matches.length > 1 ? matches.map((b) => ({ id: b.id, label: b.name, aliases: b.aliases })) : null
        },
        parse: (text, slots, options) => {
          if (options) {
            const choice = pickOption(text, options)
            if (choice) return checkBank(choice.id, slots)
          }
          const matches = findBanks(text)
          if (matches.length === 1) return checkBank(matches[0].id, slots)
          if (matches.length > 1) {
            return {
              ask: `Did you mean ${matches.map((b) => b.name).join(' or ')}?`,
              options: matches.map((b) => ({ id: b.id, label: b.name, aliases: b.aliases })),
            }
          }
          return null
        },
      },
      {
        key: 'name',
        label: 'Recipient',
        display: (value) => value,
        resolve: async (slots) => {
          try {
            const result = await resolveAccount({ account: slots.account, bankId: slots.bank })
            return { value: result.name, note: `Account name: ${result.name}.` }
          } catch (error) {
            return { error: `${error.message}. Let's check the account number.`, clear: ['account'] }
          }
        },
      },
      amountSlot({ min: 50, max: 1000000, question: 'How much would you like to send?' }),
      {
        key: 'note',
        label: 'Note',
        optional: true,
        ask: () => "Any note for this transfer? Say the note, or say 'skip'.",
        display: (value) => value || 'No note',
        parse: (text) => (isCommand(text, 'skip') ? { value: '' } : { value: text.trim().slice(0, 60) }),
      },
    ],
    summary: (s, d) =>
      `You are sending ${d.amount} to ${s.name}, account ${d.account} at ${d.bank}${s.note ? `, note: ${s.note}` : ''}.`,
    action: (s) => ({
      type: 'transfer',
      amount: s.amount,
      body: { account: s.account, bankId: s.bank, amount: s.amount, note: s.note },
    }),
  },

  airtime: {
    title: 'Buy airtime',
    screen: 'airtime',
    slots: [phoneSlot(), networkSlot(), amountSlot({ min: 50, max: 50000, question: 'How much airtime?' })],
    summary: (s, d) => `You are buying ${d.amount} ${d.network} airtime for ${d.phone}.`,
    action: (s) => ({
      type: 'airtime',
      amount: s.amount,
      body: { phone: s.phone, networkId: s.network, amount: s.amount },
    }),
  },

  data: {
    title: 'Buy data',
    screen: 'data',
    slots: [
      phoneSlot(),
      networkSlot(),
      {
        key: 'plan',
        label: 'Data plan',
        ask: (slots, options) =>
          `Here are the ${NETWORKS.find((n) => n.id === slots.network)?.name} plans. ${options
            .map((o, i) => `${i + 1}: ${o.label}`)
            .join('. ')}. Which one?`,
        display: (value) => {
          const plan = DATA_PLANS.find((p) => p.id === value)
          return plan ? `${plan.label}, ${formatNaira(plan.price)}` : value
        },
        options: (slots) =>
          DATA_PLANS.filter((p) => p.networkId === slots.network).map((p) => ({
            id: p.id,
            label: `${p.size} for ${p.validity} at ${formatNaira(p.price)}`,
            aliases: [p.size.toLowerCase(), p.size.toLowerCase().replace(/(gb|mb)/, ' $1'), ...(SIZE_WORDS[p.size.toLowerCase()] ?? [])],
          })),
        parse: (text, slots, options) => {
          const spoken = text
            .toLowerCase()
            .replace(/(\d+)\s*point\s*(\d)/g, '$1.$2')
            .replace(/(\d+(?:\.\d+)?)\s?(gigs?|gigabytes?|gb)\b/g, '$1gb')
            .replace(/(\d+(?:\.\d+)?)\s?(megs?|megabytes?|mb)\b/g, '$1mb')
          const choice = pickOption(spoken, options)
          if (!choice) return null
          const plan = DATA_PLANS.find((p) => p.id === choice.id)
          if (plan.price > getAccount().balance) return { error: `Your balance can't cover ${formatNaira(plan.price)}.` }
          return { value: choice.id }
        },
      },
    ],
    summary: (s, d) => {
      const plan = DATA_PLANS.find((p) => p.id === s.plan)
      return `You are buying ${plan.label} at ${formatNaira(plan.price)} on ${d.network} for ${d.phone}.`
    },
    action: (s) => ({
      type: 'data',
      amount: DATA_PLANS.find((p) => p.id === s.plan).price,
      body: { phone: s.phone, planId: s.plan },
    }),
  },

  electricity: {
    title: 'Pay electricity',
    screen: 'electricity',
    slots: [
      {
        key: 'disco',
        label: 'Electricity company',
        ask: () => 'Which electricity company? For example Ikeja Electric, Eko or Abuja.',
        hint: "I didn't recognise that electricity company.",
        display: (value) => DISCOS.find((d) => d.id === value)?.name,
        options: () => DISCOS.map((d) => ({ id: d.id, label: d.name, aliases: d.aliases })),
        parse: (text, slots, options) => {
          const choice = pickOption(text, options)
          return choice ? { value: choice.id } : null
        },
      },
      {
        key: 'meter',
        label: 'Meter number',
        ask: () => 'What is the meter number?',
        hint: 'I need the 11 digits on your meter.',
        display: (value) => groupDigits(value),
        parse: (text) => {
          const digits = parseDigits(text)
          if (!digits) return null
          if (digits.length !== 11) {
            return { error: `I heard ${plural(digits.length, 'digit')}. Meter numbers have 11 digits.` }
          }
          return { value: digits }
        },
      },
      {
        key: 'customer',
        label: 'Meter owner',
        display: (value) => value,
        resolve: async (slots) => {
          try {
            const result = validateMeter({ meter: slots.meter, discoId: slots.disco })
            return { value: result.customerName, note: `This meter belongs to ${result.customerName}, ${result.address}.` }
          } catch (error) {
            return { error: `${error.message}. Let's check the meter number.`, clear: ['meter'] }
          }
        },
      },
      amountSlot({ min: 1000, max: 500000, question: 'How much electricity do you want to buy?' }),
    ],
    summary: (s, d) => `You are paying ${d.amount} for ${d.disco} prepaid meter ${d.meter}, owned by ${s.customer}.`,
    action: (s) => ({
      type: 'electricity',
      amount: s.amount,
      body: { meter: s.meter, discoId: s.disco, amount: s.amount },
    }),
  },
}

export const SLOT_WORDS = {
  account: /\baccount( number)?\b/,
  bank: /\bbank\b/,
  amount: /\b(amount|how much|money)\b/,
  note: /\b(note|remark|narration)\b/,
  phone: /\b(phone|number|line)\b/,
  network: /\bnetwork\b/,
  plan: /\b(plan|bundle|data)\b/,
  disco: /\b(company|disco|distributor)\b/,
  meter: /\bmeter\b/,
}
