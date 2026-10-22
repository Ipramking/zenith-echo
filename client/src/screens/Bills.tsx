import { ChevronRight, GraduationCap, ShieldCheck, Tv, Wifi, Zap, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ModeTiles, PickerSheet, SelectField, SourceAccountField } from '../components/Fields'
import { Header } from '../components/Parts'
import { BILL_CATEGORIES, CABLE_PLANS, DISCOS, KWH_RATE, lookupAccountName, lookupAddress, PROFILE } from '../lib/data'
import { naira } from '../lib/format'
import type { Intent } from '../lib/types'
import { useFlow } from '../state/flow'
import { useDailyLimit } from '../state/limits'
import { useNav } from '../state/nav'
import { useStore } from '../state/store'

export const CAT_ICON: Record<string, LucideIcon> = {
  electricity: Zap,
  cable: Tv,
  internet: Wifi,
  education: GraduationCap,
  insurance: ShieldCheck,
}

/** Simulated customer lookup for a meter / smartcard number. */
function useLookup(id: string, length: number) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (id.length !== length) {
      setName('')
      setBusy(false)
      return
    }
    setBusy(true)
    const t = window.setTimeout(() => {
      setName(lookupAccountName(id))
      setBusy(false)
    }, 650)
    return () => window.clearTimeout(t)
  }, [id, length])
  return { name, busy }
}

