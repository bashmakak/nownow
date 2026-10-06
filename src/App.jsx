import { Route, Routes } from 'react-router-dom';
import { UIProvider } from './lib/ui.jsx';
import { Defs } from './components/Brand.jsx';
import { Layout } from './components/Chrome.jsx';
import Home from './pages/Home.jsx';
import Catalog from './pages/Catalog.jsx';
import { Topics, Topic } from './pages/Topics.jsx';
import Course from './pages/Course.jsx';
import Player from './pages/Player.jsx';
import Me from './pages/Me.jsx';
import About from './pages/About.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <UIProvider>
      <Defs />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="courses" element={<Catalog />} />
          <Route path="courses/:slug" element={<Course />} />
          <Route path="topics" element={<Topics />} />
          <Route path="topics/:slug" element={<Topic />} />
          <Route path="learn/:slug" element={<Player />} />
          <Route path="me" element={<Me />} />
          <Route path="about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </UIProvider>
  );
}
