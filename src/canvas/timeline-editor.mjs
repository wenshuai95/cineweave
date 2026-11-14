// 时间线编辑控制器：拖动/裁剪的纯状态机，DOM 由 main.mjs 绑定。
import { dragTimelineItem } from './timeline-model.mjs';

export function createTimelineDragController({ getItem, getTotal, onChange } = {}) {
  let state = null;

  return {
    start({ id, mode, startX, origin, pxPerSecond }) {
      if (!id || !origin || !Number.isFinite(pxPerSecond) || pxPerSecond <= 0) return false;
      state = { id, mode, startX, origin: { ...origin }, pxPerSecond };
      return true;
    },
    move(clientX) {
      if (!state) return null;
      const item = getItem?.(state.id);
      if (!item) return null;
      const delta = (Number(clientX) - state.startX) / state.pxPerSecond;
      const next = dragTimelineItem(item, state.origin, state.mode, delta);
      if (!next) return null;
      Object.assign(item, next);
      onChange?.();
      return item;
    },
    end() {
      const active = Boolean(state);
      state = null;
      return active;
    },
    get active() {
      return Boolean(state);
    },
  };
}
