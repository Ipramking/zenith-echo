import { writeFile } from 'node:fs/promises'

const base = process.env.API_URL ?? 'http://localhost:4000/api'
const phrase = 'Confirm transfer. You are sending five thousand naira to Daniel Toluwani Olorunda at Zenith Bank.'

async function check(label, request) {
  try {
    const result = await request()
    console.log(`PASS ${label}`)
    return result
  } catch (error) {
    console.log(`FAIL ${label}: ${error.message}`)
    return null
  }
}

async function ensureOk(response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${response.status}`)
  }
  return response
}

const voices = await check('list voices', async () => {
  const response = await ensureOk(await fetch(`${base}/voice/voices`))
  return response.json()
})
voices?.slice(0, 8).forEach((v) => console.log(`  ${v.id}  ${v.name}${v.accent ? ` (${v.accent})` : ''}`))

const audio = await check('text to speech', async () => {
  const response = await ensureOk(
    await fetch(`${base}/voice/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: phrase }),
    }),
  )
  return Buffer.from(await response.arrayBuffer())
})

if (audio) {
  await writeFile('voice-check.mp3', audio)
  console.log(`  saved voice-check.mp3 (${Math.round(audio.length / 1024)} KB)`)

  const transcript = await check('speech to text', async () => {
    const response = await ensureOk(
      await fetch(`${base}/voice/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/mpeg' },
        body: audio,
      }),
    )
    return response.json()
  })
  if (transcript) console.log(`  heard: "${transcript.text}"`)
}

const token = await check('realtime token', async () => {
  const response = await ensureOk(await fetch(`${base}/voice/token`, { method: 'POST' }))
  return response.json()
})
if (token) console.log(`  token starts ${token.token.slice(0, 8)}…, expires in ${token.expiresInSeconds}s`)