import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { GROUPS, PUBLIC, SOON, TOPIC_BY, coursesOf, isPublic, tagsOf } from '../data';
import { useTitle } from '../lib/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { CourseCard, Crumbs, TopicTile } from '../components/Cards.jsx';
import NotFound from './NotFound.jsx';

export function Topics() {
  useTitle('Темы');
  return (
    <section className="page">
      <div className="wrap">
        <header className="page-head">
          <h1 className="h1">Темы</h1>
          <p className="lead">Выбирайте по тому, что интересно сейчас. В каждой открытой теме минимум два курса.</p>
        </header>
        {GROUPS.map(g => {
          const list = PUBLIC.filter(t => t.g === g.id);
          return list.length ? (
            <div className="group" key={g.id}>
              <span className="label">{g.title}</span>
              <div className="tiles">{list.map(t => <TopicTile topic={t} key={t.slug} />)}</div>
            </div>
          ) : null;
        })}
        <div className="soon">
          <h2 className="h3">Готовятся</h2>
          <p>Эти темы появятся в каталоге, когда в каждой будет минимум два курса.</p>
          <div className="chips">
            {SOON.map(t => <span className="chip chip-static" key={t.slug}><Icon name={t.icon} size={15} />{t.title}</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}

function TopicBody({ topic }) {
  useTitle(topic.title);
  const [tag, setTag] = useState('');
  const list = coursesOf(topic.slug);
  const shown = tag ? list.filter(c => c.tags.includes(tag)) : list;
  const similar = PUBLIC.filter(x => x.g === topic.g && x.slug !== topic.slug).concat(PUBLIC.filter(x => x.g !== topic.g)).slice(0, 4);
  return (
    <section className="page">
      <div className="wrap">
        <header className="page-head">
          <Crumbs items={[['Темы', '/topics'], [topic.title]]} />
          <div className="topic-hero">
            <span className="tile-ic"><Icon name={topic.icon} size={28} /></span>
            <div className="stack" style={{ gap: 10 }}>
              <h1 className="h1">{topic.title}</h1>
              <p className="lead">{topic.hook}. {topic.desc}</p>
            </div>
          </div>
        </header>
        <div className="chips" role="group" aria-label="Подтемы" style={{ marginBottom: 24 }}>
          <button type="button" className="chip" aria-pressed={!tag} onClick={() => setTag('')}>Все подтемы</button>
          {tagsOf(topic.slug).map(x => (
            <button key={x} type="button" className="chip" aria-pressed={tag === x} onClick={() => setTag(x)}>{x}</button>
          ))}
        </div>
        <div className="cards">{shown.map(c => <CourseCard course={c} key={c.slug} />)}</div>
        <div className="group">
          <h2 className="h3" style={{ marginBottom: 18 }}>Похожие темы</h2>
          <div className="tiles">{similar.map(t => <TopicTile topic={t} key={t.slug} />)}</div>
        </div>
      </div>
    </section>
  );
}

export function Topic() {
  const { slug } = useParams();
  const topic = TOPIC_BY[slug];
  if (!topic || !isPublic(topic)) return <NotFound />;
  return <TopicBody topic={topic} key={slug} />;
}
