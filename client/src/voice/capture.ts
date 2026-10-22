const BASE = String(import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '') + '/api'

export interface Heard {
  text: string | null
  error?: 'no-speech' | 'aborted' | 'unsupported' | 'denied' | 'failed'
}

interface Rec {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  abort: () => void
}
type RecCtor = new () => Rec

export const browserRecognizer = (): RecCtor | null => {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const canRecord = () =>
  typeof window !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext)

export const canHear = () => canRecord() || !!browserRecognizer()

let ctx: AudioContext | null = null
let cloudWorks = true

function audioContext(): AudioContext | null {
  if (ctx) return ctx
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  ctx = new Ctx()
  return ctx
}

/** Call from a tap: the browser only runs audio processing after the user has touched the page. */
export function wakeAudio() {
  const c = audioContext()
  if (c && c.state !== 'running') void c.resume().catch(() => undefined)
}

function toWav(chunks: Float32Array[], rate: number): Blob {
  const target = 16000
  const step = rate / target
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const input = new Float32Array(total)
  let at = 0
  for (const c of chunks) {
    input.set(c, at)
    at += c.length
  }
  const length = Math.floor(total / step)
  const view = new DataView(new ArrayBuffer(44 + length * 2))
  const text = (o: number, s: string) => [...s].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + length * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, target, true)
  view.setUint32(28, target * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, length * 2, true)
  for (let i = 0; i < length; i++) {
    const from = Math.floor(i * step)
    const to = Math.min(total, Math.floor((i + 1) * step))
    let sum = 0
    for (let j = from; j < to; j++) sum += input[j]
    const v = Math.max(-1, Math.min(1, sum / Math.max(1, to - from)))
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true)
  }
  return new Blob([view], { type: 'audio/wav' })
}

async function transcribe(audio: Blob): Promise<string> {
  const response = await fetch(`${BASE}/voice/transcribe?language=en`, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: audio })
  if (!response.ok) throw new Error(`stt ${response.status}`)
  const data = (await response.json()) as { text?: string }
  return (data.text ?? '').trim()
}

/**
 * One turn of listening through the microphone, with the phone's noise suppression and echo cancellation on.
 * It waits for speech that stands clearly above the room's background level, records it with a short lead-in,
 * stops after a pause, then releases the microphone completely before transcribing.
 */
function recordTurn(waitMs: number, signal: { aborted: boolean; onAbort?: () => void }): Promise<Heard> {
  return new Promise((resolve) => {
    void (async () => {
      const c = audioContext()
      if (!c) return resolve({ text: null, error: 'unsupported' })
      if (c.state !== 'running') await c.resume().catch(() => undefined)
      if (c.state !== 'running') return resolve({ text: null, error: 'unsupported' })
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        })
      } catch (err) {
        const name = (err as { name?: string })?.name
        return resolve({ text: null, error: name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'failed' })
      }
      if (signal.aborted) {
        stream.getTracks().forEach((t) => t.stop())
        return resolve({ text: null, error: 'aborted' })
      }

      const source = c.createMediaStreamSource(stream)
      const node = c.createScriptProcessor(2048, 1, 1)
      const sink = c.createGain()
      sink.gain.value = 0
      const chunkMs = (2048 / c.sampleRate) * 1000
      const lead: Float32Array[] = []
      const speech: Float32Array[] = []
      let floor = 0
      let calibrated = 0
      let hot = 0
      let voiced = 0
      let quiet = 0
      let talking = false
      let finished = false
      const started = performance.now()

      const release = () => {
        node.onaudioprocess = null
        try {
          source.disconnect()
          node.disconnect()
          sink.disconnect()
        } catch {
          /* already disconnected */
        }
        stream.getTracks().forEach((t) => t.stop())
      }

      const finish = (outcome: 'speech' | 'none' | 'aborted') => {
        if (finished) return
        finished = true
        release()
        if (outcome === 'aborted') return resolve({ text: null, error: 'aborted' })
        if (outcome === 'none') return resolve({ text: null, error: 'no-speech' })
        transcribe(toWav(speech, c.sampleRate))
          .then((text) => resolve(signal.aborted ? { text: null, error: 'aborted' } : text ? { text } : { text: null, error: 'no-speech' }))
          .catch(() => {
            cloudWorks = false
            resolve({ text: null, error: signal.aborted ? 'aborted' : 'failed' })
          })
      }
      signal.onAbort = () => finish('aborted')

      node.onaudioprocess = (e) => {
        if (finished) return
        const data = new Float32Array(e.inputBuffer.getChannelData(0))
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
        const level = Math.sqrt(sum / data.length)

        if (calibrated < 6) {
          floor = calibrated === 0 ? level : floor * 0.7 + level * 0.3
          calibrated++
          lead.push(data)
          return
        }
        const threshold = Math.max(0.012, floor * 3.2)

        if (!talking) {
          lead.push(data)
          if (lead.length > 8) lead.shift()
          if (level > threshold) hot++
          else {
            hot = 0
            floor = floor * 0.96 + level * 0.04
          }
          if (hot >= 2) {
            talking = true
            speech.push(...lead)
            voiced = hot
          } else if (performance.now() - started > waitMs) finish('none')
          return
        }

        speech.push(data)
        if (level > threshold * 0.6) {
          quiet = 0
          voiced++
        } else quiet++
        const length = speech.length * chunkMs
        if (quiet * chunkMs >= 850 || length >= 12000) {
          if (voiced * chunkMs < 220) {
            talking = false
            speech.length = 0
            hot = 0
            quiet = 0
            voiced = 0
            return
          }
          finish('speech')
        }
      }
      source.connect(node)
      node.connect(sink)
      sink.connect(c.destination)
    })()
  })
}

/** Fallback when the voice service can't be reached: the browser's own speech recognition, one phrase at a time. */
function browserTurn(waitMs: number, signal: { aborted: boolean; onAbort?: () => void }): Promise<Heard> {
  return new Promise((resolve) => {
    const Rec = browserRecognizer()
    if (!Rec) return resolve({ text: null, error: 'unsupported' })
    const rec = new Rec()
    rec.lang = 'en-NG'
    rec.continuous = false
    rec.interimResults = false
    rec.maxAlternatives = 1
    let done = false
    const end = (h: Heard) => {
      if (done) return
      done = true
      window.clearTimeout(timer)
      try {
        rec.abort()
      } catch {
        /* already stopped */
      }
      resolve(h)
    }
    const timer = window.setTimeout(() => end({ text: null, error: 'no-speech' }), waitMs + 6000)
    rec.onresult = (e) => {
      const t = e.results[0]?.[0]?.transcript?.trim()
      end(t ? { text: t } : { text: null, error: 'no-speech' })
    }
    rec.onerror = (e) => end({ text: null, error: e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'denied' : e.error === 'aborted' ? 'aborted' : 'no-speech' })
    rec.onend = () => end({ text: null, error: 'no-speech' })
    signal.onAbort = () => end({ text: null, error: 'aborted' })
    try {
      rec.start()
    } catch {
      end({ text: null, error: 'failed' })
    }
  })
}

export interface Turn {
  result: Promise<Heard>
  abort: () => void
}

/** Listen for one thing the user says. The microphone is on only for the length of this turn. */
export function hearOnce(waitMs: number): Turn {
  const signal: { aborted: boolean; onAbort?: () => void } = { aborted: false }
  const useCloud = cloudWorks && canRecord()
  const result = useCloud ? recordTurn(waitMs, signal) : browserTurn(waitMs, signal)
  return {
    result,
    abort: () => {
      signal.aborted = true
      signal.onAbort?.()
    },
  }
}
