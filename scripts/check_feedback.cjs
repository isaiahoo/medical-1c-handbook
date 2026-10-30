// Проверки передачи только кода при явном переходе и сохранения локального поиска.
const fs=require('fs'), vm=require('vm'), assert=require('assert');
const source=fs.readFileSync('scripts/mobile_search.js','utf8');
const funcs=source.slice(source.indexOf('function feedbackCode'), source.indexOf('function render'));
const context=vm.createContext({encodeURIComponent});
vm.runInContext(`function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}\n`+funcs,context);
let checked=0;
for(const [input,want] of [['ORA-29999','ORA-29999'],[' 500 ','500'],['у1–99','У1-99'],['0x80090016','0X80090016'],['TEST_000','TEST_000'],['NO_SNILS','NO_SNILS'],['-20013','-20013'],['',''],['12345678901',''],['123-456-789 00',''],['Иванов Иван',''],['Ошибка ORA-29999 у пациента',''],['<img src=x onerror=alert(1)>',''],['500&name=Иванов',''],['A'.repeat(1000),'']]){
 context.input=input; const got=vm.runInContext('feedbackCode(input)',context); assert.equal(got,want,input);
 const html=vm.runInContext('feedbackLink(input)',context);
 assert(!html.includes('<img')); assert(html.includes('target="_blank"')); assert(html.includes('rel="noopener noreferrer"'));
 assert.equal(html.includes('?answer_short_text_'),Boolean(want));
 if(want) assert(html.includes(encodeURIComponent(want))); checked++;
}
const html=fs.readFileSync('web-site/dist/index.html','utf8');
assert(!/<iframe|<script[^>]+src=|<link[^>]+(?:preconnect|prefetch)/i.test(html));
assert(html.includes('Сообщить о коде')); assert(html.includes('Яндекс Формы · без данных пациента'));
assert(!/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon)\b/.test(source));
fs.writeFileSync('research/feedback/checks.json', JSON.stringify({checked_on:'2026-10-30',cases:checked,passed:true,external_requests_before_click:false,patient_text_prefill:false},null,2));
console.log(`Пройдены ${checked} сценариев кода, приватность перехода и автономность сборки.`);
