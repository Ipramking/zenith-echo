export type Kind = 'transfer' | 'airtime' | 'data' | 'electricity' | 'cable' | 'bill'

export interface Account {
  id: string
  type: string // "Savings Account"
  number: string
  balance: number
  spendable: boolean // false for fixed deposits
}

export interface Beneficiary {
  id: string
  kind: 'bank' | 'phone'
  name: string
  nickname?: string // voice nickname, e.g. "My Mechanic"
  bank?: string // bank beneficiaries
  accountNumber?: string
  network?: string // phone beneficiaries (network id)
  phone?: string
}

/** What the user is about to pay for. Built by a form, then carried through confirm -> authorize -> success. */
export interface Intent {
  kind: Kind
  accountId: string // source account
  creditAccountId?: string // own-account transfers
  title: string // "Transfer to ADAEZE GRACE OBI"
  amount: number
  fee: number
  desc: string // statement description for the main debit
  creditDesc?: string
  feeDesc?: string
  rows: [string, string][] // detail lines shown on confirm, success and receipt
  token?: { units: string } // prepaid electricity: a token is issued on success
  saveBeneficiary?: Omit<Beneficiary, 'id'> // offered on the success dialog
  viaVoice?: boolean // started from a spoken command: above the voice limit the PIN is always required
}

export interface Receipt {
  ref: string
  at: string // ISO
  kind: Kind | 'credit' | 'debit'
  title: string
  amount: number // always positive
  fee: number
  credit: boolean
  own?: boolean // moved between the customer's own accounts (not counted against the daily limit)
  from: string // "Savings Account - 2000123456"
  rows: [string, string][]
  token?: string
  units?: string
}

export const KIND_LABEL: Record<Receipt['kind'], string> = {
  transfer: 'Funds transfer',
  airtime: 'Airtime purchase',
  data: 'Data purchase',
  electricity: 'Electricity purchase',
  cable: 'Cable TV subscription',
  bill: 'Bill payment',
  credit: 'Credit',
  debit: 'Debit',
}
