import {
  Apple, ArrowDown, Calculator, CircleDot, Delete, Grid3x3, Hash, Palette, ArrowLeft, ArrowRight, ArrowUp, Award, BadgeCheck, BatteryCharging, Blocks, BookOpen, Bookmark,
  BookmarkCheck, Bot, Brain, Briefcase, CalendarCheck, ChartLine, Check, ChevronDown, ChevronRight, CircleCheck,
  Clock, Code, Coins, Compass, Crown, Dumbbell, Eye, EyeOff, Film, Flag, Flame, Gamepad2, Gauge, GraduationCap,
  Handshake, HeartPulse, History, Info, Keyboard, Landmark, Languages, Layers, LayoutGrid, Lightbulb, ListOrdered,
  Lock, Medal, Megaphone, Menu, MessagesSquare, Mic, Microscope, Monitor, Moon, MousePointerClick, NotebookPen,
  Orbit, PenLine, PenTool, Play, Plus, Repeat, Rocket, RotateCcw, Route, Scale, ScanSearch, Search, Send,
  ShieldAlert, ShieldCheck, SlidersHorizontal, Sparkles, Sun, Tag, Target, TextCursorInput, Thermometer, Timer,
  Trash2, TrendingUp, Trophy, Undo2, User, Wallet, WandSparkles, X, Zap,
} from 'lucide-react';

const MAP = {
  calculator: Calculator, 'circle-dot': CircleDot, delete: Delete, 'grid-3x3': Grid3x3, hash: Hash, palette: Palette,
  apple: Apple, 'arrow-down': ArrowDown, 'arrow-left': ArrowLeft, 'arrow-right': ArrowRight, 'arrow-up': ArrowUp,
  award: Award, 'badge-check': BadgeCheck, 'battery-charging': BatteryCharging, blocks: Blocks,
  'book-open': BookOpen, bookmark: Bookmark, 'bookmark-check': BookmarkCheck, bot: Bot, brain: Brain,
  briefcase: Briefcase, 'calendar-check': CalendarCheck, 'chart-line': ChartLine, check: Check,
  'chevron-down': ChevronDown, 'chevron-right': ChevronRight, 'circle-check': CircleCheck, clock: Clock, code: Code,
  coins: Coins, compass: Compass, crown: Crown, dumbbell: Dumbbell, eye: Eye, 'eye-off': EyeOff, film: Film,
  flag: Flag, flame: Flame, 'gamepad-2': Gamepad2, gauge: Gauge, 'graduation-cap': GraduationCap,
  handshake: Handshake, 'heart-pulse': HeartPulse, history: History, info: Info, keyboard: Keyboard,
  landmark: Landmark, languages: Languages, layers: Layers, 'layout-grid': LayoutGrid, lightbulb: Lightbulb,
  'list-ordered': ListOrdered, lock: Lock, medal: Medal, megaphone: Megaphone, menu: Menu,
  'messages-square': MessagesSquare, mic: Mic, microscope: Microscope, monitor: Monitor, moon: Moon,
  'mouse-pointer-click': MousePointerClick, 'notebook-pen': NotebookPen, orbit: Orbit, 'pen-line': PenLine,
  'pen-tool': PenTool, play: Play, plus: Plus, repeat: Repeat, rocket: Rocket, 'rotate-ccw': RotateCcw, route: Route,
  scale: Scale, 'scan-search': ScanSearch, search: Search, send: Send, 'shield-alert': ShieldAlert,
  'shield-check': ShieldCheck, 'sliders-horizontal': SlidersHorizontal, sparkles: Sparkles, sun: Sun, tag: Tag,
  target: Target, 'text-cursor-input': TextCursorInput, thermometer: Thermometer, timer: Timer, 'trash-2': Trash2,
  'trending-up': TrendingUp, trophy: Trophy, 'undo-2': Undo2, user: User, wallet: Wallet,
  'wand-sparkles': WandSparkles, x: X, zap: Zap,
};

export function Icon({ name, size = 20, className = '' }) {
  const C = MAP[name];
  if (!C) return null;
  return <C size={size} strokeWidth={1.75} className={`ic ${className}`} aria-hidden="true" focusable="false" />;
}
