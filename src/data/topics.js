/* ===== Темы каталога (спецификация, раздел 7.10) ===== */
export const GROUPS = [
  { id: 'human', title: 'Человек и отношения' },
  { id: 'money', title: 'Деньги и карьера' },
  { id: 'tech',  title: 'Технологии и ИИ' },
  { id: 'body',  title: 'Тело и энергия' },
  { id: 'world', title: 'Мир и идеи' },
];

export const TOPICS = [
  // Человек и отношения
  { g: 'human', slug: 'psihologiya', title: 'Психология', hook: 'Почему мы думаем и поступаем так, а не иначе', icon: 'brain',
    desc: 'Как устроены решения, мотивация и привычные реакции. Короткие курсы с опорой на исследования и на то, что можно проверить на себе.' },
  { g: 'human', slug: 'otnosheniya-i-obshchenie', title: 'Отношения и общение', hook: 'Говорить так, чтобы вас слышали', icon: 'messages-square',
    desc: 'Слушать, договариваться, говорить о трудном. Навыки разговора, которые одинаково нужны на работе и дома.' },
  { g: 'human', slug: 'myshlenie-i-resheniya', title: 'Мышление и решения', hook: 'Ошибки мышления и как их обходить', icon: 'lightbulb',
    desc: 'Как проверять утверждения, замечать искажения и не путать уверенность с доказательством.' },
  { g: 'human', slug: 'privychki-i-motivaciya', title: 'Привычки и мотивация', hook: 'Как делать то, что решили', icon: 'repeat',
    desc: 'Почему планы срываются и как устроить привычку так, чтобы она держалась без усилия воли.' },
  { g: 'human', slug: 'peregovory', title: 'Переговоры', hook: 'Договариваться без проигравших', icon: 'handshake',
    desc: 'Подготовка, интересы сторон, альтернативы. Основа, с которой проще говорить о зарплате, сроках и цене.' },
  { g: 'human', slug: 'emocionalnyj-intellekt', title: 'Эмоциональный интеллект', hook: 'Управлять эмоциями, а не наоборот', icon: 'heart-pulse' },
  { g: 'human', slug: 'kak-uchitsya', title: 'Как учиться', hook: 'Запоминать быстрее, забывать меньше', icon: 'graduation-cap' },

  // Деньги и карьера
  { g: 'money', slug: 'lichnye-finansy', title: 'Личные финансы', hook: 'Бюджет, подушка, цели без стресса', icon: 'wallet',
    desc: 'Куда уходят деньги, как собрать запас и планировать крупные цели. Без советов, во что вкладывать.' },
  { g: 'money', slug: 'kariera-i-najm', title: 'Карьера и найм', hook: 'Резюме, интервью, рост', icon: 'briefcase',
    desc: 'Как показать опыт в резюме, отвечать на собеседовании и готовиться к разговору о следующем шаге.' },
  { g: 'money', slug: 'produktivnost', title: 'Продуктивность', hook: 'Успевать главное', icon: 'timer',
    desc: 'Приоритеты, концентрация, планирование. Приёмы, которые помещаются в обычный рабочий день.' },
  { g: 'money', slug: 'investicii', title: 'Инвестиции', hook: 'Основы без жаргона', icon: 'trending-up' },
  { g: 'money', slug: 'liderstvo', title: 'Лидерство', hook: 'Вести людей, а не командовать', icon: 'flag' },
  { g: 'money', slug: 'marketing', title: 'Маркетинг', hook: 'Как продукт находит своих людей', icon: 'megaphone' },
  { g: 'money', slug: 'prodazhi', title: 'Продажи', hook: 'Убеждать, не давя', icon: 'tag' },
  { g: 'money', slug: 'predprinimatelstvo', title: 'Предпринимательство', hook: 'От идеи до первых клиентов', icon: 'rocket' },

  // Технологии и ИИ
  { g: 'tech', slug: 'iskusstvennyj-intellekt', title: 'Искусственный интеллект', hook: 'Работа с нейросетями без магии', icon: 'bot',
    desc: 'Как ставить задачи языковым моделям и проверять их ответы. Практика для тех, кто не программирует.' },
  { g: 'tech', slug: 'dannye-i-analitika', title: 'Данные и аналитика', hook: 'Находить ответы в цифрах', icon: 'chart-line' },
  { g: 'tech', slug: 'programmirovanie', title: 'Программирование', hook: 'Основы и практика', icon: 'code' },
  { g: 'tech', slug: 'kiberbezopasnost', title: 'Кибербезопасность', hook: 'Защитить себя и свои данные', icon: 'shield-check' },
  { g: 'tech', slug: 'dizajn-i-ux', title: 'Дизайн и UX', hook: 'Как делают удобное и красивое', icon: 'pen-tool' },

  // Тело и энергия
  { g: 'body', slug: 'son-i-vosstanovlenie', title: 'Сон и восстановление', hook: 'Высыпаться и держать энергию', icon: 'moon',
    desc: 'Режим, свет, вечерние привычки. Что влияет на сон на самом деле и с чего начать.' },
  { g: 'body', slug: 'stress-i-energiya', title: 'Стресс и энергия', hook: 'Не выгорать и восстанавливаться', icon: 'battery-charging',
    desc: 'Как работает стресс, когда он полезен и какие короткие приёмы помогают вернуть спокойствие.' },
  { g: 'body', slug: 'pitanie', title: 'Питание', hook: 'Что и зачем мы едим', icon: 'apple' },
  { g: 'body', slug: 'sport-i-dvizhenie', title: 'Спорт и движение', hook: 'Тренироваться с умом', icon: 'dumbbell' },

  // Мир и идеи
  { g: 'world', slug: 'vystupleniya-i-teksty', title: 'Выступления и тексты', hook: 'Говорить и писать ясно', icon: 'mic',
    desc: 'Структура выступления и редактура рабочих писем. Чтобы вас понимали с первого раза.' },
  { g: 'world', slug: 'istoriya', title: 'История', hook: 'Как прошлое объясняет сегодня', icon: 'landmark' },
  { g: 'world', slug: 'filosofiya', title: 'Философия', hook: 'Большие вопросы за 30 минут', icon: 'compass' },
  { g: 'world', slug: 'ekonomika', title: 'Экономика простыми словами', hook: 'Почему всё стоит столько, сколько стоит', icon: 'coins' },
  { g: 'world', slug: 'pravo-na-kazhdyj-den', title: 'Право на каждый день', hook: 'Ваши права и как их использовать', icon: 'scale' },
  { g: 'world', slug: 'kosmos-i-fizika', title: 'Космос и физика', hook: 'Как устроен мир на больших и малых масштабах', icon: 'orbit' },
  { g: 'world', slug: 'nejronauka', title: 'Нейронаука', hook: 'Как работает мозг', icon: 'microscope' },
  { g: 'world', slug: 'anglijskij-yazyk', title: 'Английский язык', hook: 'Говорить увереннее', icon: 'languages' },
  { g: 'world', slug: 'kino-knigi-iskusstvo', title: 'Кино, книги, искусство', hook: 'Смотреть и читать глубже', icon: 'film' },
];

