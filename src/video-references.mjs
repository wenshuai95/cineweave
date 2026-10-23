// Reference identity is the node ID. Aliases survive reordering and renaming.
export const referenceNames={image:'图片',video:'视频',audio:'音频'};
export const referenceLimits={image:3,video:1,audio:1};
export const referencePurposes={image:{appearance:'角色外观',scene:'场景构图',style:'画面风格'},video:{motion:'人物动作',camera:'镜头运动',rhythm:'剪辑节奏'},audio:{dialogue:'台词内容',voice:'声音风格',rhythm:'音乐节奏'}};
export function defaultReferencePurpose(kind){return {image:'appearance',video:'motion',audio:'rhythm'}[kind];}
export function referencePurposeLabel(r){return referencePurposes[r.kind]?.[r.purpose]||'综合参考';}
export function sanitizeVideoDraft(raw,remap=id=>id){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
 const out={};for(const [key,max] of Object.entries({prompt:6000,modelId:100,duration:10,resolution:30,aspect:30}))if(typeof raw[key]==='string')out[key]=raw[key].slice(0,max);
 const validId=id=>typeof id==='string'&&/^[\w.-]{1,100}$/.test(id);
 out.aliases=Array.isArray(raw.aliases)?raw.aliases.slice(0,1000).filter(r=>r&&validId(r.nodeId)&&referenceNames[r.kind]&&typeof r.alias==='string'&&r.alias.length<20&&new RegExp('^'+referenceNames[r.kind]+'[1-9][0-9]*$').test(r.alias)).map(r=>({nodeId:remap(r.nodeId),kind:r.kind,alias:r.alias,...(Object.hasOwn(referencePurposes[r.kind],r.purpose)?{purpose:r.purpose}:{})})):[];
 out.referenceOrder=Array.isArray(raw.referenceOrder)?raw.referenceOrder.slice(0,500).filter(validId).map(remap):[];
 out.excludeSelf=raw.excludeSelf===true;return out;
}
export function referenceEntries(nodes,ids,previous=[]){
 const used=new Set(previous.map(r=>r.alias));
 return [...new Set(ids)].map(id=>{
  const n=nodes.find(n=>n.id===id&&referenceNames[n.type]&&n.src);if(!n)return null;
  const old=previous.find(r=>r.nodeId===id&&r.kind===n.type&&new RegExp('^'+referenceNames[n.type]+'[1-9][0-9]*$').test(r.alias));
  let alias=old?.alias;
  if(!alias){let i=1;while(used.has(referenceNames[n.type]+i))i++;alias=referenceNames[n.type]+i;used.add(alias);}
  return {nodeId:id,kind:n.type,alias,title:n.title,...(Object.hasOwn(referencePurposes[n.type],old?.purpose)?{purpose:old.purpose}:{})};
 }).filter(Boolean);
}
export function referenceProblem(entries,model){
 for(const [kind,max] of Object.entries(referenceLimits))if(entries.filter(r=>r.kind===kind).length>max)return `当前最多参考 ${max} ${kind==='image'?'张':'段'}${referenceNames[kind]}`;
 if(model){const unsupported=Object.keys(referenceNames).filter(k=>entries.some(r=>r.kind===k)&&!model.media[k]);if(unsupported.length)return '此模型不支持'+unsupported.map(k=>referenceNames[k]).join('、')+'参考，请更换模型或移除该参考';
  if(model.audioRequiresVisual&&entries.some(r=>r.kind==='audio')&&!entries.some(r=>['image','video'].includes(r.kind)))return '此模型的音频参考需要同时连接图片或视频';
  if(!entries.length&&!model.promptOnly)return '此模型需要参考素材';}
 return '';
}
export function validateReferenceMentions(prompt,entries){
 const aliases=new Set(entries.map(r=>r.alias));
 const missing=[...String(prompt).matchAll(/@(图片|视频|音频)([1-9][0-9]*)(?![0-9])/g)].map(m=>m[1]+m[2]).filter(a=>!aliases.has(a));
 return missing.length?'引用素材已移除或未连接：'+[...new Set(missing)].map(a=>'@'+a).join('、'):'';
}
// The CLI exposes ordered media arrays, not a media-name --bind API. Translate
// UI aliases into explicit ordinal references; do not pretend to bind asset URIs.
export function compileReferencePrompt(prompt,entries){
 const error=validateReferenceMentions(prompt,entries);if(error)throw Error(error);
 const counts={image:0,video:0,audio:0},mapping=new Map();
 for(const r of entries){const ordinal=++counts[r.kind];if(r.alias)mapping.set(r.alias,`第${ordinal}${r.kind==='image'?'张':'段'}参考${referenceNames[r.kind]}`);}
 const text=String(prompt).replace(/@(图片|视频|音频)([1-9][0-9]*)(?![0-9])/g,(all,kind,index)=>mapping.get(kind+index)||all);
 const purposes=entries.filter(r=>r.purpose&&referencePurposes[r.kind]?.[r.purpose]).map(r=>`${mapping.get(r.alias)}用于${referencePurposeLabel(r)}`);
 return text+(purposes.length?'\n参考用途（创作意图，具体遵循程度取决于模型）：'+purposes.join('；'):'');
}
export function mentionQuery(text,caret){
 const before=String(text).slice(0,caret),m=before.match(/@([^\s@]{0,40})$/);
 return m?{start:before.length-m[0].length,end:caret,query:m[1]}:null;
}
export function insertMention(text,caret,alias){
 const q=mentionQuery(text,caret),start=q?.start??caret;
 const value=String(text).slice(0,start)+'@'+alias+' '+String(text).slice(caret);
 return {value,caret:start+alias.length+2};
}
