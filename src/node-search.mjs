// 画布节点搜索匹配：按名称与文字内容查询，多词为 AND；只读匹配，不改动节点。
export function nodeMatchesQuery(node,query){
 if(!node)return false;
 const q=String(query??'').trim().toLowerCase();
 if(!q)return true;
 const haystack=[node.title,node.text].filter(v=>typeof v==='string').join('\n').toLowerCase();
 const words=q.split(/\s+/).filter(Boolean);
 return words.length>0&&words.every(word=>haystack.includes(word));
}
