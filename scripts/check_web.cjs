// Обезличенные сценарии: релевантность, строгие коды, взаимодействия и комплектность.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('web-site/dist/index.html','utf8');
const payload=html.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/)[1];
const vocab=html.match(/<script type="application\/json" id="vocabulary">([\s\S]*?)<\/script>/)[1];
assert.deepEqual(JSON.parse(payload),JSON.parse(fs.readFileSync('errors.json','utf8')));
function setup(script){
 const nodes={},events={};
 function node(id){return nodes[id]??=(id==='data'?{textContent:payload}:id==='vocabulary'?{textContent:vocab}:{value:'',innerHTML:'',textContent:'',children:[],append(x){this.children.push(x)},addEventListener(e,f){this[e]=f},select(){this.selected=true},focus(){this.focused=true},blur(){this.blurred=true},scrollIntoView(){this.scrolled=true}})}
 const context=vm.createContext({document:{getElementById:node,createElement:()=>({}),querySelectorAll:()=>[],addEventListener(e,f){events[e]=f}}});
 vm.runInContext(script,context);
 return {context,node,click(dataset){events.click({target:{closest(){return {dataset}}}})}};
}
const code=fs.readFileSync('web-site/search.js','utf8');
const {context,node,click}=setup(code);
const old=setup(fs.readFileSync('research/search-v3/previous_search.js','utf8'));
const cases=JSON.parse(fs.readFileSync('scripts/search_cases.json','utf8'));
const report=[];let failed=0,oldHits=0,newHits=0;
for(const [query,want] of cases){
 context.query=query;old.context.query=query;
 const now=vm.runInContext('findMatches(query).matches.map(r=>r.id)',context);
 const before=vm.runInContext('findMatches(query).matches.map(r=>r.id)',old.context);
 const ok=want.length?want.some(id=>now.slice(0,3).includes(id)):now.length===0;
 const previous=want.length?want.some(id=>before.slice(0,3).includes(id)):before.length===0;
 if(ok)newHits++;if(previous)oldHits++;
 if(report.length < 16) assert(want.every(id=>now.includes(id)), 'Исходный сценарий: '+query);
 report.push({query,expected:want,before:Array.from(before.slice(0,3)),after:Array.from(now.slice(0,3)),passed:ok});
 if(!ok){console.error('Не пройдено:',query,now.slice(0,10));failed++}
}
fs.writeFileSync('research/codes-v5/legacy_search_checks.json',JSON.stringify({total:cases.length,before:oldHits,after:newHits,cases:report},null,2));
assert.equal(failed,0,'Нужны исправления релевантности');
assert(node('results').innerHTML.includes('Коды в справочнике'));
assert(!html.includes('data-query="пациент пропал"')); 
context.query='пациент пропал';const precise=vm.runInContext('findMatches(query).matches.map(r=>r.id)',context);assert(!precise.includes('054'));assert(!precise.includes('006'));
click({query:'подпись не работает'});assert(node('results').innerHTML.includes('data-refine'));
click({refine:'Подписание документов'});assert.equal(node('q').value,'подпись не работает');assert(node('results').innerHTML.includes('data-action="all-categories"'));
click({action:'all-categories'});assert.equal(node('cat').value,'');assert.equal(node('q').value,'подпись не работает');
click({category:'Назначения'});assert.equal(node('q').value,'');assert.equal(node('cat').value,'Назначения');assert(node('results').innerHTML.includes('error-045'));
node('q').value='04x0001';vm.runInContext('update()',context);assert(node('results').innerHTML.includes('Есть совпадения в других разделах'));click({action:'all-categories'});assert(node('results').innerHTML.includes('error-040'));
click({category:'Отправка электронных документов'});let first=[...node('results').innerHTML.matchAll(/<article id=/g)].length;assert.equal(first,6);click({action:'more'});assert.equal([...node('results').innerHTML.matchAll(/<article id=/g)].length,12);
node('clear').onclick();assert.equal(node('q').value,'');assert.equal(node('cat').value,'');assert(node('q').focused);
click({query:'ORA-20013'});click({action:'search'});assert(node('q').focused && node('q').selected && node('q').scrolled);assert(!node('back-search').hidden);
click({query:'ERR'});assert(node('results').innerHTML.includes('количество новых периодов'));assert(node('results').innerHTML.includes('доступ к ЭЛН ограничен'));
click({query:'04x0001'});assert(node('results').innerHTML.includes('class="problem" open'));assert(node('results').innerHTML.includes('Источ')); // источники доступны в карточке
let submitted=false;node('search-form').submit({preventDefault(){submitted=true}});assert(submitted);assert(node('q').blurred);assert(node('count').focused);assert(node('count').scrolled);
click({query:'<img src=x onerror=alert(1)>'});assert(!node('results').innerHTML.includes('<img'));
click({query:'не работает'});assert(node('results').innerHTML.includes('Уточните, что вы делали'));
assert(!/<script[^>]+src=|<link[^>]+(?:stylesheet|preconnect)/i.test(html));
assert(!/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage)\b/.test(code));
assert.equal(code,fs.readFileSync('scripts/mobile_search.js','utf8'));assert.equal(code,fs.readFileSync('research/mobile_script.js','utf8'));
const offline=fs.readFileSync('doctor_guide_mobile.html','utf8');assert(offline.includes(code));assert(offline.includes(vocab));
console.log(`Пройдены ${cases.length} поисковых сценария. Нужная карточка в первых трёх / корректный отказ: до ${oldHits}, после ${newHits}. Проверены фильтры, показ ещё, раскрытие, отправка формы, безопасный вывод и автономная сборка.`);
