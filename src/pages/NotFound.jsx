import { Link } from 'react-router-dom';
import { useTitle } from '../lib/ui.jsx';
import { EmptyState } from '../components/Cards.jsx';

export default function NotFound() {
  useTitle('Страница не найдена');
  return (
    <section className="page">
      <div className="wrap">
        <EmptyState title="Эта страница не нашлась" text="Возможно, ссылка устарела. Откройте каталог, чтобы найти нужный урок.">
          <Link className="btn btn-primary" to="/courses">Открыть каталог</Link>
        </EmptyState>
      </div>
    </section>
  );
}
