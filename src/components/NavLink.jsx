import { viewToPath } from '../lib/useRoutedView.js'

/* A nav item that is a real link.

   These were <button>s, which meant cmd-click, middle-click and "open in new
   tab" all did nothing — reasonable when there were no URLs, wrong now that
   there are. The href is what makes those work; the onClick is what keeps
   in-app navigation from reloading the page.

   The modifier check is the whole trick: when the user is asking the browser to
   do something with the link (new tab, new window, download), we let the real
   href handle it rather than intercepting. Middle-click needs no handling at
   all — it fires auxclick, not click. */
export default function NavLink({ to, navigate, children, ...rest }) {
  const onClick = (e) => {
    if (e.defaultPrevented) return
    if (e.button !== 0) return // not a primary click
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return // let the browser have it
    e.preventDefault()
    navigate(to)
  }

  return (
    <a href={viewToPath(to)} onClick={onClick} {...rest}>
      {children}
    </a>
  )
}
