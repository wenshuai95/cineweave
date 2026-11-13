// 多画布管理：切换/新建/复制/重命名/删除。状态通过 adapter 注入。
export function createBoardManager({
  state,
  storage,
  app,
  readDoc,
  removeDoc,
  saveState,
  updateButton,
  render,
  persist,
  postBoards,
  createDocument,
  resetView,
  toast = () => {},
} = {}) {
  function switchBoard(id) {
    if (id === state.currentId) return false;
    saveState?.();
    const next = readDoc?.(id);
    if (!next) { toast('画布读取失败'); return false; }
    state.currentId = id;
    storage.setItem(state.currentKey(), id);
    state.doc = next;
    resetView?.();
    updateButton?.();
    render();
    persist?.(false);
    postBoards?.();
    toast('已切换画布');
    return true;
  }

  function makeBoard(name = '新画布') {
    saveState?.();
    const id = `board_${Date.now().toString(36)}`;
    const boards = [...state.boards, { id, name, updatedAt: Date.now() }];
    state.boards = boards;
    state.currentId = id;
    state.doc = createDocument({ viewport: { x: 520, y: 300, zoom: 0.8 } });
    resetView?.();
    updateButton?.();
    saveState?.();
    render();
    persist?.(false);
    postBoards?.();
    toast('已新建画布');
    return id;
  }

  function duplicateBoard() {
    saveState?.();
    const id = `board_${Date.now().toString(36)}`;
    const source = state.boards.find((item) => item.id === state.currentId);
    state.boards = [...state.boards, { id, name: `${source?.name || '画布'} 副本`, updatedAt: Date.now() }];
    state.currentId = id;
    state.doc = structuredClone(state.doc);
    resetView?.();
    updateButton?.();
    saveState?.();
    render();
    persist?.(false);
    postBoards?.();
    toast('已复制画布');
    return id;
  }

  function startRename() {
    const board = state.boards.find((item) => item.id === state.currentId);
    if (!board) return false;
    app.querySelector('#boardRenameInput').value = board.name;
    app.querySelector('#boardRenameModal').classList.add('open');
    app.querySelector('#boardRenameInput').focus();
    app.querySelector('#boardRenameInput').select();
    return true;
  }

  function confirmRename() {
    const board = state.boards.find((item) => item.id === state.currentId);
    const value = app.querySelector('#boardRenameInput').value.trim();
    if (!board || !value) return false;
    board.name = value.slice(0, 40);
    app.querySelector('#boardRenameModal').classList.remove('open');
    updateButton?.();
    saveState?.();
    postBoards?.();
    toast('已重命名');
    return true;
  }

  function deleteBoard() {
    if (state.boards.length <= 1) { toast('至少保留一个画布'); return false; }
    const removed = state.currentId;
    state.boards = state.boards.filter((item) => item.id !== removed);
    removeDoc?.(removed);
    state.currentId = state.boards[0].id;
    state.doc = readDoc?.(state.currentId) || createDocument();
    resetView?.();
    updateButton?.();
    saveState?.();
    render();
    persist?.(false);
    postBoards?.();
    toast('已删除画布');
    return true;
  }

  return { switchBoard, makeBoard, duplicateBoard, startRename, confirmRename, deleteBoard };
}
