// ===== СОСТОЯНИЕ =====
let appLang = 'kz'; // Default: Kazakh
let mode = 'flash';
let activeLevels = new Set(['A1','A2','B1','B2']);
let activeCats = new Set(['cat_core','cat_people','cat_home','cat_edu','cat_travel','cat_food','cat_health','cat_nature','cat_business','cat_tech','cat_art','cat_sport']);
let deck = [];
let reviewDeck = [];      // снапшот колоды повторения: не меняется при удалении слов из repeat
let idx = 0;
let flipped = false;
let known = new Set();    // производное от srs: слова с коробкой ≥ 1
let srs = {};             // интервальное повторение: word → { box: 0..5, due: 'YYYY-MM-DD' }
let dailyGoal = 20;
let quizAnswered = false;
let typeAnswered = false;
let cardDir = true;       // направление вопроса (EN→перевод или наоборот), фиксируется на карточку
let quizState = null;     // { word, opts, timerStarted } — варианты теста, стабильные на карточку
let soundOn = true;
let timerOn = true;
let correctStreak = 0;
let timerInterval = null;
let timerSeconds = 10;

// ===== ЗАНЯТИЕ (конечная сессия вместо бесконечной ленты) =====
const SESSION_MAX = 30;   // потолок карточек за урок: ~5-7 минут
let sessionActive = false;
let sessionDeck = [];
let sessionPlan = { fresh: [], due: [] };
let sessionNewLearned = 0;  // сколько новых слов закрыто за этот урок
let sessionFresh = new Set();     // слова, которые в начале урока были новыми
let sessionCounted = new Set();   // новые слова, уже засчитанные в итог урока
let sessionRequeues = new Map();  // слово → сколько раз его вернули в урок
const REQUEUE_GAP = 3;   // слово с ошибкой возвращается через столько карточек
const REQUEUE_MAX = 2;   // и не больше стольких раз за урок

const UI_TEXT = {
  header_words: { ru: 'Слов', kz: 'Сөздер' },
  header_known: { ru: 'Знаю', kz: 'Білемін' },
  header_progress: { ru: 'Прогресс', kz: 'Прогресс' },
  header_streak: { ru: 'Дней подряд', kz: 'Қатарынан күн' },
  hero_title: { ru: 'Выучи английский<br>раз и навсегда', kz: 'Ағылшын тілін<br>біржолата үйреніңіз' },
  hero_subtitle: { ru: '3000 самых важных английских слов с переводом на казахский и русский. Короткий урок каждый день: карточки, тест или ввод — и интервальное повторение.', kz: 'Ағылшын тілінің ең маңызды 3000 сөзі қазақша және орысша аудармасымен. Күн сайын қысқа сабақ: карталар, тест немесе жазу — және аралықпен қайталау.' },
  btn_start: { ru: 'Начать урок →', kz: 'Сабақты бастау →' },
  lvl_a1: { ru: 'A1 — Начальный', kz: 'A1 — Бастапқы' },
  lvl_a2: { ru: 'A2 — Элементарный', kz: 'A2 — Қарапайым' },
  lvl_b1: { ru: 'B1 — Средний', kz: 'B1 — Орташа' },
  lvl_b2: { ru: 'B2 — Выше среднего', kz: 'B2 — Орташадан жоғары' },
  tab_flash: { ru: 'Карточки', kz: 'Флеш-карталар' },
  tab_quiz: { ru: 'Тест 4 варианта', kz: 'Тест 4 нұсқа' },
  tab_type: { ru: 'Введи перевод', kz: 'Аударманы жаз' },
  tab_review: { ru: 'Повторение', kz: 'Қайталау' },
  tab_flash_short: { ru: 'Карточки', kz: 'Карталар' },
  tab_quiz_short: { ru: 'Тест', kz: 'Тест' },
  tab_type_short: { ru: 'Ввод', kz: 'Жазу' },

  // Занятие
  ls_today: { ru: 'Урок на сегодня', kz: 'Бүгінгі сабақ' },
  ls_new: { ru: 'новых', kz: 'жаңа сөз' },
  ls_due: { ru: 'повторить', kz: 'қайталау' },
  ls_start: { ru: 'Начать урок', kz: 'Сабақты бастау' },
  ls_continue: { ru: 'Продолжить урок', kz: 'Сабақты жалғастыру' },
  ls_minutes: { ru: 'мин', kz: 'мин' },
  ls_all_done: { ru: 'На сегодня всё пройдено', kz: 'Бүгінге бәрі орындалды' },
  ls_extra: { ru: 'Позаниматься ещё', kz: 'Тағы жаттығу' },
  ls_empty: { ru: 'В выбранных фильтрах нет слов', kz: 'Таңдалған сүзгіде сөз жоқ' },
  done_title: { ru: 'Урок пройден', kz: 'Сабақ аяқталды' },
  done_new: { ru: 'новых слов', kz: 'жаңа сөз' },
  done_streak: { ru: 'дней подряд', kz: 'күн қатарынан' },
  done_again: { ru: 'Ещё урок', kz: 'Тағы сабақ' },
  done_finish: { ru: 'Завершить', kz: 'Аяқтау' },
  aria_exit: { ru: 'Завершить урок', kz: 'Сабақты аяқтау' },

  btn_settings: { ru: 'Настройки', kz: 'Параметрлер' },
  lbl_goal: { ru: 'Цель на день', kz: 'Күндік мақсат' },
  lbl_goal_today: { ru: 'Сегодня пройдено', kz: 'Бүгін өтілді' },
  lbl_stats: { ru: 'Статистика', kz: 'Статистика' },
  lbl_data: { ru: 'Данные', kz: 'Деректер' },
  scope_all_cats: { ru: 'все категории', kz: 'барлық санат' },
  scope_cats: { ru: 'категорий', kz: 'санат' },
  lbl_level: { ru: 'Уровень', kz: 'Деңгей' },
  lbl_cat: { ru: 'Категории', kz: 'Категориялар' },
  cat_core: { ru: 'Основные', kz: 'Негізгі' },
  cat_people: { ru: 'Люди', kz: 'Адамдар' },
  cat_home: { ru: 'Дом', kz: 'Үй' },
  cat_edu: { ru: 'Образование', kz: 'Білім' },
  cat_travel: { ru: 'Путешествия', kz: 'Саяхат' },
  cat_food: { ru: 'Еда', kz: 'Тамақ' },
  cat_health: { ru: 'Здоровье', kz: 'Денсаулық' },
  cat_nature: { ru: 'Природа', kz: 'Табиғат' },
  cat_business: { ru: 'Бизнес', kz: 'Бизнес' },
  cat_tech: { ru: 'Технологии', kz: 'IT/Ғылым' },
  cat_art: { ru: 'Искусство', kz: 'Өнер' },
  cat_sport: { ru: 'Спорт', kz: 'Спорт' },
  btn_shuffle: { ru: 'Перемешать', kz: 'Араластыру' },
  stat_total: { ru: 'Всего', kz: 'Барлығы' },
  stat_known: { ru: 'Знаю', kz: 'Білемін' },
  stat_repeat: { ru: 'Повторить', kz: 'Қайталау' },
  stat_progress: { ru: 'Прогресс', kz: 'Прогресс' },
  btn_graph: { ru: 'График прогресса', kz: 'Прогресс графигі' },
  btn_graph_hide: { ru: 'Скрыть график', kz: 'Графикті жасыру' },
  btn_sound_on: { ru: 'Звук: вкл', kz: 'Дыбыс: қосулы' },
  btn_sound_off: { ru: 'Звук: выкл', kz: 'Дыбыс: өшірулі' },
  btn_timer_on: { ru: 'Таймер: вкл', kz: 'Таймер: қосулы' },
  btn_timer_off: { ru: 'Таймер: выкл', kz: 'Таймер: өшірулі' },
  btn_reset: { ru: 'Сбросить прогресс', kz: 'Прогресті өшіру' },
  graph_title: { ru: 'Новые слова за 7 дней', kz: '7 күндегі жаңа сөздер' },
  graph_stat_total: { ru: 'Всего слов', kz: 'Барлық сөздер' },
  graph_stat_known: { ru: 'Изучено', kz: 'Жатталды' },
  graph_stat_left: { ru: 'Осталось', kz: 'Қалды' },
  footer_title: { ru: '3000 самых важных английских слов · <strong>Қазақша</strong> / Русский', kz: 'Ең маңызды 3000 ағылшын сөзі · <strong>Қазақша</strong> / Орысша' },
  footer_desc: { ru: 'Делись с друзьями — открывается в любом браузере', kz: 'Достарыңызбен бөлісіңіз — кез келген браузерде ашылады' },
  confirm_reset: { ru: 'Сбросить весь прогресс? Это нельзя отменить.', kz: 'Барлық прогресті өшіру керек пе? Бұны кері қайтару мүмкін емес.' },
  btn_back: { ru: '← Назад', kz: '← Артқа' },
  card_hint: { ru: 'Нажми, чтобы перевернуть', kz: 'Аудару үшін басыңыз' },
  card_hint_knew: { ru: 'Ты знал это слово?', kz: 'Бұл сөзді білдіңіз бе?' },
  btn_wrong: { ru: '✗ Не знал', kz: '✗ Білмедім' },
  btn_correct: { ru: '✓ Знал!', kz: '✓ Білдім!' },
  btn_skip: { ru: '→ Пропустить', kz: '→ Өткізіп жіберу' },
  btn_next: { ru: 'Следующая →', kz: 'Келесі →' },
  lbl_eng_word: { ru: 'Английское слово', kz: 'Ағылшын сөзі' },
  lbl_kz_trans: { ru: 'Қазақша аударма', kz: 'Қазақша аударма' },
  lbl_ru_trans: { ru: 'Перевод на русский', kz: 'Орысша аударма' },
  lbl_kz_trans_lbl: { ru: 'Қазақша аудармасы', kz: 'Қазақша аударма' },
  lbl_ru_trans_lbl: { ru: 'Русский перевод', kz: 'Орысша аударма' },
  q_translate_kz: { ru: 'Қазақшаға аудар:', kz: 'Қазақшаға аударыңыз:' },
  q_translate_ru: { ru: 'Переведи на русский:', kz: 'Орысшаға аударыңыз:' },
  q_guess_en_kz: { ru: 'Ағылшынша қалай болады?', kz: 'Ағылшын тілінде қалай?' },
  q_guess_en_ru: { ru: 'Какое английское слово?', kz: 'Ағылшын сөзін табыңыз:' },
  t_translate_kz: { ru: 'Қазақша аудармасын жаз:', kz: 'Қазақша аудармасын жазыңыз:' },
  t_translate_ru: { ru: 'Введи перевод на русский:', kz: 'Орысша аудармасын жазыңыз:' },
  t_guess_en_kz: { ru: 'Ағылшынша сөзді жаз:', kz: 'Ағылшын сөзін жазыңыз:' },
  t_guess_en_ru: { ru: 'Введи английское слово:', kz: 'Ағылшын сөзін жазыңыз:' },
  placeholder_type: { ru: 'Введи ответ...', kz: 'Жауапты жазыңыз...' },
  btn_show_ans: { ru: 'Показать ответ', kz: 'Жауапты көрсету' },
  btn_check_ans: { ru: 'Проверить', kz: 'Тексеру' },
  fb_correct: { ru: 'Правильно! ✓', kz: 'Дұрыс! ✓' },
  fb_wrong_pre: { ru: 'Неверно. Ответ: <b>', kz: 'Қате. Жауап: <b>' },
  fb_wrong_post: { ru: '</b>', kz: '</b>' },
  fb_ans_pre: { ru: 'Ответ: <b>', kz: 'Жауап: <b>' },
  fb_ans_post: { ru: '</b>', kz: '</b>' },
  empty_review: { ru: 'На сегодня нет слов для повторения.<br>Учи новые слова или возвращайся завтра!', kz: 'Бүгінге қайталайтын сөздер жоқ.<br>Жаңа сөздер үйреніңіз немесе ертең келіңіз!' },
  empty_level: { ru: 'Нет слов для выбранных уровней.', kz: 'Таңдалған деңгейлер үшін сөздер жоқ.' },
  res_words_learned: { ru: 'слов изучено!', kz: 'сөз жатталды!' },
  res_repeat: { ru: 'Повторить:', kz: 'Қайталау:' },
  res_words: { ru: 'слов', kz: 'сөз' },
  res_passed: { ru: 'Пройдено:', kz: 'Өтілді:' },
  res_cards: { ru: 'карточек', kz: 'карта' },
  btn_restart: { ru: 'Начать заново', kz: 'Қайтадан бастау' },
  btn_repeat_errs: { ru: 'Повторить ошибки', kz: 'Қателерді қайталау' },
  kbd_hint: { ru: 'Пробел — перевернуть · 1/2 — ответ · ←/→ — навигация', kz: 'Бос орын — аудару · 1/2 — жауап · ←/→ — навигация' },
  goal_today: { ru: 'Сегодня:', kz: 'Бүгін:' },
  goal_select_title: { ru: 'Цель на день (слов)', kz: 'Күндік мақсат (сөз)' },
  goal_reached: { ru: 'Цель дня достигнута!', kz: 'Күндік мақсат орындалды!' },
  btn_export: { ru: '⬇ Экспорт', kz: '⬇ Экспорт' },
  btn_import: { ru: '⬆ Импорт', kz: '⬆ Импорт' },
  confirm_import: { ru: 'Импорт заменит текущий прогресс. Продолжить?', kz: 'Импорт ағымдағы прогресті ауыстырады. Жалғастыру керек пе?' },
  import_ok: { ru: 'Прогресс импортирован!', kz: 'Прогресс импортталды!' },
  import_err: { ru: 'Не удалось прочитать файл. Это точно экспорт Sózdik 3000?', kz: 'Файлды оқу мүмкін болмады. Бұл Sózdik 3000 экспорты ма?' },
  btn_srs_stats: { ru: 'SRS статистика', kz: 'SRS статистикасы' },
  btn_srs_hide:  { ru: 'Скрыть SRS', kz: 'SRS жасыру' },
  srs_title:     { ru: 'Распределение по коробкам (система Лейтнера)', kz: 'Коробкалар бойынша бөлу (Лейтнер жүйесі)' },
  srs_box0:      { ru: 'Коробка 0 — новые / ошибки', kz: 'Коробка 0 — жаңа / қате' },
  srs_box_n:     { ru: 'Коробка', kz: 'Коробка' },
  srs_interval:  { ru: 'дн.', kz: 'күн' },
  srs_notstarted:{ ru: 'Не начато', kz: 'Басталмаған' },
  srs_due_title: { ru: 'К повторению', kz: 'Қайталауға' },
  srs_due_today: { ru: 'Сегодня', kz: 'Бүгін' },
  srs_due_3d:    { ru: '3 дня', kz: '3 күн' },
  srs_due_7d:    { ru: '7 дней', kz: '7 күн' },
  srs_due_later: { ru: '14+ дней', kz: '14+ күн' },
  srs_velocity:  { ru: 'Темп (7 дн.)', kz: 'Қарқын (7 күн)' },
  srs_wd_day:    { ru: 'сл/день', kz: 'сөз/күн' },
  hero_eyebrow:  { ru: 'тренажёр · 3000 слов', kz: 'жаттықтырғыш · 3000 сөз' },
  btn_intro:     { ru: 'Заставка', kz: 'Кіріспе' },
  btn_share:     { ru: 'Поделиться', kz: 'Бөлісу' },
  share_eyebrow: { ru: 'МОЙ ПРОГРЕСС', kz: 'МЕНІҢ ПРОГРЕСІМ' },
  share_learned: { ru: 'слов выучено', kz: 'сөз жатталды' },
  share_streak:  { ru: 'дней подряд', kz: 'күн қатарынан' },
  share_done:    { ru: 'пройдено', kz: 'аяқталды' },
  share_cta:     { ru: 'Учи английский бесплатно', kz: 'Ағылшын тілін тегін үйрен' },
  share_title:   { ru: 'Мой прогресс в Sózdik 3000', kz: 'Sózdik 3000-дегі прогресім' }
};

