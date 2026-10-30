// Поиск выполняется на устройстве; словарь меняет только подбор карточек.
const data = JSON.parse(document.getElementById('data').textContent);
const vocabulary = JSON.parse(document.getElementById('vocabulary').textContent);
const q = document.getElementById('q'), cat = document.getElementById('cat'), results = document.getElementById('results');
const stop = new Set(vocabulary.stop_words.split(' ').map(norm));
let visibleCount = 6;
const stems = new Map(), concepts = new Map(), comparisons = new Map();
function norm(s) { return String(s ?? '').toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim(); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function stem(word) {
  if (!/^[а-я]{5,}$/.test(word)) return word;
  if (!stems.has(word)) stems.set(word, word.replace(/(иями|ями|ами|ого|ему|ому|ыми|ими|ией|иям|иях|ах|ях|ов|ев|ей|ом|ем|ую|юю|ая|яя|ое|ее|ые|ия|ию|ии|ие|ый|ий|ой|а|я|ы|и|у|ю|е|о)$/, ''));
  return stems.get(word);
}
function concept(word) {
  if (concepts.has(word)) return concepts.get(word);
  const n = norm(word);
  const i = vocabulary.groups.findIndex(group => group.some(s => s.length >= 5 ? n.startsWith(s) : n === s));
  concepts.set(word, i < 0 ? null : i);
  return concepts.get(word);
}
function termsOf(text) {
  let s = norm(text);
  for (const [from, to] of vocabulary.phrases) s = (' ' + s + ' ').replaceAll(' ' + from + ' ', ' ' + to + ' ').trim();
  return [...new Set(s.split(' ').filter(w => w && !stop.has(w)))];
}
function typo(a, b) {
  if (!/^[а-я]{5,}$/.test(a) || !/^[а-я]{5,}$/.test(b) || Math.abs(a.length - b.length) > 1) return false;
  let i = 0; while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}
function wordMatch(a, b, fuzzy) {
  const key = a + '|' + b + '|' + fuzzy;
  if (!comparisons.has(key)) comparisons.set(key, compareWords(a, b, fuzzy));
  return comparisons.get(key);
}
function compareWords(a, b, fuzzy) {
  if (a === b) return 1;
  if (/[0-9]/.test(a)) return /[a-zа-я]/.test(a) && b.startsWith(a) ? 0.9 : 0;
  if (/^[a-z]+$/.test(a)) return a.length >= 3 && b.startsWith(a) ? 0.85 : 0;
  if (a.length >= 3 && b.startsWith(a)) return 0.9;
  if (a.length >= 4 && stem(a) === stem(b)) return 0.88;
  if (concept(a) !== null && concept(a) === concept(b)) return 0.72;
  return fuzzy && typo(a, b) ? 0.55 : 0;
}
const index = data.errors.map(r => {
  const codes = [...new Set([r.error_code, ...(r.error_codes || []), ...(r.rule_codes || []), ...(r.status_codes || [])].filter(Boolean).map(codeNorm))];
  const fields = [r.title, r.original_error_text || '', ...r.alternative_search_phrases, ...(r.diagnostic_markers || []), r.workflow, r.category, r.keywords.join(' '), ...codes];
  return {r, fields: fields.map(text => ({text: norm(text), words: termsOf(text)})), codes};
});
function codeNorm(s) { return String(s).toUpperCase().replace(/[–—−]/g,'-').replace(/\s+/g,'').replace(/^[UY](?=[13]-)/,'У').replace(/^0Х/,'0X'); }
// Коды с дефисом и отрицательные ответы ЭЛН нельзя исправлять нечётким поиском.
const codePattern = /[a-z][a-z0-9]*(?:_[a-z0-9]+)+|\bORA-\d+\b|-[0-9]{5}\b|\bERR\b|(?:[уyu][13]-\d+(?:\.\d+)*|core\d+-\d+|extra\d+-\d+)|\b(?:0[xх][0-9a-f]+|\d{2}x\d+)\b/gi;
function queryCodes(query) {
  return (query.match(codePattern) || []).map(codeNorm);
}
function codeMatches(known, requested) {
  return known === requested || (/^[A-Z][A-Z0-9_]{5,}$/.test(requested) && known.startsWith(requested+'_'));
}
function layoutCorrection(query) {
  if (!/^[a-z\s.,;']{4,}$/i.test(query)) return '';
  const from = "qwertyuiop[]asdfghjkl;'zxcvbnm,.", to = 'йцукенгшщзхъфывапролджэячсмитьбю';
  return query.toLowerCase().split('').map(c => from.includes(c) ? to[from.indexOf(c)] : c).join('');
}
function rank(query, category, fuzzy) {
  let terms = termsOf(query); const n = norm(query);
  if (!terms.length) return [];
  const protectedCodes = queryCodes(query);
  const numbers = query.match(/\b\d{3}\b/g) || [];
  const numericCode = !/^\s*[№#]/.test(query) && numbers.find(s => index.some(x=>x.codes.includes(s)));
  const requested = [...protectedCodes, ...(numericCode ? [numericCode] : [])];
  if (requested.length) {
    let rest=query.replace(codePattern,' ');
    if(numericCode) rest=rest.replace(new RegExp('\\b'+numericCode+'\\b','g'),' ');
    terms=termsOf(rest).filter(t=>!['код','статус'].includes(t));
  }
  const onlyCode = requested.length > 0 && !terms.length;
  return index.filter(x => !category || category === x.r.category).flatMap(x => {
    if (requested.some(code => !x.codes.some(known=>codeMatches(known,code)))) return [];
    const exact = x.codes.includes(codeNorm(query)) || (!numericCode && !requested.length && (n === x.r.id || query.trim() === '№ '+x.r.id));
    if (onlyCode) return [{r:x.r,score:exact?2000:1800,reason:exact?'Точный код':'Фрагмент кода',fuzzy:false}];
    const values = terms.map(t => Math.max(0, ...x.fields.flatMap(f => f.words.map(w => wordMatch(t, w, fuzzy))), [x.r.id,...x.codes.map(norm)].includes(t) ? 1 : 0));
    if (!exact && values.some(v => v === 0)) return [];
    // Не склеиваем разрозненные слова в ложную ситуацию: например, отсутствие
    // врача и запись пациента не означают, что пропал сам пациент.
    const together = Math.max(0, ...x.fields.map(f => terms.filter(t => f.words.some(w => wordMatch(t, w, fuzzy) > 0)).length));
    if (!exact && terms.length > 1 && together < Math.ceil(terms.length * 0.66)) return [];
    const phrase = Math.max(0, ...x.fields.map((f, i) => f.text.includes(n) && n.length >= 3 ? (i === 0 ? 45 : i === 1 ? 38 : 32) : 0));
    const inTitle = terms.reduce((v, t) => v + Math.max(0, ...x.fields[0].words.map(w => wordMatch(t, w, fuzzy))) * 8, 0);
    // Для общего запроса о подписи сначала показываем состояние документа.
    // Это порядок чтения, а не утверждение о причине конкретного сбоя.
    const generalSignature = terms.length === 1 && concept(terms[0]) === 0;
    const workflowPriority = generalSignature && /^документ|^после подписания/i.test(x.r.title) ? 20 : 0;
    const rawTerms = n.split(' ');
    const nearPhrase = fuzzy && rawTerms.length > 1 && x.fields.some(f => {
      const words = f.text.split(' ');
      return words.length === rawTerms.length && rawTerms.every((t, i) => wordMatch(t, words[i], true) > 0);
    }) ? 24 : 0;
    const score = (exact ? 1000 : 0) + Math.max(phrase, nearPhrase) + inTitle + workflowPriority + values.reduce((a, b) => a + b, 0) * 12;
    const reason = exact ? 'Точный код или номер карточки' : phrase ? 'Совпадает текст запроса' : values.some(v => v === 0.55) ? 'Похожее написание' : 'Совпадает описание';
    return [{r: x.r, score, reason, fuzzy: values.some(v => v === 0.55)}];
  }).sort((a, b) => b.score - a.score || a.r.id.localeCompare(b.r.id));
}
function findMatches(query, category = '') {
  query = query.replace(/[–—−]/g, '-');
  if (comparisons.size > 40000) comparisons.clear();
  if (!query.trim()) return {matches: data.errors.filter(r => !category || r.category === category), hits: [], approximate: false};
  let hits = rank(query, category, false), corrected = '';
  if (!hits.length) hits = rank(query, category, true);
  if (!hits.length && layoutCorrection(query)) {
    const changed = layoutCorrection(query);
    let alternative = rank(changed, category, false);
    if (!alternative.length) alternative = rank(changed, category, true);
    if (alternative.length) { hits = alternative; corrected = changed; }
  }
  return {matches: hits.map(h => h.r), hits, approximate: hits.some(h => h.fuzzy), corrected, needsContext: !termsOf(query).length};
}
function badge(r) {
  const status = r.evidence_status.filter(s => s !== 'Требует локальной проверки').join(' · ').replace('Подтверждено пользователем','Опыт пользователя').replace(/^Подтверждено$/,'Есть источник').replace('Не решено','Решение не подтверждено');
  return `<span class="badge${r.evidence_status.includes('Не решено') ? ' uncertain' : ''}">${esc(status)}</span>`;
}
function shortProduct(r) {
  if (r.software_product.includes('1C-MR')) return 'Линия 1C-MR';
  if (r.error_namespace === 'ЭЛН СФР') return 'ЭЛН · СФР';
  if (r.software_product.includes('ЕЦП.МИС')) return 'РЭМД · источник ЕЦП.МИС';
  if (r.software_product.includes('МедФлекс')) return 'РЭМД · МедФлекс';
  return r.software_product.replace('1С:Медицина. ', '1С: ');
}
function applicabilityText(r) {
  if (r.software_product.includes('ЕЦП.МИС')) return 'Внешний код; источник — ЕЦП.МИС. Для вашей 1С требуется проверка.';
  if (r.error_namespace === 'ЭЛН СФР' && !r.software_product.includes('1C-MR')) return 'Код сервиса ЭЛН СФР. Для вашей МИС требуется проверка.';
  return (r.software_version === 'Неизвестна' || r.software_version === 'Релиз не указан' ? '' : r.software_version + '. ') + 'В вашей больнице не проверено.';
}
function markerPreview(r) {
  const markers = [...new Set(r.diagnostic_markers || [])].filter(Boolean);
  return markers.length ? markers.slice(0, 3).join(' · ') : r.workflow;
}
function card(r, reason = '', open = false) {
  const displayCodes = r.rule_codes?.length ? r.rule_codes : r.error_codes?.length ? r.error_codes : r.status_codes?.length ? r.status_codes : r.error_code ? [r.error_code] : [];
  return `<article id="error-${r.id}"><details class="problem"${open ? ' open' : ''}><summary><span class="card-top"><span class="number">№ ${r.id}</span>${badge(r)}</span>${displayCodes.length ? `<span class="code">${displayCodes.map(esc).join(' · ')}</span>` : ''}<h2>${esc(r.title)}</h2><span class="context">${esc(markerPreview(r))}</span><span class="card-meta">${esc(shortProduct(r))}</span><span class="open-label"><span class="sr-only">Открыть или свернуть разбор</span><span aria-hidden="true">⌄</span></span></summary>
    <div class="answer"><p class="applicability">${esc(applicabilityText(r))}</p><p><b>Что означает:</b> ${esc(r.cause)}</p><h3>Что делать</h3><ol>${r.physician_instructions.map(s => `<li>${esc(s)}</li>`).join('')}</ol><div class="escalation"><h3>Если не помогло</h3><p>${esc(r.escalation_instructions)}</p></div>
    <details class="sources"><summary>Текст ошибки, версия и источники</summary><p>${r.error_code ? 'Код: <b>' + esc(r.error_code) + '</b>. ' : ''}${esc(r.original_error_text || 'Точный текст ошибки не установлен.')}</p><p class="meta">Что искать: ${esc(r.alternative_search_phrases.join('; '))}</p><p>${esc(r.software_product)} · ${esc(r.software_version)}</p><p>${r.source_urls.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noreferrer noopener">Источник ${i + 1}</a>`).join(' · ')}</p><p class="meta">${esc(r.source_locator)} ${esc(r.evidence_note)}</p><p class="meta">Дата источника: ${esc(r.source_date)}. Проверено: ${esc(r.checked_on)}.</p></details><a class="back" href="#q">Вернуться к поиску</a></div></details>${reason ? `<p class="match-reason">${esc(reason)}</p>` : ''}</article>`;
}
const tasks = [ ['Пациенты и госпитализация','Пациент и госпитализация'], ['Дневники и записи врача','Запись и дневник'], ['Назначения','Лекарства и назначения'], ['Эпикризы и выписка','Эпикриз и выписка'], ['Подписание документов','Электронная подпись'], ['Отправка электронных документов','Отправка в РЭМД'], ['Диагностика и исследования','Исследования'], ['Печать и формирование документов','Печать документов'], ['Больничные листы и ЭЛН','Больничный · ЭЛН'] ];
function taskButtons() { return `<div class="task-grid">${tasks.map(([value, label]) => `<button type="button" data-category="${esc(value)}">${label}<span aria-hidden="true"> →</span></button>`).join('')}</div>`; }
for (const c of [...new Set(data.errors.map(r => r.category))]) { const o = document.createElement('option'); o.textContent = c; o.value = c; cat.append(o); }
// Передаём только отдельный код узнаваемого формата и только при переходе по ссылке.
// Фразы, длинные номера и содержимое медицинских записей не подставляем.
function feedbackCode(value) {
  const code = String(value || '').trim().toUpperCase().replace(/[−–—]/g, '-');
  return /^(?:[1-5]\d{2}|-\d{5}|ORA-\d{5}|0X[0-9A-F]{8}|04X\d{4}|[УUY]1-\d{1,3}|[A-Z]{2,12}(?:_[A-Z0-9]{1,12}){1,3})$/.test(code) ? code : '';
}
function feedbackLink(value) {
  const code = feedbackCode(value);
  const url = 'https://forms.yandex.ru/u/6ae4dcd55057b22f2bee6761/' + (code ? '?answer_short_text_9008992638567346=' + encodeURIComponent(code) : '');
  return `<div class="feedback"><a class="feedback-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Сообщить о коде <span aria-hidden="true">↗</span></a><p class="meta">${code ? 'Код ' + esc(code) + ' подставится в форму.' : 'Укажите только код, без данных пациента.'} Яндекс Формы · новая вкладка · нужен интернет.</p><p class="meta">Проверим код и добавим разбор, если найдём надёжный источник.</p></div>`;
}
function render(keepOpen = []) {
  const count = document.getElementById('count');
  results.hidden = false; count.hidden = false;
  document.getElementById('back-search').hidden = !q.value.trim() && !cat.value;
  document.getElementById('clear').hidden = !q.value && !cat.value;
  document.getElementById('filter-state').textContent = cat.value ? 'Выбран раздел: ' + cat.value : 'Все разделы';
  if (!q.value.trim() && !cat.value) {
    count.textContent = '';
    const codes = [...new Set(data.errors.flatMap(r=>[...(r.error_codes||[]),...(r.rule_codes||[]) ]))].sort();
    results.innerHTML = `<section class="home"><p class="meta">${data.errors.length} разборов · Источники в каждой карточке</p><details class="browse"><summary>Коды в справочнике</summary><p class="meta">Буквенные коды и правила проверки. Числовой статус ищите вместе со словами из сообщения.</p><div class="code-list">${codes.map(c=>`<button type="button" data-query="${esc(c)}">${esc(c)}</button>`).join('')}</div></details><details class="browse"><summary>По разделам</summary>${taskButtons()}</details></section>`;
    return;
  }
  const found = findMatches(q.value, cat.value), {matches, approximate, corrected} = found;
  const hidden = cat.value ? `<button class="text-button" type="button" data-action="all-categories">Искать во всех разделах</button>` : '';
  count.textContent = `${matches.length ? 'Найдено ситуаций: ' + matches.length : 'Совпадений нет'}${cat.value ? ' · ' + cat.value : ''}`;
  if (!matches.length) {
    const other = cat.value && findMatches(q.value, '').matches.length;
    results.innerHTML = `<section class="empty"><h2>${found.needsContext ? 'Уточните, что вы делали' : 'Подтверждённый ответ не найден'}</h2><p>${other ? 'Есть совпадения в других разделах. Снимите фильтр, сохранив запрос.' : found.needsContext ? 'Например: искали пациента, подписывали эпикриз или печатали назначения.' : 'Попробуйте название действия и два-три слова из сообщения. Неизвестный код нельзя надёжно объяснить по похожему номеру.'}</p>${hidden}${!other && !found.needsContext ? feedbackLink(q.value) : ''}${taskButtons()}<details><summary>Что передать поддержке</summary><p>Название системы и версию, время сбоя, выполняемое действие и текст сообщения без данных пациента. Не повторяйте назначение, выписку или отправку, пока не проверено состояние исходной записи.</p></details></section>`;
    return;
  }
  let note = approximate ? '<p class="search-note"><b>Точных совпадений нет.</b> Найдены похожие слова с возможной опечаткой. Коды не исправлялись. Сверьте описание ситуации.</p>' : '';
  if (corrected) note += `<p class="search-note">Возможно, была включена английская раскладка. Показаны результаты для «${esc(corrected)}». <button type="button" class="text-button" data-query="${esc(corrected)}">Использовать эту формулировку</button></p>`;
  if (matches.length > 1) note += '<p class="guidance">Есть несколько вариантов. Сверьте вид документа и слова после кода.</p>';
  else if (matches[0].context_required) note += '<p class="guidance">Сверьте вид документа и уточняющие слова сообщения.</p>';
  const categories = [...new Set(matches.map(r => r.category))];
  const facets = !cat.value && categories.length > 1 ? `<div class="refine" aria-label="Уточнить задачу">${categories.map(c => `<button type="button" data-refine="${esc(c)}">${esc(c)} <span>${matches.filter(r => r.category === c).length}</span></button>`).join('')}</div>` : hidden;
  const shown = matches.slice(0, visibleCount);
  results.innerHTML = note + facets + shown.map(r => card(r, found.hits.find(h => h.r.id === r.id)?.reason, matches.length === 1 || keepOpen.includes('error-' + r.id))).join('') + (matches.length > visibleCount ? `<button type="button" class="more" data-action="more">Показать ещё ${Math.min(6, matches.length - visibleCount)} из ${matches.length - visibleCount}</button>` : '');
}
function update() { visibleCount = 6; render(); }
function chooseQuery(value) { q.value = value; cat.value = ''; update(); }
let resultScrollFrame = null;
function cancelResultScroll() {
  if (resultScrollFrame !== null) cancelAnimationFrame(resultScrollFrame);
  resultScrollFrame = null;
}
function scrollToResults(target) {
  cancelResultScroll();
  if (typeof requestAnimationFrame !== 'function' || typeof window === 'undefined') {
    target.scrollIntoView({block: 'start'}); return;
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    target.scrollIntoView({block: 'start', behavior: 'instant'}); return;
  }
  const from = window.scrollY;
  const maxTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const to = Math.min(maxTop, Math.max(0, from + target.getBoundingClientRect().top - 20));
  if (Math.abs(to - from) < 2) return;
  let started;
  function frame(now) {
    if (started === undefined) started = now;
    const progress = Math.min(1, (now - started) / 1200);
    const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
    window.scrollTo({top: from + (to - from) * eased, behavior: 'instant'});
    resultScrollFrame = progress < 1 ? requestAnimationFrame(frame) : null;
  }
  resultScrollFrame = requestAnimationFrame(frame);
}
// Ручное действие сразу возвращает управление прокруткой врачу.
for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown', 'input']) {
  document.addEventListener(event, cancelResultScroll, {passive: true});
}
function showResults() {
  q.blur(); const count = document.getElementById('count');
  count.focus({preventScroll: true});
  scrollToResults(count);
}
document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.query !== undefined) chooseQuery(button.dataset.query);
  if (button.dataset.category) { q.value = ''; cat.value = button.dataset.category; update(); }
  if (button.dataset.refine) { cat.value = button.dataset.refine; update(); }
  if (button.dataset.action === 'search') { q.focus({preventScroll: true}); q.select(); q.scrollIntoView({block:'center'}); return; }
  if (button.dataset.action === 'all-categories') { cat.value = ''; update(); }
  if (button.dataset.action === 'more') {
    const open = [...document.querySelectorAll('article > details.problem[open]')].map(d => d.parentElement.id);
    visibleCount += 6; render(open);
  } else if (button.dataset.query !== undefined || button.dataset.category || button.dataset.refine || button.dataset.action === 'all-categories') showResults();
});
q.addEventListener('input', () => { document.getElementById('clear').hidden = !q.value && !cat.value; results.hidden = true; document.getElementById('count').hidden = true; }); cat.addEventListener('change', update);
document.getElementById('clear').onclick = () => { q.value = ''; cat.value = ''; update(); q.focus(); };
document.getElementById('search-form').addEventListener('submit', event => { event.preventDefault(); update(); showResults(); });
render();
