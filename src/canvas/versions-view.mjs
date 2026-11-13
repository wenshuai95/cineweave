// 版本历史弹窗与下载。
export function versionItems(node) {
  const items = [];
  if (node?.resources?.[0]?.url) items.push({ ...node.resources[0], current: true });
  items.push(...(node?.versions || []));
  return items;
}

export function versionsGridHtml(items = []) {
  if (!items.length) return '<div class="cv-status">还没有生成结果</div>';
  return items.map((item, index) => {
    const media = item.type === 'video'
      ? `<video src="${item.url}" muted></video>`
      : item.type === 'audio'
        ? '<span class="cv-version-audio">♪</span>'
        : `<img src="${item.url}" alt="">`;
    return `<button class="cv-version${item.current ? ' current' : ''}" data-index="${index}">${media}<span>${item.current ? '当前' : new Date(item.createdAt || Date.now()).toLocaleTimeString()}</span></button>`;
  }).join('');
}

export function createVersionsView({ app, commitResource, render, toast = () => {} } = {}) {
  function open(node) {
    const grid = app.querySelector('#versionsGrid');
    const items = versionItems(node);
    grid.innerHTML = versionsGridHtml(items);
    grid.querySelectorAll('[data-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = items[Number(button.dataset.index)];
        if (!item || item.current) return;
        commitResource?.(node.id, { id: item.id, type: item.type, url: item.url, source: item.source || 'version' });
        app.querySelector('#versionsModal').classList.remove('open');
        render?.();
        toast('已切换版本');
      });
    });
    app.querySelector('#versionsModal').classList.add('open');
  }
  return { open };
}

export function downloadNodeResource(node, toast = () => {}) {
  const media = node?.resources?.[0];
  if (!media?.url) { toast('还没有生成结果'); return false; }
  const link = document.createElement('a');
  link.href = media.url;
  link.download = media.id || 'canvas-result';
  link.click();
  return true;
}
