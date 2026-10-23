// Deterministic production checks: no model calls, and never rewrites creative choices.
export function reviewStoryPackage(candidate){
 const shots=candidate.shots||[],assets=candidate.assets||[],issues=[];
 const names=new Set(assets.filter(a=>a.kind==='character').map(a=>a.name.trim()));
 for(const name of new Set(shots.flatMap(s=>s.characters||[]).map(n=>n.trim()).filter(Boolean)))if(!names.has(name))issues.push({kind:'missing-character',message:`角色「${name}」未找到同名角色资产，请检查是否使用了别名。`});
 for(const scene of new Set(shots.map(s=>s.scene.trim()).filter(Boolean)))if(!assets.some(a=>a.kind==='scene'&&(a.name===scene||shots.some(s=>s.scene===scene&&a.shotIds?.includes(s.id)))))issues.push({kind:'missing-scene',message:`场景「${scene}」尚未关联场景资产。`});
 for(const a of assets)if(!a.shotIds?.length)issues.push({kind:'unlinked-asset',message:`资产「${a.name}」未关联分镜，请确认用途。`});
 const durationSec=shots.reduce((sum,s)=>sum+(Number.isFinite(s.duration)?s.duration:0),0);
 return {version:1,kind:'local-check',durationSec,shotCount:shots.length,assetCount:assets.length,issues:issues.slice(0,50),issueCount:issues.length};
}
