export const BANKS = [
  { id: 'zenith', name: 'Zenith Bank', code: '057', aliases: ['zenith'] },
  { id: 'gtbank', name: 'GTBank', code: '058', aliases: ['gtbank', 'gt bank', 'gtb', 'guaranty trust', 'gt'] },
  { id: 'access', name: 'Access Bank', code: '044', aliases: ['access', 'access diamond', 'diamond'] },
  { id: 'firstbank', name: 'First Bank', code: '011', aliases: ['first bank', 'firstbank', 'first'] },
  { id: 'uba', name: 'UBA', code: '033', aliases: ['uba', 'united bank for africa', 'u b a'] },
  { id: 'fidelity', name: 'Fidelity Bank', code: '070', aliases: ['fidelity'] },
  { id: 'fcmb', name: 'FCMB', code: '214', aliases: ['fcmb', 'f c m b', 'first city monument'] },
  { id: 'union', name: 'Union Bank', code: '032', aliases: ['union'] },
  { id: 'sterling', name: 'Sterling Bank', code: '232', aliases: ['sterling'] },
  { id: 'wema', name: 'Wema Bank', code: '035', aliases: ['wema', 'alat'] },
  { id: 'stanbic', name: 'Stanbic IBTC', code: '221', aliases: ['stanbic', 'ibtc'] },
  { id: 'ecobank', name: 'Ecobank', code: '050', aliases: ['ecobank', 'eco bank', 'eco'] },
  { id: 'polaris', name: 'Polaris Bank', code: '076', aliases: ['polaris'] },
  { id: 'keystone', name: 'Keystone Bank', code: '082', aliases: ['keystone'] },
  { id: 'opay', name: 'OPay', code: null, aliases: ['opay', 'o pay', 'oh pay'] },
  { id: 'kuda', name: 'Kuda', code: null, aliases: ['kuda', 'kuda bank'] },
  { id: 'moniepoint', name: 'Moniepoint', code: null, aliases: ['moniepoint', 'monie point', 'money point'] },
  { id: 'palmpay', name: 'PalmPay', code: null, aliases: ['palmpay', 'palm pay'] },
]

const WEIGHTS = [3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3]

export function isValidNuban(account, bank) {
  if (!/^\d{10}$/.test(account)) return false
  if (!bank?.code) return true
  const digits = (bank.code + account.slice(0, 9)).split('').map(Number)
  const total = digits.reduce((sum, digit, i) => sum + digit * WEIGHTS[i], 0)
  return (10 - (total % 10)) % 10 === Number(account[9])
}

export function findBanks(text) {
  const spoken = ` ${text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()} `
  const scored = BANKS.map((bank) => {
    const best = bank.aliases.reduce(
      (length, alias) => (spoken.includes(` ${alias} `) ? Math.max(length, alias.length) : length),
      0,
    )
    return { bank, score: best }
  }).filter((entry) => entry.score > 0)
  if (scored.length === 0) return []
  const top = Math.max(...scored.map((entry) => entry.score))
  return scored.filter((entry) => entry.score === top).map((entry) => entry.bank)
}