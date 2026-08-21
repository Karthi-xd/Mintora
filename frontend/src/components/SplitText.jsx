/**
 * Thin text wrapper so headline styling (the shimmer/glow sweep) lives
 * entirely in CSS via whatever className is passed in — e.g. "glow-text"
 * in index.css. Same API as before (text/as/className/delay).
 */
export default function SplitText({ text, as: Tag = 'span', className = '', delay = 0 }) {
  return (
    <Tag className={className} style={{ animationDelay: `${delay}s` }}>
      {text}
    </Tag>
  )
}