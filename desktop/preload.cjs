const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('directorDesktop',{
 writeCanvasClipboard(text){return ipcRenderer.invoke('director-copy-nodes',text);},
 saveProviderSecrets(secrets){return ipcRenderer.invoke('provider-secrets-save',secrets);},
 providerSecretsStatus(){return ipcRenderer.invoke('provider-secrets-status');},
 onSaveRequest(callback){ipcRenderer.on('director-save-request',async()=>{try{ipcRenderer.send('director-saved',await callback());}catch{ipcRenderer.send('director-saved',{ok:false,message:'保存失败，请先导出备份。'});}});},
 onCommand(callback){ipcRenderer.on('director-command',(_event,command)=>{if(['help','project','api','settings','save','undo','redo','select-all'].includes(command))callback(command);});}
});
