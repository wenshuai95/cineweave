import test from 'node:test';import assert from 'node:assert/strict';
import {defaultWorkstation,validateWorkstation,normalizeClip,placeClip,moveClip,trimClip,splitClip,removeClip,refpsSequence,freeIntervals,sequenceDuration,formatTimecode,SEQUENCE_FPS,MAX_CLIPS_PER_TRACK} from '../src/workstation/sequence.mjs';
import {demoProject,validateProject,clone} from '../src/model.mjs';

const clip=(over={})=>({id:'c'+Math.random().toString(36).slice(2,8),assetId:'a1',start:0,in:0,out:48,volume:1,muted:false,...over});

test('default workstation has empty script, assets, 24fps sequence and deliver settings',()=>{
 const ws=defaultWorkstation();
 assert.deepEqual(ws,{script:'',writing:{brief:'',skill:'general',messages:[]},story:{shots:[],assets:[],versions:[]},workflow:{},creativeTasks:[],directorAssistant:{messages:[],candidate:null},assets:[],sequence:{fps:24,video:[],audio:[],audioGain:1,audioMuted:false},deliver:{height:'720p',tasks:[]}});
 assert.equal(validateWorkstation(null).sequence.fps,24);
});

test('normalizeClip repairs volume and flags, and rejects impossible clips',()=>{
 assert.deepEqual(normalizeClip({id:'x',assetId:'a',start:10,in:5,out:9,volume:9,muted:1}),{id:'x',assetId:'a',start:10,in:5,out:9,volume:2,muted:false});
 assert.equal(normalizeClip({id:'x',assetId:'a',start:0,in:9,out:5}),null); // 出点必须大于入点
 assert.equal(normalizeClip({id:'x',assetId:'bad id!',start:0,in:0,out:5}),null);
 assert.equal(normalizeClip({assetId:'a',start:0,in:0,out:5}),null); // 缺 id
});

test('track normalization drops overlaps keeping the earlier clip and caps count',()=>{
 const raw=[clip({id:'a',start:0,out:48}),clip({id:'b',start:24,out:48}),clip({id:'c',start:48,out:96})];
 const ws=validateWorkstation({sequence:{fps:24,video:raw}});
 assert.deepEqual(ws.sequence.video.map(c=>c.id),['a','c']); // b 与 a 重叠被剔除，c 从 48 起不与 a 重叠
 const many=Array.from({length:MAX_CLIPS_PER_TRACK+10},(_,i)=>clip({id:'k'+i,start:i*48,out:48}));
 assert.equal(validateWorkstation({sequence:{video:many}}).sequence.video.length,MAX_CLIPS_PER_TRACK);
});

test('placeClip defers overlapping placements to the first gap that fits',()=>{
 let track=placeClip([],clip({id:'a',start:0,out:48}));
 track=placeClip(track,clip({id:'b',start:24,out:48})); // 期望落在 24，实际顺延到 48
 assert.equal(track.find(c=>c.id==='b').start,48);
 track=placeClip(track,clip({id:'c',start:10,out:24})); // 10..34 与 a 重叠 → 放到 96
 assert.equal(track.find(c=>c.id==='c').start,96);
});

test('moveClip snaps to the nearest free interval without overlapping neighbors',()=>{
 let track=placeClip([],clip({id:'a',start:0,out:48}));
 track=placeClip(track,clip({id:'b',start:96,out:48})); // [48,96) 空闲
 track=moveClip(track,'b',60); // 移出自身后 [48,∞) 可用，期望位置 60 合法
 assert.equal(track.find(c=>c.id==='b').start,60);
 track=moveClip(track,'b',10); // 期望 10 但被 a 占据 → 最近的空位是 96
 assert.equal(track.find(c=>c.id==='b').start,48);
});

test('trimClip clamps to neighbors and source length, moving in-point with start',()=>{
 let track=[clip({id:'a',start:0,out:48}),clip({id:'b',start:48,in:48,out:144})];
 // 拖 b 左缘向左 10 帧：受 a 末端钳制
 track=trimClip(track,'b','in',-10);
 const b=track.find(c=>c.id==='b');
 assert.equal(b.start,48);assert.equal(b.in,48);
 // 拖 b 右缘超出素材总长（素材 96 帧：in 48 + 48）→ 出点被钳制
 track=trimClip(track,'b','out',200,{maxOut:96});
 assert.equal(track.find(c=>c.id==='b').out,96);
 // a 右缘拉长 10 帧：无右邻时正常拉长；有右邻（b 从 48 起）时被钳回原位
 const single=[clip({id:'a',start:0,out:48})];
 assert.equal(trimClip(single,'a','out',10).find(c=>c.id==='a').out,58);
 track=trimClip(track,'a','out',10);
 assert.equal(track.find(c=>c.id==='a').out,48);
});

test('splitClip splits strictly inside and keeps source continuity',()=>{
 const track=[clip({id:'a',start:24,in:12,out:108})];
 const {track:next,created}=splitClip(track,'a',60);
 assert.equal(created.id!==undefined,true);
 const left=next.find(c=>c.out===48&&c.in===12);
 const right=next.find(c=>c.start===60);
 assert.deepEqual(next.map(c=>c.start).sort((x,y)=>x-y),[24,60]);
 assert.equal(right.in,48);assert.equal(right.out,108);
 assert.deepEqual(splitClip(track,'a',24),{track,created:null}); // 边界不拆
});