// Витрина hero: проверенная вручную IPA-транскрипция для «живой статьи»
const SHOWCASE = [
  { w: 'language',  ipa: '/ˈlæŋɡwɪdʒ/', pos: 'noun',  lvl: 'A1', kz: 'тіл',      ru: 'язык' },
  { w: 'beautiful', ipa: '/ˈbjuːtɪfl/',  pos: 'adj.',  lvl: 'A1', kz: 'әдемі',    ru: 'красивый' },
  { w: 'remember',  ipa: '/rɪˈmembə/',   pos: 'verb',  lvl: 'A2', kz: 'есте сақтау', ru: 'помнить' },
  { w: 'knowledge', ipa: '/ˈnɒlɪdʒ/',    pos: 'noun',  lvl: 'B1', kz: 'білім',    ru: 'знание' },
  { w: 'achieve',   ipa: '/əˈtʃiːv/',     pos: 'verb',  lvl: 'B1', kz: 'қол жеткізу', ru: 'достигать' },
  { w: 'curious',   ipa: '/ˈkjʊəriəs/',  pos: 'adj.',  lvl: 'B2', kz: 'қызық',    ru: 'любопытный' }
];
let heroIdx = 0;
let heroTimer = null;

// ===== КАСТОМНЫЕ ЛИНЕЙНЫЕ ИКОНКИ (вместо эмодзи) =====
// Единый стиль: обводка currentColor, viewBox 24, без заливки
const ICONS = {
  // категории
  core:    '<path d="M4 5h16v10H9l-4 4v-4H4z"/>',
  people:  '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5.8"/><path d="M17.5 13.2a5.5 5.5 0 0 1 3 4.8"/>',
  home:    '<path d="M4 11l8-6 8 6"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
  edu:     '<path d="M12 5l9 4-9 4-9-4 9-4z"/><path d="M6 11v4c0 1.2 2.7 2.6 6 2.6s6-1.4 6-2.6v-4"/><path d="M21 9v4"/>',
  travel:  '<path d="M3 11l17-6-6 17-3-7-8-4z"/>',
  food:    '<path d="M8 3v18"/><path d="M5.5 3v4.5a2.5 2.5 0 0 0 5 0V3"/><path d="M16.5 3c-1.3 0-2 2-2 4.6s.8 4 2 4 2-1.4 2-4-.7-4.6-2-4.6z"/><path d="M16.5 11.6V21"/>',
  health:  '<path d="M3 12h4l2-5 3 10 2.5-7H21"/>',
  nature:  '<path d="M5 19c0-8 6-13 14-14 1 8-5 15-14 14z"/><path d="M9 15c2-3.5 4.5-5 8-6"/>',
  business:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7"/><path d="M3 13h18"/>',
  tech:    '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  art:     '<path d="M3 21c0-2.6 1.6-4 3.4-4 1.4 0 2.4 1 2.4 2.3S7.8 21 6 21H3z"/><path d="M9 16.5L17.5 8a2.1 2.1 0 0 1 3 3L12 19.5"/>',
  sport:   '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5c3.2 3 3.2 14 0 17"/><path d="M3.5 12h17"/>',
  // режимы
  flash:   '<rect x="4" y="7" width="13" height="13" rx="2"/><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4H19a1.5 1.5 0 0 1 1.5 1.5V15"/>',
  quiz:    '<path d="M4 7h7"/><path d="M4 12h7"/><path d="M4 17h7"/><path d="M14.5 7.5l1.5 1.5L19.5 5.5"/><path d="M14.5 16l1.5 1.5L19.5 14"/>',
  type:    '<path d="M4 16.2V20h3.8L18.5 9.3 14.7 5.5 4 16.2z"/><path d="M13 7.2l3.8 3.8"/>',
  review:  '<path d="M20 12a8 8 0 1 0-1.6 4.8"/><path d="M20 5.5V11h-5.5"/>',
  // тулбар и прочее
  sound:   '<path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4z"/><path d="M16 9.5a4 4 0 0 1 0 5"/>',
  mute:    '<path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4z"/><path d="M16.5 10l4 4M20.5 10l-4 4"/>',
  timer:   '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5"/><path d="M9.5 2.5h5"/>',
  graph:   '<path d="M5 20v-5"/><path d="M12 20V8"/><path d="M19 20v-9"/><path d="M3.5 20h17"/>',
  srs:     '<path d="M3 7.5l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4"/><path d="M3 16.5l9 4 9-4"/>',
  export:  '<path d="M12 4v10"/><path d="M8 10l4 4 4-4"/><path d="M5 19h14"/>',
  import:  '<path d="M12 14V4"/><path d="M8 8l4-4 4 4"/><path d="M5 19h14"/>',
  reset:   '<path d="M5 7h14"/><path d="M9.5 7V5h5v2"/><path d="M7 7l1 13h8l1-13"/><path d="M10 11v6M14 11v6"/>',
  shuffle: '<path d="M4 7h3.5l8.5 10H20"/><path d="M4 17h3.5l3-3.6"/><path d="M16.5 5.5L20 7l-3.5 1.5"/><path d="M16.5 15.5L20 17l-3.5 1.5"/>',
  goal:    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none"/>',
  flame:   '<path d="M12 3c1.2 4-2 5.2-2 8.2a2.5 2.5 0 0 0 5 0c0-1-.4-1.9-1-2.6 2.2 1 3.4 3 3.4 5.2a5.4 5.4 0 0 1-10.8 0C6.6 9.5 10.8 7.7 12 3z"/>',
  play:    '<path d="M7 5l11 7-11 7z"/>',
  share:   '<path d="M12 4v11"/><path d="M8 8l4-4 4 4"/><path d="M6 12v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6"/>',
  settings:'<circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4L6 18M18 18l-1.6-1.6M7.6 7.6L6 6"/>',
  close:   '<path d="M6 6l12 12M18 6L6 18"/>',
  check:   '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
};

