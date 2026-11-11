import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// Node has no CSS loader. Ignore the stylesheet while importing the actual page
// module; relative JavaScript dependencies still resolve to their real files.
const sourceUrl=new URL('../src/workstation/script-page.mjs',import.meta.url);
const source=(await readFile(sourceUrl,'utf8')).replace("import './script-ui.css';",'').replace(/from '(\.\/[^']+)'/g,(_,path)=>`from '${new URL(path,sourceUrl).href}'`);
const {shouldSendWritingKey}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('writing composer sends Enter and platform command Enter',()=>{
 for(const event of [{key:'Enter'},{key:'Enter',metaKey:true},{key:'Enter',ctrlKey:true}])assert.equal(shouldSendWritingKey(event),true);
});
test('writing composer keeps newlines and IME confirmation inside the draft',()=>{
 for(const event of [{key:'Enter',shiftKey:true},{key:'Enter',metaKey:true,shiftKey:true},{key:'Enter',isComposing:true},{key:'Enter',keyCode:229},{key:'Process',keyCode:229},{key:'a'},{key:'Escape'}])assert.equal(shouldSendWritingKey(event),false);
});
