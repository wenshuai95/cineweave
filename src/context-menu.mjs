// Two-level menu shared by nodes, empty canvas and connections.
export function showContextMenu(root,{x,y,title,items}){
 root.replaceChildren();root.classList.remove('hidden');root.style.width='240px';
 const close=()=>root.classList.add('hidden');let openGroup=null;
 const heading=document.createElement('div');heading.className='context-title';heading.textContent=title;root.append(heading);
 const list=document.createElement('div');list.role='menu';root.append(list);
 const hideGroup=()=>{if(openGroup){openGroup.panel.hidden=true;openGroup.button.setAttribute('aria-expanded','false');openGroup=null;}};
 const buttons=container=>[...container.children].filter(n=>n.tagName==='BUTTON'&&!n.disabled);
 const focusMove=(button,dir)=>{const all=buttons(button.parentElement),i=all.indexOf(button);all[(i+dir+all.length)%all.length]?.focus();};
 for(const item of items){
  const button=document.createElement('button');button.role='menuitem';button.textContent=item.label+(item.children?'　›':'');button.disabled=!!item.disabled;if(item.hint)button.title=item.hint;list.append(button);
  if(item.children){
   const panel=document.createElement('div');panel.className='context-submenu';panel.role='menu';panel.setAttribute('aria-label',item.label);panel.hidden=true;root.append(panel);button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded','false');
   const open=()=>{if(openGroup?.button===button)return;hideGroup();panel.hidden=false;button.setAttribute('aria-expanded','true');openGroup={button,panel};const r=button.getBoundingClientRect(),rr=root.getBoundingClientRect(),pr=panel.getBoundingClientRect();panel.style.left=Math.max(6,rr.right+pr.width+5<innerWidth?rr.right-1:rr.left-pr.width+1)+'px';panel.style.top=Math.max(6,Math.min(r.top,innerHeight-pr.height-6))+'px';};
   button.onpointerenter=open;button.onclick=open;
   for(const child of item.children){const b=document.createElement('button');b.role='menuitem';b.textContent=child.label;b.disabled=!!child.disabled;if(child.hint)b.title=child.hint;panel.append(b);b.onclick=()=>{close();child.run?.();};b.onkeydown=e=>{if(['ArrowDown','ArrowUp','ArrowLeft','Escape'].includes(e.key)){e.preventDefault();e.stopPropagation();if(e.key==='ArrowLeft'||e.key==='Escape'){hideGroup();button.focus();}else focusMove(b,e.key==='ArrowDown'?1:-1);}};}
   button.onkeydown=e=>{if(e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();open();buttons(panel)[0]?.focus();}};
  }else{button.onpointerenter=hideGroup;button.onclick=()=>{close();item.run?.();};}
  button.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','Escape'].includes(e.key)){e.preventDefault();e.stopPropagation();if(e.key==='Escape')close();else focusMove(button,e.key==='ArrowDown'?1:-1);}});
 }
 root.style.left=Math.max(6,Math.min(x,innerWidth-root.offsetWidth-6))+'px';root.style.top=Math.max(6,Math.min(y,innerHeight-root.offsetHeight-6))+'px';
 buttons(list)[0]?.focus({preventScroll:true});
}
