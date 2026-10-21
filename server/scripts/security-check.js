import { createHash, generateKeyPairSync, sign } from 'node:crypto'

const base = process.env.API_URL ?? 'http://localhost:4000/api'
const origin = process.env.CLIENT_ORIGIN?.split(',')[0] ?? 'http://localhost:5173'
const rpId = new URL(origin).hostname
const PIN = process.env.DEMO_PIN ?? '2580'

async function call(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: response.status, data: await response.json() }
}

function report(label, passed, detail = '') {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}${detail ? `\n  ${detail}` : ''}`)
}

const b64 = (buffer) => Buffer.from(buffer).toString('base64url')

function fakeFingerprint() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const id = b64(createHash('sha256').update(String(Math.random())).digest())
  let counter = 0
  return {
    id,
    publicKey: b64(publicKey.export({ format: 'der', type: 'spki' })),
    clientData: (type, challenge) => b64(JSON.stringify({ type, challenge, origin })),
    assert(challenge) {
      counter += 1
      const flags = Buffer.from([0x05])
      const count = Buffer.alloc(4)
      count.writeUInt32BE(counter)
      const authData = Buffer.concat([createHash('sha256').update(rpId).digest(), flags, count])
      const clientDataJSON = this.clientData('webauthn.get', challenge)
      const signed = Buffer.concat([authData, createHash('sha256').update(Buffer.from(clientDataJSON, 'base64url')).digest()])
      return { id, clientDataJSON, authenticatorData: b64(authData), signature: b64(sign('sha256', signed, privateKey)) }
    },
  }
}

async function startPayment(lines) {
  let sessionId
  let reply
  for (const text of lines) {
    reply = (await call('/assistant', { sessionId, text })).data
    sessionId = reply.sessionId
  }
  return reply
}

const status = (await call('/security/status')).data
if (!status.pin) {
  const created = await call('/security/pin', { pin: PIN })
  report('create PIN', created.status === 200)
}
const weak = await call('/security/pin', { pin: '1111', currentPin: PIN })
report('weak PIN is refused', weak.status === 400, weak.data.error)

const noTicket = await startPayment(['buy airtime', 'my number', '1000 naira', 'yes'])
const blocked = await call('/assistant/execute', { sessionId: noTicket.sessionId })
report('payment without PIN or fingerprint is blocked', blocked.status === 401, blocked.data.error)

const wrong = await call('/security/pin/verify', { pin: '9999', sessionId: noTicket.sessionId })
report('wrong PIN is rejected', wrong.status === 401, wrong.data.error)
const right = await call('/security/pin/verify', { pin: PIN, sessionId: noTicket.sessionId })
const paid = await call('/assistant/execute', { sessionId: noTicket.sessionId, ticket: right.data.ticket })
report('correct PIN completes payment', paid.status === 200, paid.data.message?.text)
const replay = await call('/assistant/execute', { sessionId: noTicket.sessionId, ticket: right.data.ticket })
report('the same approval cannot be reused', replay.status !== 200, replay.data.error)

const finger = fakeFingerprint()
const regOptions = (await call('/security/biometric/register/options', {})).data
const registered = await call('/security/biometric/register', {
  id: finger.id,
  publicKey: finger.publicKey,
  algorithm: -7,
  clientDataJSON: finger.clientData('webauthn.create', regOptions.challenge),
})
report('fingerprint registers', registered.status === 200 && registered.data.biometric)

const small = await startPayment(['buy data', 'my number', 'the 1 gig one', 'yes'])
report('small payment accepts fingerprint', small.authorisation?.required === 'any', small.message.text)
const authOptions = (await call('/security/biometric/options', { sessionId: small.sessionId })).data
const touched = await call('/security/biometric/verify', finger.assert(authOptions.challenge))
const dataPaid = await call('/assistant/execute', { sessionId: small.sessionId, ticket: touched.data.ticket })
report('fingerprint completes payment', dataPaid.status === 200, dataPaid.data.message?.text)

const forged = await call('/security/biometric/verify', {
  ...finger.assert((await call('/security/biometric/options', { sessionId: small.sessionId })).data.challenge),
  signature: b64(Buffer.alloc(64, 1)),
})
report('forged fingerprint is rejected', forged.status === 401, forged.data.error)

const large = await startPayment(['send money to daniel', '75000', 'skip', 'yes'])
report('large payment requires PIN', large.authorisation?.required === 'pin', large.message.text)
const largeOptions = (await call('/security/biometric/options', { sessionId: large.sessionId })).data
const largeTouch = await call('/security/biometric/verify', finger.assert(largeOptions.challenge))
const fingerOnly = await call('/assistant/execute', { sessionId: large.sessionId, ticket: largeTouch.data.ticket })
report('fingerprint alone cannot approve a large payment', fingerOnly.status === 401, fingerOnly.data.error)

for (let i = 0; i < 3; i += 1) await call('/security/pin/verify', { pin: '0000', sessionId: large.sessionId })
const locked = await call('/security/pin/verify', { pin: PIN, sessionId: large.sessionId })
report('three wrong PINs lock the account', locked.status === 423, locked.data.error)