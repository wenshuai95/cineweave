// 流水线 · 资产数据层：提取/合并资产设计，组装图片提示词。
import {normalizeStory} from '../workstation/story.mjs';
import {applyAssetDesigns} from '../workstation/asset-agent.mjs';
import {shotRows} from './shot-model.mjs';

const KINDS = {character: '角色', scene: '场景', prop: '道具'};
export const assetKindLabel = kind => KINDS[kind] || '资产';

export function projectAssets(project) {
  const story = project?.workstation?.story;
  return Array.isArray(story?.assets) ? story.assets : [];
}

/** 把助手生成的资产设计合并进工程（新增或更新同名资产）。 */
export function applyAssetProposal(project, designs) {
  if (!Array.isArray(designs) || !designs.length) throw Error('资产方案为空');
  project.workstation = project.workstation || {};
  if (!project.workstation.story) project.workstation.story = normalizeStory({});
  const count = applyAssetDesigns(project.workstation, designs, {snapshot: false});
  return count;
}

/** 从剧本与分镜组装“提取资产”的提示词。 */
export function extractAssetsPrompt(project) {
  const summary = shotRows(project).map(row => `镜 ${row.number}: ${row.description || '未描述'}`).join('\n');
  return `根据剧本与分镜，提取去重的角色、场景、关键道具。每项给出 kind（character/scene/prop）、name、一句话 description，以及可直接用于文生图的中文 prompt（主体外观、服装/材质、时代、色彩、光线、画风、构图、背景）。只输出 JSON：{"assets":[...]}。\n\n已有分镜：\n${summary || '（暂无分镜）'}`;
}

/** 资产图提示词：资产 prompt 优先，缺省时用描述与名称补齐。 */
export function assetImagePrompt(asset) {
  const base = String(asset?.prompt || '').trim();
  const fallback = [asset?.name, asset?.description].filter(Boolean).join('，');
  return (base || fallback).slice(0, 6000);
}

export function assetsByKind(assets) {
  const groups = {character: [], scene: [], prop: []};
  for (const asset of assets || []) {
    if (!groups[asset.kind]) continue;
    groups[asset.kind].push(asset);
  }
  return groups;
}
