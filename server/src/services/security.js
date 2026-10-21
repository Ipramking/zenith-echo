import { createHash, createPublicKey, randomBytes, scryptSync, timingSafeEqual, verify } from 'node:crypto'
import { HttpError } from '../errors.js'

const MAX_ATTEMPTS = 3
const LOCK_MS = 5 * 60 * 1000
const CHALLENGE_MS = 2 * 60 * 1000
const TICKET_MS = 2 * 60 * 1000

const state = {
  pin: null,
  failedAttempts: 0,
  lockedUntil: 0,
  credentials: new Map(),
  challenges: new Map(),
  tickets: new Map(),
  voiceLimit: Number(process.env.VOICE_LIMIT) || 50000,
}

const USER = { id: Buffer.from('amara-okeke').toString('base64url'), name: 'amara', displayName: 'Amara Okeke' }

function hashPin(pin, salt = randomBytes(16)) {
  return { salt, hash: scryptSync(pin, salt, 32) }
}

function requirePinFormat(pin) {
  const value = String(pin ?? '')
  if (!/^\d{4}$/.test(value)) throw new HttpError(400, 'PIN must be exactly 4 digits')
  if (/^(\d)\1{3}$/.test(value) || ['1234', '4321', '0123'].includes(value)) {
    throw new HttpError(400, 'Please choose a less obvious PIN')
  }
  return value
}

function pinMatches(pin) {
  if (!state.pin) return false
  const attempt = scryptSync(String(pin ?? ''), state.pin.salt, 32)
  return timingSafeEqual(attempt, state.pin.hash)
}

function relyingParty() {
  const origins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').split(',').map((o) => o.trim())
  return { id: process.env.RP_ID || new URL(origins[0]).hostname, name: 'Zenith Echo', origins }
}

function issueTicket(sessionId, method) {
  const ticket = randomBytes(24).toString('base64url')
  state.tickets.set(ticket, { sessionId, method, expires: Date.now() + TICKET_MS })
  return { ticket, method, expiresInSeconds: TICKET_MS / 1000 }
}

function newChallenge(purpose, sessionId = null) {
  const challenge = randomBytes(32).toString('base64url')
  state.challenges.set(challenge, { purpose, sessionId, expires: Date.now() + CHALLENGE_MS })
  return challenge
}

function takeChallenge(clientDataJSON, purpose, type) {
  let clientData
  try {
    clientData = JSON.parse(Buffer.from(clientDataJSON, 'base64url').toString('utf8'))
  } catch {
    throw new HttpError(400, 'Invalid client data')
  }
  const record = state.challenges.get(clientData.challenge)
  state.challenges.delete(clientData.challenge)
  if (!record || record.purpose !== purpose || record.expires < Date.now()) {
    throw new HttpError(401, 'This request has expired. Please try again.')
  }
  if (clientData.type !== type) throw new HttpError(400, 'Unexpected request type')
  if (!relyingParty().origins.includes(clientData.origin)) throw new HttpError(401, 'Unrecognised app origin')
  return record
}

export function enabledMethods() {
  return { pin: Boolean(state.pin), biometric: state.credentials.size > 0 }
}

export function getStatus() {
  const locked = state.lockedUntil > Date.now()
  return {
    ...enabledMethods(),
    locked,
    lockedSeconds: locked ? Math.ceil((state.lockedUntil - Date.now()) / 1000) : 0,
    attemptsLeft: MAX_ATTEMPTS - state.failedAttempts,
    voiceLimit: state.voiceLimit,
  }
}

export function setPin({ pin, currentPin }) {
  const value = requirePinFormat(pin)
  if (state.pin && !pinMatches(currentPin)) throw new HttpError(401, 'Your current PIN is not correct')
  state.pin = hashPin(value)
  state.failedAttempts = 0
  state.lockedUntil = 0
  return getStatus()
}

