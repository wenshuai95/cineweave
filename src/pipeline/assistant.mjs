// 流水线界面的助手桥：调用应用已有的文字模型接口，返回经过服务端校验的提案。
// 界面只负责展示与“应用”，所有写工程的动作在 story-edit.mjs 里。

export async function textToken() {
  const response = await fetch('/api/ai/text/status', {signal: AbortSignal.timeout(8000)});
  if (!response.ok) throw Error('文字模型服务尚未就绪，请先在旧界面设置 API');
  return (await response.json()).token;
}

export async function generateText({kind, prompt, script = '', shots, duration, characters, signal} = {}) {
  const token = await textToken();
  const timeout = AbortSignal.timeout(190000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const response = await fetch('/api/ai/text/generate', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-Jingchang-Token': token},
    body: JSON.stringify({kind, prompt, script, scope: 'script', ...(Array.isArray(shots) ? {shots} : {}), ...(Number.isFinite(duration) ? {duration} : {}), ...(Array.isArray(characters) ? {characters} : {})}),
    signal: combined,
  });
  let data;
  try { data = await response.json(); }
  catch { throw Error('文字模型返回异常，请稍后重试'); }
  if (!response.ok) throw Error(data.error || '文字模型请求失败');
  return data;
}

/** 续写/改写剧本：返回完整文本。 */
export function scriptProposal(result) {
  if (!result?.text) throw Error('模型没有返回剧本内容');
  return {type: 'script', text: String(result.text)};
}

/** 生成分镜：返回经过服务端校验的镜头数组。 */
export function storyboardProposal(result) {
  if (!Array.isArray(result?.shots) || !result.shots.length) throw Error('模型没有返回分镜');
  return {type: 'storyboard', shots: result.shots};
}

export function assetProposal(result) {
  if (!Array.isArray(result?.assets) || !result.assets.length) throw Error('模型没有返回资产设计');
  return {type: 'assets', assets: result.assets};
}

export function proposalSummary(proposal) {
  if (proposal.type === 'assets') {
    const counts = proposal.assets.reduce((map, asset) => ({...map, [asset.kind]: (map[asset.kind] || 0) + 1}), {});
    const label = {character: '角色', scene: '场景', prop: '道具'};
    return proposal.assets.length + ' 个资产（' + Object.entries(counts).map(([kind, count]) => (label[kind] || kind) + ' ' + count).join(' · ') + '）';
  }
  if (proposal.type === 'script') {
    const text = proposal.text.trim();
    return `剧本 ${text.length} 字 · ${text.split(/\n+/).filter(Boolean).length} 段`;
  }
  const total = proposal.shots.reduce((sum, shot) => sum + (Number(shot.duration) || 0), 0);
  return `${proposal.shots.length} 个镜头 · 总长 ${total.toFixed(1)} 秒`;
}
