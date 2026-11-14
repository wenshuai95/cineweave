// 视频截帧/分离音频。
import { extractVideoFrameRequest, extractVideoAudioRequest } from './generation-request.mjs';

export function createMediaExtract({ addResourceNode, toast = () => {}, requestFrame = extractVideoFrameRequest, requestAudio = extractVideoAudioRequest } = {}) {
  async function frame(node) {
    const media = node?.resources?.[0];
    if (!media?.url) { toast('视频还没有生成'); return false; }
    toast('截取帧中…');
    try {
      const data = await requestFrame({ videoUrl: media.url, time: 1 });
      await addResourceNode(node, 'image', data, '截取帧');
      toast('已生成截取帧节点');
      return true;
    } catch (error) {
      toast(error.message, true);
      return false;
    }
  }

  async function audio(node) {
    const media = node?.resources?.[0];
    if (!media?.url) { toast('视频还没有生成'); return false; }
    toast('分离音频中…');
    try {
      const data = await requestAudio({ videoUrl: media.url });
      await addResourceNode(node, 'audio', data, '分离音频');
      toast('已生成音频节点');
      return true;
    } catch (error) {
      toast(error.message, true);
      return false;
    }
  }

  return { frame, audio };
}
