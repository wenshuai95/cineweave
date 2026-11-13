// 局部重绘蒙版编辑器：矩形框选 + 生成黑白蒙版。
export function normalizedMaskRect(start, current, width, height) {
  return {
    x: Math.min(start.x, current.x) / width,
    y: Math.min(start.y, current.y) / height,
    w: Math.abs(current.x - start.x) / width,
    h: Math.abs(current.y - start.y) / height,
  };
}

export function createMaskEditor({
  app,
  getNode,
  setNode,
  render,
  toast = () => {},
  getPrompt = () => '',
  uploadDataUrl,
  submitJob,
  pollJob,
} = {}) {
  let node = null;
  let rects = [];
  const $ = (selector) => app.querySelector(selector);

  function draw(preview = null) {
    const canvas = $('#maskCanvas');
    if (!canvas?.width) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255, 70, 90, 0.45)';
    ctx.strokeStyle = 'rgba(255, 120, 140, 0.9)';
    for (const r of rects) {
      ctx.fillRect(r.x * canvas.width, r.y * canvas.height, r.w * canvas.width, r.h * canvas.height);
      ctx.strokeRect(r.x * canvas.width, r.y * canvas.height, r.w * canvas.width, r.h * canvas.height);
    }
    if (preview) {
      ctx.fillStyle = 'rgba(255, 70, 90, 0.35)';
      ctx.strokeStyle = 'rgba(255, 120, 140, 0.8)';
      ctx.fillRect(preview.x, preview.y, preview.w, preview.h);
      ctx.strokeRect(preview.x, preview.y, preview.w, preview.h);
    }
  }

  function bindCanvas(canvas) {
    if (canvas.dataset.bound) return;
    canvas.dataset.bound = '1';
    let start = null;
    canvas.addEventListener('pointerdown', (event) => {
      const rect = canvas.getBoundingClientRect();
      start = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      try { canvas.setPointerCapture?.(event.pointerId); } catch { /* 合成事件无活动指针 */ }
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!start) return;
      const rect = canvas.getBoundingClientRect();
      const current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      draw({ x: Math.min(start.x, current.x), y: Math.min(start.y, current.y), w: Math.abs(current.x - start.x), h: Math.abs(current.y - start.y) });
    });
    canvas.addEventListener('pointerup', (event) => {
      if (!start) return;
      const rect = canvas.getBoundingClientRect();
      const current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const w = Math.abs(current.x - start.x);
      const h = Math.abs(current.y - start.y);
      if (w > 4 && h > 4) rects.push(normalizedMaskRect(start, current, canvas.width, canvas.height));
      start = null;
      draw();
    });
  }

  function open(target) {
    const media = target?.resources?.[0];
    if (!media?.url) { toast('先生成一张图片'); return false; }
    node = target;
    rects = [];
    const modal = $('#maskModal');
    const img = $('#maskImage');
    const canvas = $('#maskCanvas');
    img.onload = () => {
      const maxW = Math.min(760, window.innerWidth - 160);
      const maxH = Math.min(520, window.innerHeight - 260);
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      const width = Math.round(img.naturalWidth * scale);
      const height = Math.round(img.naturalHeight * scale);
      img.style.width = `${width}px`;
      img.style.height = `${height}px`;
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      draw();
    };
    img.src = media.url;
    modal.classList.add('open');
    bindCanvas(canvas);
    return true;
  }

  function clear() {
    rects = [];
    draw();
  }

  function close() {
    $('#maskModal').classList.remove('open');
    node = null;
  }

  async function confirm() {
    if (!node) return false;
    if (!rects.length) { toast('先在图片上拖出要重绘的区域'); return false; }
    const target = node;
    const media = target.resources?.[0];
    const out = document.createElement('canvas');
    const source = $('#maskImage');
    out.width = source.naturalWidth || 768;
    out.height = source.naturalHeight || 512;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.fillStyle = '#fff';
    for (const r of rects) ctx.fillRect(r.x * out.width, r.y * out.height, r.w * out.width, r.h * out.height);
    close();
    setNode?.(target.id, { status: 'running', progress: 0, jobMessage: '局部重绘中…' });
    render?.();
    try {
      const uploaded = await uploadDataUrl(out.toDataURL('image/png'));
      const prompt = String(getPrompt?.() || '').trim() || (target.generation?.prompt || '');
      const data = await submitJob({ kind: 'comfyui-inpaint', imageUrl: media.url, maskUrl: uploaded.url, prompt });
      toast('已提交局部重绘');
      pollJob?.(data.id, target.id);
      return true;
    } catch (error) {
      setNode?.(target.id, { status: 'failed', error: error.message || String(error) });
      render?.();
      toast(error.message || String(error), true);
      return false;
    }
  }

  return { open, draw, clear, close, confirm, get rects() { return rects; } };
}
