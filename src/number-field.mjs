// 数字输入增强：type=number 无法 select() 全选，统一升级为 text+inputmode=decimal
// （标记 data-nf），并在元素实例上补丁 valueAsNumber，保持既有读取点兼容。
// 行为：双击全选直接键入替换；Enter 提交；Esc / 非法输入恢复上次有效值；
// min/max 越界钳制；上下方向键按 step 步进（Shift 精调 1/10）。
// 每次提交仍是单个 change 事件，应用的撤销粒度不变。

export const NUMBER_FIELD_ATTR='data-nf';
const SELECTOR=`[${NUMBER_FIELD_ATTR}]`;

export function parseNumberText(text){
 const raw=(typeof text==='string'?text:String(text??'')).trim();
 if(!raw)return NaN;
 const n=Number(raw);
 return Number.isFinite(n)?n:NaN;
}

export function formatNumber(n){return Number.isFinite(n)?String(Number(n.toPrecision(12))):''}

export function fieldRange(el){
 const min=el.getAttribute&&el.getAttribute('min'),max=el.getAttribute&&el.getAttribute('max');
 return {min:min!=null&&min!==''&&Number.isFinite(+min)?+min:-Infinity,max:max!=null&&max!==''&&Number.isFinite(+max)?+max:Infinity};
}

export function fieldStep(el){
 const s=el.getAttribute&&el.getAttribute('step');
 return s!=null&&s!==''&&s!=='any'&&Number.isFinite(+s)?+s:1;
}

export function clampField(n,{min,max}){return Math.min(max,Math.max(min,n))}

// 规范化当前值：可解析则钳制到 min/max 并回写规范字符串；否则恢复备份值。
export function normalizeNumberField(el){
 const n=parseNumberText(el.value);
 if(Number.isFinite(n)){
  const v=clampField(n,fieldRange(el)),s=formatNumber(v);
  if(s!==el.value)el.value=s;
  if(el.dataset)el.dataset.nfBackup=s;
  return v;
 }
 const backup=el.dataset&&el.dataset.nfBackup!=null?el.dataset.nfBackup:'';
 if(el.value!==backup)el.value=backup;
 return parseNumberText(backup);
}

export function isNumberField(el){return !!(el&&el.closest&&el.closest(SELECTOR))}

export function upgradeNumberInput(el){
 if(!el||!el.getAttribute||el.hasAttribute&&el.hasAttribute(NUMBER_FIELD_ATTR))return false;
 if(el.getAttribute('type')!=='number')return false;
 el.setAttribute(NUMBER_FIELD_ATTR,'');
 const n=parseNumberText(el.value);
 if(el.dataset)el.dataset.nfBackup=Number.isFinite(n)?formatNumber(n):'';
 el.setAttribute('type','text');
 el.setAttribute('inputmode','decimal');
 el.setAttribute('autocomplete','off');
 try{
  Object.defineProperty(el,'valueAsNumber',{
   configurable:true,
   get(){return parseNumberText(this.value)},
   set(v){this.value=formatNumber(v)},
  });
 }catch{}
 return true;
}

// 方向键步进；每次按键只派发 input，change 仍等提交（失焦/Enter）时一次触发。
export function stepFieldInput(el,dir=1,precise=false){
 const step=fieldStep(el),n=parseNumberText(el.value);
 const base=Number.isFinite(n)?n:parseNumberText(el.dataset&&el.dataset.nfBackup||'');
 if(!Number.isFinite(base))return null;
 const v=clampField(Math.round((base+dir*step*(precise?.1:1))*1e6)/1e6,fieldRange(el));
 el.value=formatNumber(v);
 el.dispatchEvent&&el.dispatchEvent(new Event('input',{bubbles:true}));
 return v;
}

export function installNumberFields(root){
 const scope=(root&&(root.body||root))||(typeof document!=='undefined'?document:null);
 if(!scope)return;
 const scan=node=>{
  if(node.nodeType!==1||!node.querySelectorAll)return;
  if(node.matches&&node.matches('input[type=number]'))upgradeNumberInput(node);
  for(const el of node.querySelectorAll('input[type=number]'))upgradeNumberInput(el);
 };
 scan(scope);
 if(typeof MutationObserver!=='undefined'){
  const mo=new MutationObserver(muts=>{for(const m of muts)for(const node of m.addedNodes)scan(node)});
  mo.observe(scope,{childList:true,subtree:true});
 }
 const committed=new WeakMap();
 const field=t=>t&&t.closest?t.closest(SELECTOR):null;
 const onDblclick=e=>{const el=field(e.target);if(!el)return;e.preventDefault();el.select&&el.select()};
 const onFocusIn=e=>{const el=field(e.target);if(el&&el.dataset){el.dataset.nfBackup=el.value;committed.set(el,el.value)}};
 // focusout 先于 change：在这里恢复/钳制，随后的原生 change 携带规范值或干脆不触发。
 const onFocusOut=e=>{const el=field(e.target);if(el)normalizeNumberField(el)};
 const onKeydown=e=>{
  const el=field(e.target);if(!el||el.disabled||el.readOnly)return;
  if(e.key==='Enter'){e.preventDefault();normalizeNumberField(el);el.blur&&el.blur()}
  else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();const b=el.dataset&&el.dataset.nfBackup!=null?el.dataset.nfBackup:'';if(el.value!==b)el.value=b;el.blur&&el.blur()}
  else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();stepFieldInput(el,e.key==='ArrowDown'?-1:1,e.shiftKey)}
 };
 const onChange=e=>{
  const el=field(e.target);if(!el)return;
  const n=normalizeNumberField(el);
  if(!Number.isFinite(n)||parseNumberText(el.value)===parseNumberText(committed.get(el))){e.preventDefault();e.stopImmediatePropagation()}else committed.set(el,el.value)
 };
 document.addEventListener('dblclick',onDblclick,true);
 document.addEventListener('focusin',onFocusIn,true);
 document.addEventListener('focusout',onFocusOut,true);
 document.addEventListener('keydown',onKeydown,true);
 document.addEventListener('change',onChange,true);
}
