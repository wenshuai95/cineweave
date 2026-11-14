// 撤销/重做历史：纯状态机。
export function createHistory({ limit = 80, getDoc, setDoc, onRestore, toast = () => {} } = {}) {
  const past = [];
  const future = [];

  function push() {
    past.push(JSON.stringify(getDoc?.()));
    if (past.length > limit) past.shift();
    future.length = 0;
  }

  function undo() {
    if (!past.length) { toast('没有可撤销的操作'); return false; }
    future.push(JSON.stringify(getDoc?.()));
    setDoc?.(JSON.parse(past.pop()));
    onRestore?.();
    return true;
  }

  function redo() {
    if (!future.length) { toast('没有可重做的操作'); return false; }
    past.push(JSON.stringify(getDoc?.()));
    setDoc?.(JSON.parse(future.pop()));
    onRestore?.();
    return true;
  }

  return {
    push,
    undo,
    redo,
    clear() { past.length = 0; future.length = 0; },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    get undoCount() { return past.length; },
    get redoCount() { return future.length; },
  };
}
