import { HttpError } from '../errors.js'

const API = 'https://api.elevenlabs.io/v1'
const MAX_CACHE = 200
const speechCache = new Map()
let fallbackVoiceId = null

function apiKey() {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) throw new HttpError(503, 'Voice service is not configured')
  return key
}

async function elevenlabs(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'xi-api-key': apiKey(), ...options.headers },
  })
  if (!response.ok) {
    const detail = await response.text()
    console.error(`ElevenLabs ${response.status} on ${path}: ${detail.slice(0, 300)}`)
    throw new HttpError(502, 'Voice service is unavailable right now')
  }
  return response
}

export async function createRealtimeToken() {
  const response = await elevenlabs('/single-use-token/realtime_scribe', { method: 'POST' })
  const { token } = await response.json()
  return {
    token,
    url: 'wss://api.elevenlabs.io/v1/speech-to-text/realtime',
    model: 'scribe_v2_realtime',
    expiresInSeconds: 900,
  }
}

export async function transcribe(audio, mimeType = 'audio/webm', languageCode = 'en') {
  if (!audio?.length) throw new HttpError(400, 'No audio received')
  const form = new FormData()
  form.append('model_id', process.env.ELEVENLABS_STT_MODEL || 'scribe_v2')
  form.append('file', new Blob([audio], { type: mimeType }), 'speech')
  form.append('tag_audio_events', 'false')
  if (languageCode) form.append('language_code', languageCode)
  const response = await elevenlabs('/speech-to-text', { method: 'POST', body: form })
  const result = await response.json()
  return { text: (result.text ?? '').trim(), languageCode: result.language_code ?? languageCode }
}

export async function listVoices() {
  const response = await elevenlabs('/voices')
  const { voices = [] } = await response.json()
  return voices.map((voice) => ({
    id: voice.voice_id,
    name: voice.name,
    accent: voice.labels?.accent ?? null,
    gender: voice.labels?.gender ?? null,
    category: voice.category ?? null,
  }))
}

async function resolveVoiceId() {
  if (process.env.ELEVENLABS_VOICE_ID) return process.env.ELEVENLABS_VOICE_ID
  if (fallbackVoiceId) return fallbackVoiceId
  const voices = await listVoices()
  if (!voices.length) throw new HttpError(503, 'No voices available on this account')
  fallbackVoiceId = voices[0].id
  return fallbackVoiceId
}

export async function speak(text) {
  const clean = String(text ?? '').trim()
  if (!clean) throw new HttpError(400, 'Nothing to say')
  if (clean.length > 600) throw new HttpError(400, 'Text is too long')

  const voiceId = await resolveVoiceId()
  const cacheKey = `${voiceId}:${clean}`
  if (speechCache.has(cacheKey)) return speechCache.get(cacheKey)

  const response = await elevenlabs(`/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: clean,
      model_id: process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2',
      voice_settings: { stability: 0.6, similarity_boost: 0.8 },
    }),
  })
  const audio = Buffer.from(await response.arrayBuffer())

  if (speechCache.size >= MAX_CACHE) speechCache.delete(speechCache.keys().next().value)
  speechCache.set(cacheKey, audio)
  return audio
}
