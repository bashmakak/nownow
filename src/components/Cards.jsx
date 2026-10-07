import { Link } from 'react-router-dom';
import { FORMAT, LEVEL, TOPIC_BY, VERSION, about, coursesOf, metaLine, minutes, timing } from '../data';
import { useStore, status, activeVersion, remainingSec, leftLabel, toggleBookmark, setTheme, nCourses } from '../lib/store.js';
import { useUI } from '../lib/ui.jsx';
import { Icon } from './Icon.jsx';
import { Mark } from './Brand.jsx';

/* Линия, по которой при наведении пробегает вспышка: середина яркого луча из STREAKS */
const PULSE = [[156, 120, 300, 44], [91, 120, 300, 68.5], [201, 120, 300, 20], [134, 120, 300, 91.5]];
const STREAKS = [
  [['130,120 300,34 300,52 160,120', 0.45, 'nv-b6'], ['150,120 300,42 300,46 162,120', 1]],
  [['60,120 300,60 300,76 96,120', 0.45, 'nv-b6'], ['84,120 300,67 300,70 98,120', 1]],
  [['180,120 300,10 300,30 204,120', 0.45, 'nv-b6'], ['196,120 300,18 300,22 206,120', 1]],
  [['100,120 300,84 300,98 140,120', 0.45, 'nv-b6'], ['126,120 300,90 300,93 142,120', 1]],
];

/* Обложка курса: световой луч, положение которого зависит от курса. min — расчётное время в минутах */
export function Cover({ course, min, big = false }) {
  const t = TOPIC_BY[course.topic];
  const v = [...course.slug].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 4;
  return (
    <div className="cover">
      <svg className="cover-fx" viewBox="0 0 300 120" preserveAspectRatio="none" aria-hidden="true">
        {STREAKS[v].map(([p, o, f], i) => <polygon key={i} points={p} fill="url(#nv-gs)" opacity={o} filter={f ? `url(#${f})` : undefined} />)}
        <line className="cover-pulse" x1={PULSE[v][0]} y1={PULSE[v][1]} x2={PULSE[v][2]} y2={PULSE[v][3]} pathLength="100" />
      </svg>
      <span className="cover-ic"><Icon name={t.icon} size={big ? 24 : 22} /></span>
      <span className="cover-min"><span className="sr">Время урока: </span>{min} мин</span>
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

/* Полоса прогресса начатой версии. Доля считается по расчётному времени блоков */
export function ProgressLine({ course, version }) {
  const s = useStore();
  const v = version || activeVersion(s, course);
  const left = remainingSec(s, course, v), total = timing(course, v).total;
  return (
    <div className="ccard-prog">
      <span className="bar"><i style={{ width: `${Math.round((total - left) / total * 100)}%` }} /></span>
      <span>{leftLabel(left)}</span>
    </div>
  );
}

export function CourseCard({ course }) {
  const s = useStore();
  const st = status(s, course.slug);
  const v = activeVersion(s, course), other = v === 'full' ? 'short' : 'full';
  return (
    <article className="ccard">
      <Link className="ccard-link" to={`/courses/${course.slug}`}>
        <Cover course={course} min={minutes(course, v)} />
        <div className="ccard-body">
          <span className="label">{TOPIC_BY[course.topic].title}</span>
          <h3 className="ccard-title">{course.title}</h3>
          <p className="ccard-meta">{metaLine(course, v)}</p>
          {course.community && <p className="ccard-by"><Icon name="pen-line" size={14} />{course.author.name}</p>}
          {(course.full || about(course).plays > 0) && (
            <div className="badges">
              {about(course).plays > 0 && <span className="badge badge-play"><Icon name="mouse-pointer-click" size={13} />Интерактив</span>}
              {course.full && <span className="badge badge-full"><Icon name="zap" size={13} />{VERSION[other]} версия: {minutes(course, other)} мин</span>}
            </div>
          )}
          {st === 'progress' && <ProgressLine course={course} version={v} />}
          {st === 'done' && <div><span className="badge"><Icon name="check" size={13} />Пройден</span></div>}
        </div>
      </Link>
      <BookmarkButton slug={course.slug} />
    </article>
  );
}

/* Карточка авторского урока в каталоге. Текст урока ещё не загружен, поэтому время и сведения берутся из сводки (lib/community.js) */
export function CommunityCard({ item }) {
  const s = useStore();
  const st = status(s, item.slug);
  return (
    <article className="ccard" data-community={item.slug}>
      <Link className="ccard-link" to={`/courses/${item.slug}`}>
        <Cover course={item} min={item.minutes} />
        <div className="ccard-body">
          <span className="label">{TOPIC_BY[item.topic].title}</span>
          <h3 className="ccard-title">{item.title}</h3>
          <p className="ccard-meta">{item.minutes} мин · {FORMAT[item.format]} · {LEVEL[item.level]}</p>
          <p className="ccard-by"><Icon name="pen-line" size={14} />{item.author}{item.learners > 0 && <span> · прошли {item.learners}</span>}</p>
          {st === 'progress' && <div><span className="badge badge-play">В процессе</span></div>}
          {st === 'done' && <div><span className="badge"><Icon name="check" size={13} />Пройден</span></div>}
        </div>
      </Link>
      <BookmarkButton slug={item.slug} />
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
