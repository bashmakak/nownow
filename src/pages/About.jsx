import { Link } from 'react-router-dom';
import { BLOCKS } from '../data';
import { useTitle } from '../lib/ui.jsx';
import { Icon } from '../components/Icon.jsx';

export default function About() {
  useTitle('О платформе');
  return (
    <section className="page">
      <div className="wrap">
        <header className="page-head">
          <h1 className="h1">О платформе</h1>
          <p className="lead">NowNow — это микрообучение для тех, кто ценит своё время. Мы даём концентрированные знания, которые помогают быстро расти, принимать лучшие решения и двигаться к своим целям.</p>
        </header>
        <div className="cols3" style={{ marginTop: 8 }}>
          <div className="col3"><span className="tile-ic"><Icon name="zap" size={22} /></span><h2 className="h3">Скорость</h2><p>От главной страницы до первого блока урока меньше минуты. Регистрация для этого не нужна.</p></div>
          <div className="col3"><span className="tile-ic"><Icon name="target" size={22} /></span><h2 className="h3">Концентрат</h2><p>Один экран, одна мысль. Если текст можно убрать без потери смысла, мы его убираем.</p></div>
          <div className="col3"><span className="tile-ic"><Icon name="circle-check" size={22} /></span><h2 className="h3">Результат</h2><p>Каждый урок заканчивается карточкой с выводом и одним действием, которое можно сделать сегодня.</p></div>
        </div>
        <div className="group" style={{ maxWidth: 720 }}>
          <h2 className="h3" style={{ marginBottom: 14 }}>Как устроен урок</h2>
          <ol className="syl">
            {BLOCKS.map((b, i) => (
              <li key={b.kind}><span className="n">{i + 1}</span><span><b>{b.label}</b><small>{b.hint}</small></span><span className="m">{b.min} мин</span></li>
            ))}
          </ol>
        </div>
        <div className="group" style={{ maxWidth: 720 }}>
          <h2 className="h3" style={{ marginBottom: 14 }}>Об этой версии</h2>
          <div className="note-box">
            <Icon name="info" size={20} />
            <p>Это демонстрационная версия сайта. Содержание уроков сокращено, аккаунтов и оплаты нет. Прогресс, закладки и заметки хранятся только в вашем браузере. Автор всех уроков — редакция NowNow.</p>
          </div>
        </div>
        <div className="group"><Link className="btn btn-primary btn-lg" to="/courses">Перейти в каталог <Icon name="arrow-right" size={18} /></Link></div>
      </div>
    </section>
  );
}
