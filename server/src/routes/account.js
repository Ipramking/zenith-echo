import { Router } from 'express'
import { getAccount } from '../services/ledger.js'
import { listBanks, listBeneficiaries, resolveAccount, sendTransfer } from '../services/transfers.js'

const router = Router()

router.get('/account', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50)
  res.json(getAccount({ limit }))
})

router.get('/banks', (req, res) => {
  res.json(listBanks())
})

router.get('/beneficiaries', (req, res) => {
  res.json(listBeneficiaries())
})

router.post('/transfers/lookup', async (req, res) => {
  res.json(await resolveAccount(req.body))
})

router.post('/transfers', async (req, res) => {
  res.status(201).json(await sendTransfer(req.body))
})

export default router
