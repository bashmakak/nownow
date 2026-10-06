import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

// шрифты лежат в сборке: Inter (латиница и кириллица) и Sora (латиница и цифры)
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/cyrillic-400.css';
import '@fontsource/inter/cyrillic-500.css';
import '@fontsource/inter/cyrillic-600.css';
import '@fontsource/inter/cyrillic-700.css';
import '@fontsource/sora/latin-600.css';
import '@fontsource/sora/latin-700.css';
import './styles.css';

import App from './App.jsx';
import { getState, applyTheme } from './lib/store.js';

applyTheme(getState().theme);

// HashRouter: адреса вида /#/courses работают на любом статическом хостинге без настройки сервера
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
