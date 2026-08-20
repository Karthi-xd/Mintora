import './Aurora.css'

/**
 * Ambient backdrop built from layered conic/radial gradients that mimic
 * guilloché engraving — the fine rosette pattern stamped into currency
 * and coins as an anti-counterfeit measure. Slow counter-rotating layers
 * give it a faint machine-turned shimmer instead of a generic blurred blob.
 */
export default function Aurora() {
  return (
    <div className="field-backdrop" aria-hidden="true">
      <svg width="0" height="0">
        <filter id="fb-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>
      <div className="field-backdrop__rosette field-backdrop__rosette--a" />
      <div className="field-backdrop__rosette field-backdrop__rosette--b" />
      <div className="field-backdrop__grain" style={{ filter: 'url(#fb-grain)' }} />
      <div className="field-backdrop__vignette" />
    </div>
  )
}