export function Bills() {
  const { billCat, setBillCat } = useNav()
  const cat = BILL_CATEGORIES.find((c) => c.id === billCat)

  if (!cat) {
    return (
      <div className="page">
        <Header title="Bill Payment" menu />
        <div className="scroll">
          <ul className="menu">
            {BILL_CATEGORIES.map((c) => {
              const Icon = CAT_ICON[c.id]
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => setBillCat(c.id)}>
                    <span className="menu-ico"><Icon size={20} /></span>
                    {c.name}
                    <ChevronRight size={18} className="chev" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <Header title={cat.name} back={() => setBillCat(null)} />
      <div className="scroll form">
        {cat.id === 'electricity' ? <Electricity /> : cat.id === 'cable' ? <Cable /> : <Generic id={cat.id} />}
      </div>
    </div>
  )
}

/* ---------------- electricity ---------------- */

function Electricity() {
  const { accounts } = useStore()
  const { start } = useFlow()
  const [source, setSource] = useState('sav')
  const [provider, setProvider] = useState('')
  const [type, setType] = useState<'prepaid' | 'postpaid'>('prepaid')
  const [meter, setMeter] = useState('')
  const [amount, setAmount] = useState('')
  const [phone, setPhone] = useState(PROFILE.phone)
  const [sheet, setSheet] = useState(false)
  const { name, busy } = useLookup(meter, 11)

  const src = accounts.find((a) => a.id === source)!
  const amt = Number(amount)
  const min = type === 'prepaid' ? 1000 : 500
  const units = type === 'prepaid' && amt > 0 ? (amt / KWH_RATE).toFixed(2) : ''
  const short = amt > src.balance
  const lim = useDailyLimit(amt)
  const ready = !lim.over && src.spendable && !!provider && meter.length === 11 && !!name && amt >= min && !short && /^0[789]\d{9}$/.test(phone)

  const submit = () => {
    const label = type === 'prepaid' ? 'Prepaid' : 'Postpaid'
    const intent: Intent = {
      kind: 'electricity',
      accountId: source,
      title: `${provider} ${label.toLowerCase()} electricity`,
      amount: amt,
      fee: 0,
      desc: `${provider} ${label} ${meter}`,
      rows: [
        ['Provider', provider],
        ['Meter type', label],
        ['Meter number', meter],
        ['Customer', name],
        ['Address', lookupAddress(meter)],
        ['Phone number', phone],
      ],
      token: type === 'prepaid' ? { units: `${units} kWh · Band A, NGN${KWH_RATE.toFixed(2)}/kWh` } : undefined,
    }
    start(intent)
  }

  return (
    <>
      <SourceAccountField value={source} onChange={setSource} />
      <SelectField label="Select Provider" value={provider} placeholder="Select Provider" onOpen={() => setSheet(true)} />
      <ModeTiles label="Meter Type" value={type} onChange={setType} options={[{ id: 'prepaid', label: 'Prepaid' }, { id: 'postpaid', label: 'Postpaid' }]} />
      <label className="field">
        <span>Meter Number</span>
        <input value={meter} inputMode="numeric" maxLength={11} placeholder="11-digit meter number" onChange={(e) => setMeter(e.target.value.replace(/\D/g, ''))} />
      </label>
      {busy && <p aria-live="polite" className="resolve">Validating meter…</p>}
      {name && (
        <p aria-live="polite" className="resolve ok stack">
          {name}
          <small>{lookupAddress(meter)}</small>
        </p>
      )}
      <label className="field">
        <span>Amount (min {naira(min).replace('.00', '')})</span>
        <input value={amount} inputMode="numeric" placeholder="Amount" onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
      </label>
      {units && <p aria-live="polite" className="resolve">You will receive about <b>{units} kWh</b></p>}
      {short && <p aria-live="polite" className="resolve bad">Insufficient funds</p>}
      {lim.msg && <p aria-live="polite" className="resolve bad" role="status">{lim.msg}</p>}
      <label className="field">
        <span>Phone number (for your token SMS)</span>
        <input value={phone} inputMode="numeric" maxLength={11} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
      </label>
      <button type="button" className="btn solid red upper" disabled={!ready} onClick={submit}>Continue</button>
      {sheet && <PickerSheet title="Select Provider" options={DISCOS.map((d) => ({ value: d, label: d }))} value={provider} onPick={setProvider} onClose={() => setSheet(false)} />}
    </>
  )
}

/* ---------------- cable TV ---------------- */

function Cable() {
  const { accounts } = useStore()
  const { start } = useFlow()
  const providers = Object.keys(CABLE_PLANS)
  const [source, setSource] = useState('sav')
  const [provider, setProvider] = useState(providers[0])
  const [planId, setPlanId] = useState('')
  const [card, setCard] = useState('')
  const [sheet, setSheet] = useState(false)
  const { name, busy } = useLookup(card, 10)

  const src = accounts.find((a) => a.id === source)!
  const plans = CABLE_PLANS[provider]
  const plan = plans.find((p) => p.id === planId)
  const short = !!plan && plan.price > src.balance
  const lim = useDailyLimit(plan?.price ?? 0)
  const ready = !lim.over && src.spendable && !!plan && card.length === 10 && !!name && !short

  const submit = () =>
    start({
      kind: 'cable',
      accountId: source,
      title: `${provider} ${plan!.label}`,
      amount: plan!.price,
      fee: 0,
      desc: `${provider} Payment ${card} - ${plan!.label}`,
      rows: [
        ['Provider', provider],
        ['Package', plan!.label],
        ['Smartcard / IUC', card],
        ['Customer', name],
      ],
    })

  return (
    <>
      <SourceAccountField value={source} onChange={setSource} />
      <ModeTiles label="Select Provider" value={provider} onChange={(p) => { setProvider(p); setPlanId('') }} options={providers.map((p) => ({ id: p, label: p }))} />
      <SelectField label="Select Package" value={plan ? `${plan.label} - ${naira(plan.price).replace('.00', '')}` : undefined} placeholder="Select Package" onOpen={() => setSheet(true)} />
      <label className="field">
        <span>Smartcard / IUC Number</span>
        <input value={card} inputMode="numeric" maxLength={10} placeholder="10-digit number" onChange={(e) => setCard(e.target.value.replace(/\D/g, ''))} />
      </label>
      {busy && <p aria-live="polite" className="resolve">Validating…</p>}
      {name && <p aria-live="polite" className="resolve ok">{name}</p>}
      {plan && <p aria-live="polite" className="resolve">Amount due: <b>{naira(plan.price)}</b></p>}
      {short && <p aria-live="polite" className="resolve bad">Insufficient funds</p>}
      {lim.msg && <p aria-live="polite" className="resolve bad" role="status">{lim.msg}</p>}
      <button type="button" className="btn solid red upper" disabled={!ready} onClick={submit}>Continue</button>
      {sheet && <PickerSheet title="Select Package" options={plans.map((p) => ({ value: p.id, label: p.label, note: naira(p.price).replace('.00', '') + ' / month' }))} value={planId} onPick={setPlanId} onClose={() => setSheet(false)} />}
    </>
  )
}

/* ---------------- internet, education, insurance ---------------- */

function Generic({ id }: { id: string }) {
  const { accounts } = useStore()
  const { start } = useFlow()
  const cat = BILL_CATEGORIES.find((c) => c.id === id)!
  const [source, setSource] = useState('sav')
  const [provider, setProvider] = useState('')
  const [custId, setCustId] = useState('')
  const [amount, setAmount] = useState('')
  const [sheet, setSheet] = useState(false)

  const src = accounts.find((a) => a.id === source)!
  const amt = Number(amount)
  const short = amt > src.balance
  const lim = useDailyLimit(amt)
  const ready = !lim.over && src.spendable && !!provider && custId.length >= 6 && amt >= 100 && !short

  const submit = () =>
    start({
      kind: 'bill',
      accountId: source,
      title: `${provider} payment`,
      amount: amt,
      fee: 0,
      desc: `${provider} Payment ${custId}`,
      rows: [
        ['Provider', provider],
        [cat.idLabel, custId],
      ],
    })

  return (
    <>
      <SourceAccountField value={source} onChange={setSource} />
      <SelectField label="Select Provider" value={provider} placeholder="Select Provider" onOpen={() => setSheet(true)} />
      <label className="field">
        <span>{cat.idLabel}</span>
        <input value={custId} inputMode="numeric" placeholder={cat.idLabel} onChange={(e) => setCustId(e.target.value.replace(/\D/g, ''))} />
      </label>
      <label className="field">
        <span>Amount (min NGN100)</span>
        <input value={amount} inputMode="numeric" placeholder="Amount" onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
      </label>
      {short && <p aria-live="polite" className="resolve bad">Insufficient funds</p>}
      {lim.msg && <p aria-live="polite" className="resolve bad" role="status">{lim.msg}</p>}
      <button type="button" className="btn solid red upper" disabled={!ready} onClick={submit}>Continue</button>
      {sheet && <PickerSheet title="Select Provider" options={cat.providers.map((p) => ({ value: p, label: p }))} value={provider} onPick={setProvider} onClose={() => setSheet(false)} />}
    </>
  )
}
