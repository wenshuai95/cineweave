// 画布键盘快捷键。
export function createShortcuts({
  getDoc,
  setDoc,
  getSelection,
  setSelection,
  getSelectedEdge,
  setSelectedEdge,
  getSpaceHeld,
  setSpaceHeld,
  getCanUndo,
  getCanRedo,
  pushHistory,
  undo,
  redo,
  render,
  updateSelectionUi,
  layer,
  toast = () => {},
  fitCanvas,
  copySelected,
  pasteNode,
  duplicateSelected,
  disconnect,
  findNode,
  removeNode,
  removeReference,
} = {}) {
  function onKeyDown(event) {
    const editing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
    if (editing) return;
    if (event.code === 'Space' && !event.repeat) { setSpaceHeld?.(true); event.preventDefault(); return; }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (getSelectedEdge()) {
        event.preventDefault();
        const doc = getDoc();
        const edge = doc.edges.find((item) => item.id === getSelectedEdge());
        pushHistory();
        if (edge) {
          let next = disconnect(doc, edge.id);
          const target = findNode(next, edge.to);
          if (target) next = removeReference(next, edge.to, edge.from);
          setDoc(next);
        }
        setSelectedEdge(null);
        render();
        toast('已删除连线');
        return;
      }
      if (!getSelection().size) return;
      event.preventDefault();
      pushHistory();
      let doc = getDoc();
      for (const id of getSelection()) doc = removeNode(doc, id);
      setDoc(doc);
      setSelection(new Set());
      render();
      toast('已删除');
      return;
    }
    if (event.key === 'Escape') {
      setSelection(new Set());
      setSelectedEdge(null);
      render();
      return;
    }
    const meta = event.metaKey || event.ctrlKey;
    const inAiPanel = Boolean(document.activeElement?.closest?.('#aiPanel') || window.getSelection()?.anchorNode?.parentElement?.closest?.('#aiPanel'));
    if (inAiPanel && meta && ['c', 'a'].includes(event.key.toLowerCase())) return;
    const textSelected = Boolean(window.getSelection()?.toString());
    if (textSelected && meta && event.key.toLowerCase() === 'c') return;
    if (meta && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      event.shiftKey ? redo() : undo();
      return;
    }
    if (meta && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
    if (meta && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      const selection = new Set(getDoc().nodes.map((node) => node.id));
      setSelection(selection);
      updateSelectionUi();
      layer.querySelectorAll('.cv-node').forEach((el) => el.classList.toggle('selected', selection.has(el.dataset.id)));
      return;
    }
    if (!meta && event.key.toLowerCase() === 'f') { event.preventDefault(); fitCanvas(); return; }
    if (meta && event.key.toLowerCase() === 'c') { event.preventDefault(); copySelected(); return; }
    if (meta && event.key.toLowerCase() === 'v') { event.preventDefault(); pasteNode(); return; }
    if (meta && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicateSelected(); return; }
  }
  return { onKeyDown };
}
