import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PUBLIC } from '../data';
import { useUI, DialogHead } from '../lib/ui.jsx';
import { Icon } from './Icon.jsx';
import { Lockup, Mark, Wordmark } from './Brand.jsx';
import { ThemeControl } from './Cards.jsx';
import { TopicsPanel } from './TopicsPanel.jsx';

function MobileMenu() {
  const links = [['/courses', 'Каталог'], ['/topics', 'Темы'], ['/me', 'Кабинет'], ['/about', 'О платформе']];
  return (
    <div className="dlg">
      <DialogHead title="Меню" />
      <div className="dlg-body">
        <nav className="menu-links" aria-label="Меню">
          {links.map(([to, label]) => <Link key={to} to={to}>{label}<Icon name="arrow-right" size={20} /></Link>)}
        </nav>
        <Link className="btn btn-primary btn-lg" to="/courses">Начать за 30 минут</Link>
      </div>
    </div>
  );
}

function Header() {
  const ui = useUI();
  const nav = useNavigate();
  const { pathname } = useLocation();
  return (
    <header className="site-head theme-dark">
      <div className="wrap head-row">
        <Link className="lock head-logo" to="/" aria-label="NowNow, на главную"><Mark /><Wordmark /></Link>
        <nav className="head-nav" aria-label="Основная навигация">
          <NavLink to="/courses">Каталог</NavLink>
          <button type="button" aria-haspopup="dialog" aria-current={pathname.startsWith('/topics') ? 'page' : undefined}
            onClick={() => ui.open(<TopicsPanel />)}>Темы <Icon name="chevron-down" size={15} /></button>
          <NavLink to="/about">О платформе</NavLink>
        </nav>
        <div className="head-actions">
          <button type="button" className="icon-btn" aria-label="Поиск курсов"
            onClick={() => nav('/courses', { state: { focusSearch: Date.now() } })}><Icon name="search" /></button>
          <NavLink className="btn btn-ghost btn-sm head-me" to="/me"><Icon name="user" size={16} />Кабинет</NavLink>
          <Link className="btn btn-primary btn-sm head-cta" to="/courses">Начать</Link>
          <button type="button" className="icon-btn head-menu" aria-label="Меню" aria-haspopup="dialog"
            onClick={() => ui.open(<MobileMenu />, 'dlg-sm')}><Icon name="menu" /></button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-foot theme-dark">
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <Lockup />
            <span className="label">Быстрые знания / Большие возможности</span>
            <p>Демо-версия. Уроки сокращены, прогресс хранится только в вашем браузере.</p>
          </div>
          <nav className="foot-col" aria-label="Платформа">
            <span className="label">Платформа</span>
            <Link to="/courses">Каталог</Link><Link to="/topics">Темы</Link><Link to="/me">Кабинет</Link><Link to="/about">О платформе</Link>
          </nav>
          <nav className="foot-col" aria-label="Темы">
            <span className="label">Темы</span>
            {PUBLIC.slice(0, 5).map(t => <Link key={t.slug} to={`/topics/${t.slug}`}>{t.title}</Link>)}
          </nav>
          <div className="foot-col"><span className="label">Тема оформления</span><ThemeControl /></div>
        </div>
        <div className="foot-bottom"><span>© 2026 NowNow</span><span className="label">30 минут до новой идеи</span></div>
      </div>
    </footer>
  );
}

/* Каркас страниц: шапка, содержимое, подвал. В плеере урока шапки и подвала нет. */
export function Layout() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const main = useRef(null);
  const inPlayer = pathname.startsWith('/learn/');

  useEffect(() => {
    window.scrollTo(0, 0);
    // в плеере фокус ставит сам урок: на заголовок блока
    if (!pathname.startsWith('/learn/')) main.current?.focus({ preventScroll: true });
  }, [pathname]);

  useEffect(() => {
    const onKey = e => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (e.key !== '/' || tag === 'input' || tag === 'textarea' || tag === 'select' || document.querySelector('dialog[open]')) return;
      if (window.location.hash.startsWith('#/learn/')) return;
      e.preventDefault();
      nav('/courses', { state: { focusSearch: Date.now() } });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [nav]);

  return (
    <>
      <a className="skip" href="#view" onClick={e => { e.preventDefault(); main.current?.focus(); }}>Перейти к содержанию</a>
      {!inPlayer && <Header />}
      <main id="view" tabIndex={-1} ref={main}><Outlet /></main>
      {!inPlayer && <Footer />}
    </>
  );
}
