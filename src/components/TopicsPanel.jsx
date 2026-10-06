import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GROUPS, PUBLIC, coursesOf } from '../data';
import { norm } from '../lib/store.js';
import { DialogHead } from '../lib/ui.jsx';
import { Icon } from './Icon.jsx';

/* Список тем по группам с поиском. В шапке ведёт на страницу темы, в каталоге выбирает фильтр. */
export function TopicsPanel({ onPick, selected = '' }) {
  const [q, setQ] = useState('');
  const nq = norm(q);
  const groups = GROUPS.map(g => ({ ...g, list: PUBLIC.filter(t => t.g === g.id && (!nq || norm(t.title).includes(nq))) }))
    .filter(g => g.list.length);
  const row = t => (<><Icon name={t.icon} size={20} /><span>{t.title}</span><small>{coursesOf(t.slug).length}</small></>);
  return (
    <div className="dlg">
      <DialogHead title="Темы" />
      <div className="dlg-body">
        <div className="field">
          <label className="sr" htmlFor="topic-q">Найти тему</label>
          <Icon name="search" size={18} />
          <input className="input" id="topic-q" type="search" placeholder="Найти тему…" autoComplete="off" data-autofocus
            value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="tgroups" id="topic-groups">
          {groups.map(g => (
            <div className="tgroup" key={g.id}>
              <span className="label">{g.title}</span>
              {g.list.map(t => onPick
                ? <button key={t.slug} type="button" className="tlink" aria-pressed={selected === t.slug} onClick={() => onPick(t.slug)}>{row(t)}</button>
                : <Link key={t.slug} className="tlink" to={`/topics/${t.slug}`}>{row(t)}</Link>)}
            </div>
          ))}
        </div>
        {!groups.length && <p className="muted">Такой темы пока нет. Посмотрите полный список.</p>}
        <Link className="more-link" to="/topics">Все темы и те, что готовятся <Icon name="arrow-right" size={16} /></Link>
      </div>
    </div>
  );
}
