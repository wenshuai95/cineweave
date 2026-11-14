// 任务面板 HTML：纯函数。
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const STAGE_LABELS = { prepare: '准备', sampling: '生成中', finalize: '收尾', done: '结束' };

export function jobStatusLabel(job) {
  if (job.status === 'success') return '完成';
  if (job.status === 'failed') return '失败';
  if (job.status === 'canceled') return '已取消';
  if (job.status === 'queued') return '排队中';
  return '运行中';
}

export function jobsListHtml(jobs = []) {
  if (!jobs.length) return '<div class="cv-status">还没有生成任务。</div>';
  return jobs.map((job) => {
    const terminal = ['success', 'failed', 'canceled'].includes(job.status);
    const status = jobStatusLabel(job);
    const model = job.meta?.model || job.type || '';
    const progress = Math.max(0, Math.min(100, Number(job.progress) || 0));
    const eta = job.etaSeconds ? ` · 约剩 ${job.etaSeconds}s` : '';
    const action = terminal
      ? (job.status === 'failed' && job.meta?.request ? '<button data-job-retry>重试</button>' : '')
      : '<button data-job-cancel>取消</button>';
    return `<div class="cv-job-row" data-job="${escapeHtml(job.id)}">
        <div class="cv-job-top"><b>${escapeHtml(model)}</b><span>${status}${eta}</span></div>
        <div class="cv-job-msg">${escapeHtml(job.message || STAGE_LABELS[job.stage] || '')}</div>
        <div class="cv-job-bar"><i style="width:${terminal && job.status === 'success' ? 100 : progress}%"></i></div>
        <div class="cv-job-actions">${action}</div>
      </div>`;
  }).join('');
}
