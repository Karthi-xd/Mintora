import { useEffect, useRef } from 'react'
import './Aurora.css'

/**
 * Immersive backdrop for the forge: a slowly drifting mesh of nodes and
 * connective threads (the chain), rendered on canvas, sitting behind a
 * layered plasma "forge core" glow built from CSS gradients. Nodes near
 * the cursor brighten and pull their links taut, so the mesh feels alive
 * without stealing focus from the mint card.
 */
export default function Aurora() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf = 0
    let width = 0
    let height = 0
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pointer = { x: -9999, y: -9999 }

    const NODE_COUNT = 64
    const LINK_DIST = 150
    const nodes = []

    function resize() {
      width = window.innerWidth
      height = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function seed() {
      nodes.length = 0
      for (let i = 0; i < NODE_COUNT; i++) {
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.18,
          vy: (Math.random() - 0.5) * 0.18,
          r: Math.random() * 1.4 + 0.6
        })
      }
    }

    function step() {
      ctx.clearRect(0, 0, width, height)

      for (const n of nodes) {
        n.x += n.vx
        n.y += n.vy
        if (n.x < 0 || n.x > width) n.vx *= -1
        if (n.y < 0 || n.y > height) n.vy *= -1
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]
          const b = nodes[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.hypot(dx, dy)
          if (dist < LINK_DIST) {
            const alpha = (1 - dist / LINK_DIST) * 0.16
            ctx.strokeStyle = `rgba(180, 200, 255, ${alpha})`
            ctx.lineWidth = 0.6
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }

      for (const n of nodes) {
        const dx = n.x - pointer.x
        const dy = n.y - pointer.y
        const near = Math.hypot(dx, dy) < 180
        ctx.beginPath()
        ctx.fillStyle = near ? 'rgba(255, 170, 130, 0.85)' : 'rgba(210, 220, 255, 0.45)'
        ctx.arc(n.x, n.y, near ? n.r * 2.2 : n.r, 0, Math.PI * 2)
        ctx.fill()
      }

      raf = requestAnimationFrame(step)
    }

    function onMove(e) {
      pointer.x = e.clientX
      pointer.y = e.clientY
    }
    function onLeave() {
      pointer.x = -9999
      pointer.y = -9999
    }

    resize()
    seed()
    raf = requestAnimationFrame(step)

    window.addEventListener('resize', () => {
      resize()
      seed()
    })
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerleave', onLeave)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <div className="forge-backdrop" aria-hidden="true">
      <div className="forge-backdrop__core" />
      <div className="forge-backdrop__core forge-backdrop__core--b" />
      <canvas ref={canvasRef} className="forge-backdrop__mesh" />
      <div className="forge-backdrop__grain" />
      <div className="forge-backdrop__vignette" />
    </div>
  )
}