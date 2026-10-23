import test from 'node:test';
import assert from 'node:assert/strict';
import {shotBundleCard} from '../src/shot-bundles-ui.mjs';
test('shot card previews adopted result and exposes every related action without showing hidden node content as HTML',()=>{
 const p={nodes:[{id:'s',type:'video',title:'入口',text:'<img onerror="alert(1)">'},{id:'v1',type:'video',src:'data:video/mp4;base64,AAAA'},{id:'v2',type:'video',src:'data:video/mp4;base64,BBBB'}],boardGroups:[{id:'shot',memberIds:['s'],shotBundle:true,shotSourceId:'s'},{id:'versions',memberIds:['v1','v2'],videoVersions:true,sourceNodeId:'s',adoptedNodeId:'v1'}],workstation:{sequence:{video:[]}}};
 const html=shotBundleCard(p,p.boardGroups[0]);assert.match(html,/base64,AAAA/);assert.doesNotMatch(html,/base64,BBBB/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img onerror/);
 for(const action of ['data-shot-generate="s"','data-group-list="shot"','data-video-versions="versions"','data-group-toggle="shot"'])assert.ok(html.includes(action));
});
