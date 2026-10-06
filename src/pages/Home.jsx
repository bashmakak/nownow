import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BLOCKS, COURSE_BY, FEATURED, FORMAT, PUBLIC, SOON, START_COURSE, TOPIC_BY, coursesOf } from '../data';
import { plural } from '../lib/store.js';
import { useTitle } from '../lib/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { HeroFx, Lockup } from '../components/Brand.jsx';
import { CourseCard, TopicTile } from '../components/Cards.jsx';

const TL_COLORS = ['#D8FF5A', '#B6F66B', '#93EC79', '#6BE285', '#3FD68F', '#00C897'];
const DEMO_TOPICS = [['', 'Все'], ['psihologiya', 'Психология'], ['lichnye-finansy', 'Финансы'], ['iskusstvennyj-intellekt', 'ИИ']];
const FAQ = [
  ['Почему именно 30 минут?', 'Это время, которое можно найти в обычном дне: в обеденный перерыв, по дороге или вечером. За полчаса реально разобрать одну идею и сразу попробовать её на своей ситуации.'],
  ['Что если я не успею за один раз?', 'Прогресс сохраняется после каждого блока. Откройте курс позже и продолжите с того места, где остановились.'],
  ['Таймер ограничивает время?', 'Нет. Счётчик «Осталось N мин» только подсказывает, сколько впереди. Урок не закроется, если вы задержитесь на блоке.'],
  ['Нужна ли регистрация?', 'В этой версии нет. Прогресс, закладки и заметки хранятся в вашем браузере и не передаются на сервер. На другом устройстве они не появятся.'],
  ['Что я получу в конце урока?', 'Карточку «Ключевое знание»: главный вывод, три тезиса и одно действие на сегодня. Все карточки собираются в кабинете.'],
  ['Как выбираются темы?', 'Тема открывается, когда в ней готово минимум два курса. Остальные темы из списка появятся по мере подготовки уроков.'],
];

