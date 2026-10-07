import { Link } from 'react-router-dom';
import { GROUPS, PUBLIC } from '../data';
import { SKILLS, skillKey } from '../data/brain.js';
import { useStore, toggleInterest, skipInterests, plural } from '../lib/store.js';
import { myTopics, mySkills, recommend } from '../lib/game.js';
import { useUI, DialogHead } from '../lib/ui.jsx';
import { Icon } from './Icon.jsx';
import { CourseCard } from './Cards.jsx';

/* ===== Интересы =====
   Человек отмечает темы каталога и навыки мини-игр. По ним собирается тренировка дня, блок «Для вас»
   на главной, порядок тем и фильтр в каталоге. Выбор хранится вместе с прогрессом: в браузере,
   а у вошедшего человека — ещё и в учётной записи. Изменить его можно в любой момент в кабинете. */

const count = s => {
  const t = myTopics(s).length, k = mySkills(s).length;
  if (!t && !k) return 'Пока ничего не выбрано';
  return `Выбрано: ${[t && `${t} ${plural(t, ['тема', 'темы', 'тем'])}`, k && `${k} ${plural(k, ['навык', 'навыка', 'навыков'])}`].filter(Boolean).join(' и ')}`;
};

/* Чипы: темы по разделам каталога и навыки мини-игр. Нажатие сразу сохраняет выбор */
export function InterestPicker({ id = 'interests' }) {
  const s = useStore();
  const chip = (key, label, icon) => (
    <button key={key} type="button" className="chip" aria-pressed={s.interests.includes(key)} data-interest={key} onClick={() => toggleInterest(key)}>
      {icon && <Icon name={icon} size={15} />}{label}
    </button>
  );
  return (
    <div className="ints" id={id}>
      {GROUPS.map(g => {
        const list = PUBLIC.filter(t => t.g === g.id);
        return list.length ? (
          <fieldset className="ints-group" key={g.id}>
            <legend className="label">{g.title}</legend>
            <div className="chips">{list.map(t => chip(t.slug, t.title))}</div>
          </fieldset>
        ) : null;
      })}
      <fieldset className="ints-group">
        <legend className="label">Мини-игры</legend>
        <div className="chips">{SKILLS.map(k => chip(skillKey(k.id), k.title, k.icon))}</div>
      </fieldset>
      <p className="ints-count" role="status">{count(s)}</p>
    </div>
  );
}

function InterestsDialog() {
  const { close } = useUI();
  return (
    <div className="dlg">
      <DialogHead title="Что вам интересно?" />
      <div className="dlg-body">
        <p className="muted">Отметьте темы и навыки. По ним подбираются тренировка дня и уроки на главной. Изменить выбор можно в любой момент.</p>
        <InterestPicker id="interests-dlg" />
        <div className="row"><button type="button" className="btn btn-primary" id="interests-done" data-autofocus="" onClick={close}>Готово</button></div>
      </div>
    </div>
  );
}
export function useInterestsDialog() {
  const ui = useUI();
  return () => ui.open(<InterestsDialog />);
}

/* Предложение выбрать интересы. Показывается, пока человек не выбрал их и не закрыл предложение */
export function InterestsPrompt({ id = 'ints-prompt' }) {
  const s = useStore();
  const open = useInterestsDialog();
  if (s.interestsAt || s.interests.length) return null;
  return (
    <div className="ints-prompt" id={id}>
      <span className="tile-ic"><Icon name="sliders-horizontal" size={22} /></span>
      <div className="stack" style={{ gap: 6, minWidth: 0 }}>
        <h3 className="h4">Настройте сайт под себя</h3>
        <p className="muted">Отметьте, что вам интересно. Тренировка дня и подборка уроков будут собираться из этих тем.</p>
      </div>
      <div className="row">
        <button type="button" className="btn btn-primary" id="ints-open" onClick={open}>Выбрать интересы</button>
        <button type="button" className="btn btn-ghost" id="ints-skip" onClick={skipInterests}>Не сейчас</button>
      </div>
    </div>
  );
}

/* Блок на главной: уроки из выбранных тем или предложение выбрать интересы */
export function ForYou() {
  const s = useStore();
  const open = useInterestsDialog();
  const topics = myTopics(s);
  if (!topics.length) {
    if (s.interestsAt || s.interests.length) return null;
    return <section className="sec theme-light sec-foryou"><div className="wrap"><InterestsPrompt /></div></section>;
  }
  const list = recommend(s, 6);
  return (
    <section className="sec theme-light sec-foryou" id="foryou">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <h2 className="h2">Для вас</h2>
            <p className="lead">{list.length ? 'Уроки из тем, которые вы отметили. Начатые идут первыми, пройденные сюда не попадают.' : 'Вы прошли все уроки в выбранных темах. Добавьте новые темы или повторите пройденное в тренажёрах.'}</p>
          </div>
          <button type="button" className="more-link link-plain" id="foryou-edit" onClick={open}>Изменить интересы <Icon name="sliders-horizontal" size={16} /></button>
        </div>
        {list.length > 0
          ? <div className="cards" id="foryou-cards">{list.map(c => <CourseCard course={c} key={c.slug} />)}</div>
          : <div className="row"><Link className="btn btn-primary" to="/train">К тренажёрам</Link></div>}
      </div>
    </section>
  );
}

/* Панель в кабинете */
export function InterestsPanel() {
  return (
    <div className="panel" id="me-interests-panel">
      <p className="muted">По этим темам и навыкам подбираются тренировка дня и уроки на главной. Выбор сохраняется сразу.</p>
      <InterestPicker id="interests-me" />
    </div>
  );
}
