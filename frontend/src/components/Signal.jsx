// Flat, graphic background: a single large rotated square outline (like
// a stamp or seal) sitting off-canvas behind the content, plus grain.
// No grid lines, no scanline sweep, no soft glow — a static poster-style
// backdrop instead.

export default function Signal() {
  return (
    <div className="signal" aria-hidden="true">
      <svg className="signal__shape" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <rect x="15" y="15" width="70" height="70" transform="rotate(8 50 50)" />
      </svg>
      <div className="signal__grain" />
    </div>
  )
}