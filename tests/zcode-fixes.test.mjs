import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createProjectSaver} from '../src/project-saver.mjs';

const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const desktop=readFileSync(new URL('../desktop/main.cjs',import.meta.url),'utf8');

test('P1-1 video generation card restores videoDraft prompt/model/duration', () => {
  assert.match(main,/const draft=source\?\.videoDraft/);
  assert.match(main,/mode==='video'&&typeof draft\?\.prompt==='string'&&draft\.prompt\.trim\(\)/);
  assert.match(main,/preferredProvider=mode==='video'&&draft\?\.providerId/);
  assert.match(main,/draft\.modelId&&available\.some/);
  assert.match(main,/q\('#genDuration'\)\.value=duration/);
  assert.match(main,/providerId,referenceOrder:videoRefs\.map/);
});

test('P2-3 IME composition Escape cannot close a modal', () => {
  assert.match(main,/document\.addEventListener\('keydown',e=>\{\n if\(e\.isComposing\|\|e\.keyCode===229\)return;/);
});

test('P2-4 already-in-canvas early return resets the consumed quote', () => {
  const already=[...main.matchAll(/if\(plan\.already\)\{([^}]*)\}/g)].map(match=>match[1]);
  assert.ok(already.length>=2);
  for(const branch of already)assert.match(branch,/resetQuote\(\)/);
});

test('P2-2 desktop window minimum width is 1024', () => {
  assert.match(desktop,/minWidth:1024,minHeight:720/);
  assert.doesNotMatch(desktop,/minWidth:1080/);
});

test('P3-1 failure badge is not auto-cleared after 8 seconds', () => {
  assert.doesNotMatch(main,/setTimeout\(\(\)=>\{if\(p\.nodes\.some\(n=>n\.id===sourceId&&n\.generationProgress\?\.status==='failed'\)setNodeGeneration\(sourceId,null\);\},8000\)/);
});

test('P2-1 project saver auto-retries only once, then requires a manual retry', async () => {
  let attempts=0;
  const states=[];
  const saver=createProjectSaver(async()=>{attempts++;throw Error('disk busy')},(state,error)=>states.push([state,error?.message]),null,{retryDelay:15,maxAutoRetries:1});
  saver.request({v:1});
  await assert.rejects(saver.flush(),/disk busy/);
  assert.equal(attempts,1);
  await new Promise(resolve=>setTimeout(resolve,80));
  assert.equal(attempts,2,'initial write + one automatic retry');
  assert.equal(saver.pending,true);
  assert.equal(saver.lastError()?.message,'disk busy');
  await assert.rejects(saver.flush(),/disk busy/);
  assert.equal(attempts,3,'user-triggered manual retry still works');
  assert.equal(saver.pending,true);
});
