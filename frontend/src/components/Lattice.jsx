// Ambient background for the agentic theme: a faint dot-grid with a
// handful of connected "nodes" that drift slowly, plus a soft scanline
// sweep. Pure CSS/SVG, no canvas or deps — cheap and respects
// prefers-reduced-motion (see .lattice__nodes / .lattice__scan rules).

const NODES = [
  { x: 12, y: 18 }, { x: 30, y: 10 }, { x: 55, y: 22 }, { x: 78, y: 14 },
  { x: 20, y: 45 }, { x: 48, y: 52 }, { x: 70, y: 44 }, { x: 90, y: 58 },
  { x: 15, y: 78 }, { x: 42, y: 85 }, { x: 65, y: 76 }, { x: 85, y: 88 }
]

const EDGES = [
  [0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [5, 6], [6, 7],
  [4, 8], [5, 9], [6, 10], [9, 10], [10, 11]
]

export default function Lattice() {
  return (
    <div className="lattice" aria-hidden="true">
      <div className="lattice__grid" />
      <svg className="lattice__nodes" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        {EDGES.map(([a, b], i) => (
          <line
            key={i}
            x1={NODES[a].x} y1={NODES[a].y}
            x2={NODES[b].x} y2={NODES[b].y}
            stroke="rgba(110, 231, 249, 0.12)"
            strokeWidth="0.15"
          />
        ))}
        {NODES.map((n, i) => (
          <circle
            key={i}
            cx={n.x} cy={n.y} r={i % 3 === 0 ? 0.5 : 0.3}
            fill={i % 4 === 0 ? 'rgba(167, 139, 250, 0.4)' : 'rgba(110, 231, 249, 0.35)'}
          />
        ))}
      </svg>
      <div className="lattice__scan" />
    </div>
  )
}