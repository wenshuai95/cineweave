import test from 'node:test';
import assert from 'node:assert/strict';
import {shotChecklistHtml,shotChecklistHtmlFromItems} from '../src/shot-checklist-ui.mjs';

function shot(i,extra={}){
 return {id:'s'+i,index:i-1,scene:'场景'+i,description:'画面'+i,shotNodeId:'n'+i,assets:[{id:'a'+i,name:'资产'+i,official:i%2===0,versionId:i%2===0?'v'+i:null}],unresolvedAssetIds:[],videos:{total:i%3===0?0:1,generated:i%3===0?[]:['v'+i],previz:[],plain:[]},pending:i%4===0?[{reason:'正式图已更换',title:'视频'+i}]:[],inCut:{used:i%2===0,count:i%2===0?1:0},visualReady:i%3!==0,next:{action:i%3===0?'generate':'locate',label:i%3===0?'导出白模或生成视频':'查看镜头'},statuses:{assets:{tone:i%2===0?'ok':'warn',text:i%2===0?'正式图齐 · 1 项':'缺 1 张正式图'},visual:{tone:i%3===0?'warn':'ok',text:i%3===0?'缺白模 / 生成视频':'生成视频 1 个'},cut:{tone:i%2===0?'ok':'info',text:i%2===0?'已用于剪辑 · 1 段':'未加入剪辑'},review:{tone:i%4===0?'warn':'ok',text:i%4===0?'1 个视频参考待复核':'参考无需复核'}},missing:i%3===0?['缺白模或生成视频']:[],...extra};
}
test('all shots are rendered, never only the first eight groups',()=>{
 const items=Array.from({length:14},(_,i)=>shot(i+1)),html=shotChecklistHtmlFromItems(items);
 assert.equal((html.match(/data-shot-item=/g)||[]).length,14);
 assert.match(html,/14 镜/);
 assert.match(html,/data-shot-locate="s12"/);
});
test('empty state offers real next steps instead of fake completion',()=>{
 const html=shotChecklistHtmlFromItems([]);
 assert.match(html,/还没有分镜/);assert.match(html,/data-shot-empty="script"/);assert.match(html,/data-shot-empty="story"/);
 assert.doesNotMatch(html,/100%|完成率/);
});
test('status text and next action are present without relying on colour, and user text is escaped',()=>{
 const items=[shot(1,{scene:'<img onerror="alert(1)">',description:'<b>危险</b>',statuses:{assets:{tone:'warn',text:'缺 1 张正式图'},visual:{tone:'warn',text:'缺白模 / 生成视频'},cut:{tone:'neutral',text:'暂无视频可入剪辑'},review:{tone:'warn',text:'1 个视频参考待复核'}}})];
 const html=shotChecklistHtmlFromItems(items);
 assert.match(html,/&lt;img onerror/);assert.doesNotMatch(html,/<img onerror/);
 for(const text of ['资产','画面','剪辑','复核','缺 1 张正式图','缺白模 / 生成视频','暂无视频可入剪辑','1 个视频参考待复核','查看镜头'])assert.ok(html.includes(text),text);
});
test('the public helper reads the project story and preserves incomplete shots',()=>{
 const project={workstation:{story:{shots:[{id:'a',scene:'一',description:'',assetIds:[]}],assets:[]}} ,nodes:[],edges:[],boardGroups:[]};
 const html=shotChecklistHtml(project);assert.match(html,/data-shot-item="a"/);assert.match(html,/未关联资产/);assert.match(html,/整理到画布/);
});
