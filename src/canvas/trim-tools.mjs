// 视频/音频修剪弹窗。
import { trimVideoRequest, trimAudioRequest } from './generation-request.mjs';

export function createTrimTools({
  app,
  getNode,
  commitResource,
  setNode,
  render,
  toast = () => {},
  requestVideoTrim = trimVideoRequest,
  requestAudioTrim = trimAudioRequest,
  peaksFor,
  drawWave,
} = {}) {
  let videoNode = null;
  let audioNode = null;
  let peaks = null;
  let duration = 0;
  const $ = (selector) => app.querySelector(selector);

  function drawVideoInfo() {
    const preview = $('#videoTrimPreview');
    const start = Number($('#videoTrimStart').value) || 0;
    const end = Number($('#videoTrimEnd').value) || preview.duration || 0;
    $('#videoTrimInfo').textContent = `保留 ${start.toFixed(1)}s – ${end.toFixed(1)}s（共 ${(preview.duration || 0).toFixed(1)}s）`;
    try { preview.currentTime = start; } catch { /* ignore */ }
  }

  function openVideo(node) {
    const media = node?.resources?.[0];
    if (!media?.url) { toast('先生成视频'); return false; }
    videoNode = node;
    const preview = $('#videoTrimPreview');
    preview.src = media.url;
    $('#videoTrimModal').classList.add('open');
    const start = $('#videoTrimStart');
    const end = $('#videoTrimEnd');
    preview.onloadedmetadata = () => {
      const total = Number.isFinite(preview.duration) ? preview.duration : 5;
      start.max = String(total);
      end.max = String(total);
      start.value = '0';
      end.value = String(total);
      drawVideoInfo();
    };
    preview.load();
    return true;
  }

  async function confirmVideo() {
    if (!videoNode) return false;
    const media = videoNode.resources?.[0];
    const start = Number($('#videoTrimStart').value) || 0;
    const end = Number($('#videoTrimEnd').value) || 0;
    if (end <= start + 0.3) { toast('终点要大于起点'); return false; }
    $('#videoTrimModal').classList.remove('open');
    try {
      const data = await requestVideoTrim({ videoUrl: media.url, start, end });
      commitResource?.(videoNode.id, { id: data.filename, type: 'video', url: data.url, source: 'trim' });
      setNode?.(videoNode.id, { status: 'success' });
      render?.();
      toast('视频已修剪');
      return true;
    } catch (error) {
      toast(error.message || String(error), true);
      return false;
    }
  }

  function drawAudioInfo() {
    if (!peaks) return;
    const start = Number($('#trimStart').value) || 0;
    const end = Number($('#trimEnd').value) || duration;
    drawWave?.($('#trimWave'), peaks, start, end, duration);
    $('#trimInfo').textContent = `保留 ${start.toFixed(1)}s – ${end.toFixed(1)}s（共 ${duration.toFixed(1)}s）`;
  }

  async function openAudio(node) {
    const media = node?.resources?.[0];
    if (!media?.url) { toast('先生成音频'); return false; }
    audioNode = node;
    $('#audioTrimModal').classList.add('open');
    $('#trimInfo').textContent = '读取波形…';
    try {
      const result = await peaksFor(media.url);
      peaks = result.peaks;
      duration = result.duration;
      const canvas = $('#trimWave');
      canvas.width = 600;
      canvas.height = 90;
      const start = $('#trimStart');
      const end = $('#trimEnd');
      start.max = String(duration);
      end.max = String(duration);
      start.value = '0';
      end.value = String(duration);
      drawAudioInfo();
      return true;
    } catch (error) {
      $('#trimInfo').textContent = `读取失败：${error.message}`;
      return false;
    }
  }

  async function confirmAudio() {
    if (!audioNode) return false;
    const media = audioNode.resources?.[0];
    const start = Number($('#trimStart').value) || 0;
    const end = Number($('#trimEnd').value) || duration;
    if (end <= start + 0.2) { toast('终点要大于起点'); return false; }
    $('#audioTrimModal').classList.remove('open');
    try {
      const data = await requestAudioTrim({ audioUrl: media.url, start, end });
      setNode?.(audioNode.id, { status: 'success', resources: [{ id: data.filename, type: 'audio', url: data.url, source: 'trim' }] });
      render?.();
      toast('已裁剪');
      return true;
    } catch (error) {
      toast(error.message || String(error), true);
      return false;
    }
  }

  return { openVideo, confirmVideo, openAudio, confirmAudio, drawVideoInfo, drawAudioInfo };
}
