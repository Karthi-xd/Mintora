import './SplitText.css'

/**
 * Renders headline text with a molten gradient fill (ember → magenta → cyan)
 * that sweeps across on mount, as if the letters were just poured. Same API
 * as before (text/as/delay) so it drops in without touching App.jsx's usage.
 */
export default function SplitText({ text, as: Tag = 'span', className = '', delay = 0 }) {
  return (
    <Tag className={`molten-text ${className}`} style={{ animationDelay: `${delay}s` }}>
      {text}
    </Tag>
  )
}