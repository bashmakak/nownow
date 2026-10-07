import { Link } from 'react-router-dom';
import { BLOCKS, BLOCK_SHARE, COURSES, TIME, WITH_FULL, WPM } from '../data';
import { plural, genMin, aboutMin } from '../lib/store.js';
import { useTitle } from '../lib/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { ROUND, TRAINERS } from '../data/trainers.js';
import { CLOUD } from '../config.js';

export default function About() {
  useTitle('О платформе');
  return (
    <section className="page">
      <div className="wrap">
        <header className="page-head">
          <h1 className="h1">О платформе</h1>
          <p className="lead">NowNow — это быстрые знания для тех, кто ценит своё время. Один урок даёт одну идею, которую можно применить сегодня. Сколько времени он займёт, видно заранее.</p>
        </header>
        <div className="cols3" style={{ marginTop: 8 }}>
          <div className="col3"><span className="tile-ic"><Icon name="zap" size={22} /></span><h2 className="h3">Скорость</h2><p>От главной страницы до первого блока урока меньше минуты. Регистрация для этого не нужна.</p></div>
          <div className="col3"><span className="tile-ic"><Icon name="target" size={22} /></span><h2 className="h3">Концентрат</h2><p>Один экран, одна мысль. Если текст можно убрать без потери смысла, мы его убираем.</p></div>
          <div className="col3"><span className="tile-ic"><Icon name="circle-check" size={22} /></span><h2 className="h3">Результат</h2><p>Каждый урок заканчивается карточкой с выводом и одним действием, которое можно сделать сегодня.</p></div>
        </div>
        <div className="group" style={{ maxWidth: 720 }}>
          <h2 className="h3" style={{ marginBottom: 8 }}>Как устроен урок</h2>
          <p className="muted" style={{ marginBottom: 14 }}>Шесть блоков в любой версии. Справа доля времени, которую блок обычно занимает в короткой версии.</p>
          <ol className="syl">
            {BLOCKS.map((b, i) => (
              <li key={b.kind}><span className="n">{i + 1}</span><span><b>{b.label}</b><small>{b.hint}</small></span><span className="m">{BLOCK_SHARE[i]} %</span></li>
            ))}
          </ol>
        </div>
        <div className="group" style={{ maxWidth: 720 }}>
          <h2 className="h3" style={{ marginBottom: 14 }}>Две версии урока</h2>
          <div className="stack" style={{ gap: 12 }}>
            <p><b>Короткая</b> занимает от {TIME.short.min} до {TIME.short.max} {genMin(TIME.short.max)}. В ней главная идея, один пример, короткая практика и три вопроса.</p>
            <p><b>Полная</b> разбирает ту же тему подробно: больше примеров, вопросы для размышления по ходу, рабочий лист и пять вопросов.{TIME.full && ` Она занимает ${aboutMin(TIME.full.mid)}.`} Сейчас полная версия есть у {WITH_FULL.length} {plural(WITH_FULL.length, ['урока', 'уроков', 'уроков'])}, остальные готовятся.</p>
            <p>Версию выбирают на странице урока. Выбор запоминается, изменить его можно в кабинете.</p>
          </div>
        </div>
        <div className="group" style={{ maxWidth: 720 }}>
          <h2 className="h3" style={{ marginBottom: 14 }}>Задания, тренажёры и опыт</h2>
          <div className="stack" style={{ gap: 12 }}>
            <p>В уроках по искусственному интеллекту есть <b>интерактивные задания</b>: собрать запрос из элементов, расставить шаги по порядку, найти в ответе модели то, что нужно проверить. Они необязательны и помогают закрепить материал делом.</p>
            <p><b>Тренажёры</b> — короткие раунды из {ROUND} заданий. Сейчас их {TRAINERS.length} по теме ИИ и ещё один собирает вопросы из уроков, которые вы уже прошли. После раунда показан разбор ошибок.</p>
            <p>За уроки, верные ответы, задания и раунды начисляется <b>опыт</b>. Он складывается в уровни, а за заметные шаги даются достижения. Сравнения с другими людьми нет: свои результаты видите только вы.</p>
          </div>
          <div style={{ marginTop: 16 }}><Link className="btn btn-secondary" to="/train">Открыть тренажёры</Link></div>
        </div>
        <div className="group" style={{ maxWidth: 720 }}>
          <h2 className="h3" style={{ marginBottom: 14 }}>Как считается время</h2>
          <p>Время на карточке — оценка по объёму урока: чтение со скоростью {WPM} слов в минуту плюс небольшие паузы на вопросы и задания. Это средний темп внимательного чтения, ваш может отличаться. Счётчик в уроке ничего не ограничивает.</p>
        </div>
        <div className="group" style={{ maxWidth: 720 }}>
          <h2 className="h3" style={{ marginBottom: 14 }}>Об этой версии сайта</h2>
          <div className="note-box">
            <Icon name="info" size={20} />
            <p>Это демонстрационная версия сайта. Полная версия пока написана для {WITH_FULL.length} {plural(WITH_FULL.length, ['урока', 'уроков', 'уроков'])} из {COURSES.length}: их можно найти в <Link to="/courses?version=full">каталоге</Link> по фильтру «Есть полная версия». У остальных есть только короткая. {CLOUD ? 'Оплаты нет. Учётная запись необязательна: без неё прогресс, закладки и заметки хранятся только в вашем браузере, с ней — ещё и в облаке.' : 'Аккаунтов и оплаты нет. Прогресс, закладки и заметки хранятся только в вашем браузере.'} Автор всех уроков — редакция NowNow.</p>
          </div>
        </div>
        <div className="group"><Link className="btn btn-primary btn-lg" to="/courses">Перейти в каталог <Icon name="arrow-right" size={18} /></Link></div>
      </div>
    </section>
  );
}
