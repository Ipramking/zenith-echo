import { useMemo, useState } from 'react'
import { NetworkTiles, PickerSheet, SourceAccountField } from '../components/Fields'
import { Header } from '../components/Parts'
import { DATA_PLANS, NETWORKS, PROFILE } from '../lib/data'
import { naira } from '../lib/format'
import type { Intent } from '../lib/types'
import { useFlow } from '../state/flow'
import { useDailyLimit } from '../state/limits'
import { useNav, type RechargeMode } from '../state/nav'
import { useStore } from '../state/store'
import { useVoiceFill, type FillValues } from '../voice/fill'

const QUICK = [100, 200, 500, 1000, 2000, 5000]

export function Recharge() {
  const { accounts, beneficiaries } = useStore()
  const { recharge, openRecharge } = useNav()
  const { start, setStage } = useFlow()

  const [source, setSource] = useState('sav')
  const [net, setNet] = useState('mtn')
  const [phone, setPhone] = useState(PROFILE.phone)
  const [amount, setAmount] = useState('')
  const [planId, setPlanId] = useState('')
  const [sheet, setSheet] = useState(false)

  const network = NETWORKS.find((n) => n.id === net)!
  const src = accounts.find((a) => a.id === source)!
  const plans = DATA_PLANS[net]
  const plan = plans.find((p) => p.id === planId)
  const amt = recharge === 'airtime' ? Number(amount) : (plan?.price ?? 0)
  const short = amt > src.balance
  const lim = useDailyLimit(amt)
  const phoneOk = /^0[789]\d{9}$/.test(phone)
  const ready = src.spendable && phoneOk && !short && !lim.over && (recharge === 'airtime' ? amt >= 50 : !!plan)

  const phoneBens = useMemo(
    () => beneficiaries.filter((b) => b.kind === 'phone').map((b) => ({ value: b.id, label: b.name, note: `${b.phone} · ${NETWORKS.find((n) => n.id === b.network)?.name ?? ''}` })),
    [beneficiaries],
  )

  const pickBeneficiary = (id: string) => {
    const b = beneficiaries.find((x) => x.id === id)
    if (!b) return
    setPhone(b.phone ?? '')
    if (b.network) {
      setNet(b.network)
      setPlanId('')
    }
  }

  const submit = () => {
    const isAirtime = recharge === 'airtime'
    const known = beneficiaries.some((b) => b.kind === 'phone' && b.phone === phone)
    const intent: Intent = {
      kind: isAirtime ? 'airtime' : 'data',
      accountId: source,
      title: isAirtime ? `${network.name} airtime for ${phone}` : `${network.name} ${plan!.label} data for ${phone}`,
      amount: amt,
      fee: 0,
      desc: isAirtime ? `${network.name} Airtime Purchase ${phone}-${src.number}` : `${network.name} Data ${plan!.label} ${phone}-${src.number}`,
      rows: [
        ['Network', network.name],
        ['Phone number', phone],
        ...(isAirtime ? [] : ([['Data plan', `${plan!.label} · ${plan!.note}`]] as [string, string][])),
      ],
      saveBeneficiary: known ? undefined : { kind: 'phone', name: phone, network: net, phone },
    }
    start(intent)
  }

  const fromVoice = (v: FillValues) => {
    if (v.network) setNet(v.network)
    if (v.phone !== undefined) setPhone(v.phone)
    if (v.amount !== undefined) setAmount(String(v.amount))
    if (v.plan !== undefined) setPlanId(v.plan)
  }
  const submitByVoice = () => {
    if (!ready) return
    submit()
    setStage('auth')
  }
  useVoiceFill('airtime', fromVoice, submitByVoice)
  useVoiceFill('data', fromVoice, submitByVoice)

  const seg = (m: RechargeMode, label: string) => (
    <button type="button" role="tab" aria-selected={recharge === m} className={recharge === m ? 'on' : ''} onClick={() => openRecharge(m)}>{label}</button>
  )

  return (
    <div className="page">
      <Header title={recharge === 'airtime' ? 'Airtime Recharge' : 'Data Bundles'} menu />
      <div className="scroll form">
        <div className="seg" role="tablist" aria-label="Recharge type">
          {seg('airtime', 'Airtime')}
          {seg('data', 'Data')}
        </div>

        <SourceAccountField value={source} onChange={setSource} />

        <NetworkTiles value={net} onChange={(id) => { setNet(id); setPlanId('') }} />

        <label className="field">
          <span>Mobile Number</span>
          <input value={phone} inputMode="numeric" maxLength={11} placeholder="Mobile Number" onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
        </label>
        <div className="link-row">
          <button type="button" className="inline-link" onClick={() => setSheet(true)}>Not in my beneficiaries?</button>
          <button type="button" className="inline-link" onClick={() => setPhone(PROFILE.phone)}>Use my number</button>
        </div>
        {phone.length > 0 && !phoneOk && <p aria-live="polite" className="resolve bad">Enter a valid 11-digit Nigerian number</p>}

        {recharge === 'airtime' ? (
          <div className="field">
            <span>Amount</span>
            <div className="quick">
              {QUICK.map((q) => (
                <button key={q} type="button" className={amt === q ? 'on' : ''} onClick={() => setAmount(String(q))}>{naira(q).replace('.00', '')}</button>
              ))}
            </div>
            <input value={amount} inputMode="numeric" placeholder="Amount (min 50)" aria-label="Amount, at least 50 naira" onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
          </div>
        ) : (
          <div className="field">
            <span>Select Data Plan</span>
            <div className="plans" role="radiogroup" aria-label="Data plan">
              {plans.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={p.id === planId} className={p.id === planId ? 'on' : ''} onClick={() => setPlanId(p.id)}>
                  <b>{p.label}</b>
                  <small>{p.note}</small>
                  <span>{naira(p.price).replace('.00', '')}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {short && <p aria-live="polite" className="resolve bad">Insufficient funds</p>}
        {lim.msg && <p aria-live="polite" className="resolve bad" role="status">{lim.msg}</p>}

        <button type="button" className="btn solid red upper" disabled={!ready} onClick={submit}>Continue</button>
      </div>

      {sheet && <PickerSheet title="Choose Beneficiary" options={phoneBens} onPick={pickBeneficiary} onClose={() => setSheet(false)} empty="No saved numbers yet" />}
    </div>
  )
}
