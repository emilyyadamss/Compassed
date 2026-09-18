import { useCallback, useSyncExternalStore } from 'react'

/**
 * Tracks a CSS media query from JS, so a component can be left unmounted
 * entirely rather than mounted and hidden with `display: none`. Hiding still
 * costs the download; not mounting does not.
 *
 * Returns false where matchMedia is missing (jsdom, very old browsers). That is
 * the safe answer for the one caller: the mobile nav is a second way to reach
 * pages the sidebar already lists.
 */
export default function useMediaQuery(query) {
  const supported = typeof window !== 'undefined' && !!window.matchMedia

  const subscribe = useCallback(
    (onChange) => {
      if (!supported) return () => {}
      const list = window.matchMedia(query)
      // addListener is the pre-Safari-14 spelling, still worth the two lines.
      if (list.addEventListener) {
        list.addEventListener('change', onChange)
        return () => list.removeEventListener('change', onChange)
      }
      list.addListener(onChange)
      return () => list.removeListener(onChange)
    },
    [query, supported],
  )

  const getSnapshot = useCallback(
    () => (supported ? window.matchMedia(query).matches : false),
    [query, supported],
  )

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
