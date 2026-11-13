// 右键菜单 HTML：纯函数。
export function contextMenuHtml(items = []) {
  return items.map(([label, _action, heading, disabled]) => {
    if (label === 'sep') return '<div class="cv-menu-sep"></div>';
    if (heading) return `<div class="cv-menu-label">${label}</div>`;
    return `<button data-action="${label}"${disabled ? ' disabled' : ''}>${label}</button>`;
  }).join('');
}

export function actionableMenuEntries(items = []) {
  return items.filter((item) => item?.[1] && !item?.[2]);
}
