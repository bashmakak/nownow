/* ===== Проверка: в репозиторий и в сборку не должны попасть секреты и данные пользователей =====

   node scripts/check-secrets.mjs            файлы репозитория (запускается перед каждой сборкой)
   node scripts/check-secrets.mjs --dist     готовая сборка в папке dist (запускается после сборки)
   node scripts/check-secrets.mjs --history  вся история коммитов

   Репозиторий открытый, сайт — статические файлы, которые видит любой. Поэтому здесь не может быть:
   секретных ключей Supabase, пароля и строки подключения к базе, ключей почтовых сервисов, токенов
   входа, файлов .env и чьих-либо адресов почты. Публикуемый ключ Supabase (sb_publishable_…) и адрес
   проекта — открытые значения, они разрешены (см. src/config.js).

   Нашлось совпадение — сборка останавливается. Значение в сообщении скрыто: видны только первые знаки. */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const mode = process.argv.includes('--history') ? 'history' : process.argv.includes('--dist') ? 'dist' : 'repo';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 30 });
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|mp3|mp4|webm|pdf|zip|gz)$/i;

/* Что ищем. test получает найденную строку и может её оправдать (вернуть false) */
const b64 = s => { try { return JSON.parse(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); } catch { return null; } };
const RULES = [
  { name: 'секретный ключ Supabase', re: /sb_secret_[A-Za-z0-9_-]{8,}/g },
  { name: 'личный токен доступа Supabase', re: /sbp_[a-f0-9]{30,}/g },
  { name: 'токен JWT (ключ service_role или чей-то сеанс входа)', re: /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g,
    // устаревший открытый ключ с ролью anon не секрет; всё остальное — секрет
    test: m => { const p = b64(m.split('.')[1]); return !(p && p.role === 'anon' && !p.sub); } },
  { name: 'строка подключения к базе с паролем', re: /postgres(?:ql)?:\/\/[^\s:@/'"`]+:[^\s@/'"`]+@[^\s'"`]+/g,
    test: m => !/:\/\/[^:]+:(\[?your-?password\]?|password|пароль|\*+|<[^>]*>|…|\.\.\.)@/i.test(m) },
  { name: 'закрытый ключ', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: 'токен GitHub', re: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g },
  { name: 'ключ почтового сервиса', re: /\b(?:re_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}|SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}|xkeysib-[a-f0-9]{32,}-[A-Za-z0-9]+|xsmtpsib-[a-f0-9]{32,}-[A-Za-z0-9]+|key-[0-9a-f]{32})\b/g },
];

/* Адреса почты. Разрешены учебные домены и адрес владельца сайта, который он сам опубликовал в документах */
const operator = (() => {
  try { return (readFileSync('src/data/legal.js', 'utf8').match(/email:\s*'([^']*)'/) || [])[1] || ''; } catch { return ''; }
})();
const EMAIL = { name: 'адрес почты (в примерах используйте домен example.com)', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g,
  test: m => {
    const host = m.split('@')[1].toLowerCase();
    if (m.toLowerCase() === operator.toLowerCase()) return false;
    if (/(^|\.)example(\.com|\.org|\.net)?$/.test(host)) return false;            // example.com, *.example
    if (host === 'users.noreply.github.com' || host === 'anthropic.com') return false;
    return /\.[a-z]{2,}$/.test(host) && !/\.(js|jsx|mjs|css|json|png|svg|md|html|woff2?)$/.test(host);   // «имя@2x.png» и подобное — не адрес
  } };

const mask = s => `${s.slice(0, Math.min(10, Math.ceil(s.length / 3)))}…`;
const found = [];
function scan(text, where, rules) {
  rules.forEach(rule => {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(text))) {
      if (rule.test && !rule.test(m[0])) continue;
      const line = text.slice(0, m.index).split('\n').length;
      found.push(`${where}:${line}  ${rule.name}: ${mask(m[0])}`);
    }
  });
}

function walk(dir, out = []) {
  readdirSync(dir).forEach(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  });
  return out;
}

if (mode === 'history') {
  // всё, что когда-либо добавлялось в коммитах: удалённый позже секрет остаётся в истории
  const log = git('log', '--all', '-p', '--no-color', '--unified=0', '--format=commit %h');
  let commit = '';
  log.split('\n').forEach(line => {
    if (line.startsWith('commit ')) commit = line.slice(7);
    else if (line.startsWith('+') && !line.startsWith('+++')) scan(line, `коммит ${commit}`, RULES);
  });
  const envs = git('log', '--all', '--name-only', '--format=').split('\n').filter(f => /(^|\/)\.env(\.|$)/.test(f) && !/\.env\.example$/.test(f));
  [...new Set(envs)].forEach(f => found.push(`${f}  файл с настройками окружения был в истории`));
} else if (mode === 'dist') {
  if (!existsSync('dist')) { console.log('Проверка сборки: папки dist нет, проверять нечего'); process.exit(0); }
  // в сборке есть чужой код библиотек, поэтому адреса почты здесь не ищем: их проверяет проход по репозиторию
  walk('dist').filter(f => !BINARY.test(f)).forEach(f => scan(readFileSync(f, 'utf8'), f, RULES));
} else {
  let files;
  try { files = [...new Set([...git('ls-files').split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')])].filter(Boolean); }
  catch { files = walk('.').filter(f => !/^(node_modules|dist|\.git)\//.test(f)); }
  files.filter(f => existsSync(f)).forEach(f => {
    if (/(^|\/)\.env(\.|$)/.test(f) && !/\.env\.example$/.test(f)) { found.push(`${f}  файл с настройками окружения не должен попадать в репозиторий (он указан в .gitignore)`); return; }
    if (BINARY.test(f)) return;
    const text = readFileSync(f, 'utf8');
    scan(text, f, f === 'package-lock.json' ? RULES : [...RULES, EMAIL]);
  });
}

const title = { repo: 'Проверка репозитория', dist: 'Проверка сборки', history: 'Проверка истории коммитов' }[mode];
if (found.length) {
  console.error(`\n${title}: найдено то, чего здесь быть не должно (${found.length}):\n`);
  found.slice(0, 50).forEach(f => console.error(`  ${f}`));
  console.error('\nУберите значение из файла. Если секрет уже попал в коммит или был опубликован, его нужно ещё и отозвать:\nключ Supabase — в панели проекта (Settings → API Keys), пароль базы — там же в Database → Settings.\n');
  process.exit(1);
}
console.log(`${title}: секретов и чужих данных не найдено`);
