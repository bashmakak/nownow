import { lazy } from 'react';
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
import { Train, Trainer } from './pages/Train.jsx';
import About from './pages/About.jsx';
import NotFound from './pages/NotFound.jsx';

// вход и документы нужны не каждому посетителю: они скачиваются, когда человек открывает эти страницы
const auth = name => lazy(() => import('./pages/Auth.jsx').then(m => ({ default: m[name] })));
const legal = name => lazy(() => import('./pages/Legal.jsx').then(m => ({ default: m[name] })));
const Login = auth('Login'), Signup = auth('Signup'), Reset = auth('Reset'), NewPassword = auth('NewPassword');
const Terms = legal('Terms'), Privacy = legal('Privacy');
// мастерская автора и модерация: нужны немногим, поэтому тоже скачиваются по требованию
const studio = name => lazy(() => import('./pages/Studio.jsx').then(m => ({ default: m[name] })));
const Studio = studio('Studio'), LessonEditor = studio('LessonEditor'), Moderation = studio('Moderation');

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
          <Route path="learn/:slug/:version?" element={<Player />} />
          <Route path="train" element={<Train />} />
          <Route path="train/:id" element={<Trainer />} />
          <Route path="me" element={<Me />} />
          <Route path="about" element={<About />} />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route path="reset" element={<Reset />} />
          <Route path="account/password" element={<NewPassword />} />
          <Route path="studio" element={<Studio />} />
          <Route path="studio/:id" element={<LessonEditor />} />
          <Route path="moderation" element={<Moderation />} />
          <Route path="legal/terms" element={<Terms />} />
          <Route path="legal/privacy" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </UIProvider>
  );
}
