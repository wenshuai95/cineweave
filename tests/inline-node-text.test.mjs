import test from 'node:test';
import assert from 'node:assert/strict';
import {inlineNodeText,writeInlineNodeText} from '../src/inline-node-text.mjs';
const fixture=()=>({nodes:[{id:'plain',type:'text',text:'原文'},{id:'script',type:'text',text:'剧本',storyRef:{kind:'script',id:'main-script'}},{id:'shot',type:'text',text:'',storyRef:{kind:'shot',id:'s'}},{id:'asset',type:'text',text:'旧提示词',storyRef:{kind:'asset',id:'a'}},{id:'media',type:'video',text:'说明'}],edges:[{from:'plain',to:'media'}],objects:[{id:'actor',position:[1,2,3]}],workstation:{script:'剧本',story:{shots:[{id:'s',description:'画面',scene:'树林',duration:5,characters:['女修'],dialogue:'无',camera:'特写'}],assets:[{id:'a',name:'人物',prompt:'旧提示词',images:[{id:'v1',src:'image'}]}]}}});
test('inline editing writes plain and canonical script text without changing links or director objects',()=>{
 const p=fixture(),edges=structuredClone(p.edges),objects=structuredClone(p.objects);
 assert.equal(writeInlineNodeText(p,'plain','新原文'),true);assert.equal(p.nodes[0].text,'新原文');
 // Actual script reference id used by the canonical source is main-script.
 assert.equal(writeInlineNodeText(p,'script','新剧本'),true);assert.equal(p.workstation.script,'新剧本');
 assert.deepEqual(p.edges,edges);assert.deepEqual(p.objects,objects);
 assert.equal(writeInlineNodeText(p,'plain','新原文'),false);
});
test('shot description editing preserves structured fields and refreshes its summary',()=>{
 const p=fixture(),before=structuredClone(p.workstation.story.shots[0]);
 assert.equal(inlineNodeText(p,'shot').value,'画面');writeInlineNodeText(p,'shot','偷偷在背后结印');
 assert.deepEqual(p.workstation.story.shots[0],{...before,description:'偷偷在背后结印'});
 assert.match(p.nodes[2].text,/偷偷在背后结印/);assert.match(p.nodes[2].text,/女修/);
});
test('asset prompt editing preserves versions and enforces its size limit; non-text nodes stay untouched',()=>{
 const p=fixture(),images=structuredClone(p.workstation.story.assets[0].images);
 writeInlineNodeText(p,'asset','字'.repeat(7000));assert.equal(p.workstation.story.assets[0].prompt.length,6000);assert.deepEqual(p.workstation.story.assets[0].images,images);
 assert.equal(inlineNodeText(p,'media'),null);assert.equal(writeInlineNodeText(p,'media','错改'),false);
});
