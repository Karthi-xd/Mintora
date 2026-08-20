import './Aurora.css'

/**
 * Ambient drifting gradient backdrop, in the spirit of reactbits.dev's
 * "Backgrounds" family (see https://reactbits.dev/backgrounds/aurora).
 * Pure CSS + SVG filter, no canvas/WebGL — cheap enough to sit behind an
 * entire page without hurting scroll performance.
 */
export default function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <svg width="0" height="0">
        <filter id="aurora-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>
      <div className="aurora__blob aurora__blob--gold" />
      <div className="aurora__blob aurora__blob--violet" />
      <div className="aurora__blob aurora__blob--ember" />
      <div className="aurora__grain" style={{ filter: 'url(#aurora-grain)' }} />
      <div className="aurora__vignette" />
    </div>
  )
}