/* Живое превью каталога в hero: чипы переключают курсы, поиск ведёт в каталог */
function Demo() {
  const [topic, setTopic] = useState('');
  const nav = useNavigate();
  const list = (topic ? coursesOf(topic) : [START_COURSE, 'prompty'].map(s => COURSE_BY[s])).slice(0, 2);
  const submit = e => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get('q').trim();
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (topic) p.set('topic', topic);
    nav(`/courses${p.toString() ? `?${p}` : ''}`, { state: { focusSearch: Date.now() } });
  };
  return (
    <div className="demo">
      <div className="demo-top"><Lockup /><span className="label">Каталог</span></div>
      <p className="demo-title">Выберите тему и получите ключевое знание за 30 минут</p>
      <form className="field" role="search" onSubmit={submit}>
        <label className="sr" htmlFor="demo-q">Поиск курсов</label>
        <Icon name="search" size={18} />
        <input className="input" id="demo-q" name="q" type="search" placeholder="Поиск курсов…" autoComplete="off" />
      </form>
      <div className="chips" role="group" aria-label="Темы" id="demo-chips">
        {DEMO_TOPICS.map(([v, label]) => (
          <button key={v} type="button" className="chip" aria-pressed={topic === v} onClick={() => setTopic(v)}>{label}</button>
        ))}
      </div>
      <div className="demo-list">
        {list.map(c => (
          <Link className="demo-row" to={`/courses/${c.slug}`} key={c.slug}>
            <span className="demo-thumb"><Icon name={TOPIC_BY[c.topic].icon} size={22} /></span>
            <span><b>{c.title}</b><small>30 мин · {FORMAT[c.format]}</small></span>
            <Icon name="arrow-right" size={18} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function Featured() {
  const [topic, setTopic] = useState('');
  const chips = [['', 'Все']].concat(PUBLIC.slice(0, 4).map(t => [t.slug, t.title]));
  const list = topic ? coursesOf(topic) : FEATURED.map(s => COURSE_BY[s]);
  return (
    <>
      <div className="chips chips-scroll" role="group" aria-label="Темы" id="feat-chips" style={{ marginBottom: 20 }}>
        {chips.map(([v, label]) => (
          <button key={v} type="button" className="chip" aria-pressed={topic === v} onClick={() => setTopic(v)}>{label}</button>
        ))}
      </div>
      <div className="cards" id="feat-cards">{list.map(c => <CourseCard course={c} key={c.slug} />)}</div>
    </>
  );
}

function Timeline() {
  const [hl, setHl] = useState(null);
  return (
    <>
      <div className="tl-bar" data-hl={hl ?? undefined} aria-hidden="true">
        {BLOCKS.map((b, i) => <span className="tl-seg" key={b.kind} style={{ flex: `${b.min} 1 0`, background: TL_COLORS[i] }}>{b.min}</span>)}
      </div>
      <div className="tl-scale" aria-hidden="true"><span>0 МИН</span><span>30 МИН</span></div>
      <ol className="tl-list">
        {BLOCKS.map((b, i) => (
          <li className="tl-item" key={b.kind} tabIndex={0}
            onMouseEnter={() => setHl(i)} onMouseLeave={() => setHl(null)} onFocus={() => setHl(i)} onBlur={() => setHl(null)}>
            <span className="num">{b.min} МИН</span><b>{b.label}</b><span>{b.hint}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

export default function Home() {
  useTitle('');
  return (
    <>
      <section className="hero theme-dark">
        <HeroFx />
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <p className="label hero-eyebrow">30 минут до новой идеи</p>
            <h1 className="h-display">Знания, которые работают.</h1>
            <p className="lead">Один курс даёт одно ключевое знание. Шесть коротких блоков, 30 минут и результат, который можно применить сегодня.</p>
            <div className="row">
              <Link className="btn btn-primary btn-lg" to={`/learn/${START_COURSE}`}>Начать за 30 минут <Icon name="arrow-right" size={18} /></Link>
              <Link className="btn btn-secondary btn-lg" to="/courses">Смотреть каталог</Link>
            </div>
            <p className="hero-note">Без регистрации. Прогресс сохраняется в вашем браузере.</p>
          </div>
          <Demo />
        </div>
      </section>

      <section className="sec theme-light">
        <div className="wrap">
          <div className="sec-head"><h2 className="h2">Как это работает</h2></div>
          <ol className="steps3">
            <li className="step3"><span className="num">ШАГ 1</span><h3 className="h3">Выберите тему</h3><p>Психология, финансы, ИИ, сон и другие. В каждой теме короткие курсы под конкретный вопрос.</p></li>
            <li className="step3"><span className="num">ШАГ 2</span><h3 className="h3">Пройдите за 30 минут</h3><p>Шесть блоков: зачем это нужно, главная идея, пример, практика, проверка и итог.</p></li>
            <li className="step3"><span className="num">ШАГ 3</span><h3 className="h3">Примените сегодня</h3><p>Урок заканчивается карточкой «Ключевое знание» с одним действием на сегодня.</p></li>
          </ol>
        </div>
      </section>

      <section className="sec theme-light" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head">
            <div>
              <h2 className="h2">Выберите, что вам интересно</h2>
              <p className="lead">{PUBLIC.length} {plural(PUBLIC.length, ['тема уже открыта', 'темы уже открыты', 'тем уже открыто'])}, ещё {SOON.length} готовятся.</p>
            </div>
            <Link className="more-link" to="/topics">Все темы <Icon name="arrow-right" size={16} /></Link>
          </div>
          <div className="tiles">{PUBLIC.slice(0, 12).map(t => <TopicTile topic={t} key={t.slug} />)}</div>
        </div>
      </section>

      <section className="sec theme-light" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head">
            <h2 className="h2">Начните с того, что нужно сейчас</h2>
            <Link className="more-link" to="/courses">Весь каталог <Icon name="arrow-right" size={16} /></Link>
          </div>
          <Featured />
        </div>
      </section>

      <section className="sec theme-dark">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <h2 className="h2">Что внутри 30 минут</h2>
              <p className="lead">Каждый урок устроен одинаково. Ширина отрезка на шкале равна доле времени блока.</p>
            </div>
          </div>
          <Timeline />
        </div>
      </section>

      <section className="sec theme-light">
        <div className="wrap">
          <div className="sec-head"><h2 className="h2">Зачем учиться коротко</h2></div>
          <div className="cols3">
            <div className="col3"><span className="tile-ic"><Icon name="trending-up" size={22} /></span><h3 className="h3">Быстро расти</h3><p>Полчаса в день складываются в десятки новых навыков за год. Каждый урок закончен и полезен сам по себе.</p></div>
            <div className="col3"><span className="tile-ic"><Icon name="target" size={22} /></span><h3 className="h3">Принимать лучшие решения</h3><p>В уроках нет пересказа теории ради теории. Только модели и приёмы, которые меняют поступки.</p></div>
            <div className="col3"><span className="tile-ic"><Icon name="compass" size={22} /></span><h3 className="h3">Двигаться к своим целям</h3><p>Серия дней и коллекция ключевых знаний показывают, сколько уже пройдено и что из этого вы применили.</p></div>
          </div>
          <div className="motto"><i /><p>Большие цели начинаются с малого</p></div>
        </div>
      </section>

      <section className="sec theme-light" style={{ paddingTop: 0 }}>
        <div className="wrap faq">
          <div><h2 className="h2">Вопросы и ответы</h2></div>
          <div className="faq-list">
            {FAQ.map(([q, a]) => (
              <details key={q}><summary>{q}<Icon name="chevron-down" size={20} /></summary><p>{a}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="sec final theme-dark">
        <HeroFx />
        <div className="wrap">
          <h2 className="h1">Большие цели начинаются с малого.</h2>
          <p className="lead">Первый урок займёт полчаса. Выберите тему и начните.</p>
          <div className="row"><Link className="btn btn-primary btn-lg" to="/courses">Выбрать курс <Icon name="arrow-right" size={18} /></Link></div>
        </div>
      </section>
    </>
  );
}
