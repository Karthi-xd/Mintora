// Flat, restrained background: a faint dot grid on black, grain, and a
// single thin scanline sweep in the accent color. No gradients, no
// glow blobs — deliberately structural rather than soft/atmospheric.

export default function Signal() {
  return (
    <div className="signal" aria-hidden="true">
      <div className="signal__grid" />
      <div className="signal__scan" />
      <div className="signal__grain" />
    </div>
  )
}