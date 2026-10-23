const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={
 close:'<path d="m6 6 12 12M18 6 6 18"/>',
 frames:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 5v4m5-4v4m5-4v4M3 15h18m-14 0v4m5-4v4m5-4v4"/>',
 trim:'<circle cx="5" cy="6" r="3"/><circle cx="5" cy="18" r="3"/><path d="m8 8 13 12M8 16 21 3"/>',
 depth:'<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
 mute:'<path d="M11 4 6 8H3v8h3l5 4zM16 9l6 6m0-6-6 6"/>',
 compatibility:'<path d="M20 7v5h-5M4 17v-5h5M6 6a7 7 0 0 1 12 1l2 5M4 12l2 5a7 7 0 0 0 12 1"/>',
 select:'<path d="m5 3 14 9-7 1-3 7z"/>',
 hand:'<path d="M8 13V5a2 2 0 0 1 4 0v7-9a2 2 0 0 1 4 0v9-6a2 2 0 0 1 4 0v9c0 5-3 7-7 7-3 0-5-2-7-5l-3-4a2 2 0 0 1 3-3l2 3"/>',
 undo:'<path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14"/>',
 redo:'<path d="m16 4 5 5-5 5m5-5H11a7 7 0 0 0 0 14"/>',
 weave:'<rect x="3" y="3" width="12" height="12" rx="3"/><rect x="9" y="9" width="12" height="12" rx="3"/>',
 image:'<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1"/><path d="m3 16 5-5 4 4 3-3 6 6"/>',
 video:'<rect x="3" y="4" width="18" height="16" rx="4"/><path d="m10 8 6 4-6 4z"/>',
 audio:'<path d="M4 10v4m4-9v14m4-11v8m4-13v18m4-12v6"/>',
 text:'<path d="M5 5h14M12 5v15M8 20h8"/>',
 library:'<path d="M3 8V5a2 2 0 0 1 2-2h5l3 3h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
 spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
 plus:'<path d="M12 4v16M4 12h16"/>',upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 14v6h16v-6"/>',
 download:'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 model:'<path d="m12 2 9 5v10l-9 5-9-5V7zm0 10 9-5M12 12 3 7m9 5v10"/>',
 edit:'<path d="m4 16 12-12 4 4L8 20H4zm10-10 4 4"/>',
};
export function uiIcon(name){const key=({content:'edit',media:'image',assistant:'spark',storyboard:'video',assets:'library',promote:'text','edit-media':'video',director:'video',actor:'model',scene:'model',versions:'library',templates:'library',stage:'model',import:'upload','asset-version':'image','asset-official':'image'})[name]||name;return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key]||paths.edit}</svg>`;}
// Escape first. This deliberately supports a small, inert Markdown subset, never HTML or URLs.
export function renderNodeText(text){
 if(!text)return '';
 const inline=s=>esc(s).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*\n]+)\*/g,'<em>$1</em>');
 return String(text??'').split('\n').map(line=>{const h=/^(#{1,3})\s+(.+)$/.exec(line);if(h)return `<h${h[1].length+1}>${inline(h[2])}</h${h[1].length+1}>`;if(/^[-*]\s+/.test(line))return `<p class="node-bullet">${inline(line.replace(/^[-*]\s+/,''))}</p>`;if(/^>\s?/.test(line))return `<blockquote>${inline(line.replace(/^>\s?/,''))}</blockquote>`;return line?`<p>${inline(line)}</p>`:'';}).join('');
}
export function formatSelection(value,start,end,kind){
 start=Math.max(0,Math.min(value.length,start));end=Math.max(start,Math.min(value.length,end));
 const chosen=value.slice(start,end),marks={bold:'**',italic:'*'};
 if(marks[kind]){const mark=marks[kind],body=chosen||'文字';return {value:value.slice(0,start)+mark+body+mark+value.slice(end),start:start+mark.length,end:start+mark.length+body.length};}
 const prefix={heading:'## ',list:'- ',quote:'> '}[kind];if(!prefix)return {value,start,end};
 const lineStart=value.lastIndexOf('\n',start-1)+1,body=value.slice(lineStart,end),next=body.split('\n').map(s=>prefix+s).join('\n');
 return {value:value.slice(0,lineStart)+next+value.slice(end),start:lineStart,end:lineStart+next.length};
}

// Move only the viewport, never node positions or links, when opening a contextual editor.
export function composerView(node,board,currentZoom){
 const zoom=Math.max(.65,Math.min(.9,Number.isFinite(currentZoom)?currentZoom:.85));
 return {zoom,x:Math.max(240,board.width)/2-(node.x+node.w/2)*zoom,y:112-node.y*zoom};
}
