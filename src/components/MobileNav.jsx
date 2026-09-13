import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, Home, ListChecks, Archive, Settings, PiggyBank, Coins } from 'lucide-react'

const menuVariants = {
  hidden: { transition: { staggerChildren: 0.035, staggerDirection: -1 } },
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.9 },
  show: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: 'spring', stiffness: 280, damping: 24, mass: 0.7 },
  },
  exit: {
    opacity: 0, y: 10, scale: 0.92,
    transition: { duration: 0.16, ease: [0.4, 0, 1, 1] },
  },
}

export default function MobileNav({ view, setView, archivedCount, onNewGoal, onAddMoney }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  // Ordered closest-to-farthest from the button: the panel stacks upward
  // (column-reverse), so the first entry here lands nearest the thumb.
  const items = [
    { key: 'dashboard', label: 'Today', icon: Home },
    { key: 'new-goal', label: 'New goal', icon: Plus, onSelect: onNewGoal },
    { key: 'activity', label: 'Activity', icon: ListChecks },
    ...(onAddMoney
      ? [{ key: 'add-money', label: 'Add money', icon: Coins, onSelect: () => onAddMoney() }]
      : []),
    { key: 'savings', label: 'Savings', icon: PiggyBank },
    ...(archivedCount > 0
      ? [{ key: 'archive', label: 'Completed', icon: Archive, meta: archivedCount }]
      : []),
    { key: 'settings', label: 'Settings', icon: Settings },
  ]

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="mobile-fab-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.22, ease: 'easeOut' } }}
            exit={{ opacity: 0, transition: { duration: 0.18, ease: 'easeIn' } }}
            onClick={close}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            className="mobile-fab-menu"
            variants={menuVariants}
            initial="hidden"
            animate="show"
            exit="hidden"
          >
            {items.map(({ key, label, icon: Icon, meta, onSelect }) => (
              <motion.button
                key={key}
                className="mobile-fab-item"
                variants={itemVariants}
                exit="exit"
                aria-current={view.name === key}
                style={{ transformOrigin: 'right bottom' }}
                whileTap={{ scale: 0.94, transition: { duration: 0.1 } }}
                onClick={() => { close(); onSelect ? onSelect() : setView({ name: key }) }}
              >
                <Icon size={17} strokeWidth={2.25} />
                <span>{label}</span>
                {meta != null && <em>{meta}</em>}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        className="mobile-fab-trigger"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        whileTap={{ scale: 0.92, transition: { duration: 0.1 } }}
        onClick={() => setOpen((o) => !o)}
      >
        <motion.span
          className="mobile-fab-icon"
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22, mass: 0.6 }}
        >
          <Plus size={24} strokeWidth={2.25} />
        </motion.span>
      </motion.button>
    </>
  )
}
