// Проверки кодов, неоднозначности и защиты от ложного совпадения.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const data=JSON.parse(fs.readFileSync('errors.json','utf8'));
const vocab=fs.readFileSync('scripts/search_vocabulary.json','utf8');
const nodes={};
function node(id){return nodes[id]??=(id==='data'?{textContent:JSON.stringify(data)}:id==='vocabulary'?{textContent:vocab}:{value:'',innerHTML:'',textContent:'',append(){},addEventListener(e,f){this[e]=f},focus(){},blur(){},scrollIntoView(){}})}
const ctx=vm.createContext({document:{getElementById:node,createElement:()=>({}),querySelectorAll:()=>[],addEventListener(){}}});
vm.runInContext(fs.readFileSync('scripts/mobile_search.js','utf8'),ctx);
function find(q){ctx.query=q;return Array.from(vm.runInContext('findMatches(query).matches.map(r=>r.id)',ctx))}
let checks=0;
for(const row of data.errors){
 for(const code of [...(row.error_codes||[]),...(row.rule_codes||[]),...(row.status_codes||[])]){
  assert(find(code).includes(row.id),code+' не находит '+row.id);checks++;
  assert(find(code.toLowerCase()).includes(row.id),'Регистр: '+code);checks++;
 }
}
for(const q of ['NO_SNILX','DOC_DATE_MISMATCH_CERT_NOT_AFTEX','У1-999','Core03-999','04x0002','0xDEADBEEF','ORA-20019','ORA-99999','-20019','ELR_8999','ELR_88','ELR_9999']){assert.deepEqual(find(q),[],'Неизвестный код: '+q);checks++;}
for(const [q,ids] of [
 ['ORA-20013: Не удалось обновить данные. Обновляемая запись потеряла актуальность',['160']],['ORA-20015: Направленные данные ЭЛН уже присутствуют в системе',['161']],['ORA-20013',['160']],['ora–20013',['160']],['-20013',['160']],['ошибка ORA-20015',['161']],['ERR',['167','168']],['ERR количество периодов',['167']],['ERR доступ ЭЛН',['168']],['ELR_8',['166']],['ELR_899',['165']],['SIGNER_ORG_MISMATCH',['173']],['ELR_1607',['174']],['У1-52',['098']],['у1–52',['098']],['U1-52',['098']],
 ['PERSON_POST',['061']],['500',['089','090']],['ошибка 500',['089','090']],
 ['У1-27',['096','097','108','109']],['У1-27 performer',['108']],
 ['VALIDATION_ERROR У1-52',['098']],['GET_DOCUMENT_FILE_ERROR',['148','157']],
 ['301',['091','154']],['№ 101',['101']],['ValidationError',['155']],
 ['У3-19.1.4.1.2',['099']],['cvc-minLength-valid',['092','158']]
]){const got=find(q);for(const id of ids)assert(got.includes(id),q+': отсутствует '+id+'; '+got);checks++;}
const allDataCodes=new Set(data.errors.flatMap(r=>r.error_codes||[]));
assert(!allDataCodes.has('601'));assert(!allDataCodes.has('233'));assert(!allDataCodes.has('2992'));checks+=3;
for(const q of ['ERR','500','У1-27','VALIDATION_ERROR','301']){node('q').value=q;vm.runInContext('update()',ctx);assert(node('results').innerHTML.includes('несколько вариантов'));assert(!node('results').innerHTML.includes('class="problem" open'));checks++;}
node('q').value='NO_SNILS';vm.runInContext('update()',ctx);const before=node('results').innerHTML;
node('q').value='У1-52';node('q').input();assert.equal(node('results').innerHTML,before,'При вводе результат не должен перерисовываться');
node('search-form').submit({preventDefault(){}});assert(node('results').innerHTML.includes('error-098'));checks+=2;
fs.writeFileSync('research/codes-v5/search_verification.json',JSON.stringify({checked_on:'2026-10-30',checks,passed:true,cards:data.errors.length,message_codes:allDataCodes.size,rule_designations:new Set(data.errors.flatMap(r=>r.rule_codes||[])).size,validation_statuses:new Set(data.errors.flatMap(r=>r.status_codes||[])).size},null,2));
console.log('Проверок кодов и поведения пройдено: '+checks);