function svgIcon(name, cls) {
  const inner = ICONS[name];
  if (!inner) return '';
  return `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

// Заполняет все элементы с data-ic соответствующей иконкой
function paintIcons() {
  document.querySelectorAll('[data-ic]').forEach(el => {
    const name = el.getAttribute('data-ic');
    if (ICONS[name]) el.innerHTML = svgIcon(name);
  });
}

function t(key) {
  if(!UI_TEXT[key]) return key;
  return UI_TEXT[key][appLang];
}

// Экранирование пользовательских/словарных строк перед вставкой в HTML
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function updateUI() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.innerHTML = t(el.getAttribute('data-i18n'));
  });
  document.documentElement.lang = appLang === 'kz' ? 'kk' : 'ru';
  // Текст кнопок пишем в .btn-tx, чтобы не затирать иконку
  const setBtn = (id, text) => {
    const tx = document.querySelector('#' + id + ' .btn-tx');
    if(tx) tx.textContent = text;
  };
  setBtn('sound-btn', soundOn ? t('btn_sound_on') : t('btn_sound_off'));
  const soundIc = document.querySelector('#sound-btn .btn-ic');
  if(soundIc) soundIc.innerHTML = svgIcon(soundOn ? 'sound' : 'mute');
  setBtn('timer-btn', timerOn ? t('btn_timer_on') : t('btn_timer_off'));
  const area = document.getElementById('graph-area');
  setBtn('graph-btn', (area && !area.hidden) ? t('btn_graph_hide') : t('btn_graph'));
  const srsArea = document.getElementById('srs-stats-area');
  setBtn('srs-stats-btn', (srsArea && !srsArea.hidden) ? t('btn_srs_hide') : t('btn_srs_stats'));
  if(srsArea && !srsArea.hidden) drawSrsStats();

  const inp = document.getElementById('type-inp');
  if(inp) inp.placeholder = t('placeholder_type');
  const goalSel = document.getElementById('goal-select');
  if(goalSel) goalSel.title = t('goal_select_title');
  updateGoalUI();
}

// ===== НАСТРОЙКИ =====
function saveSettings() {
  localStorage.setItem('ox_settings', JSON.stringify({ lang: appLang, sound: soundOn, timer: timerOn, goal: dailyGoal }));
}
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('ox_settings') || '{}');
    if(s.lang === 'ru' || s.lang === 'kz') appLang = s.lang;
    if(typeof s.sound === 'boolean') soundOn = s.sound;
    if(typeof s.timer === 'boolean') timerOn = s.timer;
    if([10,20,50,100].includes(s.goal)) dailyGoal = s.goal;
  } catch(e) { /* повреждённые настройки — остаются значения по умолчанию */ }
  const btnKz = document.getElementById('ls-kz');
  const btnRu = document.getElementById('ls-ru');
  if(btnKz) btnKz.classList.toggle('active', appLang === 'kz');
  if(btnRu) btnRu.classList.toggle('active', appLang === 'ru');
  const sel = document.getElementById('goal-select');
  if(sel) sel.value = String(dailyGoal);
}

function setDailyGoal(v) {
  dailyGoal = Number(v);
  saveSettings();
  updateGoalUI();
  if(typeof renderLessonStart === 'function' && !sessionActive) renderLessonStart();
}

// ===== СОХРАНЕНИЕ / ЗАГРУЗКА ПРОГРЕССА =====
// Календарная дата по МЕСТНОМУ времени (YYYY-MM-DD).
// toISOString() считает в UTC: к востоку от Гринвича (Казахстан, UTC+5)
// сутки начинались в 05:00, а «через день» превращалось в «сегодня».
function dateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function todayKey() { return dateKey(new Date()); }

function loadHistory() {
  try { return JSON.parse(localStorage.getItem('ox_history') || '[]'); }
  catch(e) { return []; }
}

// Миграция старого формата истории {date, known} → {date, known, learned}
function migrateHistory(history) {
  if(!history.length || 'learned' in history[history.length-1]) return history;
  let prev = 0;
  return history.map(e => {
    const learned = 'learned' in e ? e.learned : Math.max(0, (e.known || 0) - prev);
    prev = e.known || 0;
    return { date: e.date, known: e.known || 0, learned };
  });
}

// Засчитывает новое выученное слово в историю текущего дня
function bumpLearnedToday() {
  const today = todayKey();
  let history = migrateHistory(loadHistory());
  let entry = history.find(e => e.date === today);
  if(!entry) { entry = { date: today, known: 0, learned: 0 }; history.push(entry); }
  entry.learned++;
  entry.known = known.size;
  if(history.length > 60) history = history.slice(-60);
  localStorage.setItem('ox_history', JSON.stringify(history));
  updateStreak();
  updateGoalUI();
  if(entry.learned === dailyGoal) {
    launchConfetti();
    const lbl = document.getElementById('goal-label');
    if(lbl) { lbl.textContent = t('goal_reached'); setTimeout(updateGoalUI, 2500); }
  }
}

// Показанные сегодня новые слова: ответ дан хотя бы раз, верно или нет
function bumpIntroducedToday() {
  const today = todayKey();
  let history = migrateHistory(loadHistory());
  let entry = history.find(e => e.date === today);
  if(!entry) { entry = { date: today, known: known.size, learned: 0 }; history.push(entry); }
  entry.introduced = (entry.introduced || 0) + 1;
  if(history.length > 60) history = history.slice(-60);
  localStorage.setItem('ox_history', JSON.stringify(history));
}
function introducedToday() {
  const entry = migrateHistory(loadHistory()).find(e => e.date === todayKey());
  // в записях до этого изменения поля нет, но выученные слова тоже были показаны
  return entry ? Math.max(entry.introduced || 0, entry.learned || 0) : 0;
}

function learnedToday() {
  const entry = migrateHistory(loadHistory()).find(e => e.date === todayKey());
  return entry ? entry.learned : 0;
}

function updateGoalUI() {
  const lbl = document.getElementById('goal-label');
  const fill = document.getElementById('goal-fill');
  if(!lbl || !fill) return;
  const n = learnedToday();
  lbl.textContent = `${t('goal_today')} ${n} / ${dailyGoal}`;
  fill.style.transform = 'scaleX(' + Math.min(1, n / dailyGoal) + ')';
  fill.classList.toggle('done', n >= dailyGoal);
}

// ===== ИНТЕРВАЛЬНОЕ ПОВТОРЕНИЕ (система Лейтнера) =====
// Коробка 0 — не знал/новое (повтор сегодня), 1..5 — интервалы в днях до следующего показа
const SRS_INTERVALS = [0, 1, 3, 7, 14, 30];

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  // полдень, а не полночь: переход на летнее время не может сдвинуть дату
  return dateKey(new Date(y, m - 1, d + n, 12));
}

// Правильный ответ: слово поднимается на коробку выше, следующий показ позже
function srsCorrect(word) {
  const box = Math.min((srs[word] ? srs[word].box : 0) + 1, 5);
  srs[word] = { box, due: addDays(todayKey(), SRS_INTERVALS[box]) };
  known.add(word);
}

// Ошибка: слово падает в коробку 0 и доступно к повторению сразу
function srsWrong(word) {
  srs[word] = { box: 0, due: todayKey() };
  known.delete(word);
}

function dueCount() {
  const today = todayKey();
  return Object.keys(srs).reduce((n, w) => n + (srs[w].due <= today ? 1 : 0), 0);
}

function rebuildKnown() {
  known = new Set(Object.keys(srs).filter(w => srs[w].box >= 1));
}

function saveProgress() {
  localStorage.setItem('ox_progress', JSON.stringify({ v: 2, srs }));
}

function loadProgress() {
  try {
    const raw = localStorage.getItem('ox_progress');
    if(!raw) return;
    const data = JSON.parse(raw);
    if(data.v === 2 && data.srs) {
      srs = data.srs;
    } else {
      // Миграция формата v1 {known, repeat}: выученные — в коробку 3, ошибки — в коробку 0
      const today = todayKey();
      (data.known || []).forEach(w => { srs[w] = { box: 3, due: addDays(today, SRS_INTERVALS[3]) }; });
      (data.repeat || []).forEach(w => { srs[w] = { box: 0, due: today }; });
    }
    rebuildKnown();
  } catch(e) { /* повреждённый прогресс — начинаем с чистого */ }
}

function resetProgress() {
  if(!confirm(t('confirm_reset'))) return;
  localStorage.removeItem('ox_progress');
  localStorage.removeItem('ox_history');
  known = new Set(); srs = {}; reviewDeck = []; correctStreak = 0;
  updateStreak();
  updateReturning();
  if(mode === 'review') buildReviewDeck();
  newCard(0);
  renderLessonStart();
  render();
}

// ===== ЭКСПОРТ / ИМПОРТ ПРОГРЕССА =====
function exportProgress() {
  const data = {
    app: 'sozdik3000',
    version: 2,
    exported: new Date().toISOString(),
    settings: { lang: appLang, sound: soundOn, timer: timerOn, goal: dailyGoal },
    progress: { v: 2, srs },
    history: loadHistory()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sozdik3000-progress-' + todayKey() + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importProgress(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      // 'oxford3000' — старое имя приложения, принимаем для совместимости экспортов
      if((data.app !== 'sozdik3000' && data.app !== 'oxford3000') || !data.progress) throw new Error('bad format');
      if(!confirm(t('confirm_import'))) return;
      localStorage.setItem('ox_progress', JSON.stringify(data.progress));
      if(Array.isArray(data.history)) localStorage.setItem('ox_history', JSON.stringify(data.history));
      if(data.settings) localStorage.setItem('ox_settings', JSON.stringify(data.settings));
      srs = {};
      loadSettings();
      loadProgress();
      updateStreak();
      updateUI();
      if(mode === 'review') buildReviewDeck();
      newCard(0);
      render();
      alert(t('import_ok'));
    } catch(e) {
      alert(t('import_err'));
    }
  };
  reader.readAsText(file);
}

// ===== СТРИК: дни, когда выучено хотя бы одно новое слово =====
function currentStreak() {
  const history = migrateHistory(loadHistory());
  const byDate = new Map(history.map(e => [e.date, e]));
  let streak = 0;
  const check = new Date();
  // Если сегодня ещё не занимался — стрик не сгорает, отсчёт со вчерашнего дня
  const todayEntry = byDate.get(todayKey());
  if(!todayEntry || !todayEntry.learned) check.setDate(check.getDate() - 1);
  for(let i = 0; i < 365; i++) {
    const e = byDate.get(dateKey(check));
    if(e && e.learned > 0) { streak++; check.setDate(check.getDate() - 1); }
    else break;
  }
  return streak;
}
function updateStreak() {
  const streak = currentStreak();
  const el = document.getElementById('hs-streak');
  if(el) el.innerHTML = streak + (streak > 0 ? ' ' + svgIcon('flame', 'ic-flame') : '');
}

// ===== ЗВУК =====
function speak(text) {
  if(!soundOn || !window.speechSynthesis) return;
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'en-US'; utt.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utt);
}
function toggleSound() {
  soundOn = !soundOn;
  saveSettings();
  updateUI();
}
function toggleTimer() {
  timerOn = !timerOn;
  saveSettings();
  updateUI();
  if(!timerOn) stopTimer();
  if(mode === 'quiz') render();
}

function getTrans(w) {
  if (!w) return '';
  if (appLang === 'kz') return w.length > 3 ? w[3] : '';
  return w.length > 4 ? w[4] : (w.length > 3 ? w[3] : '');
}

// IPA-транскрипция слова (7-е поле), если есть
function getIPA(w) {
  return (w && w.length > 6 && w[6]) ? w[6] : '';
}

// ===== ТАЙМЕР =====
function startTimer(onTimeout) {
  clearInterval(timerInterval);
  timerSeconds = 10;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timerSeconds--;
    updateTimerDisplay();
    if(timerSeconds <= 0) { clearInterval(timerInterval); if(onTimeout) onTimeout(); }
  }, 1000);
}
function stopTimer() { clearInterval(timerInterval); }
function updateTimerDisplay() {
  const d = document.getElementById('timer-display');
  if(!d) return;
  const color = timerSeconds <= 3 ? 'var(--red)' : timerSeconds <= 6 ? 'var(--amber)' : 'var(--green)';
  d.textContent = timerSeconds + 's';
  d.style.color = color; d.style.borderColor = color;
}

// ===== КОНФЕТТИ =====
function launchConfetti() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const pieces = Array.from({length:120}, () => ({
    x:Math.random()*canvas.width, y:Math.random()*canvas.height - canvas.height,
    r:Math.random()*6+4, c:['#C8841E','#2E4F6B','#3E6B53','#B04A39','#E0A458','#5C7C99'][Math.floor(Math.random()*6)],
    vx:(Math.random()-0.5)*4, vy:Math.random()*4+2, angle:Math.random()*360, va:(Math.random()-0.5)*8
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pieces.forEach(p => {
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.angle*Math.PI/180);
      ctx.fillStyle=p.c; ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*0.5); ctx.restore();
      p.x+=p.vx; p.y+=p.vy; p.angle+=p.va;
    });
    frame++;
    if(frame < 120) requestAnimationFrame(draw); else canvas.remove();
  }
  draw();
}

function setAppLang(l) {
  appLang = l;
  const btnKz = document.getElementById('ls-kz');
  const btnRu = document.getElementById('ls-ru');
  if(btnKz) btnKz.classList.toggle('active', l === 'kz');
  if(btnRu) btnRu.classList.toggle('active', l === 'ru');
  saveSettings();
  updateUI();
  render();
}

// ===== ГРАФИК =====
function toggleGraph() {
  const area = document.getElementById('graph-area');
  const tx = document.querySelector('#graph-btn .btn-tx');
  if(area.hidden) {
    area.hidden = false; if(tx) tx.textContent = t('btn_graph_hide'); drawGraph();
    area.classList.remove('fade-up'); void area.offsetWidth; area.classList.add('fade-up');
  } else { area.hidden = true; if(tx) tx.textContent = t('btn_graph'); }
}

function drawGraph() {
  const history = migrateHistory(loadHistory());
  const canvas = document.getElementById('progress-chart');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.parentElement.offsetWidth - 40 || 500; canvas.height = 120;
  const days = [];
  const locale = appLang === 'kz' ? 'kk' : 'ru';
  for(let i=6; i>=0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    const key = dateKey(d);
    const entry = history.find(e=>e.date===key);
    days.push({label:d.toLocaleDateString(locale,{weekday:'short'}), learned: entry ? entry.learned : 0});
  }
  const max = Math.max(...days.map(d=>d.learned), 10);
  const W=canvas.width, H=canvas.height, padL=10, padR=10, padT=14, padB=22;
  const gW=W-padL-padR, gH=H-padT-padB, gap=gW/days.length, barW=gap*0.55;
  ctx.clearRect(0,0,W,H);
  [0.5,1].forEach(f => {
    ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1;
    const y=padT+gH*(1-f); ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(W-padR,y); ctx.stroke();
  });
  days.forEach((d,i) => {
    const x = padL + i*gap + gap/2 - barW/2;
    const barH = d.learned > 0 ? Math.max((d.learned/max)*gH, 4) : 3;
    const y = padT + gH - barH;
    const grad = ctx.createLinearGradient(0,y,0,padT+gH);
    grad.addColorStop(0,'#6c63ff'); grad.addColorStop(1,'#a78bfa');
    ctx.fillStyle = d.learned > 0 ? grad : 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.roundRect(x,y,barW,barH,3); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font='10px sans-serif'; ctx.textAlign='center';
    ctx.fillText(d.label, x+barW/2, H-5);
    if(d.learned>0){ ctx.fillStyle='rgba(255,255,255,0.75)'; ctx.font='bold 10px sans-serif'; ctx.fillText(d.learned, x+barW/2, y-3); }
  });
  const statsEl = document.getElementById('graph-stats');
  if(statsEl) {
    const total=WORDS.length;
    statsEl.innerHTML = [
      {label:t('graph_stat_total'),val:total,color:'var(--text)'},
      {label:t('graph_stat_known'),val:known.size,color:'var(--green)'},
      {label:t('graph_stat_left'),val:total-known.size,color:'var(--amber)'}
    ].map(s=>`<div style="background:var(--surface2);border-radius:10px;padding:10px;text-align:center">
      <div style="font-size:20px;font-weight:700;color:${s.color};font-family:Syne,sans-serif">${s.val}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">${s.label}</div></div>`).join('');
  }
}

