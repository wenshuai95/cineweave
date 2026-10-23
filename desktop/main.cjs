const {app,BrowserWindow,Menu,dialog,shell,ipcMain,clipboard}=require('electron');
const {spawn}=require('node:child_process');
const {join}=require('node:path');
const {mkdirSync}=require('node:fs');
const {randomUUID}=require('node:crypto');
const isMac=process.platform==='darwin';
// v1.3.0 独立应用身份：与原「超级无敌导演画布」并存，不共用端口与数据目录。
const APP_NAME='造梦工坊',PORT=process.env.DIRECTOR_CANVAS_TEST_PORT?Number(process.env.DIRECTOR_CANVAS_TEST_PORT):41974,BASE=`http://127.0.0.1:${PORT}`;
app.setName(APP_NAME);
// Stable identity keeps projects across app upgrades. A separate path permits isolated QA.
app.setPath('userData',process.env.DIRECTOR_CANVAS_TEST_DATA||join(app.getPath('appData'),'AIWorkstation'));
app.setAppUserModelId('cn.aivideoworkstation.desktop');
const single=app.requestSingleInstanceLock();if(!single){app.quit();}
let win,worker,quitting=false,savePending=false,timeout,nonce=randomUUID();
const show=()=>{if(win){win.show();if(win.isMinimized())win.restore();win.focus();}};
app.on('second-instance',show);app.on('activate',show);
async function startServer(){
 const data=join(app.getPath('userData'),'generated');mkdirSync(data,{recursive:true});
 const env={...process.env,ELECTRON_RUN_AS_NODE:'1',PORT:String(PORT),JINGCHANG_DATA_DIR:data,DIRECTOR_CANVAS_INSTANCE:nonce};
 // Windows keeps the user's own PATH/Path untouched (no duplicate case-variant key); the worker
 // resolves binaries via absolute paths. macOS prepends Homebrew for the CLI toolchain.
 if(process.platform!=='win32')env.PATH=`/opt/homebrew/bin:/usr/local/bin:${process.env.PATH||'/usr/bin:/bin'}`;
 worker=spawn(process.execPath,[join(__dirname,'service','server.mjs')],{env,stdio:['ignore','ignore','pipe'],windowsHide:true});
 let reason='';worker.stderr.on('data',chunk=>{reason=(reason+chunk.toString()).slice(-1200);});
 let failed=false;worker.on('error',()=>{failed=true;});worker.on('exit',()=>{failed=true;if(win&&!quitting){dialog.showErrorBox('本地服务已停止','请先导出当前工程备份，再退出并重新打开软件。');}});
 for(let i=0;i<100;i++){
  if(failed)throw Error(reason.includes('端口')?'本地端口 41974 已被占用。请关闭另一份应用后再打开。':'内置服务启动失败，请重新安装应用。');
  try{const response=await fetch(BASE+'/api/health',{signal:AbortSignal.timeout(600)});const health=await response.json();if(health.instance===nonce)return;if(health)throw Error('PORT_CONFLICT');}catch(e){if(e.message==='PORT_CONFLICT')throw Error('本地端口 41974 已被其他程序占用，请关闭占用程序后重试。');}
  await new Promise(r=>setTimeout(r,100));
 }
 throw Error('本地服务启动超时，请重新打开应用。');
}
function menuCommand(command){show();win?.webContents.send('director-command',command);}
function requestQuit(){
 if(quitting||savePending)return;if(!win){quitting=true;app.quit();return;}
 savePending=true;show();win.webContents.send('director-save-request');
 timeout=setTimeout(()=>{savePending=false;dialog.showMessageBox(win,{type:'warning',message:'暂未收到保存完成结果',detail:'请回到工程确认保存状态。重要工程可先导出 JSON 备份。',buttons:['返回工程']});},10000);
}
function migrateDialog(){dialog.showMessageBox(win,{message:'从网页版迁移',detail:'在原网页版点击「工程 → 导出工程」，然后在此应用点击「项目管理 → 导入项目」选择 JSON。桌面版与浏览器分别保存数据，API Key 需重新填写。',buttons:['知道了']});}
ipcMain.on('director-saved',(event,result)=>{
 if(!win||event.sender!==win.webContents||event.senderFrame?.url!==BASE+'/'||!savePending)return;
 clearTimeout(timeout);savePending=false;
 if(result?.ok){quitting=true;app.quit();}else dialog.showMessageBox(win,{type:'warning',message:'暂时无法退出',detail:String(result?.message||'工程保存失败，请先导出备份。').slice(0,500),buttons:['返回工程']});
});
// Only accept the application's own canvas clipboard packet from this trusted window.
ipcMain.handle('director-copy-nodes',(event,text)=>{
 if(!win||event.sender!==win.webContents||event.senderFrame?.url!==BASE+'/')return {ok:false};
 if(typeof text!=='string'||text.length>16*1024*1024+256||!text.startsWith('director-canvas-nodes:')&&!/^director-canvas-memory:[a-zA-Z0-9_-]{1,100}$/.test(text))return {ok:false};
 clipboard.writeText(text);return {ok:true};
});
app.on('before-quit',event=>{if(!quitting){event.preventDefault();requestQuit();}});
app.on('will-quit',()=>{worker?.kill();});
app.on('window-all-closed',()=>{});
if(single)app.whenReady().then(async()=>{
 try{
  await startServer();
  win=new BrowserWindow({width:1440,height:940,minWidth:1080,minHeight:720,title:APP_NAME,backgroundColor:'#141619',show:false,webPreferences:{preload:join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,backgroundThrottling:false}});
  const openLink=url=>{try{if(new URL(url).protocol==='https:')shell.openExternal(url);}catch{}};
  win.webContents.setWindowOpenHandler(({url})=>{openLink(url);return {action:'deny'};});
  win.webContents.on('will-navigate',(event,url)=>{if(url!==BASE+'/'){event.preventDefault();openLink(url);}});
  win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  win.webContents.session.on('will-download',(_event,item)=>{item.setSaveDialogOptions({title:'保存导出文件',buttonLabel:'保存'});});
  // macOS keeps the tray-like hide/dwell behavior; on Windows X / Alt+F4 runs the save-then-quit flow.
  win.on('close',event=>{if(!quitting){event.preventDefault();isMac?win.hide():requestQuit();}});
  win.once('ready-to-show',show);
  // Save / undo / redo shortcuts are owned by the renderer (Ctrl+S/Z/Shift+Z) so the menu
  // omits those accelerators on Windows to avoid double handling; Ctrl+O and Ctrl+, stay here.
  Menu.setApplicationMenu(Menu.buildFromTemplate(isMac?[
   {label:APP_NAME,submenu:[{role:'about',label:'关于'+APP_NAME},{type:'separator'},{label:'设置…',accelerator:'CmdOrCtrl+,',click:()=>menuCommand('settings')},{type:'separator'},{role:'hide',label:'隐藏窗口'},{role:'hideOthers',label:'隐藏其他应用'},{role:'unhide',label:'显示全部'},{type:'separator'},{label:'退出'+APP_NAME,accelerator:'CmdOrCtrl+Q',click:requestQuit}]},
   {label:'文件',submenu:[{label:'项目管理…',accelerator:'CmdOrCtrl+O',click:()=>menuCommand('project')},{label:'保存工程',accelerator:'CmdOrCtrl+S',click:()=>menuCommand('save')},{type:'separator'},{role:'close',label:'关闭窗口'}]},
   {label:'编辑',submenu:[{label:'撤销',accelerator:'CmdOrCtrl+Z',click:()=>menuCommand('undo')},{label:'重做',accelerator:'CmdOrCtrl+Shift+Z',click:()=>menuCommand('redo')},{type:'separator'},{role:'cut',label:'剪切'},{role:'copy',label:'复制'},{role:'paste',label:'粘贴'},{label:'全选',accelerator:'CmdOrCtrl+A',click:()=>menuCommand('select-all')}]},
   {label:'窗口',submenu:[{role:'minimize',label:'最小化'},{role:'togglefullscreen',label:'全屏'},{label:'显示主窗口',click:show}]},
   {label:'帮助',submenu:[{label:'使用指南与快捷键',click:()=>menuCommand('help')},{label:'从网页版迁移工程',click:migrateDialog}]}
  ]:[
   {label:'文件',submenu:[{label:'项目管理…',accelerator:'CmdOrCtrl+O',click:()=>menuCommand('project')},{label:'保存工程',click:()=>menuCommand('save')},{type:'separator'},{label:'设置…',accelerator:'CmdOrCtrl+,',click:()=>menuCommand('settings')},{type:'separator'},{label:'退出'+APP_NAME,accelerator:'CmdOrCtrl+Q',click:requestQuit}]},
   {label:'编辑',submenu:[{label:'撤销',click:()=>menuCommand('undo')},{label:'重做',click:()=>menuCommand('redo')},{type:'separator'},{role:'cut',label:'剪切'},{role:'copy',label:'复制'},{role:'paste',label:'粘贴'},{role:'selectAll',label:'全选'}]},
   {label:'窗口',submenu:[{role:'minimize',label:'最小化'},{role:'togglefullscreen',label:'全屏'},{label:'显示主窗口',click:show}]},
   {label:'帮助',submenu:[{role:'about',label:'关于'+APP_NAME},{label:'使用指南与快捷键',click:()=>menuCommand('help')},{label:'从网页版迁移工程',click:migrateDialog}]}
  ]));
  app.setAboutPanelOptions({applicationName:APP_NAME,applicationVersion:app.getVersion(),copyright:'本地创作 · 剧本 / 资产 / 画布 / 剪辑 / 交付',credits:'Three.js · Electron · 资产许可见安装包说明'});
  await win.loadURL(BASE+'/');
 }catch(e){dialog.showErrorBox('无法启动'+APP_NAME,e.message);quitting=true;app.quit();}
});
