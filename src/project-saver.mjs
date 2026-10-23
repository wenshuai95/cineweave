export function createProjectSaver(save,status=()=>{},delay=350){
 let revision=0,queued=0,snapshot,timer,chain=Promise.resolve(),pending=false;
 const schedule=()=>{clearTimeout(timer);if(pending&&delay!==null)timer=setTimeout(()=>flush().catch(()=>{}),delay);};
 const flush=async()=>{
  clearTimeout(timer);const rev=revision;
  if(queued<rev){const value=structuredClone(snapshot);queued=rev;status('saving');chain=chain.catch(()=>{}).then(()=>save(value));}
  try{await chain;if(rev===revision){pending=false;status('saved');}}
  catch(e){if(rev===revision){queued=0;pending=true;status('error');}throw e;}
 };
 return {request(project){snapshot=structuredClone(project);revision++;pending=true;status('pending');schedule();},flush,
 setDelay(value){if(value!==null&&(!Number.isFinite(value)||value<0))throw Error('无效保存间隔');delay=value;schedule();},
 get pending(){return pending;}};
}
