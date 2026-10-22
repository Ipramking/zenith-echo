import { BANKS } from './banks.js'

const KNOWN_ACCOUNTS = {
  'zenith:2082146805': 'DANIEL TOLUWANI OLORUNDA',
  'gtbank:1148082005': 'CHISOM GODWIN LEMEH',
  'access:7619025532': 'OLAMIDE ANJORIN',
  'opay:8082114408': 'BUKOLA ADEYEMI',
  'moniepoint:7031556290': 'IBRAHIM MUSA AUTOS',
  'zenith:2011223344': 'IBRAHIM MUSA BELLO',
  'gtbank:0123456789': 'ADAEZE GRACE OBI',
}

const APP_NAMES = [
  'ADAEZE GRACE OBI',
  'IBRAHIM MUSA BELLO',
  'FOLAKE TEMITOPE ADEBAYO',
  'EMEKA CHUKWUDI NWOSU',
  'AMINA YUSUF SANI',
  'OLUWASEUN BAMIDELE LAWAL',
  'NGOZI PATRICIA EZE',
  'TAIWO KEHINDE ALABI',
]

export function appName(number) {
  let h = 0
  for (const c of number) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return APP_NAMES[h % APP_NAMES.length]
}

export const BENEFICIARIES = [
  { nickname: 'My Mechanic', aliases: ['my mechanic', 'mechanic'], bankId: 'zenith', account: '2011223344' },
  { nickname: 'Auntie Bukky', aliases: ['auntie bukky', 'aunty bukky', 'bukky'], bankId: 'gtbank', account: '0123456789' },
  { nickname: 'Daniel', aliases: ['daniel'], bankId: 'zenith', account: '2082146805' },
]

export function isKnownAccount(account, bankId) {
  return Boolean(KNOWN_ACCOUNTS[`${bankId}:${account}`])
}

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
      resolve(appName(account))
    }, 900)
  })
}

export function bankById(id) {
  return BANKS.find((bank) => bank.id === id) ?? null
}
