import {normalizeStory,snapshotStory} from './story.mjs';
import {recordWorkflowStep} from './workflow.mjs';
// Merge designs by kind/name without deleting manually authored assets or canvas links.
export function applyAssetDesigns(ws,assets,{snapshot=true}={}){
 const incoming=normalizeStory({assets}).assets;
 if(!incoming.length||incoming.some(a=>!a.prompt.trim()))throw Error('资产提示词为空，请重新设计');
 const key=a=>a.kind+'\0'+a.name.trim();
 if(new Set(incoming.map(key)).size!==incoming.length)throw Error('资产名称重复，请重新设计');
 const added=incoming.filter(a=>!ws.story.assets.some(o=>key(o)===key(a)));
 if(ws.story.assets.length+added.length>300)throw Error('资产数量超过 300 个，请减少本次设计');
 if(snapshot)snapshotStory(ws,'采用资产设计前');
 for(const a of incoming){const match=ws.story.assets.find(o=>key(o)===key(a));if(match)Object.assign(match,{description:a.description,prompt:a.prompt,negativePrompt:a.negativePrompt,shotIds:a.shotIds});else ws.story.assets.push(a);}
 const updated=new Set(ws.story.assets.filter(a=>incoming.some(x=>key(x)===key(a))).map(a=>a.id));
 for(const shot of ws.story.shots)shot.assetIds=[...new Set([...shot.assetIds.filter(id=>!updated.has(id)),...ws.story.assets.filter(a=>updated.has(a.id)&&a.shotIds.includes(shot.id)).map(a=>a.id)])];
 recordWorkflowStep(ws,'assets');
 return incoming.length;
}
