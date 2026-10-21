import express from 'express'
import cors from 'cors'
import accountRoutes from './routes/account.js'
import billRoutes from './routes/bills.js'
import voiceRoutes from './routes/voice.js'

const app = express()
const port = Number(process.env.PORT) || 4000

app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') ?? true }))
app.use(express.json({ limit: '100kb' }))

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    voice: Boolean(process.env.ELEVENLABS_API_KEY),
    time: new Date().toISOString(),
  })
})
app.use('/api', accountRoutes)
app.use('/api/bills', billRoutes)
app.use('/api/voice', voiceRoutes)
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err)
  res.status(err.status ?? 500).json({ error: err.expose ? err.message : 'Something went wrong' })
})

app.listen(port, () => {
  console.log(`Echo API running on http://localhost:${port}`)
})