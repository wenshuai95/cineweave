import {videoVersionGroup} from './video-versions.mjs';
import {getCanvasStoryContext} from './workstation/canvas-source.mjs';

const names={text:'文本',image:'图片',video:'视频',audio:'音频',actor:'角色',scene:'场景',model:'3D 模型',director:'导演台'};
const hints={text:'记录剧本、台词、镜头说明或参考信息',image:'从文件夹拖入图片，或使用已有生图工具',video:'选择图片或白模参考，通过 Provider 生成视频',audio:'拖入配音、音效或音乐，先整理台词也可以',actor:'补充外观、服装与固定识别点',scene:'描述空间、材质、光线与氛围',director:'当前工程共享场景；连入模型后进入导演台预演',model:'连接导演台，即可摆放和预演'};
const tagIcons={text:'text',image:'image',video:'video',audio:'audio',actor:'model',scene:'model',model:'model',director:'video'};
/** Canvas tag shown above a node card: type first, then a short title. No header bar inside the card. */
export function nodeCanvasTag(node){
 const type=node?.type;
 const label=names[type]||'节点';
 const title=typeof node?.title==='string'?node.title.trim():'';
 const prefix=type==='text'?'T':label;
 return {icon:tagIcons[type]||'text',label,type:type||'',text:title?`${prefix} · ${title}`:prefix};
}
export function nodePresentation(project,node){
 const context=getCanvasStoryContext(project,node.id);
 const kind=context?.kind;
 const assetVersion=node.type==='image'&&node.storyImageRef?(project.workstation?.story?.assets||[]).find(asset=>asset.id===node.storyImageRef.assetId):null;
 const imageOfficial=!!(node.type==='image'&&node.storyImageRef&&assetVersion?.selectedImageId===node.storyImageRef.versionId);
 const imageState=node.type==='image'?(node.storyImageRef?(imageOfficial?'正式图':'旧正式图'):node.imageResultContext?(node.assetImageVersionId?'已加入资产版本':'资产候选图'):node.src?'已有素材':'待导入'):null;
 return {
  label:({script:'项目剧本',shot:'文学分镜',asset:'资产提示词',image:'资产正式图片'})[kind]||names[node.type]||'节点',
  status:kind==='script'?(node.text?.trim()?'已导入':'待导入'):kind==='shot'?'已规划':kind==='asset'?'提示词':node.type==='model'?(node.objectId?'已接入':'待接入'):node.type==='director'?'共享场景入口':node.type==='image'?imageState:node.src?'已有素材':['image','video','audio'].includes(node.type)?'待导入':node.text?.trim()?'已记录':'待完善',
  hint:hints[node.type]||'选中节点，继续创作',
  empty:!node.src&&!node.text?.trim()&&!['model','director'].includes(node.type),
 };
}
export function nodeQuickActions(project,node){
 const context=getCanvasStoryContext(project,node.id);
 const imageAsset=node.type==='image'&&node.storyImageRef?(project.workstation?.story?.assets||[]).find(asset=>asset.id===node.storyImageRef.assetId):null;
 const imageOfficial=!!(node.storyImageRef&&imageAsset?.selectedImageId===node.storyImageRef.versionId);
 if(context?.kind==='script')return [{id:'content',label:'编辑正文',primary:true}];
 if(context?.kind==='shot')return [{id:'edit',label:'编辑分镜',primary:true}];
 if(context&&!(node.type==='image'&&node.src))return [{id:'edit',label:'图片与版本',primary:true},{id:'content',label:context.kind==='asset'?'编辑提示词':'编辑说明'}];
 const edit={id:'content',label:'编辑内容',primary:true};
 if(node.type==='text')return [edit,{id:'promote',label:'用作项目剧本'},{id:'templates',label:'节点模板'}];
 if(['actor','scene'].includes(node.type))return [edit,{id:'image',label:'生成参考图'},{id:'templates',label:'设定模板'}];
 if(node.type==='image'){
  if(node.src){
   const adoptable=node.imageResultContext&&(node.imageResultContext.kind==='asset'||(node.imageResultContext.assetIds||[]).length);
   const candidate=adoptable&&!imageOfficial?[
    ...(node.assetImageVersionId?[]:[{id:'asset-version',label:'加入资产版本',primary:!context}]),
    {id:'asset-official',label:'设为正式图'}
   ]:[];
   return [...(context?[{id:'edit',label:'图片与版本',primary:true}]:[]),...candidate,{id:'image',label:'按描述生成新图',primary:!context&&!candidate.length},{id:'video',label:'生成视频'},{id:'media',label:'预览原图'},{id:'download',label:'下载'}];
  }
  return [{id:'image',label:'生成图片',primary:true},{id:'import',label:'导入图片'},{id:'content',label:'编辑提示词'}];
 }
 if(node.type==='video'){
  if(!node.src)return [{id:'video',label:'生成视频',primary:true},{id:'import',label:'导入视频'},{id:'content',label:'编辑描述'}];
  const version=videoVersionGroup(project,node.id);
  return [...(version?[{id:'versions',label:'版本对比',primary:true}]:[]),{id:'video',label:version?'继续生成':'参考生成视频',primary:!version},{id:'frames',label:'截取帧'},{id:'trim',label:'视频修剪'},{id:'audio',label:'分离音频'},{id:'depth',label:'提取深度'},{id:'edit-media',label:'送入剪辑'},{id:'media',label:'预览视频',secondary:true},{id:'mute',label:'移除声音',secondary:true},{id:'compatibility',label:'生成兼容副本',secondary:true},{id:'download',label:'下载原视频',secondary:true}];
 }
 if(node.type==='audio')return node.src?[{id:'media',label:'试听音频',primary:true},{id:'video',label:'参考生成视频'},{id:'edit-media',label:'送入剪辑'},{id:'download',label:'下载'}]:[{id:'import',label:'导入音频',primary:true},{id:'content',label:'配音 / 音乐说明'}];
 if(node.type==='model')return [{id:'stage',label:'加入 / 查看导演台',primary:true},{id:'content',label:'编辑描述'}];
 if(node.type==='director')return [{id:'director',label:'进入导演台',primary:true}];
 return [edit];
}

// 常用操作直接可见，低频维护留在“更多”；不按固定按钮数量截断。
export function visibleNodeActions(project,node){return nodeQuickActions(project,node).filter(a=>!a.secondary);}
