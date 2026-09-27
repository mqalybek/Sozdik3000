#!/usr/bin/env node
/**
 * Валидатор словаря data.js.
 * Запуск: node tools/validate-data.js
 * Выводит список проблемных записей по категориям проверок.
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8');
const WORDS = eval(src + '; WORDS');

const VALID_LEVELS = new Set(['A1', 'A2', 'B1', 'B2']);
const VALID_CATS = new Set(['cat_core','cat_people','cat_home','cat_edu','cat_travel','cat_food','cat_health','cat_nature','cat_business','cat_tech','cat_art','cat_sport']);
// Допустимые токены в поле части речи (включая слэш-формы в стиле Oxford: "adj./adv.")
const POS_ATOMS = new Set(['n.','v.','adj.','adv.','prep.','pron.','conj.','det.','art.','exclam.','number','modal v.','auxiliary v.','definite article','indefinite article','infinitive marker']);
function isValidPosToken(tok) {
  return tok.split('/').every(a => POS_ATOMS.has(a.trim()));
}
// Легитимные однобуквенные переводы (and→и, I→я, with→с и т.п.)
const OK_SHORT = new Set(['и','я','с','о','к','у','в']);

const issues = {};
function report(group, i, w, note) {
  (issues[group] ??= []).push({ line: i, word: w[0], note });
}

const seen = new Map();
WORDS.forEach((w, i) => {
  const [word, pos, level, kz, ru, cat] = w;

  // 1. Структура записи
  if (w.length < 6) report('Неполная запись (меньше 6 полей)', i, w, `полей: ${w.length}`);
  if (!word || !word.trim()) report('Пустое слово', i, w, '');

  // 2. Слово должно быть английским (латиница, пробелы, дефисы, апострофы, слэш)
  if (word && !/^[a-zA-Z][a-zA-Z .'\/-]*$/.test(word)) report('Подозрительное слово (не латиница)', i, w, word);

  // 3. Мусорные записи — части речи вместо слов
  if (/^(adj|adv|n|v|prep|pron|conj|det|sb|sth|etc)$/.test(word)) report('Мусорная запись (сокращение вместо слова)', i, w, '');

  // 4. Уровень
  if (!VALID_LEVELS.has(level)) report('Некорректный уровень', i, w, `"${level}"`);

  // 5. Уровень затесался в поле части речи (артефакт парсинга Oxford-списка)
  if (pos && /\b[AB][12]\b/.test(pos)) report('Уровень в поле части речи', i, w, `"${pos}"`);

  // 6. Невалидные токены в поле части речи
  if (pos) {
    const tokens = pos.split(',').map(t => t.trim()).filter(Boolean);
    const bad = tokens.filter(t => !isValidPosToken(t) && !/\b[AB][12]\b/.test(t));
    if (bad.length) report('Нестандартная часть речи', i, w, `"${pos}" → [${bad.join('; ')}]`);
  } else {
    report('Пустая часть речи', i, w, '');
  }

  // 7. Категория
  if (!VALID_CATS.has(cat)) report('Некорректная категория', i, w, `"${cat}"`);

  // 8. Пустые переводы
  if (!kz || !kz.trim()) report('Пустой казахский перевод', i, w, '');
  if (!ru || !ru.trim()) report('Пустой русский перевод', i, w, '');

  // 9. Артефакты машинного перевода: "prep." переведён как "подготовка"
  if (ru && /подготов/i.test(ru) && !/^prepar/.test(word)) report('Артефакт МП: «подготовка» в русском', i, w, ru);
  if (kz && /дайынд/i.test(kz) && !/^prepar/.test(word)) report('Артефакт МП: «дайындық» в казахском', i, w, kz);

  // 10. Перевод содержит непереведённые сокращения / латиницу-мусор
  if (ru && /\s(преп|прил|нареч|сущ|гл|союз|мест|предл|числ|частица|межд)\.?\s*$/.test(ru)) report('Сокращение части речи в русском переводе', i, w, ru);
  if (kz && /\s(үстеу|есімдік|жалғаулық|еліктеу|шылау|аян)\.?\s*$/.test(kz)) report('Сокращение части речи в казахском переводе', i, w, kz);
  // Повторяющийся сегмент перевода (артефакт МП: "завтра, завтра нареч")
  if (ru) { const parts = ru.split(/[,;]\s*/).map(p => p.trim().toLowerCase().replace(/\s+(преп|нареч|прил|сущ|гл)\.?$/, '').trim()); const s = new Set(parts.filter(Boolean)); if (s.size < parts.filter(Boolean).length) report('Дублирующийся сегмент перевода', i, w, ru); }
  if (ru && /^[a-z .]+$/i.test(ru)) report('Русский перевод латиницей', i, w, ru);
  if (kz && /^[a-z .]+$/i.test(kz)) report('Казахский перевод латиницей', i, w, kz);

  // 11. Однобуквенные/бессмысленные переводы
  const ruCore = ru ? ru.trim().replace(/\./g, '') : '';
  const kzCore = kz ? kz.trim().replace(/\./g, '') : '';
  if (ruCore.length <= 1 && !OK_SHORT.has(ruCore)) report('Слишком короткий русский перевод', i, w, `"${ru}"`);
  if (kzCore.length <= 1 && !OK_SHORT.has(kzCore)) report('Слишком короткий казахский перевод', i, w, `"${kz}"`);

  // 11b. Оторванные буквы-хвосты и непереведённые сокращения внутри перевода
  const JUNK_TOKEN = /(^| )(c|п|адж|дет|прон\w*)([ ,;.]|$)/;
  if (ru && JUNK_TOKEN.test(ru)) report('Мусорный токен в русском переводе', i, w, ru);
  if (kz && JUNK_TOKEN.test(kz)) report('Мусорный токен в казахском переводе', i, w, kz);

  // 12. Дубликаты
  if (seen.has(word)) report('Дубликат слова', i, w, `первое вхождение: запись #${seen.get(word)}`);
  else seen.set(word, i);

  // 13. Перевод оканчивается точкой посреди фразы — признак обрезанного МП
  if (ru && /\.\s*$/.test(ru.trim()) && !/^[а-яё .,;()-]+$/i.test(ru)) report('Подозрительная пунктуация в русском', i, w, ru);

  // 14. Цифра, приклеенная к слову — след склейки омонимов («жить2», «до1»).
  //     Именно так нашёлся «do → до»: глагол «делать» был переведён русским предлогом
  const GLUED_DIGIT = /[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]\s?\d|\d\s?[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]/;
  if (ru && GLUED_DIGIT.test(ru)) report('Цифра в русском переводе (склейка омонимов)', i, w, ru);
  if (kz && GLUED_DIGIT.test(kz)) report('Цифра в казахском переводе (склейка омонимов)', i, w, kz);

  // 15. Английское слово внутри перевода («қоғамдық; public»).
  //     Аббревиатуры заглавными (DVD, IT) допустимы
  const LATIN_WORD = /(^|[^A-Za-z])[a-z][A-Za-z]+/;
  if (ru && LATIN_WORD.test(ru)) report('Латинское слово в русском переводе', i, w, ru);
  if (kz && LATIN_WORD.test(kz)) report('Латинское слово в казахском переводе', i, w, kz);
});

let total = 0;
for (const [group, list] of Object.entries(issues)) {
  console.log(`\n=== ${group} (${list.length}) ===`);
  list.forEach(({ line, word, note }) => console.log(`  #${line} "${word}"${note ? ' — ' + note : ''}`));
  total += list.length;
}
console.log(`\nИтого записей: ${WORDS.length}, проблем: ${total}`);
process.exit(total > 0 ? 1 : 0);
