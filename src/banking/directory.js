import { BANKS } from './banks'

const KNOWN_ACCOUNTS = {
  'zenith:2082146805': 'DANIEL TOLUWANI OLORUNDA',
  'gtbank:1148082005': 'CHISOM GODWIN LEMEH',
  'access:7619025532': 'OLAMIDE ANJORIN',
  'opay:8082114408': 'BUKOLA ADEYEMI',
  'moniepoint:7031556290': 'IBRAHIM MUSA AUTOS',
}

const FIRST_NAMES = ['ADAEZE', 'TUNDE', 'NGOZI', 'EMEKA', 'FATIMA', 'SEGUN', 'AMAKA', 'YUSUF', 'FUNMI', 'CHUKWUDI']
const LAST_NAMES = ['OKAFOR', 'BELLO', 'ADEBAYO', 'EZE', 'ABUBAKAR', 'OGUNLEYE', 'NWOSU', 'IBRAHIM', 'ADEWALE', 'OBI']

export const BENEFICIARIES = [
  { nickname: 'My Mechanic', aliases: ['my mechanic', 'mechanic'], bankId: 'moniepoint', account: '7031556290' },
  { nickname: 'Auntie Bukky', aliases: ['auntie bukky', 'aunty bukky', 'bukky'], bankId: 'opay', account: '8082114408' },
  { nickname: 'Daniel', aliases: ['daniel'], bankId: 'zenith', account: '2082146805' },
]

export function findBeneficiary(text) {
  const spoken = ` ${text.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ')} `
  return BENEFICIARIES.find((b) => b.aliases.some((alias) => spoken.includes(` ${alias} `))) ?? null
}

export function lookupName(account, bankId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (account.startsWith('000')) {
        resolve(null)
        return
      }
      const known = KNOWN_ACCOUNTS[`${bankId}:${account}`]
      if (known) {
        resolve(known)
        return
      }
      const seed = account.split('').reduce((sum, d) => sum + Number(d), 0)
      resolve(`${FIRST_NAMES[seed % FIRST_NAMES.length]} ${LAST_NAMES[Number(account[9]) % LAST_NAMES.length]}`)
    }, 900)
  })
}

export function bankById(id) {
  return BANKS.find((bank) => bank.id === id) ?? null
}