// ===== SRS СТАТИСТИКА =====
function toggleSrsStats() {
  const area = document.getElementById('srs-stats-area');
  const tx = document.querySelector('#srs-stats-btn .btn-tx');
  if(area.hidden) {
    area.hidden = false;
    if(tx) tx.textContent = t('btn_srs_hide');
    drawSrsStats();
    area.classList.remove('fade-up'); void area.offsetWidth; area.classList.add('fade-up');
  } else {
    area.hidden = true;
    if(tx) tx.textContent = t('btn_srs_stats');
  }
}

function drawSrsStats() {
  const area = document.getElementById('srs-stats-area');
  if(!area || area.style.display === 'none') return;

  const today = todayKey();
  const intervals = SRS_INTERVALS; // [0,1,3,7,14,30]
  const boxLabels = ['0', '1 (+1 '+t('srs_interval')+')', '2 (+3 '+t('srs_interval')+')',
                     '3 (+7 '+t('srs_interval')+')', '4 (+14 '+t('srs_interval')+')', '5 (+30 '+t('srs_interval')+')'];
  const boxColors = ['var(--red)','#f97316','var(--amber)','var(--blue)','var(--green)','#a78bfa'];

  // Count words per box (only words that have been touched)
  const boxCounts = [0,0,0,0,0,0];
  Object.values(srs).forEach(s => { if(s.box >= 0 && s.box <= 5) boxCounts[s.box]++; });
  const notStarted = WORDS.length - Object.keys(srs).length;
  const maxBox = Math.max(...boxCounts, 1);

  // Due schedule
  const d1 = addDays(today, 1), d3 = addDays(today, 3), d7 = addDays(today, 7);
  let dueToday = 0, due3d = 0, due7d = 0, dueLater = 0;
  Object.values(srs).forEach(s => {
    if(s.due <= today) dueToday++;
    else if(s.due <= d1) due3d++;
    else if(s.due <= d3) due3d++;
    else if(s.due <= d7) due7d++;
    else dueLater++;
  });

  // Learning velocity (avg per day over last 7 days)
  const history = migrateHistory(loadHistory());
  const last7 = [];
  for(let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const entry = history.find(e => e.date === key);
    last7.push(entry ? entry.learned : 0);
  }
  const activeDays = last7.filter(n => n > 0).length;
  const totalLearned7 = last7.reduce((a,b) => a+b, 0);
  const velocity = activeDays > 0 ? Math.round(totalLearned7 / 7 * 10) / 10 : 0;

  // Box distribution bars
  const boxRows = boxCounts.map((count, i) => {
    const pct = Math.round(count / maxBox * 100);
    const label = i === 0 ? t('srs_box0') : `${t('srs_box_n')} ${i} (+${intervals[i]} ${t('srs_interval')})`;
    return `<div class="srs-box-row">
      <div class="srs-box-label">${label}</div>
      <div class="srs-box-bar-wrap">
        <div class="srs-box-bar" style="transform:scaleX(${Math.max(pct,count>0?2:0)/100});background:${boxColors[i]}"></div>
      </div>
      <div class="srs-box-count" style="color:${boxColors[i]}">${count}</div>
    </div>`;
  }).join('');

  // Not-started row
  const notStartedPct = Math.round(notStarted / Math.max(notStarted, maxBox) * 100);
  const notStartedRow = `<div class="srs-box-row">
    <div class="srs-box-label" style="color:var(--muted)">${t('srs_notstarted')}</div>
    <div class="srs-box-bar-wrap">
      <div class="srs-box-bar" style="transform:scaleX(${Math.min(notStartedPct,100)/100});background:var(--rule)"></div>
    </div>
    <div class="srs-box-count" style="color:var(--muted)">${notStarted}</div>
  </div>`;

  area.innerHTML = `
  <div class="srs-title">${t('srs_title')}</div>
  <div class="srs-boxes">${boxRows}${notStartedRow}</div>
  <div class="srs-grid">
    <div class="srs-section">
      <div class="srs-section-title">${t('srs_due_title')}</div>
      <div class="srs-due-row">
        <div class="srs-due-cell"><div class="srs-due-num" style="color:var(--red)">${dueToday}</div><div class="srs-due-lbl">${t('srs_due_today')}</div></div>
        <div class="srs-due-cell"><div class="srs-due-num" style="color:var(--amber)">${due3d}</div><div class="srs-due-lbl">${t('srs_due_3d')}</div></div>
        <div class="srs-due-cell"><div class="srs-due-num" style="color:var(--blue)">${due7d}</div><div class="srs-due-lbl">${t('srs_due_7d')}</div></div>
        <div class="srs-due-cell"><div class="srs-due-num" style="color:var(--muted)">${dueLater}</div><div class="srs-due-lbl">${t('srs_due_later')}</div></div>
      </div>
    </div>
    <div class="srs-section">
      <div class="srs-section-title">${t('srs_velocity')}</div>
      <div class="srs-velocity"><span class="srs-vel-num">${velocity}</span> <span class="srs-vel-unit">${t('srs_wd_day')}</span></div>
    </div>
  </div>`;
}

