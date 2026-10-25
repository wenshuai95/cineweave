export function createProjectSaver(save,status=()=>{},delay=350,{retryDelay=2000,maxAutoRetries=1}={}){
 let revision=0,queued=0,snapshot,timer,retryTimer,autoRetries=0,chain=Promise.resolve(),pending=false,lastError=null;
 const schedule=()=>{clearTimeout(timer);if(pending&&delay!==null)timer=setTimeout(()=>flush().catch(()=>{}),delay);};
 const flush=async()=>{
  clearTimeout(timer);const rev=revision;
  if(queued<rev){const value=structuredClone(snapshot);queued=rev;status('saving');chain=chain.catch(()=>{}).then(()=>save(value));}
  try{await chain;if(rev===revision){pending=false;lastError=null;status('saved');}}
  catch(e){if(rev===revision){queued=0;pending=true;lastError=e;status('error',e);if(!retryTimer&&autoRetries<maxAutoRetries){autoRetries++;retryTimer=setTimeout(()=>{retryTimer=null;if(pending)flush().catch(()=>{});},retryDelay);retryTimer.unref?.();}}throw e;}
 };
 return {request(project){snapshot=structuredClone(project);revision++;pending=true;lastError=null;status('pending');schedule();},flush,lastError:()=>lastError,
 setDelay(value){if(value!==null&&(!Number.isFinite(value)||value<0))throw Error('无效保存间隔');delay=value;schedule();},
 get pending(){return pending;}};
}
