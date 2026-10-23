import test from 'node:test';
import assert from 'node:assert/strict';
import {renderNodeText,formatSelection} from '../src/canvas-content.mjs';
test('canvas Markdown remains inert even with imported HTML and URL-shaped text',()=>{
 const html=renderNodeText('# 场景\n**角色**\n<img src=x onerror=alert(1)>\n[点击](javascript:alert(1))');
 assert.match(html,/<h2>场景<\/h2>/);assert.match(html,/<strong>角色<\/strong>/);
 assert.ok(!html.includes('<img'));assert.ok(!html.includes('<a'));assert.ok(html.includes('&lt;img'));
});
test('formatting preserves surrounding script and selects only the changed content',()=>{
 const r=formatSelection('前文 人物对白 后文',3,7,'bold');assert.equal(r.value,'前文 **人物对白** 后文');assert.equal(r.value.slice(r.start,r.end),'人物对白');
 const lines=formatSelection('开头\n第一镜\n第二镜\n结尾',3,10,'list');assert.equal(lines.value,'开头\n- 第一镜\n- 第二镜\n结尾');
});
test('opening a composer focuses a tiny or distant node without changing scene content',async()=>{
 const {composerView}=await import('../src/canvas-content.mjs');const n={x:10000,y:-9000,w:300},before=JSON.stringify(n),view=composerView(n,{width:1080,height:549},.2);
 assert.equal(n.x*view.zoom+view.x+n.w*view.zoom/2,540);assert.equal(n.y*view.zoom+view.y,112);assert.equal(view.zoom,.65);assert.equal(JSON.stringify(n),before);
 assert.equal(renderNodeText(''),'');
});
