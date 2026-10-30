// Проверка поисковой страницы перед размещением.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('web-site/dist/index.html','utf8');
const payload=html.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/)[1];
assert.deepEqual(JSON.parse(payload),JSON.parse(fs.readFileSync('errors.json','utf8')));
const nodes={};const buttons=['нет пациента','не сохраняется дневник','не могу подписать эпикриз'].map(query=>({dataset:{query},addEventListener(event,fn){this[event]=fn}}));
function node(id){return nodes[id]??=(id==='data'?{textContent:payload}:{value:'',innerHTML:'',textContent:'',children:[],append(x){this.children.push(x)},addEventListener(event,fn){this[event]=fn},focus(){}})}
const context=vm.createContext({document:{getElementById:node,createElement:()=>({}),querySelectorAll:()=>buttons}});
vm.runInContext(fs.readFileSync('web-site/search.js','utf8'),context);
assert(node('results').innerHTML.includes('Начните с кода'));
const tests=[['нет пациента',['023']],['не сохраняется дневник',['041']],['не могу подписать эпикриз',['022','042']],['04x0001',['040']],['2992',['015']],['добавить МД',['003','004','005']],['не найден сертификат',['022']],['ДатаВыписки',['019']],['ошибка 500',[]],['DOC_DATE_MISMATCH_CERT_NOT_AFTER',['059']],['doc_date_mismatch_cert_not_before',['060']],['MIS_NOT_AVAILABLE',['062']],['00-00009439',['068']],['компоненты инъекции',['045']],['готов без подписи',['050']],['период просмотра ЭМК',['072']],['уже зарегистрирован',['056']]];
for(const [q,want] of tests){node('q').value=q;vm.runInContext('render()',context);const hits=[...node('results').innerHTML.matchAll(/<article id="error-(\d+)"/g)].map(m=>m[1]);assert(want.every(id=>hits.includes(id)),q);if(!want.length)assert.equal(hits.length,0)}
node('clear').onclick();assert.equal(node('q').value,'');assert(node('results').innerHTML.includes('Начните с кода'));
buttons[1].click();assert(node('results').innerHTML.includes('error-041'));
node('q').value='';node('cat').value='Назначения';vm.runInContext('render()',context);assert(node('results').innerHTML.includes('error-045'));assert(!node('results').innerHTML.includes('error-041'));
assert(!/<script[^>]+src=|<link[^>]+(?:stylesheet|preconnect)/i.test(html));
assert(!/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage)\b/.test(fs.readFileSync('web-site/search.js','utf8')));
assert.equal(fs.readFileSync('web-site/search.js','utf8'),fs.readFileSync('scripts/mobile_search.js','utf8'));
assert.equal(fs.readFileSync('research/mobile_script.js','utf8'),fs.readFileSync('scripts/mobile_search.js','utf8'));
// Опечатки не должны превращать неизвестный код в известную ошибку.
const extra=[['не сохраянется дневник','041'],['не сохраняется дненик','041'],['не найден сертифкат','022'],['сертификатт истек','059']];
node('cat').value='';
for(const [query,id] of extra){node('q').value=query;vm.runInContext('render()',context);assert(node('results').innerHTML.includes(`error-${id}`),query);assert(node('results').innerHTML.includes('Точных совпадений нет.'),query)}
for(const query of ['04x0002','DOC_DATE_MISMATCH_CERT_NOT_AFTEQ','ошибка 501']){node('q').value=query;vm.runInContext('render()',context);assert(!node('results').innerHTML.includes('<article id="error-'),query)}
node('q').value='не могу подписать эпикриз';vm.runInContext('render()',context);assert(node('results').innerHTML.includes('aria-label="Найденные ситуации"'));assert(node('results').innerHTML.includes('href="#error-042"'));
node('q').value='04x0001';node('cat').value='Назначения';vm.runInContext('render()',context);assert(node('results').innerHTML.includes('Есть совпадения в других разделах'));assert(!node('results').innerHTML.includes('<article id="error-'));
node('cat').value='';node('q').value='<img src=x onerror=alert(1)>';vm.runInContext('render()',context);assert(!node('results').innerHTML.includes('<img'));
node('q').value='041';vm.runInContext('render()',context);assert.equal([...node('results').innerHTML.matchAll(/<article id="error-(\d+)"/g)][0][1],'041');
console.log('Пройдены 17 исходных и 11 дополнительных сценариев: опечатки, строгие коды, выбор ситуации, фильтр, безопасный вывод и приоритет номера. Поиск одинаков в сайте и автономной версии; запросы не отправляются.');
