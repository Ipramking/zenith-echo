import express, { Router } from 'express'
import rateLimit from '../rateLimit.js'
import { execute, handle } from '../assistant/engine.js'
import { transcribe } from '../services/voice.js'

const router = Router()

router.use(rateLimit({ windowMs: 60000, max: 120 }))

router.post('/', async (req, res) => {
  const { sessionId, text, intent, choice, language } = req.body ?? {}
  res.json(await handle({ sessionId, text, intent, choice, language }))
})

router.post(
  '/voice',
  express.raw({ type: ['audio/*', 'video/webm', 'application/octet-stream'], limit: '10mb' }),
  async (req, res) => {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined
    const mimeType = req.get('content-type') ?? 'audio/webm'
    let heard = await transcribe(req.body, mimeType, null)
    if (!['en', 'eng', 'yo', 'yor', 'pcm'].includes(String(heard.languageCode).toLowerCase())) {
      heard = await transcribe(req.body, mimeType, 'en')
    }
    const reply = await handle({ sessionId, text: heard.text, language: heard.languageCode })
    res.json({ ...reply, heard: heard.text })
  },
)

router.post('/execute', async (req, res) => {
  const { sessionId, ticket } = req.body ?? {}
  res.json(await execute({ sessionId, ticket }))
})

export default router
