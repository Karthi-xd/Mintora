import './SplitText.css'

/**
 * Per-character reveal on mount, in the spirit of reactbits.dev's
 * "Text Animations" family (see https://reactbits.dev/text-animations/split-text).
 * Splits into <span> characters and staggers the entrance with CSS only.
 */
export default function SplitText({ text, as: Tag = 'span', className = '', delay = 0 }) {
  const chars = [...text]
  return (
    <Tag className={`split-text ${className}`}>
      {chars.map((ch, i) => (
        <span
          key={i}
          className="split-text__char"
          style={{ animationDelay: `${delay + i * 0.028}s` }}
        >
          {ch === ' ' ? '\u00A0' : ch}
        </span>
      ))}
    </Tag>
  )
}
