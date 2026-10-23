import './project-manager.css';
import {uiIcon} from './canvas-content.mjs';
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createProjectManager({library,open,create,importFile,exportProject,withProjectLock,modal,closeModal,toast,help}){
 const host=document.createElement('section');host.id='projectManager';host.setAttribute('aria-label','项目管理');document.querySelector('#app').prepend(host);
 let rows=[],selected=null,view='grid',query='',sort='recent',trash=false,busy=false;
 const $=s=>host.querySelector(s),chosen=()=>rows.find(r=>r.id===selected);
 host.innerHTML=`<header class="pm-header"><div class="pm-brand"><span class="mark" aria-hidden="true">${uiIcon('weave')}</span><div><b>造梦工坊</b><small>CineWeave · 本地项目</small></div></div><span class="pm-local"><i></i> 本地项目库</span><button id="pmHelp" class="ghost">使用指南 ↗</button></header>
 <div class="pm-body"><aside class="pm-sidebar"><p>工作空间</p><button id="pmAll" class="active">▦　全部项目 <span></span></button><button id="pmTrash">♧　回收站 <span></span></button><div class="pm-storage"><span class="led"></span> 保存在这台电脑<br><small>每个项目独立保存。<br>重要作品请导出备份。</small></div></aside>
 <main class="pm-main"><div class="pm-title"><div><h1 id="pmHeading">项目</h1><p id="pmCount">正在读取本地项目…</p></div><button id="pmNewTop" class="primary">＋ 新建项目</button></div>
 <div class="pm-toolbar"><label class="pm-search">⌕ <input id="pmSearch" type="search" placeholder="搜索项目名称" aria-label="搜索项目名称"></label><select id="pmSort" aria-label="项目排序"><option value="recent">最近修改</option><option value="name">名称 A–Z</option><option value="created">最近创建</option></select><div class="pm-views"><button id="pmGrid" aria-label="缩略图视图" aria-pressed="true">▦</button><button id="pmList" aria-label="列表视图" aria-pressed="false">☰</button></div></div>
 <p id="pmError" role="alert" hidden></p><div id="pmProjects" class="pm-projects" aria-label="项目列表"></div></main></div>
 <footer class="pm-footer"><div><button id="pmImport">↑ 导入项目</button><button id="pmExport" disabled>↓ 导出项目</button></div><span id="pmSelection">单击选中 · 双击打开</span><div><button id="pmRename" disabled>重命名</button><button id="pmCopy" disabled>复制</button><button id="pmArchive" disabled>移入回收站</button><button id="pmOpen" class="primary" disabled>打开项目 ↗</button></div></footer>`;
 const date=t=>new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(t);
 const notifyError=e=>{const d=$('#pmError');d.hidden=false;d.textContent=e.message||'项目操作失败，请重试';toast(d.textContent)};
 const run=async fn=>{if(busy)return;busy=true;host.setAttribute('aria-busy','true');actions();try{await fn();$('#pmError').hidden=true}catch(e){notifyError(e)}finally{busy=false;host.removeAttribute('aria-busy');actions()}};
 function actions(){const row=chosen();for(const id of ['pmExport','pmRename','pmCopy','pmArchive','pmOpen'])$('#'+id).disabled=busy||!row||((id==='pmOpen'||id==='pmRename'||id==='pmCopy')&&trash);$('#pmNewTop').disabled=busy||trash;$('#pmImport').disabled=busy;$('#pmArchive').textContent=trash?'恢复项目':'移入回收站';$('#pmSelection').textContent=row?row.name:'单击选中 · 双击打开';host.querySelectorAll('[data-project]').forEach(b=>{b.classList.toggle('selected',b.dataset.project===selected);b.setAttribute('aria-pressed',String(b.dataset.project===selected))});}
 function draw(){
  let list=rows.filter(r=>!!r.archived===trash&&r.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));list.sort(sort==='name'?(a,b)=>a.name.localeCompare(b.name,'zh-CN'):(a,b)=>(sort==='created'?b.createdAt-a.createdAt:b.updatedAt-a.updatedAt));
  if(!list.some(r=>r.id===selected))selected=null;
  $('#pmHeading').textContent=trash?'回收站':'项目';$('#pmCount').textContent=`${list.length} 个项目${query?' · 搜索结果':trash?' · 可随时恢复':' · 从这里继续你的创作'}`;
  $('#pmAll span').textContent=rows.filter(r=>!r.archived).length;$('#pmTrash span').textContent=rows.filter(r=>r.archived).length;$('#pmAll').classList.toggle('active',!trash);$('#pmTrash').classList.toggle('active',trash);
  const grid=$('#pmProjects');grid.className='pm-projects '+(view==='list'?'pm-list':'');
  grid.innerHTML=(!trash&&!query?'<button class="pm-card pm-new" id="pmNewCard"><div class="pm-cover"><span>＋</span></div><div class="pm-card-info"><b>新建项目</b><small>空白画布，开始新的故事</small></div></button>':'')+list.map(r=>`<button class="pm-card" data-project="${escape(r.id)}" aria-label="项目：${escape(r.name)}" aria-pressed="false"><div class="pm-cover">${r.cover&&/^data:image\/(jpeg|png|webp);base64,/.test(r.cover)?`<img src="${escape(r.cover)}" alt="" loading="lazy">`:`<div class="pm-placeholder"><span aria-hidden="true">${uiIcon('weave')}</span><i>CineWeave</i><small>${r.shots} 个镜头 / ${r.objects} 个对象</small></div>`}<em>${r.duration}s</em></div><div class="pm-card-info"><b>${escape(r.name)}</b><small>${r.nodes} 个资产 · ${r.shots} 个镜头</small><time>修改于 ${date(r.updatedAt)}</time></div><span class="pm-card-arrow">↗</span></button>`).join('')+(!list.length&&(trash||query)?`<div class="pm-empty"><span>${trash?'♧':'⌕'}</span><h2>${trash?'回收站为空':'没有找到项目'}</h2><p>${trash?'移入回收站的项目会保留素材，可随时恢复。':'试试其他名称，或清空搜索。'}</p></div>`:'');
  $('#pmNewCard')?.addEventListener('click',newProject);
  grid.querySelectorAll('[data-project]').forEach(b=>{b.onclick=()=>{selected=b.dataset.project;actions()};b.ondblclick=()=>{selected=b.dataset.project;if(!trash)run(()=>open(selected))};b.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();selected=b.dataset.project;if(!trash)run(()=>open(selected));}if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const all=[...grid.querySelectorAll('[data-project]')],i=all.indexOf(b),next=all[(i+(e.key==='ArrowRight'?1:-1)+all.length)%all.length];selected=next.dataset.project;actions();next.focus()}};});actions();
 }
 async function refresh(){rows=await library.list();draw()}
 function nameDialog(title,value,confirm,callback,extra=''){
  modal(title,'项目独立保存，可以随时回到项目管理继续其他作品。',`<label class="field">项目名称<input id="pmNameInput" maxlength="200" value="${escape(value)}" placeholder="给你的故事起个名字"></label>${extra}` ,`<button id="pmCancel">取消</button><button class="primary" id="pmConfirm">${confirm}</button>`);
  const input=document.querySelector('#pmNameInput'),button=document.querySelector('#pmConfirm');input.focus();input.select();document.querySelector('#pmCancel').onclick=closeModal;
  const submit=async()=>{if(button.disabled)return;const name=input.value.trim();if(!name)return toast('请输入项目名称');button.disabled=true;try{await callback(name);closeModal()}catch(e){toast(e.message)}finally{button.disabled=false}};button.onclick=submit;input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();submit()}};
 }
 function newProject(){if(busy||trash)return;nameDialog('新建项目','未命名项目','创建并打开',async name=>{const type=document.querySelector('#pmTemplate').value;await create(name,type);await refresh()},'<label class="field">起点<select id="pmTemplate"><option value="blank">空白项目 · 一个基础机位</option><option value="demo">示例项目 · 雨后会面</option></select></label>')}
 $('#pmNewTop').onclick=newProject;$('#pmHelp').onclick=help;$('#pmImport').onclick=importFile;
 $('#pmOpen').onclick=()=>run(()=>open(selected));$('#pmExport').onclick=()=>run(async()=>exportProject(await library.read(selected)));
 $('#pmRename').onclick=()=>{const row=chosen();if(row)nameDialog('重命名项目',row.name,'保存名称',async name=>{await withProjectLock(row.id,()=>library.rename(row.id,name));await refresh()})};
 $('#pmCopy').onclick=()=>{const row=chosen();if(row)nameDialog('复制项目',row.name+' 副本','创建副本',async name=>{const p=await library.read(row.id);p.name=name;const copy=await library.add(p,{forceCopy:true});if(row.cover)await library.cover(copy.id,row.cover);selected=copy.id;query='';$('#pmSearch').value='';await refresh();toast('已创建独立副本')})};
 $('#pmArchive').onclick=()=>run(async()=>{await withProjectLock(selected,()=>library.archive(selected,!trash));selected=null;await refresh();toast(trash?'项目已恢复到全部项目':'项目已移入回收站，可随时恢复')});
 $('#pmSearch').oninput=e=>{query=e.target.value;draw()};$('#pmSort').onchange=e=>{sort=e.target.value;draw()};
 $('#pmGrid').onclick=()=>{view='grid';$('#pmGrid').setAttribute('aria-pressed','true');$('#pmList').setAttribute('aria-pressed','false');draw()};$('#pmList').onclick=()=>{view='list';$('#pmGrid').setAttribute('aria-pressed','false');$('#pmList').setAttribute('aria-pressed','true');draw()};
 for(const [id,value] of [['pmAll',false],['pmTrash',true]])$('#'+id).onclick=()=>{trash=value;selected=null;draw()};
 host.addEventListener('keydown',e=>{e.stopPropagation();if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='f'){e.preventDefault();$('#pmSearch').focus()}});
 return {async show(id){host.hidden=false;selected=id||null;query='';trash=false;$('#pmSearch').value='';await refresh();$('#pmSearch').focus()},hide(){host.hidden=true},refresh,select:async id=>{selected=id;query='';trash=false;$('#pmSearch').value='';await refresh()},error:notifyError};
}
