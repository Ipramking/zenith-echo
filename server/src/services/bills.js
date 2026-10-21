import { badRequest, notFound, requireAmount, requireDigits } from '../errors.js'
import { debit } from './ledger.js'

export const NETWORKS = [
  {
    id: 'mtn',
    name: 'MTN',
    aliases: ['mtn', 'm t n'],
    prefixes: ['0703', '0704', '0706', '0803', '0806', '0810', '0813', '0814', '0816', '0903', '0906', '0913', '0916'],
  },
  {
    id: 'airtel',
    name: 'Airtel',
    aliases: ['airtel', 'air tel'],
    prefixes: ['0701', '0708', '0802', '0808', '0812', '0901', '0902', '0904', '0907', '0911', '0912'],
  },
  {
    id: 'glo',
    name: 'Glo',
    aliases: ['glo', 'globacom'],
    prefixes: ['0705', '0805', '0807', '0811', '0815', '0905', '0915'],
  },
  {
    id: '9mobile',
    name: '9mobile',
    aliases: ['9mobile', '9 mobile', 'nine mobile', 'etisalat'],
    prefixes: ['0809', '0817', '0818', '0908', '0909'],
  },
]

const PLAN_TEMPLATES = [
  { size: '500MB', validity: '1 day', price: 350 },
  { size: '1GB', validity: '1 day', price: 500 },
  { size: '2GB', validity: '7 days', price: 1500 },
  { size: '5GB', validity: '30 days', price: 3500 },
  { size: '10GB', validity: '30 days', price: 5500 },
  { size: '20GB', validity: '30 days', price: 9000 },
]

export const DATA_PLANS = NETWORKS.flatMap((network) =>
  PLAN_TEMPLATES.map((plan) => ({
    id: `${network.id}-${plan.size.toLowerCase()}-${plan.validity.split(' ')[0]}d`,
    networkId: network.id,
    label: `${plan.size} for ${plan.validity}`,
    ...plan,
  })),
)

export const DISCOS = [
  { id: 'ikedc', area: 'Ikeja, Lagos', name: 'Ikeja Electric', aliases: ['ikeja electric', 'ikeja', 'ikedc'] },
  { id: 'ekedc', area: 'Lekki, Lagos', name: 'Eko Electricity', aliases: ['eko electric', 'eko', 'ekedc'] },
  { id: 'aedc', area: 'Wuse, Abuja', name: 'Abuja Electricity', aliases: ['abuja electric', 'abuja', 'aedc'] },
  { id: 'ibedc', area: 'Bodija, Ibadan', name: 'Ibadan Electricity', aliases: ['ibadan electric', 'ibadan', 'ibedc'] },
  { id: 'phed', area: 'GRA, Port Harcourt', name: 'Port Harcourt Electricity', aliases: ['port harcourt', 'phed'] },
  { id: 'eedc', area: 'Independence Layout, Enugu', name: 'Enugu Electricity', aliases: ['enugu', 'eedc'] },
  { id: 'kedco', area: 'Nassarawa, Kano', name: 'Kano Electricity', aliases: ['kano', 'kedco'] },
  { id: 'bedc', area: 'GRA, Benin City', name: 'Benin Electricity', aliases: ['benin', 'bedc'] },
  { id: 'jed', area: 'Rayfield, Jos', name: 'Jos Electricity', aliases: ['jos', 'jed'] },
  { id: 'kaedco', area: 'Barnawa, Kaduna', name: 'Kaduna Electric', aliases: ['kaduna', 'kaedco'] },
]

const TARIFF_PER_KWH = 209.5

const METER_HOLDERS = ['ADEWALE OKONKWO', 'GRACE EMEKA', 'FATIMA BELLO', 'TUNDE LAWAL', 'NGOZI EZE']
const STREETS = ['12 Palm Avenue', '4 Unity Close', '27 Market Road', '9 Church Street', '15 Station Road']

export function normalisePhone(value) {
  let digits = String(value ?? '').replace(/\D/g, '')
  if (digits.startsWith('234') && digits.length === 13) digits = `0${digits.slice(3)}`
  if (digits.length === 10 && !digits.startsWith('0')) digits = `0${digits}`
  return requireDigits(digits, 'Phone number', { min: 11 })
}

export function detectNetwork(phone) {
  return NETWORKS.find((network) => network.prefixes.includes(phone.slice(0, 4))) ?? null
}

function requireNetwork(networkId, phone) {
  const network = networkId ? NETWORKS.find((n) => n.id === networkId) : detectNetwork(phone)
  if (!network) throw badRequest('Please choose the network')
  return network
}

function maskPhone(phone) {
  return `${phone.slice(0, 4)} *** ${phone.slice(-4)}`
}

export function listNetworks() {
  return NETWORKS.map(({ id, name }) => ({ id, name }))
}

export function listDataPlans(networkId) {
  return networkId ? DATA_PLANS.filter((plan) => plan.networkId === networkId) : DATA_PLANS
}

export function listDiscos() {
  return DISCOS.map(({ id, name }) => ({ id, name }))
}

export function buyAirtime({ phone, networkId, amount }) {
  const number = normalisePhone(phone)
  const network = requireNetwork(networkId, number)
  const value = requireAmount(amount, { min: 50, max: 50000 })
  return debit({
    amount: value,
    category: 'airtime',
    description: `${network.name} airtime ${maskPhone(number)}`,
    details: { phone: number, networkId: network.id, networkName: network.name },
  })
}

export function buyData({ phone, planId }) {
  const number = normalisePhone(phone)
  const plan = DATA_PLANS.find((p) => p.id === planId)
  if (!plan) throw badRequest('Unknown data plan')
  const network = NETWORKS.find((n) => n.id === plan.networkId)
  return debit({
    amount: plan.price,
    category: 'data',
    description: `${network.name} ${plan.label} ${maskPhone(number)}`,
    details: { phone: number, networkId: network.id, networkName: network.name, plan },
  })
}

function requireDisco(discoId) {
  const disco = DISCOS.find((d) => d.id === discoId)
  if (!disco) throw badRequest('Please choose the electricity company')
  return disco
}

export function validateMeter({ meter, discoId }) {
  const number = requireDigits(meter, 'Meter number', { min: 11, max: 13 })
  const disco = requireDisco(discoId)
  if (number.startsWith('000')) throw notFound('Meter not found')
  const seed = number.split('').reduce((sum, d) => sum + Number(d), 0)
  return {
    meter: number,
    discoId: disco.id,
    discoName: disco.name,
    customerName: METER_HOLDERS[seed % METER_HOLDERS.length],
    address: `${STREETS[Number(number.at(-1)) % STREETS.length]}, ${disco.area}`,
    meterType: 'prepaid',
  }
}

function generateToken() {
  const digits = Array.from({ length: 20 }, () => Math.floor(Math.random() * 10)).join('')
  return digits.match(/.{4}/g).join('-')
}

export function buyElectricity({ meter, discoId, amount }) {
  const customer = validateMeter({ meter, discoId })
  const value = requireAmount(amount, { min: 1000, max: 500000 })
  const units = Math.floor((value / TARIFF_PER_KWH) * 10) / 10
  return debit({
    amount: value,
    category: 'electricity',
    description: `${customer.discoName} prepaid ${customer.meter.slice(-4)}`,
    details: { customer, token: generateToken(), units },
  })
}