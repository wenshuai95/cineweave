import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {starterProject} from '../src/model.mjs';
import {cutLibraryRows} from '../src/workstation/cut-library.mjs';
import {snapFrame} from '../src/workstation/sequence.mjs';
import {classifyImportFile} from '../src/workstation/media-import.mjs';

const edit=readFileSync(new URL('../src/workstation/edit-page.mjs',import.meta.url),'utf8');

test('cut library can include imported images for preview without breaking default A/V rows',()=>{
 const p=starterProject();p.nodes=[];p.edges=[];
 p.workstation.assets=[
  {id:'v1',kind:'video',name:'镜头.mp4',mime:'video/mp4',size:10,durationSec:2,createdAt:1},
  {id:'i1',kind:'image',name:'参考.png',mime:'image/png',size:5,createdAt:2},
 ];
 assert.equal(cutLibraryRows(p).length,1);
 const rows=cutLibraryRows(p,{includeImages:true});
 assert.equal(rows.length,2);
 assert.equal(rows.find(row=>row.kind==='image').name,'参考.png');
 assert.equal(cutLibraryRows(p,{includeImages:true,filter:'image'}).length,1);
});

test('image files are accepted by the shared media importer classifier',()=>{
 for(const name of ['a.png','b.jpg','c.webp','d.gif'])assert.equal(classifyImportFile({name,size:5}).kind,'image');
 assert.equal(classifyImportFile({name:'e.mp4',size:5}).kind,'video');
 assert.equal(classifyImportFile({name:'f.zip',size:5}).ok,false);
});

test('sequence snapping picks nearby edges only inside the threshold',()=>{
 assert.equal(snapFrame(37,[0,40],5),40);
 assert.equal(snapFrame(33,[40],2),33);
 assert.equal(snapFrame(2,[0,10],3),0);
});

test('edit page exposes B1 shortcuts, snapping, image library, thumbnails, delete and recovery',()=>{
 for(const code of ["case 'KeyJ'","case 'KeyK'","case 'KeyL'","case 'KeyI'","case 'KeyO'","case 'KeyK'"])assert.match(edit,new RegExp(code));
 assert.match(edit,/e\.code==='KeyK'/);
 assert.match(edit,/snapFrame\(/);
 assert.match(edit,/snapCandidates/);
 assert.match(edit,/includeImages:true/);
 assert.match(edit,/data-bin-thumb/);
 assert.match(edit,/hydrateThumbs/);
 assert.match(edit,/data-remove-material/);
 assert.match(edit,/recoverMaterial/);
 assert.match(edit,/ondblclick/);
 assert.match(edit,/startPlay\(-1\)/);
 assert.match(edit,/markInPoint|markOutPoint/);
});
