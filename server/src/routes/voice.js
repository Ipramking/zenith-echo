import express, { Router } from 'express'
import rateLimit from '../rateLimit.js'
import { createRealtimeToken, listVoices, speak, transcribe } from '../services/voice.js'

const router = Router()

router.use(rateLimit({ windowMs: 60000, max: 60 }))

router.post('/token', async (req, res) => {
  res.json(await createRealtimeToken())
})

router.post(
  '/transcribe',
  express.raw({ type: ['audio/*', 'video/webm', 'application/octet-stream'], limit: '10mb' }),
  async (req, res) => {
    const mimeType = req.get('content-type') ?? 'audio/webm'
    const language = typeof req.query.language === 'string' ? req.query.language : 'en'
    res.json(await transcribe(req.body, mimeType, language))
  },
)

router.post('/speak', async (req, res) => {
  const audio = await speak(req.body?.text)
  res.set('Cache-Control', 'private, max-age=3600')
  res.type('audio/mpeg').send(audio)
})

router.get('/voices', async (req, res) => {
  res.json(await listVoices())
})

export default router