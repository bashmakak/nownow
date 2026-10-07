import { Fragment, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BLOCKS, BLOCK_SHARE, COURSES, COURSE_BY, FEATURED, FORMAT, PUBLIC, SOON, START_COURSE, TIME, TOPIC_BY, WITH_FULL, WPM, coursesOf, minutes } from '../data';
import { plural, genMin, aboutMin } from '../lib/store.js';
import { useTitle } from '../lib/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { HeroFx, Lockup } from '../components/Brand.jsx';
import { CourseCard, TopicTile } from '../components/Cards.jsx';
import { ChoiceView } from '../components/Play.jsx';
import { TRAINERS, ROUND } from '../data/trainers.js';
import { normalize } from '../lib/game.js';
import { sparkFrom } from '../lib/fx.js';
import { CLOUD } from '../config.js';
import { GAMES } from '../data/brain.js';
import { ForYou } from '../components/Interests.jsx';

const TL_COLORS = ['#D8FF5A', '#B6F66B', '#93EC79', '#6BE285', '#3FD68F', '#00C897'];
const DEMO_TOPICS = [['', 'Все'], ['psihologiya', 'Психология'], ['lichnye-finansy', 'Финансы'], ['iskusstvennyj-intellekt', 'ИИ']];
const FAQ = [
  ['Сколько времени занимает урок?', `У каждого урока своё время. Оно указано на карточке и на странице урока. Короткие версии занимают от ${TIME.short.min} до ${TIME.short.max} ${genMin(TIME.short.max)}${TIME.full ? `, полная — ${aboutMin(TIME.full.mid)}` : ''}.`],
  ['Чем короткая версия отличается от полной?', 'В короткой главная идея, один пример, короткая практика и три вопроса. Полная разбирает ту же тему подробно: больше примеров, вопросы для размышления по ходу, рабочий лист и пять вопросов. Версию выбирают на странице урока.'],
  ['У всех уроков есть полная версия?', `Пока нет. Сейчас она есть у ${WITH_FULL.length} ${plural(WITH_FULL.length, ['урока', 'уроков', 'уроков'])} из ${COURSES.length}${PUBLIC.every(t => coursesOf(t.slug).some(c => c.full)) ? ', минимум у одного в каждой теме' : ''}. Остальные готовятся. В каталоге такие уроки показывает фильтр «Есть полная версия», а на карточке указано время обеих версий.`],
  ['Как считается время?', `По объёму урока: чтение со скоростью ${WPM} слов в минуту плюс небольшие паузы на вопросы и задания. Это оценка среднего темпа, а не замер. Ваш темп может отличаться.`],
  ['Что если я не успею за один раз?', 'Прогресс сохраняется после каждого блока. Откройте курс позже и продолжите с того места, где остановились.'],
  ['Счётчик времени что-то ограничивает?', 'Нет. Надпись «Осталось N мин» только подсказывает, сколько впереди. Урок не закроется, если вы задержитесь на блоке.'],
  ['Нужна ли регистрация?', CLOUD
    ? 'Нет. Уроки, задания и тренажёры доступны сразу, а прогресс, закладки и заметки хранятся в вашем браузере. Учётная запись нужна для одного: чтобы прогресс сохранялся в облаке и появлялся на других устройствах. Создать её можно в кабинете.'
    : 'В этой версии нет. Прогресс, закладки и заметки хранятся в вашем браузере и не передаются на сервер. На другом устройстве они не появятся.'],
  ['Что я получу в конце урока?', 'Карточку «Ключевое знание»: главный вывод, три тезиса и одно действие на сегодня. Все карточки собираются в кабинете.'],
  ['Что такое тренажёры?', `Короткие раунды на каждый день. ${GAMES.length} мини-игр на внимание, реакцию, память и счёт, вопросы по любой теме каталога, ${TRAINERS.length} тренажёров по теме «Искусственный интеллект» и повторение пройденного. Раунд длится от полуминуты до двух минут. Рейтинга игроков нет: свои результаты видите только вы.`],
  ['Можно ли настроить сайт под себя?', 'Да. Отметьте интересные темы и навыки при регистрации, в кабинете или прямо на главной. По ним собирается тренировка дня и подборка уроков «Для вас». Учётная запись для этого не нужна.'],
  ['Делают ли мини-игры умнее?', 'Они тренируют то, что в них делаешь: искать глазами, быстро отвечать, удерживать в голове. Исследования не подтверждают, что такие игры улучшают мышление в целом, и мы этого не обещаем. Знания дают уроки, а игры — разминка и способ не прерывать серию.'],
  ...(CLOUD ? [
    ['Кто пишет уроки?', 'Основу каталога пишет редакция NowNow. Урок может написать и любой участник: в мастерской есть редактор в формате сайта. Перед публикацией каждый такой урок читает модератор. Авторские уроки собраны в каталоге на вкладке «От авторов», имя автора указано на карточке.'],
    ['Что получает автор урока?', 'Искры — внутренние очки сайта: 50 за опубликованный урок, 5 за каждого вошедшего читателя, который прошёл урок, и ещё 2, если он отметил урок полезным. Сейчас искры нельзя потратить или обменять на деньги, и выплат мы не обещаем. Как они будут использоваться, решится, когда на сайте появится оплата.'],
  ] : []),
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

/* Одно задание из тренажёра прямо на главной: ответ ничего не записывает, только показывает, как это устроено */
function Try() {
  const t = TRAINERS[0];
  const n = normalize(t, t.items[14]);
  const [picked, setPicked] = useState(null);
  return (
    <div className="try">
      <div className="try-copy" data-rv="">
        <h2 className="h2">Знание закрепляется, когда им пользуются</h2>
        <p className="lead">В уроках по искусственному интеллекту есть задания, которые выполняют руками, а после уроков — тренажёры: раунд из {ROUND} заданий, очки за точность и скорость, разбор ошибок.</p>
        <ul className="try-list">
          <li><Icon name="mouse-pointer-click" size={20} /><span>Соберите запрос из элементов и посмотрите, как меняется ответ</span></li>
          <li><Icon name="gamepad-2" size={20} /><span>{TRAINERS.length} тренажёров и тренировка дня из трёх раундов</span></li>
          <li><Icon name="trophy" size={20} /><span>Опыт, уровни и достижения за то, что вы прошли</span></li>
        </ul>
        <div className="row"><Link className="btn btn-primary btn-lg" to="/train">Открыть тренажёры <Icon name="arrow-right" size={18} /></Link></div>
      </div>
      <div className="try-card" id="try-card" data-rv="">
        <p className="try-tag"><Icon name="pen-line" size={16} />Тренажёр «{t.title}»</p>
        <p className="tr-ask">{t.ask}</p>
        <div className="ch ch-pick">
          <ChoiceView type="pick" n={n} picked={picked} onPick={(k, el) => { setPicked(k); if (k === n.correct) sparkFrom(el); }} />
        </div>
        <div className="ch-fb" aria-live="polite">
          {picked != null && (
            <>
              <p><b>{picked === n.correct ? 'Верно.' : 'Не совсем.'}</b> {n.why}</p>
              <div className="row">
                <Link className="btn btn-secondary btn-sm" to={`/train/${t.id}`}>Сыграть весь раунд<Icon name="arrow-right" size={16} /></Link>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicked(null)}>Ответить заново</button>
              </div>
            </>
          )}
        </div>
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
      <div className="cards" id="feat-cards" data-rv-kids="">{list.map(c => <CourseCard course={c} key={c.slug} />)}</div>
    </>
  );
}

