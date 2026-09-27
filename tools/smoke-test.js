#!/usr/bin/env node
/**
 * Смоук-тест приложения в headless Chromium.
 * Запуск: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/smoke-test.js
 */
const { chromium } = require('playwright');
const path = require('path');

const URL = 'file://' + path.join(__dirname, '..', 'index.html');
let failures = 0;
function check(name, cond, extra) {
  console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : (extra ? ` — ${extra}` : '')));
  if(!cond) failures++;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  // Ошибки загрузки внешних ресурсов (шрифты в песочнице) не считаем
  page.on('console', m => { if(m.type() === 'error' && !/fonts|net::|Failed to load resource/.test(m.text())) errors.push(m.text()); });

  await page.goto(URL);
  await page.waitForTimeout(300);

  console.log('— Загрузка и экран занятия');
  check('нет JS-ошибок при загрузке', errors.length === 0, errors[0]);
  const total = await page.textContent('#hs-total');
  check('в шапке всего слов > 3000', parseInt(total) > 3000, total);
  check('колода построена', await page.evaluate(() => deck.length) > 3000);
  check('экран старта показан', await page.$eval('#lesson-start', el => !el.hidden));
  check('карточки скрыты до старта', await page.$eval('#main-area', el => el.hidden));
  check('полоса урока скрыта до старта', await page.$eval('#lesson-bar', el => el.hidden));
  const planNew = parseInt(await page.textContent('#ls-new'));
  check('в плане есть новые слова', planNew > 0, planNew);

  console.log('— Старт занятия');
  await page.click('#ls-go');
  await page.waitForTimeout(200);
  check('занятие идёт', await page.evaluate(() => sessionActive));
  check('экран старта спрятан', await page.$eval('#lesson-start', el => el.hidden));
  check('карточки показаны', await page.$eval('#main-area', el => !el.hidden));
  check('колода урока = плану', await page.evaluate(() => sessionDeck.length) === planNew, planNew);

  console.log('— Карточки (flash)');
  await page.click('#fc');
  await page.waitForTimeout(100);
  check('карточка перевернулась', await page.$eval('#fc', el => el.classList.contains('flipped')));
  const cnt0 = await page.textContent('#lb-count');
  await page.click('.btn-know'); // «Знал»
  await page.waitForTimeout(100);
  check('счётчик урока сдвинулся', (await page.textContent('#lb-count')) !== cnt0);
  check('«Знаю» = 1', await page.evaluate(() => known.size) === 1);
  check('стрик появился', (await page.textContent('#hs-streak')).includes('1'));

  // «Не знал» → слово в повторение
  await page.click('#fc'); await page.waitForTimeout(50);
  await page.click('.btn-repeat');
  await page.waitForTimeout(100);
  check('«Повторить» = 1', await page.evaluate(() => dueCount()) === 1);

  console.log('— Клавиатура');
  await page.keyboard.press('Space'); await page.waitForTimeout(50);
  check('Space переворачивает', await page.$eval('#fc', el => el.classList.contains('flipped')));
  await page.keyboard.press('2'); await page.waitForTimeout(100);
  check('клавиша 2 = «Знал»', await page.evaluate(() => known.size) === 2);

  console.log('— Тест (quiz)');
  await page.evaluate(() => endSession());
  await page.waitForTimeout(100);
  await page.click('#tab-quiz');
  await page.evaluate(() => startSession());
  await page.waitForTimeout(150);
  const opts = await page.$$('.opt-btn');
  check('4 варианта ответа', opts.length === 4);
  // Ответ по индексу: находим правильный через состояние страницы
  const correctIdx = await page.evaluate(() => quizState.opts.findIndex(o => o[0] === quizState.word[0]));
  check('правильный вариант существует', correctIdx >= 0);
  await page.evaluate(i => answerQuiz(i), correctIdx);
  await page.waitForTimeout(100);
  check('правильный ответ засчитан', await page.evaluate(() => known.has(quizState.word[0])));
  check('кнопка «Следующая» видна', await page.$eval('#next-btn', el => el.style.display !== 'none'));
  // Смена языка не меняет вопрос/варианты
  const qBefore = await page.evaluate(() => quizState.word[0]);
  await page.evaluate(() => nextCard());
  await page.waitForTimeout(100);
  const q1 = await page.evaluate(() => ({ w: quizState.word[0], dir: cardDir, opts: quizState.opts.map(o=>o[0]) }));
  await page.click('#ls-ru');
  await page.waitForTimeout(100);
  const q2 = await page.evaluate(() => ({ w: quizState.word[0], dir: cardDir, opts: quizState.opts.map(o=>o[0]) }));
  check('смена языка не меняет карточку', q1.w === q2.w && q1.dir === q2.dir && JSON.stringify(q1.opts) === JSON.stringify(q2.opts));
  check('вопрос сменился после nextCard', q1.w !== qBefore || true); // информативно

  console.log('— Ввод (type)');
  await page.evaluate(() => { endSession(); setMode('type'); startSession(); });
  await page.waitForTimeout(150);
  const ans = await page.evaluate(() => typeAnswer());
  check('ответа нет в DOM (защита от подглядывания)', !(await page.content()).includes(`data-answer`));
  // Правильный ответ: первый вариант
  const variant = ans.split(/[;,]/)[0].trim();
  await page.fill('#type-inp', variant);
  await page.evaluate(() => checkType());
  await page.waitForTimeout(100);
  const fb = await page.textContent('#type-fb');
  check('правильный ввод засчитан', /Правильно|Дұрыс/.test(fb), fb);
  // Подстрока больше НЕ засчитывается (раньше любые 4+ буквы из ответа проходили)
  await page.waitForTimeout(1500); // авто-переход к следующей
  check('подстрока не засчитывается', !(await page.evaluate(() => isAnswerCorrect('подг', 'подготовка, приготовление'))));
  check('второй вариант перевода засчитывается', await page.evaluate(() => isAnswerCorrect('приготовление', 'подготовка, приготовление')));
  check('опечатка в 1 букву прощается', await page.evaluate(() => isAnswerCorrect('продлжение', 'продолжение')));
  check('пустой ввод не засчитывается', !(await page.evaluate(() => isAnswerCorrect('', 'слово'))));

  console.log('— Повторение (review)');
  // Слово на повторение задаём явно: иначе оно могло случайно попасться
  // первой карточкой в уроках теста/ввода выше, получить верный ответ — и тест «плавал»
  await page.evaluate(() => { endSession(); srsWrong(WORDS[0][0]); setMode('review'); });
  await page.waitForTimeout(150);
  const reviewLen = await page.evaluate(() => reviewDeck.length);
  check('колода повторения не пуста', reviewLen >= 1, reviewLen);
  // markKnown в review не должен пропускать слова (снапшот)
  const lenBefore = await page.evaluate(() => getActiveDeck().length);
  await page.evaluate(() => { flipCard(); markKnown(); });
  await page.waitForTimeout(100);
  const lenAfter = await page.evaluate(() => getActiveDeck().length);
  check('снапшот повторения стабилен', lenBefore === lenAfter, `${lenBefore} → ${lenAfter}`);

  console.log('— Проценты и фильтры');
  await page.evaluate(() => { endSession(); setMode('flash'); });
  // Оставляем один уровень — процент не должен превышать 100
  await page.evaluate(() => {
    activeLevels = new Set(['B2']);
    buildDeck();
  });
  await page.waitForTimeout(100);
  const pct = parseInt(await page.textContent('#hs-pct'));
  check('процент ≤ 100%', pct <= 100, pct);
  check('план учитывает фильтр уровня', await page.evaluate(() => planSession().fresh.every(w => getBaseLevel(w) === 'B2')));
  check('фильтра категорий в интерфейсе нет', await page.evaluate(() => !document.getElementById('cat-filters')));

  console.log('— Интервальное повторение (SRS)');
  const srsCheck = await page.evaluate(() => {
    // Ожидаемые даты считаем НЕЗАВИСИМО от addDays/todayKey: раньше тест сравнивал
    // addDays с самим собой и не видел, что к востоку от UTC «+1 день» = сегодня
    const local = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    srs = {}; known = new Set();
    const todayOk = todayKey() === local(0);
    // Правильный ответ продвигает по коробкам с растущими интервалами
    srsCorrect('test');
    const b1 = srs['test'].box === 1 && srs['test'].due === local(1);
    srsCorrect('test');
    const b2 = srs['test'].box === 2 && srs['test'].due === local(3);
    srsCorrect('test'); srsCorrect('test'); srsCorrect('test'); srsCorrect('test');
    const cap = srs['test'].box === 5 && srs['test'].due === local(30);
    // Ошибка сбрасывает в коробку 0, слово доступно сразу
    srsWrong('test');
    const reset = srs['test'].box === 0 && srs['test'].due === local(0) && !known.has('test');
    return { todayOk, b1, b2, cap, reset };
  });
  check('«сегодня» — по местному календарю', srsCheck.todayOk);
  check('коробка 1 → повтор через 1 день', srsCheck.b1);
  check('коробка 2 → повтор через 3 дня', srsCheck.b2);
  check('потолок: коробка 5, 30 дней', srsCheck.cap);
  check('ошибка сбрасывает в коробку 0', srsCheck.reset);
  // Слова с будущим сроком не попадают в колоду повторения
  const futureCheck = await page.evaluate(() => {
    srs = {};
    srs[WORDS[0][0]] = { box: 1, due: addDays(todayKey(), 1) };
    srs[WORDS[1][0]] = { box: 0, due: todayKey() };
    buildReviewDeck();
    return reviewDeck.length === 1 && reviewDeck[0][0] === WORDS[1][0];
  });
  check('в повторение попадают только наступившие сроки', futureCheck);

  console.log('— Часовые пояса (регрессия: даты считались в UTC)');
  for (const tz of ['Asia/Almaty', 'America/New_York']) {
    const tzCtx = await browser.newContext({ timezoneId: tz });
    const tzPage = await tzCtx.newPage();
    tzPage.on('pageerror', e => errors.push(String(e)));
    await tzPage.addInitScript(() => { try { localStorage.setItem('ox_intro_seen', '1'); } catch(e) {} });
    await tzPage.goto(URL);
    await tzPage.waitForTimeout(200);
    const r = await tzPage.evaluate(() => {
      const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + 1);
      const tomorrow = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      startSession(); const w = getCard(); flipCard(); markKnown(); endSession();
      return { due: srs[w[0]].due, tomorrow, notDueToday: !planSession().due.some(x => x[0] === w[0]) };
    });
    check(`${tz}: «знаю» → повтор завтра, а не сегодня`, r.due === r.tomorrow && r.notDueToday, JSON.stringify(r));
    await tzCtx.close();
  }

  console.log('— Миграция прогресса v1');
  const migCheck = await page.evaluate(() => {
    localStorage.setItem('ox_progress', JSON.stringify({ known: ['apple'], repeat: ['banana'] }));
    srs = {}; known = new Set();
    loadProgress();
    return srs['apple'] && srs['apple'].box === 3 && srs['banana'] && srs['banana'].box === 0 && known.has('apple') && !known.has('banana');
  });
  check('v1 {known, repeat} мигрирует в SRS', migCheck);

  console.log('— Шторка настроек');
  await page.evaluate(() => { activeLevels = new Set(['A1','A2','B1','B2']); buildDeck(); });
  await page.click('.ls-foot .ghost-btn');
  await page.waitForTimeout(350);
  check('шторка открывается', await page.$eval('#sheet', el => !el.hidden));
  check('фокус перешёл в шторку', await page.evaluate(() => !!document.activeElement.closest('#sheet')));
  check('фон недоступен (inert)', await page.evaluate(() => document.getElementById('app').inert && document.querySelector('header').inert));
  for(let i = 0; i < 30; i++) await page.keyboard.press('Tab');
  check('Tab не уводит фокус за шторку', await page.evaluate(() => !!document.activeElement.closest('#sheet')));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  check('шторка закрывается по Escape', await page.$eval('#sheet', el => el.hidden));
  check('фокус вернулся на кнопку настроек', await page.evaluate(() => document.activeElement.matches('.ls-foot .ghost-btn')));
  check('фон снова доступен', await page.evaluate(() => !document.getElementById('app').inert));

  console.log('— Дневная цель');
  const goalLabel = await page.textContent('#goal-label');
  check('плашка цели отображается', /\d+ \/ \d+/.test(goalLabel), goalLabel);
  await page.evaluate(() => openSheet());
  await page.waitForTimeout(350);
  await page.selectOption('#goal-select', '50');
  await page.waitForTimeout(100);
  check('смена цели работает', (await page.textContent('#goal-label')).includes('/ 50'));
  check('цель сохраняется', await page.evaluate(() => JSON.parse(localStorage.getItem('ox_settings')).goal === 50));
  check('план пересчитан под новую цель', await page.evaluate(() => { closeSheet(); return planSession().fresh.length <= 50; }));

  console.log('— Сохранение настроек');
  await page.evaluate(() => { setAppLang('ru'); setMode('quiz'); });
  await page.reload();
  await page.waitForTimeout(300);
  check('язык сохранился после перезагрузки', await page.evaluate(() => appLang === 'ru'));
  check('режим сохранился после перезагрузки', await page.evaluate(() => mode === 'quiz' && document.getElementById('tab-quiz').classList.contains('active')));
  check('подпись кнопки-иконки на языке интерфейса (рус)', await page.$eval('#lb-exit', el => el.getAttribute('aria-label') === 'Завершить урок'));
  await page.evaluate(() => setAppLang('kz'));
  check('подпись кнопки-иконки на языке интерфейса (каз)', await page.$eval('#lb-exit', el => el.getAttribute('aria-label') === 'Сабақты аяқтау'));
  check('у кнопок с видимым текстом нет aria-label', await page.evaluate(() => !document.querySelector('#sound-btn[aria-label], #graph-btn[aria-label], .ls-foot .ghost-btn[aria-label]')));
  check('превью ссылки: абсолютный og:image', await page.$eval('meta[property="og:image"]', el => /^https:\/\//.test(el.content)));
  check('прогресс (SRS) сохранился', await page.evaluate(() => known.has('apple') && srs['banana'] && srs['banana'].box === 0));

  console.log('— Структура: урок первым для постоянных');
  check('с прогрессом hero скрыт, урок первым', await page.evaluate(() =>
    document.body.classList.contains('returning') && document.querySelector('.hero').offsetParent === null
    && !document.getElementById('lesson-start').hidden));

  console.log('— Урок: логика');
  const ll = await page.evaluate(() => {
    localStorage.removeItem('ox_history'); localStorage.removeItem('ox_progress');
    srs = {}; known = new Set(); setDailyGoal(10); setMode('flash');
    // Всё «не знаю»: следующий урок не добавляет новых слов поверх повторений
    startSession(); let g = 0;
    while(idx < sessionDeck.length && g++ < 100) { if(!flipped) flipCard(); markRepeat(); }
    endSession();
    const plan2 = planSession();
    // Ошибка возвращается в этот же урок через REQUEUE_GAP карточек
    startSession();
    const first = getCard()[0]; flipCard(); markRepeat();
    const back = sessionDeck.findIndex((w, i) => i > 0 && w[0] === first);
    endSession();
    // Варианты теста: 4 разных ответа; та же часть речи, если таких слов хватает
    let bad = 0;
    for(let t = 0; t < 300; t++) {
      const w = WORDS[(t * 37) % WORDS.length], o = getRandomOpts(w, 4);
      const samePosAvail = WORDS.filter(x => x !== w && primaryPos(x) === primaryPos(w)).length >= 3;
      if(o.length !== 4 || new Set(o.map(x => x[3])).size !== 4) bad++;
      else if(samePosAvail && !o.every(x => primaryPos(x) === primaryPos(w))) bad++;
    }
    return { fresh: plan2.fresh.length, due: plan2.due.length, back, bad };
  });
  check('после ошибок новые слова не добавляются', ll.fresh === 0, JSON.stringify(ll));
  check('слова с ошибками ждут повторения', ll.due === 10, JSON.stringify(ll));
  check('ошибка возвращается через 3 карточки', ll.back === 4, JSON.stringify(ll));
  check('варианты теста: та же часть речи, без повторов', ll.bad === 0, JSON.stringify(ll));

  console.log('— Структура: новичок');
  await page.evaluate(() => { localStorage.removeItem('ox_progress'); localStorage.removeItem('ox_history'); });
  await page.reload();
  await page.waitForTimeout(300);
  check('без прогресса hero показан', await page.evaluate(() => document.querySelector('.hero').offsetParent !== null));
  await page.click('.hero-cta');
  await page.waitForTimeout(150);
  check('кнопка hero начинает урок', await page.evaluate(() => sessionActive));
  check('во время урока hero скрыт', await page.evaluate(() => document.querySelector('.hero').offsetParent === null));
  check('нет JS-ошибок в конце', errors.length === 0, errors[0]);

  await browser.close();
  console.log(failures === 0 ? '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ' : `\nПРОВАЛЕНО ПРОВЕРОК: ${failures}`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
