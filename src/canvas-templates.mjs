import {MAX_BOARD_NODES} from './board-operations.mjs';
// 纯数据流程模板：把「创建一组用途明确的空卡片」这件事做成可预测的计划，由调用方写入工程。
// 本模块不触碰 DOM、不修改工程、不接入任何新媒体接口，也不伪造生成结果：
// 图片 / 视频 / 音频节点一律不带 src，文案只提示「接入现有工具」或「导入成品」。
export const MAX_BOARD_GROUPS=200; // 与 validateProject 的分组上限保持一致
const COLUMN_GAP=420,ROW_GAP=340,NODE_WIDTH=320;
const ID_RE=/^[a-zA-Z0-9_-]{1,100}$/; // validateProject 的节点 / 分组 ID 规则
const ID_ATTEMPTS=64; // ID 生成器重复或非法时有限次数失败，绝不无限重试

// 画布一块卡片的默认占位说明：只讲来源与用途，不写成生成结果。
const PLACEHOLDER_HINT='选中后生成参考图，或用「导入素材」放入本地图片。';
export const CANVAS_TEMPLATES=[
 {id:'character-board',title:'角色设定',description:'角色档案与参考图，让不同镜头保持同一形象。',steps:['填写角色档案','生成或导入角色图'],nodes:[
  {type:'actor',col:0,row:0,title:'角色档案',text:'姓名：\n外观：\n服装：\n识别点：\n风格：'},
  {type:'image',col:1,row:0,title:'角色参考图',text:PLACEHOLDER_HINT}
 ],links:[[0,1]]},
 {id:'scene-board',title:'场景设计',description:'先确定空间与光线，再准备场景参考图。',steps:['填写场景档案','生成或导入场景图'],nodes:[
  {type:'scene',col:0,row:0,title:'场景档案',text:'空间：\n年代：\n光线：\n材质：\n禁忌：'},
  {type:'image',col:1,row:0,title:'场景参考图',text:PLACEHOLDER_HINT}
 ],links:[[0,1]]},
 {id:'first-last-video',title:'起止画面参考',description:'准备起点与终点两张参考图；生成模型是否支持精确首尾帧，以其能力说明为准。',steps:['起始参考图','结束参考图','选择模型生成视频'],nodes:[
  {type:'image',col:0,row:0,title:'首帧参考图',text:'运动的起始画面。\n'+PLACEHOLDER_HINT},
  {type:'image',col:0,row:1,title:'尾帧参考图',text:'运动的结束画面。\n'+PLACEHOLDER_HINT},
  {type:'video',col:1,row:0,title:'参考生成视频',text:'选择「生成视频」并核对模型支持的参考方式。\n两张参考图不保证精确首尾帧约束；可导入外部生成的视频。'}
 ],links:[[0,2],[1,2]]},
 {id:'voice-prep',title:'配音准备',description:'整理台词与语气，再导入录制或合成的配音。',steps:['整理台词稿','导入配音音频'],nodes:[
  {type:'text',col:0,row:0,title:'台词稿',text:'角色：\n台词：\n语气与停顿：'},
  {type:'audio',col:1,row:0,title:'配音音频（待导入）',text:'当前没有语音生成接口。\n导入配音后，可送入剪辑时间线。'}
 ],links:[[0,1]]}
];
const templateById=new Map(CANVAS_TEMPLATES.map(t=>[t.id,t]));

let fallbackSerial=0;
function randomId(){
 // node:test 环境不保证有 crypto；退化生成器同样落在合法字符集内。
 if(globalThis.crypto&&typeof globalThis.crypto.randomUUID==='function')return globalThis.crypto.randomUUID();
 fallbackSerial+=1;
 return `ct-${Date.now().toString(36)}-${fallbackSerial.toString(36)}-${Math.floor(Math.random()*1e6).toString(36)}`;
}
// 重复或非法 ID 只重试有限次数，之后明确报错，避免死循环。
function claimId(create,used,label){
 for(let attempt=0;attempt<ID_ATTEMPTS;attempt++){
  const id=create();
  if(typeof id==='string'&&ID_RE.test(id)&&!used.has(id)){used.add(id);return id;}
 }
 throw Error(`${label} ID 生成失败，请重试`);
}

// 返回一份可直接写入的计划：{nodes,edges,group,primaryId}。绝不修改 project。
// 分组默认折叠成一张卡片，成员全部是本次新建的节点，不复用既有节点或分组。
export function planCanvasTemplate(project,templateId,{x=0,y=0,createId}={}){
 if(!project||typeof project!=='object')throw Error('工程数据无效');
 const template=templateById.get(templateId);
 if(!template)throw Error('未知的画布流程模板');
 if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('模板落点位置无效');
 if(createId!==undefined&&typeof createId!=='function')throw Error('缺少 ID 生成器');
 const existingNodes=Array.isArray(project.nodes)?project.nodes:[],existingGroups=Array.isArray(project.boardGroups)?project.boardGroups:[];
 // 容量先行：写不下就整体不写，不给半成品。
 if(existingNodes.length+template.nodes.length>MAX_BOARD_NODES)throw Error('画布节点已达上限，本次模板未创建');
 if(existingGroups.length+1>MAX_BOARD_GROUPS)throw Error('画布分组已达上限，本次模板未创建');
 const create=createId||randomId,used=new Set();
 for(const n of existingNodes)if(n&&typeof n.id==='string')used.add(n.id);
 for(const g of existingGroups)if(g&&typeof g.id==='string')used.add(g.id);
 const nodes=template.nodes.map((step,index)=>{
  const column=Number.isInteger(step.col)?step.col:index,row=Number.isInteger(step.row)?step.row:0;
  return {id:claimId(create,used,'节点'),type:step.type,title:step.title,text:step.text,
   x:x+column*COLUMN_GAP,y:y+row*ROW_GAP,w:NODE_WIDTH};
 });
 const ids=nodes.map(n=>n.id);
 const edges=template.links.map(([from,to])=>{
  const source=nodes[from],target=nodes[to];
  if(!source||!target||source===target)throw Error('画布流程模板连线无效');
  return {from:source.id,to:target.id};
 });
 const group={id:claimId(create,used,'分组'),name:template.title,memberIds:ids,collapsed:true};
 return {nodes,edges,group,primaryId:ids[0]};
}
