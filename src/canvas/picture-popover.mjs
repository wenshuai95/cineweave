// 画面设置弹层：比例/分辨率/数量。DOM 通过 app 注入。
export const PICTURE_RATIOS = ['智能', '1:1', '3:4', '16:9', '4:3', '9:16', '2:3', '3:2', '21:9'];

export function ratioButtonsHtml(current = '16:9') {
  return PICTURE_RATIOS.map((ratio) => {
    const active = (current || '16:9') === ratio ? ' active' : '';
    let shape = '<span class="cv-ratio-shape smart">✦</span>';
    if (ratio !== '智能') {
      const [w, h] = ratio.split(':').map(Number);
      const bw = 30;
      const bh = Math.max(10, Math.min(30, Math.round(bw * h / w)));
      shape = `<span class="cv-ratio-shape" style="width:${bw}px;height:${bh}px"></span>`;
    }
    return `<button class="cv-pic-ratio${active}" data-ratio="${ratio}">${shape}<span>${ratio}</span></button>`;
  }).join('');
}

export function countButtonsHtml(current, min, max) {
  const counts = Array.from({ length: Math.max(0, max - min + 1) }, (_, index) => index + min);
  return counts.map((value) => `<button class="cv-pic-count${(current || 1) === value ? ' active' : ''}" data-count="${value}">${value}</button>`).join('');
}

export function createPicturePopover({ app, dock, getNode, onChange, toast = () => {}, resolutionOptions = () => [], countRange = () => ({ min: 1, max: 1 }) } = {}) {
  const $ = (selector) => app.querySelector(selector);

  function close() {
    $('#picturePopover')?.classList.remove('open');
  }

  function open() {
    const node = getNode?.();
    if (!node?.generation) { toast('先选中一个生成节点'); return false; }
    render(node);
    const pop = $('#picturePopover');
    const dockRect = dock.getBoundingClientRect();
    pop.style.left = `${Math.max(16, Math.min(window.innerWidth - 650, dockRect.left + (dockRect.width - 620) / 2))}px`;
    pop.style.bottom = `${Math.max(12, window.innerHeight - dockRect.top + 8)}px`;
    pop.classList.add('open');
    return true;
  }

  function render(node) {
    const generation = node.generation || {};
    $('#picRatios').innerHTML = ratioButtonsHtml(generation.ratio);
    const resolutions = resolutionOptions(node);
    $('#picRes').innerHTML = resolutions.map((value) => `<button class="cv-pic-res-btn${(generation.resolution || resolutions[0]) === value ? ' active' : ''}" data-res="${value}">${value}</button>`).join('');
    const range = countRange(node);
    $('#picCounts').innerHTML = countButtonsHtml(generation.outputCount, range.min, range.max);
    $('#picRatios').querySelectorAll('[data-ratio]').forEach((button) => button.addEventListener('click', () => {
      onChange?.(node, { ratio: button.dataset.ratio });
    }));
    $('#picRes').querySelectorAll('[data-res]').forEach((button) => button.addEventListener('click', () => {
      onChange?.(node, { resolution: button.dataset.res, h3Size: node.type === 'video' ? button.dataset.res : node.generation?.h3Size });
    }));
    $('#picCounts').querySelectorAll('[data-count]').forEach((button) => button.addEventListener('click', () => {
      onChange?.(node, { outputCount: Number(button.dataset.count) });
    }));
    return node;
  }

  return { open, close, render };
}
