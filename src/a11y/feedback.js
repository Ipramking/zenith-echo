let audioContext = null

function getAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!audioContext) audioContext = new Ctx()
  if (audioContext.state === 'suspended') audioContext.resume()
  return audioContext
}

export function vibrate(pattern) {
  if ('vibrate' in navigator) navigator.vibrate(pattern)
}

function playNotes(notes) {
  const ctx = getAudio()
  if (!ctx) return
  const now = ctx.currentTime
  notes.forEach(({ freq, to, start = 0, duration = 0.15, type = 'sine' }) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now + start)
    if (to) osc.frequency.exponentialRampToValueAtTime(to, now + start + duration)
    gain.gain.setValueAtTime(0.0001, now + start)
    gain.gain.exponentialRampToValueAtTime(0.25, now + start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now + start)
    osc.stop(now + start + duration + 0.05)
  })
}

const CUES = {
  tap: { haptic: 30 },
  listen: { haptic: 50, notes: [{ freq: 440, to: 880, duration: 0.25 }] },
  success: {
    haptic: [40, 60, 40],
    notes: [
      { freq: 660, duration: 0.12 },
      { freq: 880, start: 0.12, duration: 0.18 },
    ],
  },
  error: {
    haptic: [80, 60, 80, 60, 80],
    notes: [
      { freq: 150, duration: 0.15, type: 'triangle' },
      { freq: 150, start: 0.2, duration: 0.15, type: 'triangle' },
    ],
  },
  settled: {
    haptic: [100, 50, 200],
    notes: [523.25, 659.25, 783.99].map((freq) => ({ freq, duration: 0.7 })),
  },
}

export function cue(name, { haptics = true, sound = true } = {}) {
  const selected = CUES[name]
  if (!selected) return
  if (haptics && selected.haptic) vibrate(selected.haptic)
  if (sound && selected.notes) playNotes(selected.notes)
}