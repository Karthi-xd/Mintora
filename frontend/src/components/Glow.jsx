// Ambient background: two or three large, softly blurred color orbs
// drifting slowly behind the UI, dark base beneath. No grid, no
// scanline — a quieter, more premium "AI product" atmosphere.
// Pure CSS, respects prefers-reduced-motion (see .glow__orb rule).

export default function Glow() {
  return (
    <div className="glow" aria-hidden="true">
      <div className="glow__orb glow__orb--cyan" />
      <div className="glow__orb glow__orb--violet" />
      <div className="glow__orb glow__orb--dim" />
      <div className="glow__grain" />
    </div>
  )
}