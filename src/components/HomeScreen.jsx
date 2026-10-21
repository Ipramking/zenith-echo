import { useAccount } from '../banking/accountContext'
import { formatNaira } from '../banking/parsers'
import useFocusOnMount from '../a11y/useFocusOnMount'
import SafeButton from './SafeButton'

export default function HomeScreen({ navigate }) {
  const { balance } = useAccount()
  const headingRef = useFocusOnMount()

  return (
    <>
      <header className="topbar">
        <h1 className="brand" ref={headingRef} tabIndex={-1}>
          Zenith <span>Echo</span>
        </h1>
        <SafeButton onPress={() => navigate('settings')}>Accessibility</SafeButton>
      </header>
      <main className="screen">
        <section className="card" aria-labelledby="balance-label">
          <p id="balance-label" className="label">
            Available balance
          </p>
          <p className="amount">{formatNaira(balance)}</p>
        </section>
        <SafeButton className="cta" onPress={() => navigate('transfer')}>
          Send money
        </SafeButton>
      </main>
    </>
  )
}