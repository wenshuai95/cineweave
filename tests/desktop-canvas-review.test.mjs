import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
test('desktop preload forwards select-all and exposes a write-only canvas clipboard command',async()=>{
 let api;const listeners={},sent=[];
 const ipcRenderer={on:(k,f)=>listeners[k]=f,invoke:async(...args)=>{sent.push(args);return {ok:true}}};
 const c=vm.createContext({require:()=>({contextBridge:{exposeInMainWorld:(_name,value)=>api=value},ipcRenderer})});
 vm.runInContext(readFileSync(new URL('../desktop/preload.cjs',import.meta.url),'utf8'),c);
 const commands=[];api.onCommand(v=>commands.push(v));listeners['director-command']({},'select-all');listeners['director-command']({},'unknown');assert.deepEqual(commands,['select-all']);
 await api.writeCanvasClipboard('director-canvas-nodes:test');assert.deepEqual(sent,[['director-copy-nodes','director-canvas-nodes:test']]);assert.equal(api.readClipboard,undefined);
});
test('native canvas clipboard rejects foreign windows/frames, unmarked text and oversized payloads',()=>{
 const src=readFileSync(new URL('../desktop/main.cjs',import.meta.url),'utf8');const start=src.indexOf("ipcMain.handle('director-copy-nodes'");const end=src.indexOf("app.on('before-quit'",start);
 let handler;const writes=[],win={webContents:{}},BASE='http://127.0.0.1:41973';
 vm.runInNewContext(src.slice(start,end),{ipcMain:{handle:(_name,f)=>handler=f},win,BASE,clipboard:{writeText:text=>writes.push(text)}});
 const trusted={sender:win.webContents,senderFrame:{url:BASE+'/'}};
 const payload='director-canvas-nodes:{"app":"director-canvas"}';assert.equal(handler(trusted,payload).ok,true);
 for(const [event,text] of [[{sender:{},senderFrame:{url:BASE+'/'}},payload],[{sender:win.webContents,senderFrame:{url:'https://outside.example/'}},payload],[trusted,'普通文字'],[trusted,payload+'x'.repeat(16*1024*1024+256)]])assert.equal(handler(event,text).ok,false);
 assert.deepEqual(writes,[payload]);assert.equal(handler(trusted,'director-canvas-memory:session_1').ok,true);
});
