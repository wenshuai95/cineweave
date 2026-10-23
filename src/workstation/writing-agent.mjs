// Reviewed, declarative guidance only. No downloaded skill can execute tools.
export const writingSkills=[
 {id:'general',name:'通用编剧',description:'按你的要求讨论与修改，保留已有设定。',rules:'使用中文。剧本描述可见动作与可听对白。尊重用户风格，不强制三幕结构。'},
 {id:'structure',name:'故事结构',description:'梳理人物目标、冲突、转折和结尾。',rules:'分析目标、阻力、因果、代价和情绪变化；核对设定一致性。必要时建议开端、发展与结尾，不强行套用固定比例。',source:'wind-comic / screenwriter · MIT'},
 {id:'dialogue',name:'人物与对白',description:'区分人物声音，让对白简洁而有潜台词。',rules:'保持人物动机、关系与口吻一致。减少解释性对白，通过行动和潜台词传达信息，不强制重复口头禅。'},
 {id:'shots',name:'文学分镜',description:'将戏剧动作写成可拍摄的镜头。',rules:'每镜写清主体、动作、景别、运镜、时长；检查动作连续性和对白可读性。人物与场景名称保持一致，不凭空新增资产。'},
 {id:'review',name:'剧本检查',description:'检查逻辑、连续性、节奏与可拍摄性。',rules:'指出具体问题与对应段落，区分事实错误和风格建议；先保留有效部分，再提出局部修改，不假装已执行修改。'},
 {id:'directing',name:'导演与调度',description:'从戏剧目的出发，设计人物走位、机位与运镜。',rules:'使用中文，先明确每场戏的人物目标、冲突和情绪转折，再设计镜头。先写主体起点、走位、视线、互动和结束姿态，再决定机位、景别与运动；每个镜头说明叙事作用。检查轴线、视线匹配、画面方向与空间关系，避免没有动机的运镜和为丰富而切镜。默认控制单镜主要动作与摄影机运动的复杂度，但用户需要的长镜头不强行拆分。把抽象情绪翻译成可见行为，不靠器材名和形容词堆砌。保持原剧本和用户风格，不默认套用任何导演风格；被点名时讨论可迁移的方法，不假称导演本人参与或背书。遵守本次操作的输出格式，不自行增加工具调用或工程改动。',source:'wuwangzhang1216/DirectorSKILL · MIT · reviewed adaptation'},
 {id:'continuity',name:'资产连续性',description:'统一角色、服装、场景和道具，减少跨镜头变化。',rules:'使用中文。为重复出现的角色、场景、道具建立稳定名称，复用已有资产，不重复发明。区分不可随意改变的身份锚点与会随剧情改变的状态：锚点包括面部特征、发型、轮廓、服装材质与主色、场景地理和关键道具；状态包括表情、伤痕、湿度、损坏、持物位置、天气和时段，并注明对应场次或镜头。跨镜提示词复用简短一致的锚点；角色参考优先清楚中性视角，场景参考突出空间，道具参考突出形制和材质。优先服从用户确认的设定；遇到矛盾指出具体位置，不悄悄改写。存在参考图时建议复用参考图，不能承诺仅靠文字就保证角色一致。仅输出本次操作需要的内容，不声称已更新资产或实际检查了未提供的图片。',source:'0xhughs/director-skills / character-location-prop-bible · MIT · reviewed adaptation'},
 {id:'video-prompt',name:'视频提示词',description:'把分镜与参考素材转成清楚、可执行的视频描述。',rules:'使用中文。把镜头写成清楚的起始状态、主体主要动作、方向和速度、摄影机行为、环境变化与可观察的结束状态。参考图已有的身份、服装和构图无需反复重述，只保留必要连续性约束；白模视频作为空间、动作或运镜参考时明确希望保留的部分，不能假称已解析没有提供给模型的视频。多素材参考逐项说明用途，素材名称与项目保持一致；不要凭空生成不存在的素材编号或引用语法。文字不足以确认模型是否支持音频、首尾帧、时间戳或视频参考时明确未知，以实际服务能力为准，不编造参数。负面约束只针对具体风险。时长须容纳动作和对白；复杂动作优先建议分次生成。保持剧情、人物及已有参考，遵守本次操作输出格式，不宣称已生成媒体。',source:'wuwangzhang1216/DirectorSKILL · MIT · reviewed adaptation'}
];
export function normalizeWriting(raw){const r=raw&&typeof raw==='object'?raw:{};return {...(typeof r.artDirection==='string'?{artDirection:r.artDirection.slice(0,6000)}:{}),brief:typeof r.brief==='string'?r.brief.slice(0,6000):'',skill:writingSkills.some(s=>s.id===r.skill)?r.skill:'general',messages:(Array.isArray(r.messages)?r.messages:[]).filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-40).map(m=>({role:m.role,content:m.content.slice(0,12000),...(typeof m.taskId==='string'&&/^[\w-]{1,100}$/.test(m.taskId)?{taskId:m.taskId}:{}),...(Number.isFinite(m.createdAt)&&m.createdAt>0?{createdAt:m.createdAt}:{})}))};}
export function boundedHistory(raw){let size=0;const out=[];for(const m of normalizeWriting({messages:raw}).messages.slice(-12).reverse()){if(size+m.content.length>24000)break;out.unshift({role:m.role,content:m.content});size+=m.content.length;}while(out[0]?.role==='assistant')out.shift();return out;}
export function applyLocalWriting(ws,pending){
 const r=pending.result;
 if(pending.scope==='selection'){
  const s=pending.selection;
  if(!s||ws.script.slice(s.start,s.end)!==s.text||s.end<=s.start)throw Error('选中文字已变化，请重新选择');
  if(ws.script.length-(s.end-s.start)+r.text.length>200000)throw Error('采用后剧本超过长度限制');
  ws.script=ws.script.slice(0,s.start)+r.text+ws.script.slice(s.end);return;
 }
 if(pending.scope==='shots'){
  const patches=new Map(r.shots.map(s=>[s.id,s]));
  if(r.shots.some(s=>!ws.story.shots.some(o=>o.id===s.id)))throw Error('选中分镜已变化');
  ws.story.shots=ws.story.shots.map(s=>patches.has(s.id)?{...s,...patches.get(s.id),assetIds:s.assetIds,canvasNodeId:s.canvasNodeId}:s);return;
 }
 throw Error('请选择局部修改范围');
}
