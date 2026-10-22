/** Original Z mark + wordmark drawn for this prototype (not the bank's logo file). */
export function ZMark({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 100 80" fill="currentColor" aria-hidden="true">
      <path d="M26 2h72l-5 15H21zM8 63h72l-5 15H3zM62 17h31L39 63H8z" />
    </svg>
  )
}

export function Logo({ size = 64 }: { size?: number }) {
  return (
    <div className="logo" style={{ fontSize: size * 0.3 }}>
      <ZMark size={size} />
      <span className="logo-word">ZENITH</span>
      <span className="logo-echo">echo</span>
    </div>
  )
}
