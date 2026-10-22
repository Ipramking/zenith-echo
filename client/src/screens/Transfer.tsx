import { useEffect, useMemo, useState } from 'react'
import { ModeTiles, PickerSheet, SelectField, SourceAccountField } from '../components/Fields'
import { Header } from '../components/Parts'
import { bankCode, BANKS, lookupAccountName, PROFILE, ZENITH } from '../lib/data'
import { naira, nipCharge } from '../lib/format'
import type { Intent } from '../lib/types'
import { useFlow } from '../state/flow'
import { useDailyLimit } from '../state/limits'
import { useNav } from '../state/nav'
import { useStore } from '../state/store'

type Mode = 'own' | 'zenith' | 'other'

const MODES: { id: Mode; label: string }[] = [
  { id: 'own', label: 'Own Account' },
  { id: 'zenith', label: 'Zenith Bank' },
  { id: 'other', label: 'Other Banks' },
]

export function Transfer() {
  const { accounts, beneficiaries } = useStore()
  const { prefill } = useNav()
  const { start } = useFlow()

  const [source, setSource] = useState('sav')
  const [mode, setMode] = useState<Mode>(prefill ? (prefill.bank === ZENITH ? 'zenith' : 'other') : 'zenith')
  const [bank, setBank] = useState(prefill && prefill.bank !== ZENITH ? prefill.bank : '')
  const [ownDest, setOwnDest] = useState('')
  const [acct, setAcct] = useState(prefill?.accountNumber ?? '')
  const [name, setName] = useState(prefill?.name ?? '')
  const [looking, setLooking] = useState(false)
  const [amount, setAmount] = useState(prefill?.amount ? String(prefill.amount) : '')
  const [note, setNote] = useState('')
  const [sheet, setSheet] = useState<'bank' | 'ben' | 'own' | null>(null)
  // A name we already trust (saved beneficiary or prefill), so the simulated lookup doesn't overwrite it.
  const [known, setKnown] = useState<{ accountNumber: string; name: string } | null>(prefill ? { accountNumber: prefill.accountNumber, name: prefill.name } : null)

  const src = accounts.find((a) => a.id === source)!
  const dest = accounts.find((a) => a.id === ownDest)
  const bankName = mode === 'zenith' ? ZENITH : bank
  const isOwnNumber = accounts.some((a) => a.number === acct)
  const amt = Number(amount)
  const fee = mode === 'other' && amt > 0 ? nipCharge(amt) : 0
  const short = amt > 0 && amt + fee > src.balance
  const lim = useDailyLimit(mode === 'own' ? 0 : amt + fee)

  // Simulated name enquiry once 10 digits are in.
  useEffect(() => {
    if (mode === 'own' || acct.length !== 10 || (mode === 'other' && !bank)) {
      if (mode !== 'own') setName('')
      setLooking(false)
      return
    }
    if (known && known.accountNumber === acct) {
      setName(known.name)
      setLooking(false)
      return
    }
    setLooking(true)
    const t = window.setTimeout(() => {
      setName(lookupAccountName(acct))
      setLooking(false)
    }, 650)
    return () => window.clearTimeout(t)
  }, [acct, mode, bank, known])

  const destOk = mode === 'own' ? !!dest && dest.id !== source : acct.length === 10 && !!name && !isOwnNumber
  const ready = src.spendable && destOk && amt >= 1 && !short && !lim.over

  const ownOptions = useMemo(
    () => accounts.filter((a) => a.spendable && a.id !== source).map((a) => ({ value: a.id, top: `${a.type} - ${a.number}`, label: naira(a.balance) })),
    [accounts, source],
  )
  const benOptions = useMemo(
    () => beneficiaries.filter((b) => b.kind === 'bank').map((b) => ({ value: b.id, label: b.name, note: `${b.bank} · ${b.accountNumber}` })),
    [beneficiaries],
  )

  const pickBeneficiary = (id: string) => {
    const b = beneficiaries.find((x) => x.id === id)
    if (!b) return
    setMode(b.bank === ZENITH ? 'zenith' : 'other')
    setBank(b.bank === ZENITH ? '' : b.bank ?? '')
    setAcct(b.accountNumber ?? '')
    setName(b.name)
    setKnown({ accountNumber: b.accountNumber ?? '', name: b.name })
  }

  const onMode = (m: Mode) => {
    setMode(m)
    setName('')
    if (m !== 'other') setBank('')
    if (m === 'own') setAcct('')
  }

  const submit = () => {
    const own = mode === 'own'
    const who = own ? 'Own account' : name
    const intent: Intent = {
      kind: 'transfer',
      accountId: source,
      creditAccountId: own ? ownDest : undefined,
      title: own ? `Transfer to ${dest!.type}` : `Transfer to ${name}`,
      amount: amt,
      fee,
      desc: own
        ? `TRF TO OWN ACCOUNT ${dest!.number}`
        : mode === 'zenith'
          ? `TRF FRM ${PROFILE.fullName} TO ${name}`
          : `NIP/${bankCode(bank)}/${name}/${note.trim() || 'Transfer'}`,
      creditDesc: `TRF FRM OWN ACCOUNT ${src.number}`,
      rows: [
        ['Beneficiary', who],
        ...(own ? ([['Account', `${dest!.type} - ${dest!.number}`]] as [string, string][]) : ([['Bank', bankName], ['Account number', acct]] as [string, string][])),
        ...(note.trim() ? ([['Description', note.trim()]] as [string, string][]) : []),
      ],
      saveBeneficiary: own ? undefined : { kind: 'bank', name, bank: bankName, accountNumber: acct },
      viaVoice: !!prefill?.viaVoice && known?.accountNumber === acct,
    }
    start(intent)
  }

  return (
    <div className="page">
      <Header title="Transfer" menu />
      <div className="scroll form">
        <SourceAccountField value={source} onChange={(id) => { setSource(id); if (id === ownDest) setOwnDest('') }} />

        <ModeTiles label="Select Registration Modes" options={MODES} value={mode} onChange={onMode} />

        {mode === 'own' && (
          <SelectField label="Select Destination Account" value={dest ? `${dest.type} - ${dest.number}` : undefined} placeholder="Select Account" onOpen={() => setSheet('own')} />
        )}

        {mode === 'other' && <SelectField label="Select Bank" value={bank} placeholder="Select Bank" onOpen={() => setSheet('bank')} />}

        {mode !== 'own' && (
          <>
            <label className="field">
              <span>Enter Destination Account</span>
              <input value={acct} inputMode="numeric" maxLength={10} placeholder="Account Number" onChange={(e) => setAcct(e.target.value.replace(/\D/g, ''))} />
            </label>
            <button type="button" className="inline-link" onClick={() => setSheet('ben')}>Choose Beneficiary</button>
            {looking && <p aria-live="polite" className="resolve">Checking account…</p>}
            {name && !isOwnNumber && acct.length === 10 && <p aria-live="polite" className="resolve ok">{name}</p>}
            {isOwnNumber && acct.length === 10 && <p aria-live="polite" className="resolve bad">That's one of your accounts. Use the Own Account option.</p>}
          </>
        )}

        <label className="field">
          <span>Amount</span>
          <input value={amount} inputMode="decimal" placeholder="Amount" onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))} />
        </label>
        {fee > 0 && <p aria-live="polite" className="resolve">Fee + VAT: {naira(fee)}</p>}
        {short && <p aria-live="polite" className="resolve bad">Insufficient funds</p>}
        {lim.msg && <p aria-live="polite" className="resolve bad" role="status">{lim.msg}</p>}

        <label className="field">
          <span>Transaction Description</span>
          <input value={note} maxLength={40} placeholder="Transaction Description" onChange={(e) => setNote(e.target.value)} />
        </label>

        <button type="button" className="btn solid red upper" disabled={!ready} onClick={submit}>Continue</button>
        <p className="fine">Names are simulated. No real money moves in this demo.</p>
      </div>

      {sheet === 'bank' && <PickerSheet title="Select Bank" searchable options={BANKS.map((b) => ({ value: b, label: b }))} value={bank} onPick={setBank} onClose={() => setSheet(null)} />}
      {sheet === 'own' && <PickerSheet title="Select Destination Account" options={ownOptions} value={ownDest} onPick={setOwnDest} onClose={() => setSheet(null)} />}
      {sheet === 'ben' && <PickerSheet title="Choose Beneficiary" searchable options={benOptions} onPick={pickBeneficiary} onClose={() => setSheet(null)} empty="No saved beneficiaries yet" />}
    </div>
  )
}
