import {validateProject,MAX_PROJECT_DURATION} from './model.mjs';
export function contentEnd(project){let end=0;for(const shot of project.shots)end=Math.max(end,shot.end);for(const o of project.objects){for(const k of o.keys)end=Math.max(end,k.t);for(const keys of Object.values(o.channels||{}))for(const k of keys)end=Math.max(end,k.t);for(const h of o.pathHandles||[])end=Math.max(end,h.t);for(const a of o.actions||[])end=Math.max(end,a.end);}return end;}
// Do not quantize individual keys: rounding could merge nearby keys and lose animation.
export function resizeProjectDuration(project,duration,scale=false){
 if(!Number.isFinite(duration)||duration<1||duration>MAX_PROJECT_DURATION)throw Error(`时长须为 1–${MAX_PROJECT_DURATION} 秒`);
 if(!scale&&contentEnd(project)>duration)throw Error('新结束时间内放不下已有内容，请选择“按比例缩放全部时间”');
 const next=structuredClone(project),ratio=duration/project.duration;
 if(scale){const at=t=>Math.min(duration,t*ratio);for(const o of next.objects){for(const k of o.keys)k.t=at(k.t);for(const keys of Object.values(o.channels||{}))for(const k of keys)k.t=at(k.t);for(const h of o.pathHandles||[])h.t=at(h.t);for(const a of o.actions||[]){a.start=at(a.start);a.end=at(a.end);}}for(const s of next.shots){s.start=at(s.start);s.end=at(s.end);}}
 next.duration=duration;return validateProject(next);
}
