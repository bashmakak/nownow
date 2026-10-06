import { Link } from 'react-router-dom';
import { TOPIC_BY, coursesOf, metaLine } from '../data';
import { useStore, status, remaining, toggleBookmark, setTheme, nCourses } from '../lib/store.js';
import { useUI } from '../lib/ui.jsx';
import { Icon } from './Icon.jsx';
import { Mark } from './Brand.jsx';

const STREAKS = [
  [['130,120 300,34 300,52 160,120', 0.45, 'nv-b6'], ['150,120 300,42 300,46 162,120', 1]],
  [['60,120 300,60 300,76 96,120', 0.45, 'nv-b6'], ['84,120 300,67 300,70 98,120', 1]],
  [['180,120 300,10 300,30 204,120', 0.45, 'nv-b6'], ['196,120 300,18 300,22 206,120', 1]],
  [['100,120 300,84 300,98 140,120', 0.45, 'nv-b6'], ['126,120 300,90 300,93 142,120', 1]],
];

/* Обложка курса: световой луч, положение которого зависит от курса */
export function Cover({ course, big = false }) {
  const t = TOPIC_BY[course.topic];
  const v = [...course.slug].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 4;
  return (
    <div className="cover">
      <svg className="cover-fx" viewBox="0 0 300 120" preserveAspectRatio="none" aria-hidden="true">
        {STREAKS[v].map(([p, o, f], i) => <polygon key={i} points={p} fill="url(#nv-gs)" opacity={o} filter={f ? `url(#${f})` : undefined} />)}
      </svg>
      <span className="cover-ic"><Icon name={t.icon} size={big ? 24 : 22} /></span>
      <span className="cover-min">30 МИН</span>
    </div>
  );
}

export function BookmarkButton({ slug, inline = false }) {
  const s = useStore();
  const { toast } = useUI();
  const on = s.bookmarks.includes(slug);
  return (
    <button type="button" className={`bm ${inline ? 'bm-inline' : ''}`} aria-pressed={on}
      aria-label={on ? 'Убрать из закладок' : 'Добавить в закладки'}
      onClick={() => toast(toggleBookmark(slug) ? 'Добавлено в закладки' : 'Убрано из закладок')}>
      <Icon name={on ? 'bookmark-check' : 'bookmark'} size={inline ? 20 : 18} />
    </button>
  );
}

export function ProgressLine({ slug }) {
  const s = useStore();
  const left = remaining(s, slug);
  return (
    <div className="ccard-prog">
      <span className="bar"><i style={{ width: `${Math.round((30 - left) / 30 * 100)}%` }} /></span>
      <span>Осталось {left} мин</span>
    </div>
  );
}

export function CourseCard({ course }) {
  const s = useStore();
  const st = status(s, course.slug);
  return (
    <article className="ccard">
      <Link className="ccard-link" to={`/courses/${course.slug}`}>
        <Cover course={course} />
        <div className="ccard-body">
          <span className="label">{TOPIC_BY[course.topic].title}</span>
          <h3 className="ccard-title">{course.title}</h3>
          <p className="ccard-meta">{metaLine(course)}</p>
          {st === 'progress' && <ProgressLine slug={course.slug} />}
          {st === 'done' && <div><span className="badge"><Icon name="check" size={13} />Пройден</span></div>}
        </div>
      </Link>
      <BookmarkButton slug={course.slug} />
    </article>
  );
}

export function TopicTile({ topic }) {
  return (
    <Link className="tile" to={`/topics/${topic.slug}`}>
      <span className="tile-ic"><Icon name={topic.icon} size={22} /></span>
      <span className="tile-title">{topic.title}</span>
      <span className="tile-hook">{topic.hook}</span>
      <span className="label tile-count">{nCourses(coursesOf(topic.slug).length)}</span>
    </Link>
  );
}

export function KeyCard({ course, locked = false }) {
  if (locked) {
    return (
      <div className="keycard locked">
        <span className="label"><Icon name="lock" size={15} />Ключевое знание</span>
        <h3>{course.key.title}</h3>
        <p>Карточка с тезисами и действием откроется, когда вы пройдёте урок. Она сохранится в кабинете.</p>
      </div>
    );
  }
  return (
    <div className="keycard">
      <span className="label"><Mark size={16} />Ключевое знание</span>
      <h3>{course.key.title}</h3>
      <ul>{course.key.theses.map(x => <li key={x}>{x}</li>)}</ul>
      <p className="act"><small>Что сделать сегодня</small>{course.key.action}</p>
    </div>
  );
}

export function EmptyState({ title, text, children }) {
  return (
    <div className="empty">
      <Mark size={40} fill="currentColor" />
      <h3 className="h4">{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}

export function Crumbs({ items }) {
  return (
    <nav className="crumbs" aria-label="Навигационная цепочка">
      {items.map(([label, to], i) => (
        <span key={label} style={{ display: 'contents' }}>
          {to ? <Link to={to}>{label}</Link> : <span aria-current="page">{label}</span>}
          {i < items.length - 1 && <Icon name="chevron-right" size={14} />}
        </span>
      ))}
    </nav>
  );
}

export function ThemeControl() {
  const s = useStore();
  const opts = [['dark', 'Тёмная', 'moon'], ['light', 'Светлая', 'sun'], ['system', 'Системная', 'monitor']];
  return (
    <div className="seg-ctl" role="radiogroup" aria-label="Тема оформления">
      {opts.map(([v, label, ic]) => (
        <button key={v} type="button" role="radio" aria-checked={s.theme === v} onClick={() => setTheme(v)}>
          <Icon name={ic} size={15} />{label}
        </button>
      ))}
    </div>
  );
}