function getBaseLevel(w) {
  const l = w[2];
  if(l.startsWith('A1')) return 'A1';
  if(l.startsWith('A2')) return 'A2';
  if(l.startsWith('B1')) return 'B1';
  return 'B2';
}

function getCat(w) {
  return w.length > 5 ? w[5] : 'cat_core';
}

function inSelection(w) {
  return activeLevels.has(getBaseLevel(w)) && activeCats.has(getCat(w));
}

// ===== КОЛОДЫ =====
function getActiveDeck() {
  if(sessionActive) return sessionDeck;
  return mode === 'review' ? reviewDeck : deck;
}

// ===== ЗАНЯТИЕ =====
// План на сегодня: просроченные повторения + новые слова до дневной цели.
// Новые берём от простого к сложному (A1 → B2), внутри уровня — вперемешку,
// чтобы урок не начинался каждый раз с одних и тех же слов.
const LEVEL_ORDER = { A1: 0, A2: 1, B1: 2, B2: 3 };

// Тасовка Фишера–Йетса на месте (sort(() => Math.random()-.5) даёт смещённый порядок)
function shuffle(a) {
  for(let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function planSession() {
  const today = todayKey();
  const pool = WORDS.filter(inSelection);
  const due = pool.filter(w => srs[w[0]] && srs[w[0]].due <= today);
  // Лимит — по ПОКАЗАННЫМ сегодня новым словам: иначе тот, кто ошибается,
  // получал бы всё новые слова поверх растущей кучи повторений
  const remaining = Math.max(0, dailyGoal - introducedToday());
  let fresh = [];
  if(remaining > 0) {
    const candidates = pool.filter(w => !srs[w[0]])
      .sort((a, b) => LEVEL_ORDER[getBaseLevel(a)] - LEVEL_ORDER[getBaseLevel(b)]);
    // берём запас из ближайших по сложности и тасуем — свежесть без потери порядка уровней
    fresh = shuffle(candidates.slice(0, remaining * 3)).slice(0, remaining);
  }
  sessionPlan = { fresh, due };
  return sessionPlan;
}

function sessionLength(plan) {
  return Math.min(plan.fresh.length + plan.due.length, SESSION_MAX);
}

// Экран старта: единственное решение, которое нужно принять
function renderLessonStart() {
  const plan = planSession();
  const total = sessionLength(plan);
  const set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  set('ls-new', plan.fresh.length);
  set('ls-due', plan.due.length);

  const go = document.getElementById('ls-go');
  const time = document.getElementById('ls-time');
  const poolEmpty = WORDS.filter(inSelection).length === 0;
  if(go) {
    const lbl = go.querySelector('[data-i18n]');
    if(poolEmpty) {
      go.disabled = true;
      if(lbl) lbl.textContent = t('ls_empty');
    } else if(total === 0) {
      go.disabled = false;
      if(lbl) lbl.textContent = t('ls_extra');
    } else {
      go.disabled = false;
      if(lbl) lbl.textContent = t('ls_start');
    }
  }
  if(time) {
    time.textContent = poolEmpty ? ''
      : total === 0 ? t('ls_all_done')
      : '≈ ' + Math.max(1, Math.round(total * 12 / 60)) + ' ' + t('ls_minutes');
  }

  // Область охвата: какие уровни и категории выбраны
  const scope = document.getElementById('ls-scope');
  if(scope) {
    const lv = ['A1','A2','B1','B2'].filter(l => activeLevels.has(l));
    const lvTxt = lv.length === 4 ? 'A1–B2' : lv.join(', ');
    const catTxt = activeCats.size === 12
      ? t('scope_all_cats')
      : activeCats.size + ' ' + t('scope_cats');
    scope.textContent = lvTxt + ' · ' + catTxt;
  }
}

function startSession() {
  // План пересчитываем при старте: вкладка могла пролежать открытой через полночь
  const plan = planSession();
  // Повторения и новые чередуются, чтобы урок не делился на два скучных блока.
  // Если на сегодня всё закрыто — свободная тренировка по выбранным фильтрам.
  let d = [...plan.due, ...plan.fresh];
  if(d.length === 0) d = WORDS.filter(inSelection);
  d = shuffle(d.slice()).slice(0, SESSION_MAX);
  if(d.length === 0) return;
  sessionDeck = d;
  sessionActive = true;
  sessionNewLearned = 0;
  sessionFresh = new Set(d.filter(w => !srs[w[0]]).map(w => w[0]));
  sessionCounted = new Set();
  sessionRequeues = new Map();
  correctStreak = 0;
  newCard(0);
  toggleLessonChrome();
  render();
  scrollToEl(document.getElementById('lesson-bar'));
}

function endSession() {
  sessionActive = false;
  sessionDeck = [];
  stopTimer();
  updateReturning();
  toggleLessonChrome();
  renderLessonStart();
  render();
  scrollToEl(document.getElementById('lesson-start'));
}

// У кого уже есть прогресс, тот пришёл заниматься, а не читать лендинг:
// hero показываем только новичкам, остальным урок — первым экраном
function updateReturning() {
  document.body.classList.toggle('returning', Object.keys(srs).length > 0);
}

// Прокрутка к элементу с учётом липкой шапки, которая иначе его перекроет
function scrollToEl(el) {
  if(!el) return;
  const header = document.querySelector('header');
  const top = el.getBoundingClientRect().top + window.scrollY - (header ? header.offsetHeight : 0) - 12;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

// Переключает «оболочку»: во время урока не видно ничего лишнего
function toggleLessonChrome() {
  document.body.classList.toggle('in-lesson', sessionActive);
  const start = document.getElementById('lesson-start');
  const bar = document.getElementById('lesson-bar');
  if(start) start.hidden = sessionActive;
  if(bar) bar.hidden = !sessionActive;
  const main = document.getElementById('main-area');
  if(main) main.hidden = !sessionActive;
}

// ===== ШТОРКА НАСТРОЕК =====
function openSheet() {
  const sh = document.getElementById('sheet'), sc = document.getElementById('scrim');
  if(!sh) return;
  sc.hidden = false; sh.hidden = false;
  requestAnimationFrame(() => { sc.classList.add('open'); sh.classList.add('open'); });
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  const sh = document.getElementById('sheet'), sc = document.getElementById('scrim');
  if(!sh) return;
  sh.classList.remove('open'); sc.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => { sh.hidden = true; sc.hidden = true; }, 220);
  renderLessonStart();
}

// Колода повторения: слова, чей срок показа наступил (отсортированы по сроку)
function buildReviewDeck() {
  const today = todayKey();
  reviewDeck = WORDS.filter(w => srs[w[0]] && srs[w[0]].due <= today)
    .sort((a, b) => srs[a[0]].due < srs[b[0]].due ? -1 : 1);
}

// Сбрасывает состояние текущей карточки (направление, ответы, варианты теста)
function newCard(newIdx) {
  if(typeof newIdx === 'number') idx = newIdx;
  flipped = false; quizAnswered = false; typeAnswered = false;
  cardDir = Math.random() < 0.5;
  quizState = null;
  stopTimer();
}

function buildDeck() {
  deck = WORDS.filter(inSelection);
  newCard(0);
  renderLessonStart();
  render();
}

function shuffleDeck() {
  const d = getActiveDeck();
  for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}
  newCard(0);
  render();
}

function toggleLevel(l) {
  if(activeLevels.has(l)) { if(activeLevels.size>1) activeLevels.delete(l); }
  else activeLevels.add(l);
  const btn = document.getElementById('lbtn-'+l);
  if(activeLevels.has(l)) btn.classList.add('active-'+l);
  else btn.className = 'lvl-btn';
  buildDeck();
}

function toggleCat(c) {
  if(activeCats.has(c)) { if(activeCats.size>1) activeCats.delete(c); }
  else activeCats.add(c);
  const btn = document.getElementById('cbtn-'+c);
  if(btn) {
    if(activeCats.has(c)) btn.classList.add('active');
    else btn.classList.remove('active');
  }
  buildDeck();
}

function setMode(m) {
  mode = m;
  if(m === 'review') buildReviewDeck();
  newCard(0);
  ['flash','quiz','type','review'].forEach(x => {
    const tab = document.getElementById('tab-'+x);
    if(!tab) return;
    tab.classList.toggle('active', x===m);
    tab.setAttribute('aria-selected', x===m ? 'true' : 'false');
  });
  render();
}

function updateStats() {
  const set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  set('hs-total', WORDS.length);
  set('hs-known', known.size);
  set('hs-pct', (WORDS.length ? Math.round(known.size/WORDS.length*100) : 0)+'%');
  // Полоса урока: только внутри занятия
  const cur = getActiveDeck().length;
  const fill = cur > 0 ? Math.min(idx, cur)/cur : 0;
  const lf = document.getElementById('lb-fill');
  if(lf) lf.style.transform = 'scaleX(' + fill + ')';
  set('lb-count', cur > 0 && idx < cur ? (idx+1)+' / '+cur : (cur ? cur+' / '+cur : ''));
  saveProgress();
}

function getCard() {
  return getActiveDeck()[idx] || null;
}

// Засчитать слово как выученное (общая точка для всех режимов)
function learnWord(w) {
  const isNew = !known.has(w[0]);
  if(!srs[w[0]]) bumpIntroducedToday();
  srsCorrect(w[0]);
  if(isNew) bumpLearnedToday();
  // В итог урока идут только слова, которые были новыми в его начале
  if(sessionActive && sessionFresh.has(w[0]) && !sessionCounted.has(w[0])) {
    sessionCounted.add(w[0]);
    sessionNewLearned++;
  }
}

// Отметить ошибку (общая точка для всех режимов)
function missWord(w) {
  if(!srs[w[0]]) bumpIntroducedToday();
  srsWrong(w[0]);
  correctStreak = 0;
  requeueInSession(w);
}

// Слово с ошибкой возвращается в этот же урок через несколько карточек —
// как «шаги заучивания» в Anki: иначе до следующего урока его не увидеть
function requeueInSession(w) {
  if(!sessionActive) return;
  const n = sessionRequeues.get(w[0]) || 0;
  if(n >= REQUEUE_MAX) return;
  sessionRequeues.set(w[0], n + 1);
  sessionDeck.splice(Math.min(idx + 1 + REQUEUE_GAP, sessionDeck.length), 0, w);
}

function makeLevelPill(w) {
  return `<span class="level-pill lp-${getBaseLevel(w)}">${esc(w[2])}</span>`;
}

// Строка произношения: IPA (на английской стороне) + часть речи
function posLine(w, isEnglish) {
  const ipa = isEnglish ? getIPA(w) : '';
  return `<div class="card-pron">${ipa ? `<span class="card-ipa">${esc(ipa)}</span>` : ''}<span class="card-pos-tag">${esc(w[1])}</span></div>`;
}

function renderFlash() {
  const w = getCard();
  const front = cardDir ? w[0] : getTrans(w);
  const back = cardDir ? getTrans(w) : w[0];
  const frontLabel = cardDir ? t('lbl_eng_word') : (appLang==='kz'?t('lbl_kz_trans_lbl'):t('lbl_ru_trans_lbl'));
  const backLabel = cardDir ? (appLang==='kz'?t('lbl_kz_trans'):t('lbl_ru_trans')) : t('lbl_eng_word');
  return `
  ${idx > 0 ? `<div class="card-nav"><button class="ghost-btn" onclick="goBack()">${t('btn_back')}</button></div>` : ''}
  <div class="card-scene">
    <div class="card-inner${flipped?' flipped':''}" onclick="flipCard()" id="fc">
      <div class="card-face card-front-face">
        <div class="card-eyebrow">${frontLabel}</div>
        <div class="card-row">
          <div class="card-word-main">${esc(front)}</div>
          ${makeLevelPill(w)}
        </div>
        ${posLine(w, cardDir)}
        <div class="card-rule"></div>
        <div class="card-hint">${t('card_hint')}</div>
      </div>
      <div class="card-face card-back-face">
        <div class="card-eyebrow">${backLabel}</div>
        <div class="card-row">
          <div class="card-translation">${esc(back)}</div>
          ${makeLevelPill(w)}
        </div>
        ${posLine(w, !cardDir)}
        <div class="card-rule"></div>
        <div class="card-hint">${t('card_hint_knew')}</div>
      </div>
    </div>
  </div>
  <div class="card-actions" id="flash-actions" style="${flipped?'':'display:none'}">
    <button class="act-btn btn-repeat" onclick="markRepeat()">${t('btn_wrong')}</button>
    <button class="act-btn btn-know" onclick="markKnown()">${t('btn_correct')}</button>
  </div>
  <div id="flip-hint" style="${flipped?'display:none':''}">
    <div class="card-actions">
      <button class="act-btn" onclick="skip()">${t('btn_skip')}</button>
    </div>
  </div>
  <div class="kbd-hint">${t('kbd_hint')}</div>`;
}

// Неправильные варианты: та же часть речи и соседний уровень — иначе ответ
// угадывался по грамматике (к прилагательному шли существительные).
// Совпадающие тексты ответов отсекаем: два одинаковых варианта сбивают с толку.
function primaryPos(w) { return (w[1] || '').split(/[,/]/)[0].trim(); }
function getRandomOpts(w, count) {
  const pos = primaryPos(w), lvl = LEVEL_ORDER[getBaseLevel(w)];
  const pool = shuffle(WORDS.filter(x => x !== w && inSelection(x)));
  const tiers = [
    x => primaryPos(x) === pos && Math.abs(LEVEL_ORDER[getBaseLevel(x)] - lvl) <= 1,
    x => primaryPos(x) === pos,
    () => true
  ];
  const taken = new Set([w[0].toLowerCase(), w[3], w[4]]);
  const picked = [];
  for(const fits of tiers) {
    for(const x of pool) {
      if(picked.length === count - 1) break;
      if(!fits(x) || taken.has(x[0].toLowerCase()) || taken.has(x[3]) || taken.has(x[4])) continue;
      picked.push(x);
      taken.add(x[0].toLowerCase()); taken.add(x[3]); taken.add(x[4]);
    }
  }
  return shuffle([...picked, w]);
}

// Тест не пройден (таймаут): подсветить правильный ответ, слово — на повторение
function failQuiz() {
  if(quizAnswered) return;
  quizAnswered = true;
  const w = quizState.word;
  missWord(w);
  document.querySelectorAll('.opt-btn').forEach((o, i) => {
    o.disabled = true;
    if(quizState.opts[i] && quizState.opts[i][0] === w[0]) o.classList.add('correct');
  });
  const nb = document.getElementById('next-btn'); if(nb) nb.style.display='';
  updateStats();
}

function renderQuiz() {
  const w = getCard();
  if(!quizState || quizState.word !== w) {
    quizState = { word: w, opts: getRandomOpts(w, 4), timerStarted: false };
  }
  const question = cardDir ? w[0] : getTrans(w);
  const qLabel = cardDir ? (appLang==='kz'?t('q_translate_kz'):t('q_translate_ru')) : (appLang==='kz'?t('q_guess_en_kz'):t('q_guess_en_ru'));
  return `
  <div class="quiz-panel">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div class="quiz-eyebrow" style="margin-bottom:0">${qLabel}</div>
      ${timerOn ? `<div id="timer-display" style="font-family:'Syne',sans-serif;font-size:18px;font-weight:700;min-width:40px;text-align:center;border:2px solid var(--green);border-radius:8px;padding:2px 8px;color:var(--green);transition:color .3s,border-color .3s">${timerSeconds}s</div>` : ''}
    </div>
    <div class="quiz-q">${esc(question)}</div>
    <div class="quiz-meta">${cardDir && getIPA(w) ? `<span class="card-ipa">${esc(getIPA(w))}</span> · ` : ''}${esc(w[1])} · ${esc(w[2])}</div>
    <div class="quiz-opts">
      ${quizState.opts.map((o,i)=>{
        const ans = cardDir ? getTrans(o) : o[0];
        return `<button class="opt-btn" onclick="answerQuiz(${i})">${esc(ans)}</button>`;
      }).join('')}
    </div>
  </div>
  <div class="card-actions">
    <button class="act-btn btn-next" onclick="nextCard()" id="next-btn" style="${quizAnswered?'':'display:none'}">${t('btn_next')}</button>
  </div>`;
}

// Текущий правильный ответ режима «Введи перевод» (не кладём в DOM, чтобы не подсматривали)
function typeAnswer() {
  const w = getCard();
  return cardDir ? getTrans(w) : w[0];
}

function renderType() {
  const w = getCard();
  const question = cardDir ? w[0] : getTrans(w);
  const qLabel = cardDir ? (appLang==='kz'?t('t_translate_kz'):t('t_translate_ru')) : (appLang==='kz'?t('t_guess_en_kz'):t('t_guess_en_ru'));
  return `
  <div class="type-panel">
    <div class="quiz-eyebrow">${qLabel}</div>
    <div class="quiz-q">${esc(question)}</div>
    <div class="quiz-meta">${cardDir && getIPA(w) ? `<span class="card-ipa">${esc(getIPA(w))}</span> · ` : ''}${esc(w[1])} · ${esc(w[2])}</div>
    <input class="type-input" id="type-inp" placeholder="${t('placeholder_type')}" onkeydown="if(event.key==='Enter')checkType()" ${typeAnswered?'disabled':''} autocomplete="off" autocapitalize="off" spellcheck="false">
    <div class="type-feedback" id="type-fb"></div>
    <div class="card-actions" style="margin-top:14px">
      ${!typeAnswered
        ? `<button class="act-btn btn-repeat" onclick="skipType()">${t('btn_show_ans')}</button><button class="act-btn btn-know" onclick="checkType()">${t('btn_check_ans')}</button>`
        : `<button class="act-btn btn-next" onclick="nextCard()">${t('btn_next')}</button>`
      }
    </div>
  </div>`;
}

function render() {
  const d = getActiveDeck();
  updateStats();
  const area = document.getElementById('main-area');
  area.className = 'fade-up';
  void area.offsetWidth;
  if(d.length===0) {
    area.innerHTML = mode==='review'
      ? `<div class="empty-state">${t('empty_review')}</div>`
      : `<div class="empty-state">${t('empty_level')}</div>`;
    return;
  }
  if(idx>=d.length) {
    // Финиш урока: сначала итог занятия, потом — что дальше
    area.innerHTML = `
    <div class="result-panel">
      <div class="done-mark">${svgIcon('check')}</div>
      <div class="result-title">${t('done_title')}</div>
      <div class="done-figures">
        <div class="done-fig"><b id="res-score">0</b><span>${t('done_new')}</span></div>
        <div class="done-fig"><b>${currentStreak()}</b><span>${t('done_streak')}</span></div>
      </div>
      <div class="result-sub">${t('res_passed')} ${d.length} ${t('res_cards')}${dueCount()>0 ? ' · '+t('res_repeat')+' '+dueCount()+' '+t('res_words') : ''}</div>
      <div class="card-actions" style="justify-content:center">
        <button class="act-btn btn-next" onclick="endSession();startSession()">${t('done_again')}</button>
        <button class="act-btn" onclick="endSession()">${t('done_finish')}</button>
      </div>
      <div class="card-actions" style="justify-content:center;margin-top:4px">
        <button class="act-btn" onclick="shareCard()">${svgIcon('share')} ${t('btn_share')}</button>
      </div>
    </div>`;
    countUp(document.getElementById('res-score'), sessionActive ? sessionNewLearned : known.size);
    return;
  }
  if(mode==='flash' || mode==='review') area.innerHTML = renderFlash();
  else if(mode==='quiz') {
    area.innerHTML = renderQuiz();
    // Озвучка и таймер — один раз на карточку, а не при каждой перерисовке
    if(!quizAnswered && !quizState.timerStarted) {
      quizState.timerStarted = true;
      if(cardDir) speak(quizState.word[0]);
      if(timerOn) startTimer(failQuiz);
    }
  }
  else {
    area.innerHTML = renderType();
    const inp = document.getElementById('type-inp');
    if(inp && !typeAnswered) inp.focus();
  }
}

function flipCard() {
  flipped=!flipped;
  document.getElementById('fc').classList.toggle('flipped');
  const actions = document.getElementById('flash-actions');
  const hint = document.getElementById('flip-hint');
  if(actions) actions.style.display = flipped ? '' : 'none';
  if(hint) hint.style.display = flipped ? 'none' : '';
  if(flipped) {
    const w = getCard();
    if(w) speak(w[0]);
  }
}
function markKnown() {
  const w = getCard();
  if(w) {
    learnWord(w);
    correctStreak++;
    if(correctStreak > 0 && correctStreak % 10 === 0) launchConfetti();
  }
  nextCard();
}
function markRepeat() { const w = getCard(); if(w) missWord(w); nextCard(); }
function skip() { nextCard(); }

function nextCard() {
  newCard(idx + 1);
  render();
}

function answerQuiz(optIdx) {
  if(quizAnswered || !quizState) return;
  quizAnswered=true;
  stopTimer();
  const w = quizState.word;
  const isCorrect = quizState.opts[optIdx] && quizState.opts[optIdx][0] === w[0];
  document.querySelectorAll('.opt-btn').forEach((o, i) => {
    o.disabled=true;
    if(quizState.opts[i] && quizState.opts[i][0] === w[0]) o.classList.add('correct');
    else if(i === optIdx && !isCorrect) o.classList.add('wrong');
  });
  if(isCorrect) {
    learnWord(w); correctStreak++;
    flashAcute(document.querySelector('.quiz-panel'));
    if(correctStreak > 0 && correctStreak % 10 === 0) launchConfetti();
    speak(w[0]);
  } else {
    missWord(w);
  }
  document.getElementById('next-btn').style.display='';
  updateStats();
}

// Нормализация ответа: регистр, ё→е, скобки, лишние пробелы
function normalizeAnswer(s) {
  return s.toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/ё/g, 'е')
    .replace(/[!?.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Расстояние Левенштейна — допускаем одну опечатку в длинных словах
function levenshtein(a, b) {
  if(Math.abs(a.length - b.length) > 1) return 99;
  const m = a.length, n = b.length;
  let prev = Array.from({length: n+1}, (_, j) => j);
  for(let i = 1; i <= m; i++) {
    const cur = [i];
    for(let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j-1] + 1, prev[j-1] + (a[i-1] === b[j-1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

// Принимаем любой из вариантов перевода (разделители «,» и «;»), с одной опечаткой для слов от 5 букв
function isAnswerCorrect(input, answer) {
  const val = normalizeAnswer(input);
  if(!val) return false;
  const variants = answer.split(/[;,]/).map(normalizeAnswer).filter(Boolean);
  return variants.some(v => v === val || (v.length >= 5 && levenshtein(v, val) <= 1));
}

function checkType() {
  if(typeAnswered) return;
  const inp = document.getElementById('type-inp');
  const answer = typeAnswer();
  const isCorrect = isAnswerCorrect(inp.value, answer);
  typeAnswered=true;
  const w = getCard();
  const fb = document.getElementById('type-fb');
  if(isCorrect) {
    fb.innerHTML=`<span style="color:var(--green)">${t('fb_correct')}</span>`;
    learnWord(w);
    correctStreak++;
    flashAcute(document.querySelector('.type-panel'));
    if(correctStreak > 0 && correctStreak % 10 === 0) launchConfetti();
  } else {
    fb.innerHTML=`<span style="color:var(--red)">${t('fb_wrong_pre')}${esc(answer)}${t('fb_wrong_post')}</span>`;
    missWord(w);
  }
  inp.disabled=true;
  setTimeout(() => { if(typeAnswered) nextCard(); }, 1400);
  updateStats();
}

function skipType() {
  if(typeAnswered) return;
  typeAnswered=true;
  const answer = typeAnswer();
  const w = getCard();
  missWord(w);
  document.getElementById('type-fb').innerHTML=`<span style="color:var(--muted)">${t('fb_ans_pre')}${esc(answer)}${t('fb_ans_post')}</span>`;
  const inp = document.getElementById('type-inp');
  if(inp) inp.disabled=true;
  render();
  updateStats();
}

function goBack() {
  if(idx > 0) { newCard(idx - 1); render(); }
}
function restart() { newCard(0); render(); }
function scrollToApp() { document.getElementById('app').scrollIntoView({behavior:'smooth'}); return false; }

// ===== ИНТРО (Лондон → книга Sózdik) =====
let introTimer = null;
function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function dismissIntro() {
  const o = document.getElementById('intro');
  if(!o) return;
  o.classList.add('done');
  clearTimeout(introTimer);
  setTimeout(() => { o.style.display = 'none'; }, 500);
}
function initIntro() {
  const o = document.getElementById('intro');
  if(!o) return;
  let seen = false;
  try { seen = localStorage.getItem('ox_intro_seen') === '1'; } catch(e) {}
  if(seen || prefersReducedMotion()) { o.style.display = 'none'; return; }
  try { localStorage.setItem('ox_intro_seen', '1'); } catch(e) {}
  introTimer = setTimeout(() => { o.style.display = 'none'; }, 4900);
}
// Повторный показ заставки по кнопке: перезапускаем анимацию через клон узла
function playIntro() {
  if(prefersReducedMotion()) return;
  const o = document.getElementById('intro');
  if(!o) return;
  const fresh = o.cloneNode(true);
  fresh.classList.remove('done');
  fresh.style.display = '';
  o.parentNode.replaceChild(fresh, o);
  paintIcons();
  clearTimeout(introTimer);
  introTimer = setTimeout(() => { const c = document.getElementById('intro'); if(c) c.style.display = 'none'; }, 4900);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== HERO: живая словарная статья =====
// Алфавитный индекс всех заголовков (для направляющих слов колонтитула)
let _sortedWords = null;
function sortedWords() {
  if(!_sortedWords) _sortedWords = WORDS.map(w => w[0]).slice().sort((a, b) => a.localeCompare(b, 'en'));
  return _sortedWords;
}
// Ближайшие соседи слова по алфавиту — как guide words на странице словаря
function guideNeighbors(word) {
  const arr = sortedWords();
  let lo = 0, hi = arr.length - 1, idx = 0;
  while(lo <= hi) {
    const mid = (lo + hi) >> 1, c = arr[mid].localeCompare(word, 'en');
    if(c === 0) { idx = mid; break; }
    if(c < 0) { lo = mid + 1; idx = lo; } else { hi = mid - 1; idx = hi; }
  }
  idx = Math.max(0, Math.min(arr.length - 1, idx));
  return {
    left: arr[Math.max(0, idx - 1)],
    right: arr[Math.min(arr.length - 1, idx + 1)],
    section: (word[0] || '').toUpperCase()
  };
}
// Раскладывает заголовок на буквы-спаны со ступенчатой задержкой набора
function setHeadword(word) {
  const el = document.getElementById('he-word');
  if(!el) return;
  el.textContent = '';
  [...word].forEach((ch, i) => {
    const sp = document.createElement('span');
    sp.className = 'gl';
    sp.textContent = ch === ' ' ? ' ' : ch;
    sp.style.animationDelay = (0.045 * i) + 's';
    el.appendChild(sp);
  });
}
function renderHero(animate) {
  const s = SHOWCASE[heroIdx % SHOWCASE.length];
  const entry = document.getElementById('hero-entry');
  if(!entry) return;
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  setHeadword(s.w);
  set('he-level', s.lvl);
  set('he-ipa', s.ipa);
  set('he-pos', s.pos);
  const g = guideNeighbors(s.w);
  set('he-guide-l', g.left);
  set('he-guide-r', g.right);
  set('he-folio', g.section);
  const senses = document.getElementById('he-senses');
  if(senses) senses.innerHTML =
    `<li><span class="sense-lang">қаз</span> ${esc(s.kz)}</li>` +
    `<li><span class="sense-lang">рус</span> ${esc(s.ru)}</li>`;
  if(animate) {
    entry.classList.remove('assemble');
    void entry.offsetWidth; // перезапуск анимации
    entry.classList.add('assemble');
  }
}

function startHeroRotation() {
  renderHero(true);
  clearInterval(heroTimer);
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce) return; // не крутим карусель при reduced-motion
  heroTimer = setInterval(() => {
    // Крутим, только пока hero показан (новичку) и на экране
    const hero = document.querySelector('.hero');
    if(hero && hero.offsetParent !== null && window.scrollY < window.innerHeight) { heroIdx++; renderHero(true); }
  }, 4200);
}

// Янтарный знак-акут «правильно» — фирменный росчерк вместо галочки
function flashAcute(container) {
  if(!container) return;
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'acute-mark');
  svg.setAttribute('viewBox', '0 0 26 26');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M6 20 L20 6');
  svg.appendChild(path);
  if(getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.appendChild(svg);
  setTimeout(() => svg.remove(), 800);
}

// Плавный набор числа от 0 до target (экран результата)
function countUp(el, target) {
  if(!el) return;
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = target; return; }
  const dur = 650, start = performance.now();
  function step(now) {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3); // кубическая ease-out
    el.textContent = Math.round(target * eased);
    if(p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ===== КАРТОЧКА ПРОГРЕССА ДЛЯ СТОРИС =====
// Фирменная палитра «The Lexicon» (повтор :root для канваса)
const CARD = {
  paper:  '#FBFAF8', raised: '#FFFFFF', sunken: '#F4F1EA',
  ink:    '#1A1714', inkSoft: '#463F36', muted: '#6B6358',
  indigo: '#2E4F6B', amber: '#C8841E', amberText: '#8A5A12',
  forest: '#3E6B53', brick: '#B04A39',
  rule:   'rgba(26,23,20,0.12)', ruleStrong: 'rgba(26,23,20,0.20)'
};
const CARD_LEVELS = ['A1','A2','B1','B2'];
const CARD_LEVEL_COLOR = { A1: CARD.forest, A2: CARD.indigo, B1: CARD.amber, B2: CARD.brick };

// Дожидаемся загрузки веб-шрифтов, иначе канвас нарисует системным
async function ensureCardFonts() {
  if(!document.fonts || !document.fonts.load) return;
  const faces = ['700 96px Spectral','600 280px Spectral','500 46px Spectral',
                 '700 40px Manrope','800 96px Manrope','600 30px Manrope',
                 '500 30px "JetBrains Mono"'];
  try { await Promise.all(faces.map(f => document.fonts.load(f))); } catch(e) {}
}

// Текст по центру с опциональным трекингом
function cardText(ctx, text, x, y, font, color, opts = {}) {
  ctx.font = font; ctx.fillStyle = color;
  ctx.textAlign = opts.align || 'center';
  ctx.textBaseline = opts.baseline || 'alphabetic';
  if('letterSpacing' in ctx) ctx.letterSpacing = (opts.spacing || 0) + 'px';
  ctx.fillText(text, x, y);
  if('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

// Логотип Sózdik с янтарной буквой ó
function drawWordmark(ctx, cx, y) {
  const parts = [['S', CARD.ink], ['ó', CARD.amber], ['zdik', CARD.ink]];
  ctx.font = '700 96px Spectral'; ctx.textBaseline = 'alphabetic';
  if('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  const total = parts.reduce((w, [tx]) => w + ctx.measureText(tx).width, 0);
  let x = cx - total / 2;
  ctx.textAlign = 'left';
  for(const [tx, c] of parts) { ctx.fillStyle = c; ctx.fillText(tx, x, y); x += ctx.measureText(tx).width; }
}

// Фирменный язычок пламени (filled), на основе линейной иконки flame
function drawFlame(ctx, cx, cy, size, color) {
  const p = new Path2D('M12 3c1.2 4-2 5.2-2 8.2a2.5 2.5 0 0 0 5 0c0-1-.4-1.9-1-2.6 2.2 1 3.4 3 3.4 5.2a5.4 5.4 0 0 1-10.8 0C6.6 9.5 10.8 7.7 12 3z');
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color; ctx.fill(p);
  ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else { ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
}

function cardLevelStats() {
  return CARD_LEVELS.map(l => {
    const tot = WORDS.filter(w => getBaseLevel(w) === l);
    const kn = tot.reduce((n, w) => n + (known.has(w[0]) ? 1 : 0), 0);
    return { l, kn, tot: tot.length };
  });
}

// Рисует карточку 1080×1920 и возвращает Blob (PNG)
async function renderShareCard() {
  await ensureCardFonts();
  const W = 1080, H = 1920, cx = W / 2;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // Фон-бумага
  ctx.fillStyle = CARD.paper; ctx.fillRect(0, 0, W, H);

  // Двойная редакционная рамка
  ctx.strokeStyle = CARD.ruleStrong; ctx.lineWidth = 2;
  roundRectPath(ctx, 40, 40, W - 80, H - 80, 26); ctx.stroke();
  ctx.strokeStyle = CARD.rule; ctx.lineWidth = 1;
  roundRectPath(ctx, 54, 54, W - 108, H - 108, 20); ctx.stroke();

  // Шапка: логотип + 3000
  drawWordmark(ctx, cx, 250);
  cardText(ctx, '3000', cx, 326, '500 46px Spectral', CARD.amber, { spacing: 16 });

  // Тонкая линейка
  ctx.strokeStyle = CARD.rule; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(220, 408); ctx.lineTo(W - 220, 408); ctx.stroke();
  cardText(ctx, appLang === 'kz' ? 'МЕНІҢ ПРОГРЕСІМ' : 'МОЙ ПРОГРЕСС', cx, 500,
           '500 30px "JetBrains Mono"', CARD.muted, { spacing: 8 });

  // Главное число — выучено слов
  cardText(ctx, String(known.size), cx, 790, '600 300px Spectral', CARD.forest);
  cardText(ctx, t('share_learned'), cx, 880, '700 44px Manrope', CARD.ink, { spacing: 1 });

  // Разделитель
  ctx.strokeStyle = CARD.rule; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(220, 980); ctx.lineTo(W - 220, 980); ctx.stroke();

  // Два показателя: стрик и процент
  const streak = currentStreak();
  const total = WORDS.length;
  const pct = total ? Math.round(known.size / total * 100) : 0;
  // вертикальный разделитель между колонками
  ctx.strokeStyle = CARD.rule; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, 1070); ctx.lineTo(cx, 1240); ctx.stroke();
  // стрик (левая колонка)
  const lx = 312;
  if(streak > 0) drawFlame(ctx, lx - 78, 1150, 96, CARD.amber);
  cardText(ctx, String(streak), lx + (streak > 0 ? 28 : 0), 1185, '800 120px Manrope', CARD.amber);
  cardText(ctx, t('share_streak'), lx, 1255, '600 30px Manrope', CARD.muted, { spacing: 1 });
  // процент (правая колонка)
  const rx = 768;
  cardText(ctx, pct + '%', rx, 1185, '800 120px Manrope', CARD.indigo);
  cardText(ctx, t('share_done'), rx, 1255, '600 30px Manrope', CARD.muted, { spacing: 1 });

  // Прогресс-бар
  const trX = 120, trW = W - 240, trY = 1360, trH = 32;
  ctx.fillStyle = CARD.sunken; roundRectPath(ctx, trX, trY, trW, trH, 16); ctx.fill();
  const fillW = Math.max(trH, trW * pct / 100);
  ctx.fillStyle = CARD.forest; roundRectPath(ctx, trX, trY, fillW, trH, 16); ctx.fill();

  // Разбивка по уровням
  const stats = cardLevelStats();
  const colXs = [225, 435, 645, 855];
  stats.forEach((s, i) => {
    const x = colXs[i], c = CARD_LEVEL_COLOR[s.l];
    cardText(ctx, s.l, x, 1530, '500 30px "JetBrains Mono"', c, { spacing: 2 });
    cardText(ctx, String(s.kn), x, 1610, '800 60px Manrope', c);
    cardText(ctx, '/ ' + s.tot, x, 1655, '500 26px "JetBrains Mono"', CARD.muted);
  });

  // Подвал
  ctx.strokeStyle = CARD.rule; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(220, 1730); ctx.lineTo(W - 220, 1730); ctx.stroke();
  cardText(ctx, t('share_cta'), cx, 1800, '700 38px Manrope', CARD.ink, { spacing: 1 });
  let host = (location.host + location.pathname).toLowerCase()
    .replace(/index\.html?$/, '').replace(/\/+$/, '');
  if(!host) host = 'sózdik 3000';
  cardText(ctx, host, cx, 1850, '500 30px "JetBrains Mono"', CARD.amberText, { spacing: 2 });

  return new Promise(res => cv.toBlob(res, 'image/png'));
}

// Делится карточкой через Web Share API (мобайл) либо скачивает PNG
async function shareCard() {
  let blob;
  try { blob = await renderShareCard(); } catch(e) { return; }
  if(!blob) return;
  const file = new File([blob], 'sozdik3000-progress.png', { type: 'image/png' });
  const shareData = { files: [file], title: t('share_title'), text: t('share_cta') };
  if(navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share(shareData); return; }
    catch(e) { if(e && e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sozdik3000-progress.png';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ===== КЛАВИАТУРА =====
document.addEventListener('keydown', e => {
  const sheet = document.getElementById('sheet');
  if(sheet && !sheet.hidden) { if(e.key === 'Escape') closeSheet(); return; }
  const tag = document.activeElement && document.activeElement.tagName;
  if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.ctrlKey || e.metaKey || e.altKey) return;
  // Вне урока клавиши карточек не работают: Enter начинает занятие
  if(!sessionActive) {
    if(e.key === 'Enter' && tag !== 'BUTTON') { e.preventDefault(); startSession(); }
    return;
  }
  if(e.key === 'Escape') { e.preventDefault(); endSession(); return; }
  // На сфокусированной кнопке Space/Enter обрабатывает сама кнопка
  if(tag === 'BUTTON' && (e.code === 'Space' || e.key === 'Enter')) return;
  const d = getActiveDeck();
  if(!d.length) return;
  if(idx >= d.length) {
    if(e.key === 'Enter') { e.preventDefault(); endSession(); startSession(); }
    return;
  }
  if(mode === 'flash' || mode === 'review') {
    if(e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); flipCard(); }
    else if(flipped && e.key === '1') markRepeat();
    else if(flipped && e.key === '2') markKnown();
    else if(e.key === 'ArrowRight') skip();
    else if(e.key === 'ArrowLeft') goBack();
  } else if(mode === 'quiz') {
    if(!quizAnswered && ['1','2','3','4'].includes(e.key)) answerQuiz(Number(e.key) - 1);
    else if(quizAnswered && (e.key === 'Enter' || e.key === 'ArrowRight')) nextCard();
  } else if(mode === 'type') {
    if(typeAnswered && (e.key === 'Enter' || e.key === 'ArrowRight')) nextCard();
  }
});

// ===== ИНИЦИАЛИЗАЦИЯ =====
loadSettings();
initIntro();
loadProgress();
paintIcons();
updateStreak();
updateUI();
buildDeck();
updateReturning();
toggleLessonChrome();
renderLessonStart();
startHeroRotation();
