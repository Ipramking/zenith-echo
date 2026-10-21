const base = process.env.API_URL ?? 'http://localhost:4000/api'

async function call(method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json()
  console.log(`${response.ok ? 'PASS' : 'FAIL'} ${response.status} ${method} ${path}`)
  if (!response.ok) console.log(`  ${data.error}`)
  return { ok: response.ok, data }
}

async function expectError(method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  console.log(`${response.ok ? 'FAIL' : 'PASS'} ${response.status} ${method} ${path} is rejected`)
  if (!response.ok) console.log(`  ${data.error}`)
}

const start = await call('GET', '/account')
console.log(`  balance ₦${start.data.balance.toLocaleString('en-NG')}`)

const lookup = await call('POST', '/transfers/lookup', { account: '2082146805', bankId: 'zenith' })
console.log(`  name ${lookup.data.name}`)

await call('POST', '/transfers', { account: '2082146805', bankId: 'zenith', amount: 5000, note: 'Fuel' })
await expectError('POST', '/transfers', { account: '2082146805', bankId: 'gtbank', amount: 5000 })
await expectError('POST', '/transfers', { account: '2082146805', bankId: 'zenith', amount: 99000000 })

const airtime = await call('POST', '/bills/airtime', { phone: '+2348031234567', amount: 1000 })
console.log(`  ${airtime.data.description}`)

const plans = await call('GET', '/bills/data-plans?network=airtel')
const data = await call('POST', '/bills/data', { phone: '08021234567', planId: plans.data[1].id })
console.log(`  ${data.data.description}`)

const meter = await call('POST', '/bills/electricity/validate', { meter: '45012345678', discoId: 'ikedc' })
console.log(`  ${meter.data.customerName}, ${meter.data.address}`)

const light = await call('POST', '/bills/electricity', { meter: '45012345678', discoId: 'ikedc', amount: 5000 })
console.log(`  token ${light.data.token}, ${light.data.units} kWh`)
await expectError('POST', '/bills/electricity', { meter: '45012345678', discoId: 'ikedc', amount: 500 })

const end = await call('GET', '/account?limit=5')
console.log(`  balance ₦${end.data.balance.toLocaleString('en-NG')}`)
end.data.transactions.forEach((t) => console.log(`  - ${t.description}: ₦${t.amount.toLocaleString('en-NG')}`))