/* Порядок показа тем на лендинге и в чипах каталога */
export const TOPIC_ORDER = [
  'psihologiya', 'lichnye-finansy', 'iskusstvennyj-intellekt', 'son-i-vosstanovlenie',
  'otnosheniya-i-obshchenie', 'produktivnost', 'kariera-i-najm', 'myshlenie-i-resheniya',
  'privychki-i-motivaciya', 'peregovory', 'stress-i-energiya', 'vystupleniya-i-teksty',
];

/* Шесть блоков урока: сумма минут = 30 */
export const BLOCKS = [
  { kind: 'why',      label: 'Зачем',           min: 2, hint: 'Проблема и польза: почему тема важна сейчас' },
  { kind: 'idea',     label: 'Идея',            min: 8, hint: 'Ядро знания: модель или правило' },
  { kind: 'example',  label: 'Пример',          min: 7, hint: 'Разбор реального случая' },
  { kind: 'practice', label: 'Практика',        min: 8, hint: 'Применение к своей ситуации' },
  { kind: 'check',    label: 'Проверка',        min: 4, hint: 'Три вопроса на закрепление' },
  { kind: 'key',      label: 'Ключевое знание', min: 1, hint: 'Карточка: что применить сегодня' },
];
export const FORMAT = { theory: 'Теория', practice: 'Практика', case: 'Кейс' };
export const LEVEL = { 1: 'Начальный', 2: 'Средний', 3: 'Продвинутый' };
export const DISCLAIMER = 'Образовательный материал, не консультация. Если вопрос касается здоровья или денег, решение принимайте вместе со специалистом.';
