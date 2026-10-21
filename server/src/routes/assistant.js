import express, { Router } from 'express'
import rateLimit from '../rateLimit.js'
import { execute, handle } from '../assistant/engine.js'
import { transcribe } from '../services/voice.js'

const router = Router()

router.use(rateLimit({ windowMs: 60000, max: 120 }))

router.post('/', async (req, res) => {
  const { sessionId, text, intent, choice } = req.body ?? {}
  res.json(await handle({ sessionId, text, intent, choice }))
})

router.post(
  '/voice',
  express.raw({ type: ['audio/*', 'video/webm', 'application/octet-stream'], limit: '10mb' }),
  async (req, res) => {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined
    const heard = await transcribe(req.body, req.get('content-type') ?? 'audio/webm', 'en')
    const reply = await handle({ sessionId, text: heard.text })
    res.json({ ...reply, heard: heard.text })
  },
)

router.post('/execute', async (req, res) => {
  res.json(await execute(req.body?.sessionId))
})

export default router