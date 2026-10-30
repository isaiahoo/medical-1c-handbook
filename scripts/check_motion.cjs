// Время перехода, ручная остановка, повторный поиск и уменьшение движения.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const script=fs.readFileSync('scripts/mobile_search.js','utf8');
const part=script.slice(script.indexOf('let resultScrollFrame'),script.indexOf('function showResults'));
let queue=new Map(),id=0,positions=[],reduced=false,instant=null;const events={};
const target={getBoundingClientRect:()=>({top:620}),scrollIntoView:options=>instant=options};
const win={scrollY:0,innerHeight:800,matchMedia:()=>({matches:reduced}),scrollTo:({top,behavior})=>{assert.equal(behavior,'instant');win.scrollY=top;positions.push(top)}};
const context=vm.createContext({window:win,document:{documentElement:{scrollHeight:3000},addEventListener:(name,fn)=>events[name]=fn},requestAnimationFrame:fn=>{queue.set(++id,fn);return id},cancelAnimationFrame:id=>queue.delete(id),target});vm.runInContext(part,context);
function tick(t){const pending=[...queue.values()];queue.clear();pending.forEach(fn=>fn(t))}
vm.runInContext('scrollToResults(target)',context);[0,300,600,900,1200].forEach(tick);
assert.deepEqual(positions,[0,37.5,300,562.5,600]);assert.equal(queue.size,0);
for(const event of ['wheel','touchstart','pointerdown','keydown','input']) {win.scrollY=0;vm.runInContext('scrollToResults(target)',context);tick(0);events[event]();assert.equal(queue.size,0)}
win.scrollY=0;vm.runInContext('scrollToResults(target);scrollToResults(target)',context);assert.equal(queue.size,1);events.wheel();
reduced=true;vm.runInContext('scrollToResults(target)',context);assert.equal(queue.size,0);assert.equal(instant.behavior,'instant');
console.log('Переход 1200 мс, плавная кривая, пять способов остановки, повторный поиск и уменьшение движения: проверено.');
