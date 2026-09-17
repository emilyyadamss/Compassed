import { useEffect, useRef } from 'react'

export default function Modal({ title, onClose, children, footer, width }) {
  const panel = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      if (e.key === 'Tab' && panel.current) {
        const focusables = panel.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    const prev = document.activeElement
    // focus the first meaningful control, not the close button
    requestAnimationFrame(() => {
      const target = panel.current?.querySelector('input, textarea, select')
      target?.focus()
    })
    return () => {
      document.removeEventListener('keydown', onKey)
      if (prev instanceof HTMLElement) prev.focus()
    }
  }, [onClose])

  return (
    // Click-outside-to-close is a convenience on top of Esc and the close
    // button, so the backdrop needs no role of its own.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        className="modal"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={width ? { width: `min(${width}px, 100%)` } : undefined}
      >
        <div className="modal-head">
          <h2 className="modal-title">{title}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}