function Timeline() {
  const [hl, setHl] = useState(null);
  return (
    <>
      <div className="tl-bar" data-hl={hl ?? undefined} data-rv="" aria-hidden="true">
        {BLOCKS.map((b, i) => <span className="tl-seg" key={b.kind} style={{ flex: `${BLOCK_SHARE[i]} 1 0`, background: TL_COLORS[i] }}>{BLOCK_SHARE[i]}</span>)}
      </div>
      <div className="tl-scale" aria-hidden="true"><span>НАЧАЛО</span><span>ДОЛЯ ВРЕМЕНИ, %</span><span>ИТОГ</span></div>
      <ol className="tl-list" data-rv-kids="">
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
            <h1 className="h-display hero-h">{['Знания,', 'которые', 'работают.'].map((w, i) => <Fragment key={w}>{i > 0 && ' '}<span style={{ '--i': i }}><i>{w}</i></span></Fragment>)}</h1>
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

      <ForYou />

      <section className="sec theme-light">
        <div className="wrap">
          <div className="sec-head"><h2 className="h2">Как это работает</h2></div>
          <ol className="steps3" data-rv-kids="">
            <li className="step3"><span className="num">ШАГ 1</span><h3 className="h3">Выберите тему</h3><p>Психология, финансы, ИИ, сон и другие. В каждой теме короткие курсы под конкретный вопрос.</p></li>
            <li className="step3"><span className="num">ШАГ 2</span><h3 className="h3">Выберите версию</h3><p>Короткая даёт главное за несколько минут. Полная разбирает тему подробно. Время каждой указано заранее.</p></li>
            <li className="step3"><span className="num">ШАГ 3</span><h3 className="h3">Примените сегодня</h3><p>Урок заканчивается карточкой «Ключевое знание» с одним действием на сегодня.</p></li>
          </ol>
        </div>
      </section>

      <section className="sec theme-dark sec-try">
        <div className="wrap"><Try /></div>
      </section>

      <section className="sec theme-light">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <h2 className="h2">Выберите, что вам интересно</h2>
              <p className="lead">{PUBLIC.length} {plural(PUBLIC.length, ['тема', 'темы', 'тем'])}, в каждой минимум два урока.{SOON.length > 0 && ` Ещё ${SOON.length} готовятся.`}</p>
            </div>
            <Link className="more-link" to="/topics">Все темы <Icon name="arrow-right" size={16} /></Link>
          </div>
          <div className="tiles" data-rv-kids="">{PUBLIC.slice(0, 12).map(t => <TopicTile topic={t} key={t.slug} />)}</div>
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
          <div className="cols3" data-rv-kids="">
            <div className="col3"><span className="tile-ic"><Icon name="trending-up" size={22} /></span><h3 className="h3">Быстро расти</h3><p>Несколько минут в день складываются в десятки новых идей за год. Каждый урок закончен и полезен сам по себе.</p></div>
            <div className="col3"><span className="tile-ic"><Icon name="target" size={22} /></span><h3 className="h3">Принимать лучшие решения</h3><p>В уроках нет пересказа теории ради теории. Только модели и приёмы, которые меняют поступки.</p></div>
            <div className="col3"><span className="tile-ic"><Icon name="compass" size={22} /></span><h3 className="h3">Двигаться к своим целям</h3><p>Серия дней, уровень и коллекция ключевых знаний показывают, сколько уже пройдено и что из этого вы применили.</p></div>
          </div>
          <div className="motto" data-rv=""><i /><p>Большие цели начинаются с малого</p></div>
        </div>
      </section>

      {CLOUD && (
        <section className="sec theme-light" style={{ paddingTop: 0 }} id="home-authors">
          <div className="wrap">
            <div className="authors-cta" data-rv="">
              <div className="stack" style={{ gap: 10 }}>
                <span className="label">Авторам</span>
                <h2 className="h2">Знаете тему? Напишите урок</h2>
                <p className="lead">В мастерской есть редактор в формате NowNow: шесть блоков, от 3 до 7 минут. Урок читает модератор, после одобрения он выходит в каталоге под вашим именем. За читателей начисляются искры — внутренние очки сайта.</p>
              </div>
              <div className="row"><Link className="btn btn-primary btn-lg" to="/studio"><Icon name="pen-line" size={18} />Открыть мастерскую</Link><Link className="btn btn-secondary btn-lg" to="/courses?by=authors">Уроки авторов</Link></div>
            </div>
          </div>
        </section>
      )}

      <section className="sec theme-light" style={{ paddingTop: 0 }}>
        <div className="wrap faq">
          <div><h2 className="h2">Вопросы и ответы</h2></div>
          <div className="faq-list" data-rv="">
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
