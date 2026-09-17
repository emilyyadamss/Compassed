/* URL routing, without a router library.

   The app already had a perfectly good description of where you are — the
   `{ name, goalId, potId }` view object — it just lived in a useState and never
   reached the address bar. This hook keeps that exact shape and syncs it to the
   History API, so every existing `setView(...)` call site keeps working while
   goals become linkable, Back works, and a refresh keeps your place.

   `parsePath` and `viewToPath` are pure and take no window access on purpose:
   they are the whole routing contract, they are unit tested, and keeping them
   free of globals is what would make a later swap to react-router mechanical.

   One rule matters more than the rest: THIS HOOK NEVER WRITES TO HISTORY ON
   MOUNT. It reads location and writes only when the user actually navigates.
   A URL the user arrived on is theirs: an unknown path stays in the address
   bar rather than being tidied to '/', and a signed-out deep link survives
   sign-in because nothing rewrites it in the meantime.

   It also keeps this hook out of the auth handoff. Email links arrive with
   tokens in the hash, and supabaseClient.js removes them at import time,
   before React has rendered anything — so by the time this hook first reads
   location the hash is already gone. Everything to do with that URL belongs
   there, not here. */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Path → view object. Unknown paths become `notfound` rather than silently
    redirecting home, which would hide typos and read as a bug. */
export function parsePath(pathname) {
  const seg = String(pathname || '/').split('/').filter(Boolean)

  if (seg.length === 0) return { name: 'dashboard' }

  if (seg.length === 1) {
    switch (seg[0]) {
      case 'activity': return { name: 'activity' }
      case 'savings': return { name: 'savings' }
      case 'archive': return { name: 'archive' }
      case 'settings': return { name: 'settings' }
      case 'signin': return { name: 'signin' }
      case 'signup': return { name: 'signup' }
      default: return { name: 'notfound' }
    }
  }

  if (seg.length === 2) {
    const id = decode(seg[1])
    if (!id) return { name: 'notfound' }
    if (seg[0] === 'goal') return { name: 'goal', goalId: id }
    if (seg[0] === 'pot') return { name: 'pot', potId: id }
  }

  return { name: 'notfound' }
}

/** View object → path. The inverse of parsePath for every routable view. */
export function viewToPath(view) {
  switch (view?.name) {
    case 'activity': return '/activity'
    case 'savings': return '/savings'
    case 'archive': return '/archive'
    case 'settings': return '/settings'
    case 'signin': return '/signin'
    case 'signup': return '/signup'
    case 'goal': return view.goalId ? `/goal/${encodeURIComponent(view.goalId)}` : '/'
    case 'pot': return view.potId ? `/pot/${encodeURIComponent(view.potId)}` : '/'
    case 'notfound': return '/notfound'
    default: return '/'
  }
}

function decode(raw) {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw // a malformed escape is still a usable (if wrong) id
  }
}

/* Scroll positions per history entry. <main> is remounted on every view change
   (it is keyed), so nothing restores scroll on its own once Back exists. */
const scrollByKey = new Map()
let keySeq = 0

export function useRoutedView() {
  const [view, setView] = useState(() => parsePath(window.location.pathname))
  // The initial history entry has no key of its own — writing one would mean a
  // mount-time replaceState, which is exactly what we must not do. Key 0 stands
  // in for it, and history.state?.k covers every entry we push ourselves.
  const currentKey = useRef(0)
  const pendingScroll = useRef(null)

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  useEffect(() => {
    const onPop = () => {
      // Manual restoration means the browser has not moved us yet, so the
      // current scroll still belongs to the entry we are leaving.
      scrollByKey.set(currentKey.current, window.scrollY)
      const key = window.history.state?.k ?? 0
      currentKey.current = key
      pendingScroll.current = scrollByKey.get(key) ?? 0
      setView(parsePath(window.location.pathname))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Applied after the new view has rendered, so the page is tall enough to
  // scroll to where it was.
  useLayoutEffect(() => {
    if (pendingScroll.current == null) return
    window.scrollTo(0, pendingScroll.current)
    pendingScroll.current = null
  }, [view])

  /* Navigate. `replace` is for view changes that are a side effect of a
     mutation rather than a place the user chose to go — deleting a goal, say.
     Pushing those means Back returns to a goal that no longer exists, which
     reads as a crash. Always called from an event handler, never an effect:
     StrictMode double-invokes effects in development and would push twice. */
  const navigate = useCallback((next, { replace = false, state } = {}) => {
    const path = viewToPath(next)
    if (replace) {
      const entry = { ...window.history.state, ...state, k: currentKey.current }
      window.history.replaceState(entry, '', path)
    } else {
      scrollByKey.set(currentKey.current, window.scrollY)
      const key = ++keySeq
      currentKey.current = key
      window.history.pushState({ ...state, k: key }, '', path)
      pendingScroll.current = 0 // a new place starts at the top
    }
    setView(next)
  }, [])

  return [view, navigate]
}
