import { HttpError } from './errors.js'

export default function rateLimit({ windowMs = 60000, max = 60 } = {}) {
  const hits = new Map()

  return (req, res, next) => {
    const now = Date.now()
    const key = req.ip ?? 'local'
    const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs)
    if (recent.length >= max) {
      next(new HttpError(429, 'Too many requests. Please wait a moment.'))
      return
    }
    recent.push(now)
    hits.set(key, recent)
    next()
  }
}
