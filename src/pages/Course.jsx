import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BLOCKS, COURSE_BY, DISCLAIMER, FORMAT, LEVEL, REC_ORDER, TOPIC_BY, VERSION, blockTitle, coursesOf, lesson, minutes, timing } from '../data';
import { useStore, pkey, statusOf, activeVersion, remainingSec, leftLabel, restartCourse, setVersion, nMin, aboutMin, plural } from '../lib/store.js';
import { useTitle } from '../lib/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { BookmarkButton, CourseCard, Cover, Crumbs, KeyCard } from '../components/Cards.jsx';
import NotFound from './NotFound.jsx';

const learnPath = (slug, v) => `/learn/${slug}/${v}`;
const blockTime = sec => (sec < 45 ? 'меньше минуты' : `${Math.round(sec / 60)} мин`);

/* Что входит в версию: считается по содержимому, а не пишется руками */
function contents(L) {
  const n = L.check.length, q = `${n} ${plural(n, ['вопрос', 'вопроса', 'вопросов'])} на закрепление`;
  const thinks = [L.idea, L.example, L.practice].reduce((k, part) => k + (part.body || []).filter(x => x[0] === 'think').length, 0);
  if (!L.practice.sheet && !thinks) return `Главная идея, один пример, короткая практика и ${q}.`;
  return `Подробный разбор с примерами${thinks ? ', вопросы для размышления по ходу' : ''}${L.practice.sheet ? ', рабочий лист, который вы заполняете сами,' : ''} и ${q}.`;
}

/* Выбор версии урока. Выбор запоминается и действует на всех уроках, у которых такая версия есть */
function VersionPicker({ course, value, onChange }) {
  return (
    <div className="ver-wrap">
      <div className="ver" role="radiogroup" aria-label="Версия урока">
        {['short', 'full'].map(v => {
          const ready = v === 'short' || Boolean(course.full);
          return (
            <button key={v} type="button" role="radio" aria-checked={value === v} disabled={!ready} onClick={() => onChange(v)}>
              <span>{VERSION[v]}</span>
              <small>{ready ? nMin(minutes(course, v)) : 'готовится'}</small>
            </button>
          );
        })}
      </div>
      <p className="ver-note">{contents(lesson(course, value))}</p>
    </div>
  );
}

function Cta({ course, version: v, big }) {
  const s = useStore();
  const nav = useNavigate();
  const st = statusOf(s, course.slug, v), to = learnPath(course.slug, v);
  const cls = `btn ${big ? 'btn-lg' : ''}`;
  if (st === 'progress') return <Link className={`${cls} btn-primary`} to={to}>Продолжить · {leftLabel(remainingSec(s, course, v)).toLowerCase()}</Link>;
  if (st === 'done') {
    return (
      <button type="button" className={`${cls} btn-secondary`} onClick={() => { restartCourse(pkey(course.slug, v)); nav(to); }}>
        <Icon name="rotate-ccw" size={17} />Пройти ещё раз
      </button>
    );
  }
  return <Link className={`${cls} btn-primary`} to={to}><Icon name="play" size={17} />Начать урок · {minutes(course, v)} мин</Link>;
}

