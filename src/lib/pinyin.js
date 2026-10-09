/* ===== Пиньинь: тоны и слоги =====
   Чистые функции без зависимостей. Нужны заданиям на тоны и проверке данных (scripts/validate-lang.mjs):
   по ним видно, что в записи пиньиня нет опечаток и что слогов столько же, сколько иероглифов. */

const MARKS = {
  a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ',
};
const BACK = {};
Object.entries(MARKS).forEach(([v, list]) => [...list].forEach((ch, k) => { BACK[ch] = [v, k + 1]; }));

/* Все слоги путунхуа без тона. Буква ü пишется как ü (lü, nü), после j, q, x, y — как u */
const LIST = `a o e ai ei ao ou an en ang eng er
yi ya yo ye yao you yan yin yang ying yong yu yue yuan yun
wu wa wo wai wei wan wen wang weng
ba bo bai bei bao ban ben bang beng bi bie biao bian bin bing bu
pa po pai pei pao pou pan pen pang peng pi pie piao pian pin ping pu
ma mo me mai mei mao mou man men mang meng mi mie miao miu mian min ming mu
fa fo fei fou fan fen fang feng fu
da de dai dei dao dou dan den dang deng dong di dia die diao diu dian ding du duo dui duan dun
ta te tai tao tou tan tang teng tong ti tie tiao tian ting tu tuo tui tuan tun
na ne nai nei nao nou nan nen nang neng nong ni nie niao niu nian nin niang ning nu nuo nuan nü nüe
la le lai lei lao lou lan lang leng long li lia lie liao liu lian lin liang ling lu luo luan lun lü lüe lo
ga ge gai gei gao gou gan gen gang geng gong gu gua guo guai gui guan gun guang
ka ke kai kei kao kou kan ken kang keng kong ku kua kuo kuai kui kuan kun kuang
ha he hai hei hao hou han hen hang heng hong hu hua huo huai hui huan hun huang
ji jia jie jiao jiu jian jin jiang jing jiong ju jue juan jun
qi qia qie qiao qiu qian qin qiang qing qiong qu que quan qun
xi xia xie xiao xiu xian xin xiang xing xiong xu xue xuan xun
zha zhe zhi zhai zhei zhao zhou zhan zhen zhang zheng zhong zhu zhua zhuo zhuai zhui zhuan zhun zhuang
cha che chi chai chao chou chan chen chang cheng chong chu chua chuo chuai chui chuan chun chuang
sha she shi shai shei shao shou shan shen shang sheng shu shua shuo shuai shui shuan shun shuang
re ri rao rou ran ren rang reng rong ru rua ruo rui ruan run
za ze zi zai zei zao zou zan zen zang zeng zong zu zuo zui zuan zun
ca ce ci cai cao cou can cen cang ceng cong cu cuo cui cuan cun
sa se si sai sao sou san sen sang seng song su suo sui suan sun`;
export const SYLLABLES = new Set(LIST.split(/\s+/));

/* «mǎ» → { base: 'ma', tone: 3 }. Тон 0 — нейтральный (без знака) */
export function parseSyllable(s) {
  let tone = 0, base = '';
  for (const ch of s.normalize('NFC')) {
    if (BACK[ch]) { base += BACK[ch][0]; tone = BACK[ch][1]; } else base += ch;
  }
  return { base: base.toLowerCase(), tone };
}

/* Знак тона ставится на a или e; в сочетании ou — на o; иначе на последнюю гласную */
export function mark(base, tone) {
  if (!tone) return base;
  const at = base.search(/a|e/) >= 0 ? base.search(/a|e/) : base.includes('ou') ? base.indexOf('o') : Math.max(...['i', 'o', 'u', 'ü'].map(v => base.lastIndexOf(v)));
  if (at < 0) return base;
  return base.slice(0, at) + MARKS[base[at]][tone - 1] + base.slice(at + 1);
}
/* Слог во всех четырёх тонах: «ma» → mā má mǎ mà */
export const toneVariants = base => [1, 2, 3, 4].map(t => mark(base, t));

/* Разбор слова на слоги: «Zhōngguó» → [{base:'zhong',tone:1},{base:'guo',tone:2}].
   Эризация («nǎr» в 哪儿) возвращается отдельным элементом { base: 'r', erhua: true }.
   Если слово не разбирается, возвращает null: это опечатка */
export function syllables(word) {
  const clean = word.normalize('NFC').toLowerCase().replace(/[’']/g, ' ').replace(/-/g, ' ');
  const out = [];
  for (const part of clean.split(/\s+/).filter(Boolean)) {
    const plain = [...part].map(ch => (BACK[ch] ? BACK[ch][0] : ch)).join('');
    const marks = [...part].map(ch => (BACK[ch] ? BACK[ch][1] : 0));
    // разбор с конца к началу: слогов как можно меньше
    const n = plain.length, best = Array(n + 1).fill(null);
    best[n] = [];
    for (let i = n - 1; i >= 0; i--) {
      for (let len = Math.min(6, n - i); len >= 1; len--) {
        const piece = plain.slice(i, i + len);
        const ok = SYLLABLES.has(piece) || (piece === 'r' && i > 0);
        if (ok && best[i + len] && (!best[i] || best[i + len].length + 1 < best[i].length)) best[i] = [[i, len], ...best[i + len]];
      }
    }
    if (!best[0]) return null;
    for (const [i, len] of best[0]) {
      const piece = plain.slice(i, i + len);
      const tones = marks.slice(i, i + len).filter(Boolean);
      if (tones.length > 1) return null;              // два знака тона в одном слоге
      out.push(piece === 'r' ? { base: 'r', erhua: true, tone: 0 } : { base: piece, tone: tones[0] || 0 });
    }
  }
  return out;
}

/* Тот же текст с другим тоном в слоге номер at (счёт по всем словам): неверный вариант для задания «какой тон» */
export function retone(text, at, tone) {
  let k = -1;
  return text.replace(/[^\s?!.,:;，。？！]+/g, word => word.split(/([’'-])/).map(part => {
    if (/^[’'-]$/.test(part) || !part) return part;
    const syl = syllables(part);
    if (!syl) return part;
    const out = syl.map(x => { if (x.erhua) return 'r'; k++; return mark(x.base, k === at ? tone : x.tone); }).join('');
    return part[0] !== part[0].toLowerCase() ? out[0].toUpperCase() + out.slice(1) : out;
  }).join(''));
}
/* Сколько слогов с тоном (без эризации) в тексте */
export const syllableCount = text => text.split(/[\s?!.,:;，。？！]+/).filter(Boolean).reduce((n, w) => n + ((syllables(w) || []).filter(x => !x.erhua).length), 0);

/* Сколько иероглифов в записи (без знаков препинания) */
export const hanziCount = s => [...s].filter(ch => /\p{Script=Han}/u.test(ch)).length;
