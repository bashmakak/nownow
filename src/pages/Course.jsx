import { Link, useNavigate, useParams } from 'react-router-dom';
import { BLOCKS, COURSE_BY, DISCLAIMER, FORMAT, LEVEL, REC_ORDER, TOPIC_BY, blockTitle, coursesOf } from '../data';
import { useStore, status, remaining, restartCourse } from '../lib/store.js';
import { useTitle } from '../lib/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { BookmarkButton, CourseCard, Cover, Crumbs, KeyCard } from '../components/Cards.jsx';
import NotFound from './NotFound.jsx';

function Cta({ course, big }) {
  const s = useStore();
  const nav = useNavigate();
  const st = status(s, course.slug);
  const cls = `btn ${big ? 'btn-lg' : ''}`;
  if (st === 'progress') return <Link className={`${cls} btn-primary`} to={`/learn/${course.slug}`}>Продолжить · осталось {remaining(s, course.slug)} мин</Link>;
  if (st === 'done') {
    return (
      <button type="button" className={`${cls} btn-secondary`} onClick={() => { restartCourse(course.slug); nav(`/learn/${course.slug}`); }}>
        <Icon name="rotate-ccw" size={17} />Пройти ещё раз
      </button>
    );
  }
  return <Link className={`${cls} btn-primary`} to={`/learn/${course.slug}`}><Icon name="play" size={17} />Начать урок</Link>;
}

function CourseBody({ course: c }) {
  useTitle(c.title);
  const s = useStore();
  const t = TOPIC_BY[c.topic];
  const p = s.courses[c.slug];
  const st = status(s, c.slug);
  const done = i => st === 'done' || Boolean(p && p.done[i]);
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
            <span><Icon name="clock" size={16} />30 минут</span>
            <span><Icon name="layout-grid" size={16} />{FORMAT[c.format]}</span>
            <span><Icon name="trending-up" size={16} />{LEVEL[c.level]} уровень</span>
            {c.full && <span className="badge badge-full"><Icon name="zap" size={13} />Полный урок</span>}
            {st === 'done' && <span className="badge"><Icon name="check" size={13} />Пройден</span>}
          </div>
          <div className="row" style={{ marginTop: 8 }}><Cta course={c} big /><BookmarkButton slug={c.slug} inline /></div>
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
                {BLOCKS.map((b, i) => <i key={b.kind} className={done(i) ? 'on' : ''} style={{ flex: `${b.min} 1 0` }} />)}
              </div>
              <ol className="syl">
                {BLOCKS.map((b, i) => (
                  <li key={b.kind}>
                    <span className="n">{i + 1}</span>
                    <span><b>{b.label}</b><small>{blockTitle(c, i)}</small></span>
                    <span className="m">{done(i) && <><Icon name="check" size={15} /><span className="sr">пройден, </span></>}{b.min} мин</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="blk"><h2 className="h3">Итог урока</h2><KeyCard course={c} locked={!(p && p.completed)} /></div>
            {c.sources && (
              <div className="blk"><h2 className="h3">Источники</h2><ul className="sources">{c.sources.map(x => <li key={x}>{x}</li>)}</ul></div>
            )}
          </div>
          <aside className="side" aria-label="О курсе">
            <Cover course={c} big />
            <div className="side-body">
              <Cta course={c} />
              <dl className="facts">
                <div><dt>Длительность</dt><dd>30 минут</dd></div>
                <div><dt>Версия</dt><dd>{c.full ? 'Полная' : 'Сокращённая'}</dd></div>
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
