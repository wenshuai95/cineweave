import {uid} from './model.mjs';
export function appendDirectorVideo(project,video,sourceId){
 const source=project.nodes.find(n=>n.id===sourceId&&n.type==='director')||project.nodes.find(n=>n.type==='director');
 if(project.nodes.length+(source?1:2)>500)return false;
 const director=source||{id:uid(),type:'director',title:'3D 导演台',text:'当前工程的共享三维场景与镜头。双击进入导演台。',x:video.x,y:video.y,w:280};
 if(!source)project.nodes.push(director);
 video.x=director.x+director.w+100;video.y=director.y+project.edges.filter(e=>e.from===director.id&&project.nodes.some(n=>n.id===e.to&&n.type==='video')).length*420;
 project.nodes.push(video);project.edges.push({from:director.id,to:video.id});return true;
}
