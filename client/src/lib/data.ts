// All demo data lives here. Nothing in this app talks to a server.
import type { Account, Beneficiary } from './types'

export const PROFILE = {
  firstName: 'Chidera',
  fullName: 'CHIDERA NNAMDI OKAFOR',
  phone: '08031234567',
}

/** Opening state of the three demo accounts. */
export const SEED_ACCOUNTS: Account[] = [
  { id: 'sav', type: 'Savings Account', number: '2000123456', balance: 248350.75, spendable: true },
  { id: 'cur', type: 'Current Account', number: '1012345678', balance: 389256.4, spendable: true },
  { id: 'fd', type: 'Fixed Deposit Account', number: '5090012345', balance: 5000000, spendable: false },
]

export const ZENITH = 'Zenith Bank'

/** Other banks, for the "Other Banks" transfer mode. */
export const BANKS = [
  'Access Bank Plc',
  'Citibank Nigeria Limited',
  'Ecobank Nigeria Plc',
  'Fidelity Bank Plc',
  'First City Monument Bank Plc',
  'First Bank of Nigeria Limited',
  'Guaranty Trust Bank Plc',
  'Heritage Banking Company Limited',
  'Keystone Bank Limited',
  'Kuda Microfinance Bank',
  'Moniepoint Microfinance Bank',
  'OPay Digital Services',
  'PalmPay Limited',
  'Polaris Bank Limited',
  'Stanbic IBTC Bank Plc',
  'Standard Chartered Bank Nigeria',
  'Sterling Bank Plc',
  'Union Bank of Nigeria Plc',
  'United Bank for Africa Plc',
  'Unity Bank Plc',
  'Wema Bank Plc',
]

const BANK_CODES: [string, string][] = [
  ['Guaranty', 'GTB'], ['Access', 'ACC'], ['Fidelity', 'FID'], ['First Bank', 'FBN'], ['First City', 'FCM'], ['United Bank', 'UBA'],
  ['Stanbic', 'STB'], ['Standard Chartered', 'SCB'], ['Sterling', 'STE'], ['Union', 'UNI'], ['Unity', 'UNT'], ['Wema', 'WEM'],
  ['Polaris', 'POL'], ['Ecobank', 'ECO'], ['Keystone', 'KEY'], ['Kuda', 'KUD'], ['Moniepoint', 'MON'], ['OPay', 'OPY'],
  ['PalmPay', 'PAL'], ['Heritage', 'HER'], ['Citibank', 'CIT'], ['Zenith', 'ZEN'],
]
/** Three-letter bank code used in NIP statement narrations. */
export function bankCode(bank: string): string {
  return BANK_CODES.find(([k]) => bank.includes(k))?.[1] ?? bank.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()
}

export const SEED_BENEFICIARIES: Omit<Beneficiary, 'id'>[] = [
  { kind: 'bank', name: 'ADAEZE GRACE OBI', nickname: 'Auntie Bukky', bank: 'Guaranty Trust Bank Plc', accountNumber: '0123456789' },
  { kind: 'bank', name: 'IBRAHIM MUSA BELLO', nickname: 'My Mechanic', bank: ZENITH, accountNumber: '2011223344' },
  { kind: 'phone', name: 'Mum', network: 'mtn', phone: '08033334444' },
]

const MOCK_NAMES = [
  'ADAEZE GRACE OBI',
  'IBRAHIM MUSA BELLO',
  'FOLAKE TEMITOPE ADEBAYO',
  'EMEKA CHUKWUDI NWOSU',
  'AMINA YUSUF SANI',
  'OLUWASEUN BAMIDELE LAWAL',
  'NGOZI PATRICIA EZE',
  'TAIWO KEHINDE ALABI',
]

/** Simulated name enquiry: the same account number always resolves to the same name. */
export function lookupAccountName(accountNumber: string): string {
  let h = 0
  for (const c of accountNumber) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return MOCK_NAMES[h % MOCK_NAMES.length]
}

// Order matches the reference app: 9mobile, Airtel, Glo, MTN. Marks are drawn in CSS, not the carriers' logo files.
export const NETWORKS = [
  { id: '9mobile', name: '9mobile', mark: '9', bg: '#1a1a1a', fg: '#b5d334' },
  { id: 'airtel', name: 'Airtel', mark: 'airtel', bg: '#e40000', fg: '#fff' },
  { id: 'glo', name: 'Glo', mark: 'glo', bg: '#0b8a3e', fg: '#fff' },
  { id: 'mtn', name: 'MTN', mark: 'MTN', bg: '#ffcc00', fg: '#1a1a1a' },
]

