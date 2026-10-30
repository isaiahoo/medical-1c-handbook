// Общий поиск для сайта и скачанного справочника. Запрос остаётся в браузере.
const data = JSON.parse(document.getElementById('data').textContent);
const q = document.getElementById('q'), cat = document.getElementById('cat');
const results = document.getElementById('results');
function norm(s) { return String(s ?? '').toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim(); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function searchable(r) {
  return norm([r.id, r.title, r.category, r.original_error_text, r.error_code, r.defect_id,
    ...r.alternative_search_phrases, ...r.keywords, r.workflow].filter(Boolean).join(' '));
}
const index = data.errors.map(r => ({r, text: searchable(r), words: [...new Set(searchable(r).split(' '))]}));
// Одна пропущенная, лишняя или заменённая буква либо перестановка соседних букв.
// Только длинные русские слова: цифры, латинские коды и короткие слова не исправляются.
function typo(a, b) {
  if (!/^[а-я]{5,}$/.test(a) || !/^[а-я]{5,}$/.test(b) || Math.abs(a.length - b.length) > 1) return false;
  if (a === b) return true;
  let i = 0;
  while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
  if (a.length === b.length) {
    return a.slice(i + 1) === b.slice(i + 1) ||
      (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}
function findMatches(query, category) {
  const terms = norm(query).split(' ').filter(Boolean);
  const candidates = index.filter(x => !category || x.r.category === category);
  let found = candidates.filter(x => terms.every(t => x.text.includes(t)));
  let approximate = false;
  // Подсказки появляются только при отсутствии буквальных совпадений.
  if (!found.length && terms.some(t => /^[а-я]{5,}$/.test(t))) {
    found = candidates.filter(x => terms.every(t => x.text.includes(t) || x.words.some(w => typo(t, w))));
    approximate = found.length > 0;
  }
  // Точный номер карточки, код или номер дефекта располагается первым.
  const exact = r => [r.id, r.error_code, r.defect_id].some(v => v && norm(v) === norm(query));
  found.sort((a, b) => Number(exact(b.r)) - Number(exact(a.r)));
  return {matches: found.map(x => x.r), approximate};
}
for (const c of [...new Set(data.errors.map(r => r.category))]) {
  const o = document.createElement('option'); o.textContent = c; o.value = c; cat.append(o);
}
function card(r) {
  return `<article id="error-${r.id}"><h2>№ ${r.id} — ${esc(r.title)}</h2>
    <p class="status">${esc(r.evidence_status.join(' · '))}</p>
    <p class="meta">${esc(r.software_product)} · ${esc(r.software_version)}</p>
    <p><b>Где возникает:</b> ${esc(r.workflow)}</p>
    <p><b>Что искать:</b> ${r.error_code ? 'Код: ' + esc(r.error_code) + '. ' : ''}${esc(r.original_error_text || 'Точный текст ошибки не установлен.')} ${esc(r.alternative_search_phrases.join('; '))}</p>
    <p><b>Почему:</b> ${esc(r.cause)}</p><h3>Что делать</h3>
    <ol>${r.physician_instructions.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    <details><summary>Если не помогло и источники</summary><p>${esc(r.escalation_instructions)}</p>
    <p>${r.source_urls.map(u => `<a href="${esc(u)}" target="_blank" rel="noreferrer noopener">Открыть источник</a>`).join(' · ')}</p>
    <p class="meta">${esc(r.source_locator)} ${esc(r.evidence_note)}</p>
    <p class="meta">Дата источника: ${esc(r.source_date)}. Проверено: ${esc(r.checked_on)}.</p></details>
    <p class="meta"><a href="#q">Вернуться к поиску</a></p></article>`;
}
function render() {
  const count = document.getElementById('count');
  if (!q.value.trim() && !cat.value) {
    count.textContent = `${data.errors.length} карточек с источниками`;
    results.innerHTML = '<div class="empty"><h2>Найдём подходящую ситуацию</h2><p>Начните с кода или двух-трёх слов. Если совпадений несколько, сравните операцию и версию программы.</p></div>';
    return;
  }
  const {matches, approximate} = findMatches(q.value, cat.value);
  count.textContent = `${approximate ? 'Похожие формулировки' : 'Найдено'}: ${matches.length} из ${data.errors.length}.` + (cat.value ? ` Раздел: ${cat.value}.` : '');
  if (!matches.length) {
    const other = cat.value && findMatches(q.value, '').matches.length;
    results.innerHTML = '<article><h2>Подтверждённый ответ не найден</h2>' +
      (other ? '<p class="search-note">Есть совпадения в других разделах. Выберите «Все разделы» в списке задач, сохранив текст запроса.</p>' : '') +
      '<p>Попробуйте два-три отличительных слова. Если похожих карточек нет, обратитесь в местную поддержку. По одному сообщению «ошибка 500» нельзя установить причину.</p></article>';
    return;
  }
  const note = approximate ? '<p class="search-note"><b>Точных совпадений нет.</b> Показаны похожие слова с возможной опечаткой. Сверьте ситуацию и версию перед выполнением действий. Коды ошибок автоматически не исправляются.</p>' : '';
  const shortlist = matches.length > 1 ? `<nav class="result-list" aria-label="Найденные ситуации"><b>Выберите подходящую ситуацию</b><p class="meta">У похожих сообщений могут быть разные причины.</p><ul>${matches.map(r => `<li><a href="#error-${r.id}">№ ${r.id} — ${esc(r.title)}</a><small>${esc(r.software_product)} · ${esc(r.software_version)}</small></li>`).join('')}</ul></nav>` : '';
  results.innerHTML = note + shortlist + matches.map(card).join('');
}
document.querySelectorAll('[data-query]').forEach(button => button.addEventListener('click', () => {
  q.value = button.dataset.query; cat.value = ''; render(); q.focus();
}));
q.addEventListener('input', render);
cat.addEventListener('change', render);
document.getElementById('clear').onclick = () => { q.value = ''; cat.value = ''; render(); q.focus(); };
render();
