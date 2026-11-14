// 资产库面板：网格 HTML 与加入画布控制。
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function assetsGridHtml(assets = []) {
  if (!assets.length) return '<div class="cv-status">画布里还没有生成资产</div>';
  return assets.map((asset, index) => {
    const media = asset.type === 'video'
      ? `<video src="${escapeHtml(asset.url)}" muted></video>`
      : asset.type === 'audio'
        ? '<span class="cv-version-audio">♪</span>'
        : `<img src="${escapeHtml(asset.url)}" alt="">`;
    return `<button class="cv-asset" data-index="${index}">${media}<span>${escapeHtml(asset.nodeTitle || '')}</span></button>`;
  }).join('');
}

export function assetNodePayload(asset, center) {
  const type = asset.type === 'video' ? 'video' : asset.type === 'audio' ? 'audio' : 'image';
  return {
    type,
    title: `资产 · ${asset.nodeTitle || type}`,
    layout: { x: Math.round(center.x - (type === 'audio' ? 160 : 284)), y: Math.round(center.y - 160), width: type === 'audio' ? 320 : 569, height: 320 },
    resources: [{ ...asset, source: 'asset' }],
    generation: type === 'image'
      ? { mode: 'i2i', prompt: '', model: 'comfyui', ratio: '16:9', resolution: '2K', outputCount: 1 }
      : type === 'video'
        ? { mode: 't2v', prompt: '', model: 'dreamina', ratio: '16:9', resolution: '480P', durationSeconds: 5, outputCount: 1 }
        : { mode: 'tts', prompt: '', model: 'dreamina', ratio: '16:9', resolution: '2K', outputCount: 1 },
  };
}

export function createAssetsPanel({ app, collectAssets, center, onAdd, toast = () => {} } = {}) {
  function open() {
    const grid = app.querySelector('#assetsGrid');
    const assets = collectAssets?.() || [];
    grid.innerHTML = assetsGridHtml(assets);
    grid.querySelectorAll('[data-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const asset = assets[Number(button.dataset.index)];
        if (!asset) return;
        onAdd?.(assetNodePayload(asset, center()));
        app.querySelector('#assetsModal').classList.remove('open');
        toast('已从资产库加入画布');
      });
    });
    app.querySelector('#assetsModal').classList.add('open');
  }
  return { open };
}
