import './SplitText.css'

/**
 * Renders text as if it were engraved into metal and catching a single
 * pass of light: a soft bevel via layered text-shadow, plus one slow
 * diagonal highlight sweep on mount. Same API as before (text/as/delay)
 * so it drops in without touching App.jsx's usage.
 */
export default function SplitText({ text, as: Tag = 'span', className = '', delay = 0 }) {
  return (
    <Tag className={`engrave ${className}`} style={{ animationDelay: `${delay}s` }}>
      {text}
    </Tag>
  )
}