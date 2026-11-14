// 节点复制/粘贴/副本：状态通过回调注入。
export function createClipboardActions({
  getSelectedNode,
  getClipboard,
  setClipboard,
  pushHistory,
  addNodeToDoc,
  render,
  toast = () => {},
  onPasted = () => {},
} = {}) {
  function copy() {
    const node = getSelectedNode?.();
    if (!node) { toast('先选中一个节点'); return null; }
    const copy = JSON.parse(JSON.stringify(node));
    setClipboard?.(copy);
    toast('已复制节点');
    return copy;
  }

  function paste() {
    const source = getClipboard?.();
    if (!source) { toast('剪贴板为空'); return null; }
    const copy = JSON.parse(JSON.stringify(source));
    delete copy.id;
    copy.layout = { ...copy.layout, x: (copy.layout?.x || 0) + 40, y: (copy.layout?.y || 0) + 40 };
    copy.resources = copy.resources || [];
    pushHistory?.();
    const nextDoc = addNodeToDoc(copy);
    const node = nextDoc?.nodes?.at(-1);
    if (node) setClipboard?.(JSON.parse(JSON.stringify(node)));
    onPasted?.(node);
    render?.();
    toast('已粘贴节点');
    return node;
  }

  function duplicate() {
    if (!getSelectedNode?.()) { toast('先选中一个节点'); return null; }
    copy();
    return paste();
  }

  return { copy, paste, duplicate };
}
