// 相机/配色/风格/运镜参数弹窗。
export const CAMERA_OPTIONS = {
  camera: ['自动', 'ARRI Alexa 65', 'RED Komodo', 'Sony Venice', 'Blackmagic Ursa'],
  lens: ['自动', '定焦 35mm', '定焦 50mm', '变焦 24-70mm', '微距 100mm'],
  focal: ['自动', '广角', '中景', '特写', '远景'],
  aperture: ['自动', 'f/1.4', 'f/2.8', 'f/4', 'f/8'],
};

export const PALETTES = [
  ['日系清新', ['#d9e7df', '#a8c6b8', '#f2e9dc', '#7d9f92']],
  ['雾蓝米白', ['#cfd9e2', '#8fa6b8', '#f3efe7', '#5f7588']],
  ['复古糖果', ['#f2b6c1', '#f6d365', '#8fd3c7', '#c48f9f']],
  ['暖黄灰褐', ['#e6c79c', '#b58b63', '#f4ead9', '#7b614c']],
  ['冷青琥珀', ['#8fc7c9', '#e0a35c', '#20343a', '#d9d2c3']],
  ['南法假日', ['#f2d8a7', '#7fb6b0', '#e38b6d', '#f7f1e3']],
  ['沙漠史诗', ['#e0a562', '#b8753f', '#f2dfc2', '#5e412b']],
];

export const STYLES = ['复古对称美学', '电影胶片', '赛博霓虹', '水墨东方', '清新日系', '暗黑史诗'];

export const CAMERA_MOVES = {
  '推镜头': '镜头缓慢推近，主体逐渐占据画面',
  '拉镜头': '镜头缓慢拉远，逐渐展现环境',
  '摇镜头': '镜头水平摇移，扫过场景',
  '移镜头': '镜头横向平移，跟随主体',
  '跟拍': '镜头跟随主体移动，保持中景',
  '环绕': '镜头围绕主体环绕，背景旋转',
  '升降': '镜头垂直升降，改变视角高度',
};

export function cameraOptionsHtml(key, current) {
  return (CAMERA_OPTIONS[key] || []).map((value) => `<option${value === (current || '自动') ? ' selected' : ''}>${value}</option>`).join('');
}

export function paletteGridHtml(selected = 0) {
  return PALETTES.map(([name, colors], index) => `<button class="cv-palette${index === selected ? ' active' : ''}" data-index="${index}"><b>${name}</b><span>${colors.map((color) => `<i style="background:${color}"></i>`).join('')}</span></button>`).join('');
}

export function styleListHtml(selected = 0) {
  return STYLES.map((name, index) => `<button class="cv-style${index === selected ? ' active' : ''}" data-index="${index}">${name}</button>`).join('');
}

export function createStyleTools({ app, getNode, updateNode, appendPrompt, render, toast = () => {} } = {}) {
  let selectedPalette = 0;
  let selectedStyle = 0;
  const $ = (selector) => app.querySelector(selector);

  function openCamera() {
    const node = getNode?.();
    if (!node) return false;
    const camera = node.generation?.camera || {};
    for (const key of ['camera', 'lens', 'focal', 'aperture']) $(`#cam${key[0].toUpperCase()}${key.slice(1)}`).innerHTML = cameraOptionsHtml(key, camera[key]);
    $('#cameraModal').dataset.node = node.id;
    $('#cameraModal').classList.add('open');
    return true;
  }

  function applyCamera() {
    const modal = $('#cameraModal');
    const node = getNode?.(modal.dataset.node);
    if (!node) return false;
    const camera = {
      camera: $('#camCamera').value,
      lens: $('#camLens').value,
      focal: $('#camFocal').value,
      aperture: $('#camAperture').value,
    };
    updateNode?.(node.id, { generation: { camera } });
    const parts = [];
    if (camera.camera !== '自动') parts.push(`相机 ${camera.camera}`);
    if (camera.lens !== '自动') parts.push(`镜头 ${camera.lens}`);
    if (camera.focal !== '自动') parts.push(`${camera.focal}景别`);
    if (camera.aperture !== '自动') parts.push(`光圈 ${camera.aperture}`);
    if (parts.length) appendPrompt?.(`镜头语言：${parts.join('，')}`);
    modal.classList.remove('open');
    render?.();
    toast('已应用相机参数');
    return true;
  }

  function openPalette() {
    const node = getNode?.();
    if (!node) return false;
    const grid = $('#paletteGrid');
    grid.innerHTML = paletteGridHtml(selectedPalette);
    grid.querySelectorAll('[data-index]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedPalette = Number(button.dataset.index);
        grid.querySelectorAll('.cv-palette').forEach((el) => el.classList.toggle('active', el === button));
      });
    });
    $('#paletteModal').dataset.node = node.id;
    $('#paletteModal').classList.add('open');
    return true;
  }

  function applyPalette() {
    const modal = $('#paletteModal');
    const node = getNode?.(modal.dataset.node);
    if (!node) return false;
    const [name, colors] = PALETTES[selectedPalette];
    updateNode?.(node.id, { generation: { palette: name } });
    appendPrompt?.(`配色：${name}（${colors.join(' / ')}）`);
    modal.classList.remove('open');
    render?.();
    toast(`已应用配色：${name}`);
    return true;
  }

  function openStyle() {
    const node = getNode?.();
    if (!node) return false;
    const list = $('#styleList');
    list.innerHTML = styleListHtml(selectedStyle);
    list.querySelectorAll('[data-index]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedStyle = Number(button.dataset.index);
        list.querySelectorAll('.cv-style').forEach((el) => el.classList.toggle('active', el === button));
      });
    });
    $('#styleModal').dataset.node = node.id;
    $('#styleModal').classList.add('open');
    return true;
  }

  function applyStyle() {
    const modal = $('#styleModal');
    const node = getNode?.(modal.dataset.node);
    if (!node) return false;
    const name = STYLES[selectedStyle];
    updateNode?.(node.id, { generation: { style: name } });
    appendPrompt?.(`风格：${name}`);
    modal.classList.remove('open');
    render?.();
    toast(`已应用风格：${name}`);
    return true;
  }

  function openCameraMoveMenu(showContextMenu) {
    showContextMenu?.(Object.keys(CAMERA_MOVES).map((label) => [label, () => {
      appendPrompt?.(`运镜：${CAMERA_MOVES[label]}`);
      toast(`已加入运镜：${label}`);
    }]), 420, 300);
  }

  return { openCamera, applyCamera, openPalette, applyPalette, openStyle, applyStyle, openCameraMoveMenu };
}
