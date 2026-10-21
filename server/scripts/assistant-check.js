const base = process.env.API_URL ?? 'http://localhost:4000/api'

let sessionId

async function send(body) {
  const response = await fetch(`${base}/assistant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, ...body }),
  })
  const reply = await response.json()
  if (!response.ok) throw new Error(reply.error)
  sessionId = reply.sessionId
  console.log(`YOU:  ${body.text ?? JSON.stringify(body)}`)
  console.log(`ECHO: [${reply.screen} · ${reply.status}] ${reply.message.text}\n`)
  return reply
}

const DEMO_PIN = process.env.DEMO_PIN ?? '2580'

async function post(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error)
  return data
}

async function ensurePin() {
  const status = await (await fetch(`${base}/security/status`)).json()
  if (!status.pin) await post('/security/pin', { pin: DEMO_PIN })
}

async function authorise(reply) {
  const { ticket } = await post('/security/pin/verify', { pin: DEMO_PIN, sessionId })
  const done = await post('/assistant/execute', { sessionId, ticket })
  console.log(`AUTH: PIN accepted (${reply.authorisation.required === 'pin' ? 'PIN required' : 'fingerprint or PIN'})`)
  console.log(`ECHO: [${done.screen} · ${done.status}] ${done.message.text}\n`)
  return done
}

const conversations = {
  data: ['I want to buy data', 'zero eight zero two one two three four five six seven', 'the 2 gig one', 'yes'],
  airtime: ['buy airtime', 'my number', 'one thousand five hundred naira', 'change the amount', '2k', 'yes'],
  transfer: ['I want to send money', '2082146805', 'GT bank', 'zenith', '5k', 'skip', 'no, the amount should be 7k', 'yes'],
  contact: ['send money to my mechanic', '20000', 'for brake pads', 'yes'],
  electricity: ['pay my light bill', 'ikeja', '4501 2345 678', '500', '5000 naira', 'yes'],
  large: ['send money to daniel', '60000', 'skip', 'yes'],
  balance: ["what's my balance", 'read my last transactions'],
}

await ensurePin()

const pick = process.argv[2]
const selected = pick ? { [pick]: conversations[pick] } : conversations

for (const [name, lines] of Object.entries(selected)) {
  console.log(`===== ${name.toUpperCase()} =====\n`)
  sessionId = undefined
  for (const text of lines) {
    const reply = await send({ text })
    if (reply.status === 'authorising') await authorise(reply)
  }
}