export interface Plan {
  id: string
  label: string
  note: string
  price: number
}
const plan = (label: string, note: string, price: number): Plan => ({ id: label + note, label, note, price })

// Demo prices, not live tariffs.
export const DATA_PLANS: Record<string, Plan[]> = {
  mtn: [plan('500MB', '7 days', 500), plan('1.5GB', '30 days', 1000), plan('3.2GB', '30 days', 2000), plan('7GB', '30 days', 3500), plan('11GB', '30 days', 5000), plan('25GB', '30 days', 8000)],
  airtel: [plan('600MB', '7 days', 500), plan('1.5GB', '30 days', 1000), plan('4GB', '30 days', 2000), plan('8GB', '30 days', 3000), plan('13GB', '30 days', 5000), plan('25GB', '30 days', 7500)],
  glo: [plan('1GB', '7 days', 500), plan('2.9GB', '30 days', 1000), plan('5.8GB', '30 days', 2000), plan('10GB', '30 days', 3000), plan('18GB', '30 days', 4500), plan('29GB', '30 days', 8000)],
  '9mobile': [plan('500MB', '30 days', 500), plan('1.5GB', '30 days', 1000), plan('4.5GB', '30 days', 2000), plan('11GB', '30 days', 4000), plan('15GB', '30 days', 5000), plan('40GB', '30 days', 10000)],
}

export const DISCOS = [
  'Ikeja Electric (IKEDC)',
  'Eko Electricity (EKEDC)',
  'Abuja Electricity (AEDC)',
  'Port Harcourt Electricity (PHED)',
  'Ibadan Electricity (IBEDC)',
  'Kano Electricity (KEDCO)',
  'Enugu Electricity (EEDC)',
]

/** Band A tariff used to turn naira into kWh for the demo. */
export const KWH_RATE = 209.5

export const CABLE_PLANS: Record<string, Plan[]> = {
  DStv: [plan('Padi', 'monthly', 4400), plan('Yanga', 'monthly', 6000), plan('Confam', 'monthly', 11000), plan('Compact', 'monthly', 19000), plan('Compact Plus', 'monthly', 30000), plan('Premium', 'monthly', 44500)],
  GOtv: [plan('Smallie', 'monthly', 1575), plan('Jinja', 'monthly', 3950), plan('Jolli', 'monthly', 5800), plan('Max', 'monthly', 8500), plan('Supa', 'monthly', 11400)],
  StarTimes: [plan('Nova', 'monthly', 2100), plan('Basic', 'monthly', 3700), plan('Smart', 'monthly', 4700), plan('Classic', 'monthly', 6200), plan('Super', 'monthly', 9800)],
  Showmax: [plan('Mobile', 'monthly', 1450), plan('Standard', 'monthly', 2900), plan('Pro', 'monthly', 8400)],
}

const ADDRESSES = ['12 Admiralty Way, Lekki Phase 1', '4 Allen Avenue, Ikeja', '27 Awolowo Road, Ikoyi', '9 Bode Thomas Street, Surulere', '31 Herbert Macaulay Way, Yaba']
export function lookupAddress(id: string): string {
  let h = 0
  for (const c of id) h = (h * 17 + c.charCodeAt(0)) >>> 0
  return ADDRESSES[h % ADDRESSES.length]
}

export const BILL_CATEGORIES = [
  { id: 'electricity', name: 'Electricity', idLabel: 'Meter number', providers: DISCOS },
  { id: 'cable', name: 'Cable TV', idLabel: 'Smartcard / IUC number', providers: Object.keys(CABLE_PLANS) },
  {
    id: 'internet',
    name: 'Internet',
    idLabel: 'Account / device ID',
    providers: ['Spectranet', 'Smile', 'FibreOne', 'ipNX'],
  },
  {
    id: 'education',
    name: 'Education',
    idLabel: 'Candidate / profile number',
    providers: ['WAEC', 'JAMB', 'NECO'],
  },
  {
    id: 'insurance',
    name: 'Insurance',
    idLabel: 'Policy number',
    providers: ['AXA Mansard', 'Leadway Assurance', 'AIICO'],
  },
] as const

export const INBOX = [
  { id: 'm1', title: 'Credit alert', body: 'Your account 2000***456 has been credited with NGN25,000.00.', ago: '2h ago' },
  { id: 'm2', title: 'Security tip', body: 'Never share your passcode, OTP or token with anyone, including bank staff.', ago: '1d ago' },
  { id: 'm3', title: 'Statement ready', body: 'Your account statement for last month is ready to view.', ago: '5d ago' },
]
