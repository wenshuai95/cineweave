import test from 'node:test';import assert from 'node:assert/strict';
import {groupAwareSelection} from '../src/canvas-selection.mjs';
test('selecting a filtered shot card preserves all refs and versions for identical move/copy/delete scope',()=>{
 const p={nodes:[{id:'t',type:'text'},{id:'s',type:'video'},{id:'v',type:'video'},{id:'other',type:'text'}],boardGroups:[{id:'shot',shotBundle:true,shotSourceId:'s',memberIds:['t','s']},{id:'versions',videoVersions:true,sourceNodeId:'s',memberIds:['v']}]};
 const onlyVideo=n=>n.type==='video';assert.deepEqual(groupAwareSelection(p,['t','s','v'],onlyVideo),['t','s','v']);
 assert.deepEqual(groupAwareSelection(p,['s','other'],onlyVideo),['s']);assert.deepEqual(groupAwareSelection(p,['gone','s'],onlyVideo),['s']);
});
