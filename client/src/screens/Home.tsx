import { Globe, GraduationCap, Inbox as InboxIcon, Landmark, Lightbulb, Receipt, Repeat2, Search, ShieldCheck, Smartphone, Tv, UserRound, UserRoundPlus, Wifi, type LucideIcon } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { PickerSheet } from '../components/Fields'
import { EchoLastReply } from '../components/EchoUi'
import { Header, HistoryRow, KebabButton, Money, Sheet, Toggle, TxnRow } from '../components/Parts'
import { BANKS, INBOX, lookupAccountName, PROFILE, ZENITH } from '../lib/data'
import { greeting, initials, MASK, naira } from '../lib/format'
import type { Account } from '../lib/types'
import { useFlow } from '../state/flow'
import { useNav } from '../state/nav'
import { receiptFor, useStore } from '../state/store'

function AccountCard({ a }: { a: Account }) {
  const { hideBalance, setHideBalance } = useStore()
  const { openAccount } = useNav()
  return (
    <section className="card-red slide" onClick={() => openAccount(a.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openAccount(a.id)}>
      <div className="cr-top">
        <span>{PROFILE.fullName}</span>
        <span className="active"><i /> Active</span>
      </div>
      <p className="cr-label center">{a.type.toUpperCase()}</p>
      <p className="cr-balance center">{hideBalance ? MASK : naira(a.balance)}</p>
      <div className="cr-bottom" onClick={(e) => e.stopPropagation()}>
        <span className="pill">{a.number}</span>
        <label className="hide-row">
          Hide Balance <Toggle on={hideBalance} onChange={setHideBalance} label="Hide balance" />
        </label>
      </div>
    </section>
  )
}

function AccountCarousel() {
  const { accounts } = useStore()
  const rail = useRef<HTMLDivElement>(null)
  const [idx, setIdx] = useState(0)
  const onScroll = () => {
    const el = rail.current
    if (el) setIdx(Math.round(el.scrollLeft / (el.clientWidth + 12)))
  }
  const go = (i: number) => rail.current?.scrollTo({ left: i * (rail.current.clientWidth + 12), behavior: 'smooth' })
  return (
    <div className="carousel">
      <div className="rail" ref={rail} onScroll={onScroll}>
        {accounts.map((a) => (
          <AccountCard key={a.id} a={a} />
        ))}
      </div>
      <div className="pager" role="tablist" aria-label="Accounts">
        {accounts.map((a, i) => (
          <button key={a.id} type="button" role="tab" aria-selected={i === idx} aria-label={a.type} className={i === idx ? 'on' : ''} onClick={() => go(i)} />
        ))}
      </div>
    </div>
  )
}

export function Home() {
  const { total, txns, accounts, hideBalance, setHideBalance, beneficiaries, addBeneficiary } = useStore()
  const { openAccount, openInbox, setDrawer, startTransfer, openRecharge, openBill, toast } = useNav()
  const { openReceipt } = useFlow()
  const [adding, setAdding] = useState(false)

  const links: { label: string; Icon: LucideIcon; run: () => void }[] = [
    { label: 'Transfer', Icon: Repeat2, run: () => startTransfer() },
    { label: 'Airtime', Icon: Smartphone, run: () => openRecharge('airtime') },
    { label: 'Data', Icon: Wifi, run: () => openRecharge('data') },
    { label: 'Electricity', Icon: Lightbulb, run: () => openBill('electricity') },
    { label: 'Cable TV', Icon: Tv, run: () => openBill('cable') },
    { label: 'Internet', Icon: Globe, run: () => openBill('internet') },
    { label: 'Education', Icon: GraduationCap, run: () => openBill('education') },
    { label: 'Insurance', Icon: ShieldCheck, run: () => openBill('insurance') },
  ]
  const favourites = beneficiaries.filter((b) => b.kind === 'bank')

  return (
    <div className="page">
      <Header
        big
        title={`${greeting()}, ${PROFILE.firstName}`}
        right={
          <>
            <button type="button" className="icon-btn" onClick={openInbox} aria-label="Inbox">
              <InboxIcon size={24} />
            </button>
            <button type="button" className="avatar" onClick={() => setDrawer(true)} aria-label="Open menu">
              {initials(PROFILE.fullName)}
            </button>
          </>
        }
      />
      <div className="scroll">
        <EchoLastReply />

        <section className="card-grey">
          <div className="cg-top">
            <span>Total Balance</span>
            <span className="cg-count">{accounts.length} accounts</span>
          </div>
          <div className="cg-bottom">
            <b>{hideBalance ? MASK : naira(total)}</b>
            <label className="hide-row">
              Hide Balance <Toggle on={hideBalance} onChange={setHideBalance} label="Hide total balance" />
            </label>
          </div>
        </section>

        <AccountCarousel />

        <section className="panel">
          <div className="panel-head"><h2>Quick Links</h2></div>
          <ul className="links">
            {links.map(({ label, Icon, run }) => (
              <li key={label}>
                <button type="button" onClick={run}>
                  <Icon size={26} strokeWidth={1.5} />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Recent Transactions</h2>
            <button type="button" className="red-link" onClick={() => openAccount('sav')}>Transaction History</button>
          </div>
          <ul className="txn-list">
            {txns.slice(0, 3).map((t) => (
              <TxnRow key={t.id} t={t} onOpen={() => openReceipt(receiptFor(t, accounts))} />
            ))}
          </ul>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>My Favourites</h2>
            <button type="button" className="red-link" onClick={() => setAdding(true)}>Add Favourites</button>
          </div>
          {favourites.length === 0 ? (
            <div className="empty">
              <UserRoundPlus size={36} strokeWidth={1.4} />
              <p>You have no favourites yet</p>
            </div>
          ) : (
            <ul className="fav-list">
              {favourites.map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => startTransfer({ name: f.name, bank: f.bank ?? ZENITH, accountNumber: f.accountNumber ?? '' })}>
                    <span className="avatar sm">{initials(f.name)}</span>
                    <span>{f.name.split(' ')[0]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {adding && (
        <AddFavourite
          onClose={() => setAdding(false)}
          onSave={(b) => {
            toast(addBeneficiary(b) ? 'Added to favourites' : 'Already in your favourites')
            setAdding(false)
          }}
        />
      )}
    </div>
  )
}

function AddFavourite({ onClose, onSave }: { onClose: () => void; onSave: (b: { kind: 'bank'; name: string; bank: string; accountNumber: string }) => void }) {
  const [bank, setBank] = useState(ZENITH)
  const [acct, setAcct] = useState('')
  const [picking, setPicking] = useState(false)
  const name = acct.length === 10 ? lookupAccountName(acct) : ''
  return (
    <Sheet title="Add favourite" onClose={onClose}>
      <div className="field">
        <span>Bank</span>
        <button type="button" className="select" onClick={() => setPicking(true)}>
          <span>{bank}</span>
        </button>
      </div>
      <label className="field">
        <span>Account number</span>
        <input value={acct} inputMode="numeric" maxLength={10} placeholder="10 digits" onChange={(e) => setAcct(e.target.value.replace(/\D/g, ''))} />
      </label>
      {name && <p aria-live="polite" className="resolve ok">{name}</p>}
      <button type="button" className="btn solid red upper" disabled={!name} onClick={() => onSave({ kind: 'bank', name, bank, accountNumber: acct })}>
        Save favourite
      </button>
      {picking && <PickerSheet title="Select Bank" searchable value={bank} onPick={setBank} onClose={() => setPicking(false)} options={[ZENITH, ...BANKS].map((b) => ({ value: b, label: b }))} />}
    </Sheet>
  )
}

type Dir = 'all' | 'credit' | 'debit'
type Range = 'all' | '1' | '7' | '30'

/** Account detail + transaction history: card, quick actions, filters and expandable rows. */
export function Account({ accountId }: { accountId: string }) {
  const { accounts, txns } = useStore()
  const { closePage, setTab, startTransfer, toast } = useNav()
  const { openReceipt } = useFlow()
  const [id, setId] = useState(accountId)
  const [q, setQ] = useState('')
  const [searching, setSearching] = useState(false)
  const [dir, setDir] = useState<Dir>('all')
  const [range, setRange] = useState<Range>('all')

  const acct = accounts.find((a) => a.id === id)!
  const pos = accounts.findIndex((a) => a.id === id) + 1

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const cutoff = range === 'all' ? 0 : Date.now() - Number(range) * 86_400_000
    return txns.filter(
      (t) =>
        t.accountId === id &&
        (dir === 'all' || (dir === 'credit') === t.amount > 0) &&
        new Date(t.at).getTime() >= cutoff &&
        (!needle || t.desc.toLowerCase().includes(needle)),
    )
  }, [txns, id, q, dir, range])

  return (
    <div className="page">
      <Header title="Transaction History" back={closePage} right={<KebabButton onClick={() => toast('Account options are not available in this demo')} />} />
      <div className="scroll">
        <div className="acct-tabs" role="tablist" aria-label="Accounts">
          {accounts.map((a) => (
            <button key={a.id} type="button" role="tab" aria-selected={a.id === id} className={a.id === id ? 'on' : ''} onClick={() => setId(a.id)}>
              {a.type.replace(' Account', '')}
            </button>
          ))}
        </div>

        <section className="card-red detail">
          <div className="cr-top">
            <span>{acct.type} - <b>{acct.number}</b></span>
            <span className="cr-count">{pos} of {accounts.length}</span>
          </div>
          <p className="cr-name">{PROFILE.fullName}</p>
          <p className="cr-label">Account Balance:</p>
          <p className="cr-balance"><Money value={acct.balance} /></p>
          <p className="cr-ledger">Ledger Balance: <Money value={acct.balance} /></p>
        </section>

        <div className="actions">
          <button type="button" onClick={() => startTransfer()}><Landmark size={24} strokeWidth={1.6} />Transfer</button>
          <button type="button" onClick={() => setTab('bills')}><Receipt size={24} strokeWidth={1.6} />Bills</button>
          <button type="button" onClick={() => toast('Manage Account is not available in this demo')}><UserRound size={24} strokeWidth={1.6} />Manage Account</button>
        </div>

        <div className="filters">
          <label>
            <span className="sr">Transaction type</span>
            <select value={dir} onChange={(e) => setDir(e.target.value as Dir)}>
              <option value="all">All transactions</option>
              <option value="credit">Credits</option>
              <option value="debit">Debits</option>
            </select>
          </label>
          <label>
            <span className="sr">Date range</span>
            <select value={range} onChange={(e) => setRange(e.target.value as Range)}>
              <option value="all">Select Range</option>
              <option value="1">Last 24 hours</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </label>
          <button type="button" className={'icon-btn dark' + (searching ? ' lit' : '')} onClick={() => { setSearching((s) => !s); setQ('') }} aria-label="Search transactions"><Search size={22} /></button>
        </div>
        {searching && <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search description" aria-label="Search transactions" autoFocus />}

        <ul className="hist-list">
          {rows.map((t) => (
            <HistoryRow key={t.id} t={t} onReceipt={() => openReceipt(receiptFor(t, accounts))} />
          ))}
          {rows.length === 0 && <li className="empty"><p>No transactions match</p></li>}
        </ul>
      </div>
    </div>
  )
}

export function Inbox() {
  const { closePage } = useNav()
  return (
    <div className="page">
      <Header title="Messages" back={closePage} />
      <div className="scroll">
        <ul className="inbox">
          {INBOX.map((m) => (
            <li key={m.id}>
              <div><b>{m.title}</b><small>{m.ago}</small></div>
              <p>{m.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
