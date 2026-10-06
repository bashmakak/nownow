import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BLOCKS, BLOCK_SHARE, COURSES, COURSE_BY, FEATURED, FORMAT, PUBLIC, SOON, START_COURSE, TIME, TOPIC_BY, WITH_FULL, WPM, coursesOf, minutes } from '../data';
import { plural, genMin, aboutMin } from '../lib/store.js';
import { useTitle } from '../lib/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { HeroFx, Lockup } from '../components/Brand.jsx';
import { CourseCard, TopicTile } from '../components/Cards.jsx';

const TL_COLORS = ['#D8FF5A', '#B6F66B', '#93EC79', '#6BE285', '#3FD68F', '#00C897'];
const DEMO_TOPICS = [['', 'Все'], ['psihologiya', 'Психология'], ['lichnye-finansy', 'Финансы'], ['iskusstvennyj-intellekt', 'ИИ']];
const FAQ = [
  ['Сколько времени занимает урок?', `У каждого урока своё время. Оно указано на карточке и на странице урока. Короткие версии занимают от ${TIME.short.min} до ${TIME.short.max} ${genMin(TIME.short.max)}${TIME.full ? `, полная — ${aboutMin(TIME.full.mid)}` : ''}.`],
  ['Чем короткая версия отличается от полной?', 'В короткой главная идея, один пример, короткая практика и три вопроса. Полная разбирает ту же тему подробно: больше примеров, вопросы для размышления по ходу, рабочий лист и пять вопросов. Версию выбирают на странице урока.'],
  ['У всех уроков есть полная версия?', `Пока нет. Сейчас она есть у ${WITH_FULL.length} ${plural(WITH_FULL.length, ['урока', 'уроков', 'уроков'])} из ${COURSES.length}${PUBLIC.every(t => coursesOf(t.slug).some(c => c.full)) ? ', минимум у одного в каждой теме' : ''}. Остальные готовятся. В каталоге такие уроки показывает фильтр «Есть полная версия», а на карточке указано время обеих версий.`],
  ['Как считается время?', `По объёму урока: чтение со скоростью ${WPM} слов в минуту плюс небольшие паузы на вопросы и задания. Это оценка среднего темпа, а не замер. Ваш темп может отличаться.`],
  ['Что если я не успею за один раз?', 'Прогресс сохраняется после каждого блока. Откройте курс позже и продолжите с того места, где остановились.'],
  ['Счётчик времени что-то ограничивает?', 'Нет. Надпись «Осталось N мин» только подсказывает, сколько впереди. Урок не закроется, если вы задержитесь на блоке.'],
  ['Нужна ли регистрация?', 'В этой версии нет. Прогресс, закладки и заметки хранятся в вашем браузере и не передаются на сервер. На другом устройстве они не появятся.'],
  ['Что я получу в конце урока?', 'Карточку «Ключевое знание»: главный вывод, три тезиса и одно действие на сегодня. Все карточки собираются в кабинете.'],
  ['Как выбираются темы?', 'Тема открывается, когда в ней готово минимум два урока. Дальше в открытые темы добавляются новые уроки.'],
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
      <div className="demo-top"><Lockup small /><span className="label">Каталог</span></div>
      <p className="demo-title">Выберите тему и получите ключевое знание за несколько минут</p>
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
            <span><b>{c.title}</b><small>{minutes(c, 'short')} мин · {FORMAT[c.format]}</small></span>
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
        {BLOCKS.map((b, i) => <span className="tl-seg" key={b.kind} style={{ flex: `${BLOCK_SHARE[i]} 1 0`, background: TL_COLORS[i] }}>{BLOCK_SHARE[i]}</span>)}
      </div>
      <div className="tl-scale" aria-hidden="true"><span>НАЧАЛО</span><span>ДОЛЯ ВРЕМЕНИ, %</span><span>ИТОГ</span></div>
      <ol className="tl-list">
        {BLOCKS.map((b, i) => (
          <li className="tl-item" key={b.kind} tabIndex={0}
            onMouseEnter={() => setHl(i)} onMouseLeave={() => setHl(null)} onFocus={() => setHl(i)} onBlur={() => setHl(null)}>
            <span className="num">{BLOCK_SHARE[i]} %</span><b>{b.label}</b><span>{b.hint}</span>
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
            <p className="label hero-eyebrow">Быстрые знания</p>
            <h1 className="h-display">Знания, которые работают.</h1>
            <p className="lead">Один урок даёт одно ключевое знание. Короткая версия занимает {aboutMin(TIME.short.mid)}, полная разбирает тему подробно. Сколько времени уйдёт, видно до начала.</p>
            <div className="row">
              <Link className="btn btn-primary btn-lg" to={`/learn/${START_COURSE}`}>Начать первый урок <Icon name="arrow-right" size={18} /></Link>
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
            <li className="step3"><span className="num">ШАГ 2</span><h3 className="h3">Выберите версию</h3><p>Короткая даёт главное за несколько минут. Полная разбирает тему подробно. Время каждой указано заранее.</p></li>
            <li className="step3"><span className="num">ШАГ 3</span><h3 className="h3">Примените сегодня</h3><p>Урок заканчивается карточкой «Ключевое знание» с одним действием на сегодня.</p></li>
          </ol>
        </div>
      </section>

      <section className="sec theme-light" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head">
            <div>
              <h2 className="h2">Выберите, что вам интересно</h2>
              <p className="lead">{PUBLIC.length} {plural(PUBLIC.length, ['тема', 'темы', 'тем'])}, в каждой минимум два урока.{SOON.length > 0 && ` Ещё ${SOON.length} готовятся.`}</p>
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
              <h2 className="h2">Что внутри урока</h2>
              <p className="lead">Шесть блоков в любой версии. Ширина отрезка показывает, какую долю времени блок обычно занимает в короткой версии.</p>
            </div>
          </div>
          <Timeline />
        </div>
      </section>

      <section className="sec theme-light">
        <div className="wrap">
          <div className="sec-head"><h2 className="h2">Зачем учиться коротко</h2></div>
          <div className="cols3">
            <div className="col3"><span className="tile-ic"><Icon name="trending-up" size={22} /></span><h3 className="h3">Быстро расти</h3><p>Несколько минут в день складываются в десятки новых идей за год. Каждый урок закончен и полезен сам по себе.</p></div>
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
          <p className="lead">Первый урок займёт {aboutMin(minutes(COURSE_BY[START_COURSE], 'short'))}. Выберите тему и начните.</p>
          <div className="row"><Link className="btn btn-primary btn-lg" to="/courses">Выбрать курс <Icon name="arrow-right" size={18} /></Link></div>
        </div>
      </section>
    </>
  );
}
