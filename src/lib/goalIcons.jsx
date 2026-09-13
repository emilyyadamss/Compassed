/* Icon set goals are tagged with — replaces the old free-form emoji picker.
   Ids are stored on `goal.emoji` (field name kept to avoid a data migration
   beyond the value itself; see LEGACY_EMOJI_TO_ICON below). */
import {
  Target, BookOpen, Laptop, MessageCircle, Guitar, Footprints, Flower2, PenLine,
  Palette, FlaskConical, Dumbbell, ChefHat, Camera, Sprout, Brain, Moon, Piano,
  TrendingUp, FolderOpen, Flame, Keyboard, Car,
  PiggyBank, House, Plane, Gift, Gem, Bike, Smartphone, Sofa, GraduationCap,
  Headphones, Gamepad2, Ticket, Dog, Baby, Tent, Watch,
} from 'lucide-react'

/* The curated set offered in the goal editor's icon picker. */
export const ICON_CHOICES = [
  'target', 'book', 'laptop', 'message', 'guitar', 'run', 'meditate', 'write', 'art', 'science',
  'strength', 'cook', 'camera', 'sprout', 'brain', 'sleep', 'piano', 'progress', 'organize', 'flame',
]

/* ---------------------------------------------------------------- savings */

/* Savings pots get their own picker: what you are saving up for is a thing,
   not a practice, so the useful icons are objects and trips rather than the
   verbs above. Ids share one registry with the goal icons, so `GoalIcon`
   renders either set and nothing has to know which picker a value came from. */
export const SAVINGS_ICON_CHOICES = [
  'piggy-bank', 'car', 'laptop', 'house', 'plane', 'gift', 'gem', 'bike',
  'phone', 'sofa', 'study', 'camera', 'guitar', 'headphones', 'console',
  'ticket', 'dog', 'baby', 'tent', 'watch',
]

const SAVINGS_ICONS = {
  'piggy-bank': PiggyBank,
  house: House,
  plane: Plane,
  gift: Gift,
  gem: Gem,
  bike: Bike,
  phone: Smartphone,
  sofa: Sofa,
  study: GraduationCap,
  headphones: Headphones,
  console: Gamepad2,
  ticket: Ticket,
  dog: Dog,
  baby: Baby,
  tent: Tent,
  watch: Watch,
}

/** Normalise a stored savings icon, falling back to the piggy bank. */
export function normaliseSavingsIconId(value) {
  return GOAL_ICONS[value] ? value : SAVINGS_ICON_CHOICES[0]
}

/* A couple of extra ids outside the picker, kept only so older sample/backup
   data (keyboard, car) still resolves to something sensible. */
export const GOAL_ICONS = {
  target: Target,
  book: BookOpen,
  laptop: Laptop,
  message: MessageCircle,
  guitar: Guitar,
  run: Footprints,
  meditate: Flower2,
  write: PenLine,
  art: Palette,
  science: FlaskConical,
  strength: Dumbbell,
  cook: ChefHat,
  camera: Camera,
  sprout: Sprout,
  brain: Brain,
  sleep: Moon,
  piano: Piano,
  progress: TrendingUp,
  organize: FolderOpen,
  flame: Flame,
  keyboard: Keyboard,
  car: Car,
  ...SAVINGS_ICONS,
}

/* Goals saved before icons replaced emoji still carry a literal emoji
   character in `emoji` — map those onto the closest icon id so old saves
   and backups keep rendering correctly. */
export const LEGACY_EMOJI_TO_ICON = {
  '🎯': 'target', '📚': 'book', '💻': 'laptop', '🗣️': 'message', '🎸': 'guitar',
  '🏃': 'run', '🧘': 'meditate', '✍️': 'write', '🎨': 'art', '🧪': 'science',
  '💪': 'strength', '🍳': 'cook', '📷': 'camera', '🌱': 'sprout', '🧠': 'brain',
  '💤': 'sleep', '🎹': 'piano', '📈': 'progress', '🗂️': 'organize', '🕯️': 'flame',
  '⌨️': 'keyboard', '🚗': 'car',
}

/** Normalise any stored value (new icon id, legacy emoji, or unrecognised) to a valid icon id. */
export function normaliseIconId(value) {
  if (GOAL_ICONS[value]) return value
  if (LEGACY_EMOJI_TO_ICON[value]) return LEGACY_EMOJI_TO_ICON[value]
  return ICON_CHOICES[0]
}

export function GoalIcon({ id, size = 18, ...rest }) {
  const Icon = GOAL_ICONS[id] || Target
  return <Icon size={size} aria-hidden="true" {...rest} />
}
