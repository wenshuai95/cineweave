import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createProjectSaver} from '../src/project-saver.mjs';
import {demoProject,validateProject} from '../src/model.mjs';

const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const shell=readFileSync(new URL('../src/workstation/shell.mjs',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/canvas-simple.css',import.meta.url),'utf8');

test('there is only one workspace/stage navigation entry', () => {
  assert.match(main,/id="workspaceSwitch"/);
  assert.match(main,/function selectWorkspace\(kind\)/);
  assert.match(main,/function updateWorkspaceSwitch\(\)/);
  assert.match(main,/STAGE_ITEMS/);
  assert.doesNotMatch(main,/id="boardTab"/);
  assert.doesNotMatch(main,/id="stageTab"/);
  assert.doesNotMatch(main,/id="stageBreadcrumb"/);
  assert.doesNotMatch(shell,/className='ws-bottomnav'/);
  assert.doesNotMatch(shell,/app\.insertBefore\(nav,footer\)/);
  assert.match(shell,/ctx\.onPageChanged/);
  assert.match(css,/\.topbar \.workspace-switch/);
});

test('save status shows the real error and the status button retries', () => {
  assert.match(main,/function saveStatus\(state,error=null\)/);
  assert.match(main,/saveFailure=error\|\|Error/);
  assert.match(main,/保存失败\$\{reason\}/);
  assert.match(main,/\$\('#saveStatus'\)\.onclick=\(\)=>saveFailure\?saveNow\(\):projectModal\(\)/);
  assert.match(main,/catch\(e\)\{toast\('保存失败'/);
});

test('project saver reports the error, stays pending and can be retried', async () => {
  const states=[];
  let attempts=0;
  const saver=createProjectSaver(async()=>{attempts++;if(attempts===1)throw Error('QuotaExceededError')},(state,error)=>states.push([state,error?.message]),10000);
  saver.request({v:1});
  await assert.rejects(saver.flush(),/QuotaExceededError/);
  assert.equal(saver.pending,true);
  assert.equal(saver.lastError()?.message,'QuotaExceededError');
  assert.ok(states.some(([state,message])=>state==='error'&&message==='QuotaExceededError'));
  await saver.flush();
  assert.equal(saver.pending,false);
  assert.equal(saver.lastError(),null);
  assert.equal(states.at(-1)[0],'saved');
});

test('project validation accepts common browser media types that previously blocked saves', () => {
  const project=structuredClone(demoProject());
  const node=project.nodes.find(item=>item.type==='image')||project.nodes[0];
  node.src='data:image/avif;base64,AAAA';
  assert.doesNotThrow(()=>validateProject(project));
  node.src='data:video/quicktime;base64,AAAA';
  assert.doesNotThrow(()=>validateProject(project));
  node.src='data:audio/aac;base64,AAAA';
  assert.doesNotThrow(()=>validateProject(project));
  node.src='data:application/zip;base64,AAAA';
  assert.throws(()=>validateProject(project),/仅支持内嵌图片/);
});
