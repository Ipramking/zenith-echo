export class HttpError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.expose = true
    this.details = details
  }
}

export function badRequest(message, details) {
  return new HttpError(400, message, details)
}

export function notFound(message) {
  return new HttpError(404, message)
}

export function requireDigits(value, field, { min, max = min }) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length < min || digits.length > max) {
    const size = min === max ? `${min}` : `${min} to ${max}`
    throw badRequest(`${field} must be ${size} digits`)
  }
  return digits
}

export function requireAmount(value, { min = 1, max = Infinity } = {}) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) throw badRequest('Amount must be a positive number')
  if (amount < min) throw badRequest(`Minimum amount is ₦${min.toLocaleString('en-NG')}`)
  if (amount > max) throw badRequest(`Maximum amount is ₦${max.toLocaleString('en-NG')}`)
  return Math.round(amount * 100) / 100
}