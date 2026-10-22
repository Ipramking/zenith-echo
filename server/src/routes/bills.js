import { Router } from 'express'
import {
  buyAirtime,
  buyData,
  buyElectricity,
  listDataPlans,
  listDiscos,
  listNetworks,
  validateMeter,
} from '../services/bills.js'

const router = Router()

router.get('/networks', (req, res) => {
  res.json(listNetworks())
})

router.get('/data-plans', (req, res) => {
  res.json(listDataPlans(req.query.network))
})

router.get('/discos', (req, res) => {
  res.json(listDiscos())
})

router.post('/airtime', (req, res) => {
  res.status(201).json(buyAirtime(req.body))
})

router.post('/data', (req, res) => {
  res.status(201).json(buyData(req.body))
})

router.post('/electricity/validate', (req, res) => {
  res.json(validateMeter(req.body))
})

router.post('/electricity', (req, res) => {
  res.status(201).json(buyElectricity(req.body))
})

export default router