test('removeClip ripple closes the gap without jumping over earlier clips',()=>{
 let track=[clip({id:'a',start:0,out:24}),clip({id:'b',start:24,out:48}),clip({id:'c',start:96,out:48})];
 const plain=removeClip(track,'b');
 assert.deepEqual(plain.map(c=>c.start),[0,96]); // 不闭合
 const ripple=removeClip(track,'b',{ripple:true});
 assert.deepEqual(ripple.map(c=>c.start),[0,48]);
});

test('refpsSequence converts all integer frames preserving wall-clock time',()=>{
 const seq={fps:24,video:[clip({id:'a',start:0,in:0,out:48})],audio:[clip({id:'b',start:24,in:12,out:60})],audioGain:0.5,audioMuted:true};
 const out=refpsSequence(seq,30);
 assert.equal(out.fps,30);
 const a=out.video[0];
 assert.equal(a.start,0);assert.equal(a.in,0);assert.equal(a.out,60); // 2s 保持
 assert.equal(out.audioGain,0.5);assert.equal(out.audioMuted,true);
 assert.equal(refpsSequence(seq,24),seq); // 同帧率原样返回
});

test('freeIntervals walks the track and always ends with an open tail',()=>{
 const track=[clip({id:'a',start:0,out:24}),clip({id:'b',start:48,out:24})];
 assert.deepEqual(freeIntervals(track),[[24,48],[72,Infinity]]);
 assert.deepEqual(freeIntervals([]),[[0,Infinity]]);
});

test('sequenceDuration takes the longer of the two tracks and timecode formats frames',()=>{
 const ws=defaultWorkstation();
 ws.sequence.video=[clip({start:0,out:48})];
 ws.sequence.audio=[clip({start:0,out:72})];
 assert.equal(sequenceDuration(ws),72);
 assert.equal(formatTimecode(72,24),'00:03.00');
 assert.equal(formatTimecode(25,25),'00:01.00');
 assert.deepEqual(SEQUENCE_FPS,[24,25,30]);
});

test('validateWorkstation normalizes deliver settings and repairs corrupt fields',()=>{
 const fixed=validateWorkstation({script:'台本',assets:[{id:'m1',kind:'video',name:'镜头',mime:'video/mp4',size:99,durationSec:2.5,width:1920,height:1080,createdAt:1}],deliver:{height:'4k',tasks:[{id:'t1',status:'running',createdAt:1,height:'1080p',frames:-5,fps:99,message:'x'.repeat(500)}]}});
 assert.equal(fixed.script,'台本');
 assert.equal(fixed.assets.length,1);
 assert.equal(fixed.deliver.height,'720p');
 assert.equal(fixed.deliver.tasks[0].fps,24);
 assert.equal(fixed.deliver.tasks[0].frames,0);
 assert.equal(fixed.deliver.tasks[0].message.length<=200,true);
});

test('validateProject keeps workstation data through save/undo/copy cycles',()=>{
 const p=demoProject();
 p.workstation.script='雨后会面 第一稿';
 p.workstation.assets=[{id:'m1',kind:'video',name:'预演',mime:'video/mp4',size:1,durationSec:3,width:1280,height:720,createdAt:1}];
 p.workstation.sequence.video=[{id:'c1',assetId:'m1',start:0,in:0,out:72,volume:1,muted:false}];
 p.workstation.sequence.audioGain=0.8;
 const saved=validateProject(JSON.parse(JSON.stringify(p)));
 assert.equal(saved.workstation.script,'雨后会面 第一稿');
 assert.equal(saved.workstation.sequence.video.length,1);
 assert.equal(saved.workstation.sequence.audioGain,0.8);
 // 旧工程（无 workstation）导入后获得默认值，不抛错
 const legacy=demoProject();delete legacy.workstation;
 const migrated=validateProject(clone(legacy));
 assert.equal(migrated.workstation.script,'');
 assert.equal(migrated.workstation.sequence.fps,24);
 // 撤销/复制路径（structuredClone 往返）不丢数据
 const copy=structuredClone(saved);
 assert.equal(copy.workstation.assets[0].id,'m1');
});

test('trim cannot extend left before source zero; split survives normalization',()=>{
 const t=[clip({id:'a',start:48,in:0,out:48})];
 assert.equal(trimClip(t,'a','in',-100)[0].in,0);
 assert.equal(trimClip(t,'a','in',-100)[0].start,48);
 const split=splitClip(t,'a',72);
 assert.notEqual(split.track[0].id,split.track[1].id);
 assert.equal(validateWorkstation({sequence:{video:split.track}}).sequence.video.length,2);
});

test('fps conversion preserves adjacent clips even when rounding their source in points',()=>{
 const input={fps:30,video:[clip({id:'a',start:0,in:1,out:3}),clip({id:'b',start:2,in:0,out:2})],audio:[],audioGain:1,audioMuted:false};
 const converted=refpsSequence(input,24);
 assert.equal(converted.video.length,2);
 assert.ok(converted.video[1].start>=converted.video[0].start+converted.video[0].out-converted.video[0].in);
});
