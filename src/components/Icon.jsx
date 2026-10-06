import {
  Apple, ArrowLeft, ArrowRight, BatteryCharging, Bookmark, BookmarkCheck, Bot, Brain, Briefcase, ChartLine, Check,
  ChevronDown, ChevronRight, CircleCheck, Clock, Code, Coins, Compass, Dumbbell, Film, Flag, GraduationCap, Handshake,
  HeartPulse, Info, Keyboard, Landmark, Languages, LayoutGrid, Lightbulb, Lock, Megaphone, Menu, MessagesSquare, Mic,
  Microscope, Monitor, Moon, NotebookPen, Orbit, PenTool, Play, Repeat, Rocket, RotateCcw, Scale, Search, ShieldCheck,
  Sun, Tag, Target, Timer, Trash2, TrendingUp, User, Wallet, X, Zap,
} from 'lucide-react';

const MAP = {
  apple: Apple, 'arrow-left': ArrowLeft, 'arrow-right': ArrowRight, 'battery-charging': BatteryCharging, bookmark: Bookmark,
  'bookmark-check': BookmarkCheck, bot: Bot, brain: Brain, briefcase: Briefcase, 'chart-line': ChartLine, check: Check,
  'chevron-down': ChevronDown, 'chevron-right': ChevronRight, 'circle-check': CircleCheck, clock: Clock, code: Code, coins: Coins,
  compass: Compass, dumbbell: Dumbbell, film: Film, flag: Flag, 'graduation-cap': GraduationCap, handshake: Handshake,
  'heart-pulse': HeartPulse, info: Info, keyboard: Keyboard, landmark: Landmark, languages: Languages, 'layout-grid': LayoutGrid,
  lightbulb: Lightbulb, lock: Lock, megaphone: Megaphone, menu: Menu, 'messages-square': MessagesSquare, mic: Mic,
  microscope: Microscope, monitor: Monitor, moon: Moon, 'notebook-pen': NotebookPen, orbit: Orbit, 'pen-tool': PenTool, play: Play,
  repeat: Repeat, rocket: Rocket, 'rotate-ccw': RotateCcw, scale: Scale, search: Search, 'shield-check': ShieldCheck, sun: Sun,
  tag: Tag, target: Target, timer: Timer, 'trash-2': Trash2, 'trending-up': TrendingUp, user: User, wallet: Wallet, x: X, zap: Zap,
};

export function Icon({ name, size = 20, className = '' }) {
  const C = MAP[name];
  if (!C) return null;
  return <C size={size} strokeWidth={1.75} className={`ic ${className}`} aria-hidden="true" focusable="false" />;
}
