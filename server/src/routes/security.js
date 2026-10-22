import { Router } from 'express'
import rateLimit from '../rateLimit.js'
import {
  biometricOptions,
  biometricRegistrationOptions,
  getStatus,
  registerBiometric,
  setPin,
  verifyBiometric,
  verifyPin,
} from '../services/security.js'

const router = Router()

router.use(rateLimit({ windowMs: 60000, max: 30 }))

router.get('/status', (req, res) => {
  res.json(getStatus())
})

router.post('/pin', (req, res) => {
  res.json(setPin(req.body ?? {}))
})

router.post('/pin/verify', (req, res) => {
  res.json(verifyPin(req.body ?? {}))
})

router.post('/biometric/register/options', (req, res) => {
  res.json(biometricRegistrationOptions())
})

router.post('/biometric/register', (req, res) => {
  res.json(registerBiometric(req.body ?? {}))
})

router.post('/biometric/options', (req, res) => {
  res.json(biometricOptions(req.body ?? {}))
})

router.post('/biometric/verify', (req, res) => {
  res.json(verifyBiometric(req.body ?? {}))
})

export default router
