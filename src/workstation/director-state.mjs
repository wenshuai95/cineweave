// Small, bounded persisted conversation; no model assets, keys or screenshots.
export function normalizeDirectorAssistant(raw){
 const messages=(Array.isArray(raw?.messages)?raw.messages:[]).filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-24).map(m=>({role:m.role,content:m.content.slice(0,6000)}));
 const c=raw?.candidate;
 let candidate=null;
 if(c&&typeof c.signature==='string'&&c.signature.length<=80&&typeof c.projectId==='string'&&c.plan&&Array.isArray(c.plan.operations)&&c.plan.operations.length<=24&&JSON.stringify(c).length<=64000)candidate={projectId:c.projectId,signature:c.signature,plan:structuredClone(c.plan),changes:(Array.isArray(c.changes)?c.changes:[]).filter(t=>typeof t==='string').slice(0,24).map(t=>t.slice(0,600)),...(typeof c.request==='string'?{request:c.request.slice(0,6000)}:{})};
 return {messages,candidate};
}