function CourseBody({ course: c }) {
  useTitle(c.title);
  const s = useStore();
  const [v, setV] = useState(() => activeVersion(s, c));
  const pick = next => { setV(next); setVersion(next); };
  const t = TOPIC_BY[c.topic];
  const L = lesson(c, v), T = timing(c, v);
  const p = s.courses[pkey(c.slug, v)];
  const st = statusOf(s, c.slug, v);
  const done = i => st === 'done' || Boolean(p && p.done[i]);
  // карточка итога открыта, если пройдена любая версия; показываем ту, что пройдена
  const passed = [v, v === 'full' ? 'short' : 'full'].find(x => s.courses[pkey(c.slug, x)]?.completed);
  const others = coursesOf(c.topic).filter(x => x.slug !== c.slug)
    .concat(REC_ORDER.map(slug => COURSE_BY[slug]).filter(x => x.topic !== c.topic)).slice(0, 3);
  return (
    <section className="page">
      <div className="wrap">
        <header className="page-head">
          <Crumbs items={[['Каталог', '/courses'], [t.title, `/topics/${t.slug}`], [c.title]]} />
          <h1 className="h1" style={{ maxWidth: '22ch' }}>{c.title}</h1>
          <p className="lead">{c.summary}</p>
          <div className="course-meta">
            <span id="course-time"><Icon name="clock" size={16} />{nMin(T.min)}</span>
            <span><Icon name="layout-grid" size={16} />{FORMAT[c.format]}</span>
            <span><Icon name="trending-up" size={16} />{LEVEL[c.level]} уровень</span>
            {passed && <span className="badge"><Icon name="check" size={13} />Пройден</span>}
          </div>
          <VersionPicker course={c} value={v} onChange={pick} />
          <div className="row" style={{ marginTop: 4 }}><Cta course={c} version={v} big /><BookmarkButton slug={c.slug} inline /></div>
        </header>
        <div className="course-grid">
          <div className="course-main">
            {c.disclaimer && <div className="note-box"><Icon name="info" size={20} /><p>{DISCLAIMER}</p></div>}
            <div className="blk">
              <h2 className="h3">Что вы узнаете</h2>
              <ul className="outcomes">{c.outcomes.map(o => <li key={o}><Icon name="check" size={20} /><span>{o}</span></li>)}</ul>
            </div>
            <div className="blk">
              <h2 className="h3">Программа урока</h2>
              <div className="syl-bar" aria-hidden="true">
                {BLOCKS.map((b, i) => <i key={b.kind} className={done(i) ? 'on' : ''} style={{ flex: `${Math.max(T.blocks[i], T.total * 0.04)} 1 0` }} />)}
              </div>
              <ol className="syl">
                {BLOCKS.map((b, i) => (
                  <li key={b.kind}>
                    <span className="n">{i + 1}</span>
                    <span><b>{b.label}</b><small>{blockTitle(L, i)}</small></span>
                    <span className="m">{done(i) && <><Icon name="check" size={15} /><span className="sr">пройден, </span></>}{blockTime(T.blocks[i])}</span>
                  </li>
                ))}
              </ol>
              <p className="time-note">Время посчитано по объёму текста и заданий. Ваш темп может отличаться.</p>
            </div>
            <div className="blk"><h2 className="h3">Итог урока</h2><KeyCard course={lesson(c, passed || v)} locked={!passed} /></div>
            {c.sources && (
              <div className="blk"><h2 className="h3">Источники</h2><ul className="sources">{c.sources.map(x => <li key={x}>{x}</li>)}</ul></div>
            )}
          </div>
          <aside className="side" aria-label="О курсе">
            <Cover course={c} min={T.min} big />
            <div className="side-body">
              <Cta course={c} version={v} />
              <dl className="facts">
                <div><dt>Время</dt><dd>{aboutMin(T.min)}</dd></div>
                <div><dt>Версия</dt><dd>{VERSION[v]}</dd></div>
                <div><dt>Блоков</dt><dd>6</dd></div>
                <div><dt>Формат</dt><dd>{FORMAT[c.format]}</dd></div>
                <div><dt>Уровень</dt><dd>{LEVEL[c.level]}</dd></div>
                <div><dt>Тема</dt><dd><Link to={`/topics/${t.slug}`}>{t.title}</Link></dd></div>
                <div><dt>Автор</dt><dd>Редакция NowNow</dd></div>
              </dl>
            </div>
          </aside>
        </div>
        <div className="group">
          <h2 className="h3" style={{ marginBottom: 18 }}>Что пройти дальше</h2>
          <div className="cards">{others.map(x => <CourseCard course={x} key={x.slug} />)}</div>
        </div>
      </div>
    </section>
  );
}

export default function Course() {
  const { slug } = useParams();
  const course = COURSE_BY[slug];
  return course ? <CourseBody course={course} key={slug} /> : <NotFound />;
}