export function verifyPin({ pin, sessionId }) {
  if (!state.pin) throw new HttpError(409, 'Please create a PIN first')
  if (state.lockedUntil > Date.now()) {
    const seconds = Math.ceil((state.lockedUntil - Date.now()) / 1000)
    throw new HttpError(423, `Too many wrong attempts. Try again in ${Math.ceil(seconds / 60)} minutes.`)
  }
  if (!pinMatches(pin)) {
    state.failedAttempts += 1
    const left = MAX_ATTEMPTS - state.failedAttempts
    if (left <= 0) {
      state.lockedUntil = Date.now() + LOCK_MS
      state.failedAttempts = 0
      throw new HttpError(423, 'Too many wrong attempts. PIN is locked for 5 minutes.')
    }
    throw new HttpError(401, `Wrong PIN. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`)
  }
  state.failedAttempts = 0
  return issueTicket(sessionId, 'pin')
}

export function biometricRegistrationOptions() {
  const rp = relyingParty()
  return {
    challenge: newChallenge('register'),
    rp: { id: rp.id, name: rp.name },
    user: USER,
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
    timeout: CHALLENGE_MS,
    attestation: 'none',
    excludeCredentials: [...state.credentials.keys()].map((id) => ({ type: 'public-key', id })),
  }
}

export function registerBiometric({ id, publicKey, algorithm, clientDataJSON }) {
  takeChallenge(clientDataJSON, 'register', 'webauthn.create')
  if (!id || !publicKey) throw new HttpError(400, 'Missing credential')
  let key
  try {
    key = createPublicKey({ key: Buffer.from(publicKey, 'base64url'), format: 'der', type: 'spki' })
  } catch {
    throw new HttpError(400, 'Unsupported key')
  }
  state.credentials.set(id, { key, algorithm: Number(algorithm) || -7, counter: 0 })
  return getStatus()
}

export function biometricOptions({ sessionId }) {
  if (!state.credentials.size) throw new HttpError(409, 'Fingerprint is not set up')
  return {
    challenge: newChallenge('authenticate', sessionId),
    rpId: relyingParty().id,
    allowCredentials: [...state.credentials.keys()].map((id) => ({ type: 'public-key', id })),
    userVerification: 'required',
    timeout: CHALLENGE_MS,
  }
}

export function verifyBiometric({ id, clientDataJSON, authenticatorData, signature }) {
  const credential = state.credentials.get(id)
  if (!credential) throw new HttpError(401, 'This device is not recognised')
  const challenge = takeChallenge(clientDataJSON, 'authenticate', 'webauthn.get')

  const authData = Buffer.from(authenticatorData ?? '', 'base64url')
  if (authData.length < 37) throw new HttpError(400, 'Invalid authenticator data')
  const rpIdHash = createHash('sha256').update(relyingParty().id).digest()
  if (!authData.subarray(0, 32).equals(rpIdHash)) throw new HttpError(401, 'Unrecognised app')
  const flags = authData[32]
  if (!(flags & 0x01) || !(flags & 0x04)) throw new HttpError(401, 'Fingerprint was not confirmed')

  const clientHash = createHash('sha256').update(Buffer.from(clientDataJSON, 'base64url')).digest()
  const signed = Buffer.concat([authData, clientHash])
  const valid = verify('sha256', signed, credential.key, Buffer.from(signature ?? '', 'base64url'))
  if (!valid) throw new HttpError(401, 'Fingerprint could not be verified')

  const counter = authData.readUInt32BE(33)
  if (counter !== 0 && counter <= credential.counter) throw new HttpError(401, 'This request was already used')
  credential.counter = counter

  return issueTicket(challenge.sessionId, 'biometric')
}

export function consumeTicket({ ticket, sessionId, requiredMethod }) {
  const record = state.tickets.get(ticket)
  state.tickets.delete(ticket)
  if (!record || record.expires < Date.now() || record.sessionId !== sessionId) {
    throw new HttpError(401, 'Please confirm with your fingerprint or PIN first')
  }
  if (requiredMethod === 'pin' && record.method !== 'pin') {
    throw new HttpError(401, 'This payment needs your PIN')
  }
  return record.method
}

export function voiceLimit() {
  return state.voiceLimit
}

if (process.env.DEMO_PIN) {
  try {
    setPin({ pin: process.env.DEMO_PIN })
  } catch (error) {
    console.error(`DEMO_PIN ignored: ${error.message}`)
  }
}