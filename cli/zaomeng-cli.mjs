// 造梦工坊 CLI：给其他智能体/脚本调用的本地 HTTP 客户端。
// 不依赖第三方包；默认输出 JSON，进度写 stderr。

const DEFAULT_URL = process.env.ZAOMENG_URL || 'http://127.0.0.1:41974';

export function parseArgs(argv = []) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--') { positional.push(...argv.slice(i + 1)); break; }
    if (token.startsWith('--')) {
      const [name, inline] = token.slice(2).split('=', 2);
      if (inline !== undefined) flags[name] = inline;
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) flags[name] = argv[++i];
      else flags[name] = true;
    } else positional.push(token);
  }
  return { positional, flags };
}

export function buildImageBody(flags) {
  const body = {
    kind: 'comfyui-image',
    prompt: String(flags.prompt || ''),
    width: Number(flags.width) || 1024,
    height: Number(flags.height) || 1024,
    workflow: flags.workflow || flags.model || 'qwen21-t2i',
  };
  if (flags.image) body.imageUrl = flags.image;
  if (flags.megapixels) body.megapixels = Number(flags.megapixels);
  if (flags.refMode) body.refMode = flags.refMode;
  return body;
}

export function buildVideoBody(flags) {
  const body = {
    kind: 'comfyui-video',
    prompt: String(flags.prompt || ''),
    model: flags.model || 'h3-ultimate',
    width: Number(flags.width) || 640,
    height: Number(flags.height) || 352,
    duration: Number(flags.duration) || 5,
    fps: Number(flags.fps) || 24,
  };
  if (flags['first-frame']) body.firstFrameUrl = flags['first-frame'];
  if (flags['last-frame']) body.lastFrameUrl = flags['last-frame'];
  if (flags['ref-image']) body.refImages = String(flags['ref-image']).split(',').map((url) => ({ url: url.trim() })).filter((item) => item.url);
  if (flags.megapixels) body.megapixels = Number(flags.megapixels);
  return body;
}

function requestJson(baseUrl, path, { method = 'GET', body } = {}, fetchImpl = fetch) {
  return fetchImpl(`${baseUrl.replace(/\/$/, '')}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (response) => {
    let data = {};
    try { data = await response.json(); } catch { /* 空响应 */ }
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  });
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

export async function main(argv, {
  fetchImpl = fetch,
  stdout = (text) => process.stdout.write(`${text}\n`),
  stderr = (text) => process.stderr.write(`${text}\n`),
  env = process.env,
} = {}) {
  const { positional, flags } = parseArgs(argv);
  const command = positional[0] || 'help';
  const baseUrl = flags.url || env.ZAOMENG_URL || DEFAULT_URL;
  const timeoutMs = Math.max(5, Number(flags.timeout) || 1800) * 1000;
  const print = (value) => stdout(JSON.stringify(value, null, flags.pretty ? 2 : 0));

  async function waitFor(id) {
    const started = Date.now();
    for (;;) {
      if (Date.now() - started > timeoutMs) throw new Error(`等待任务超时：${id}`);
      const job = await requestJson(baseUrl, `/api/generation/jobs/${id}`, {}, fetchImpl);
      if (!['success', 'failed', 'canceled'].includes(job.status)) {
        stderr(`[${job.status}] ${job.progress || 0}% ${job.message || ''}`);
        await sleep(1500);
        continue;
      }
      return job;
    }
  }

  async function submit(body, label) {
    const job = await requestJson(baseUrl, '/api/generation/jobs', { method: 'POST', body }, fetchImpl);
    stderr(`submitted ${label || body.kind}: ${job.id}`);
    if (flags.wait) { const final = await waitFor(job.id); print(final); return final; }
    print(job);
    return job;
  }

  if (command === 'help' || flags.help) {
    stdout(`用法：zaomeng <command> [options]

命令：
  health                         检查本地服务
  capabilities                   模型/端点清单
  jobs [--limit 30]              任务列表
  job <id> [--wait]              任务详情/等待
  cancel <id>                    取消任务
  retry <id>                     重试任务
  submit --json <file|-> [--wait] 提交原始任务 JSON
  image --prompt ... [--workflow qwen21-t2i] [--image URL] [--wait]
  video --prompt ... [--model h3-ultimate] [--first-frame URL] [--duration 5] [--wait]
  relayvsr --video URL [--variant upscale|short|rife] [--wait]
  export-timeline --items <file> [--preset landscape|portrait|draft] [--out file]
  voices                         即梦音色
  optimize --prompt ...          DeepSeek 优化提示词
  translate --prompt ...         提示词翻译
  assistant --message ...         AI 助手

全局：--url http://127.0.0.1:41974  --pretty  --timeout 秒`);
    return 0;
  }

  if (command === 'health') { print(await requestJson(baseUrl, '/api/health', {}, fetchImpl)); return 0; }
  if (command === 'capabilities') { print(await requestJson(baseUrl, '/api/generation/capabilities', {}, fetchImpl)); return 0; }
  if (command === 'voices') { print(await requestJson(baseUrl, '/api/generation/voices', {}, fetchImpl)); return 0; }
  if (command === 'jobs') {
    const limit = Math.max(1, Math.min(200, Number(flags.limit) || 30));
    print(await requestJson(baseUrl, `/api/generation/jobs?limit=${limit}`, {}, fetchImpl));
    return 0;
  }
  if (command === 'job') {
    const id = positional[1];
    if (!id) throw new Error('缺少任务 id');
    print(flags.wait ? await waitFor(id) : await requestJson(baseUrl, `/api/generation/jobs/${id}`, {}, fetchImpl));
    return 0;
  }
  if (command === 'cancel' || command === 'retry') {
    const id = positional[1];
    if (!id) throw new Error('缺少任务 id');
    print(await requestJson(baseUrl, `/api/generation/jobs/${id}/${command}`, { method: 'POST' }, fetchImpl));
    return 0;
  }
  if (command === 'submit') {
    if (!flags.json) throw new Error('submit 需要 --json <file|->');
    const fs = await import('node:fs/promises');
    const raw = flags.json === '-' ? await new Promise((resolve) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => { data += chunk; });
      process.stdin.on('end', () => resolve(data));
    }) : await fs.readFile(flags.json, 'utf8');
    const body = JSON.parse(raw);
    await submit(body, body.kind);
    return 0;
  }
  if (command === 'image') { await submit(buildImageBody(flags), 'image'); return 0; }
  if (command === 'video') { await submit(buildVideoBody(flags), 'video'); return 0; }
  if (command === 'relayvsr') {
    if (!flags.video) throw new Error('relayvsr 需要 --video URL');
    await submit({ kind: 'comfyui-relayvsr', videoUrl: flags.video, detail: Number(flags.detail) || 1, variant: flags.variant || 'upscale' }, 'relayvsr');
    return 0;
  }
  if (command === 'export-timeline') {
    if (!flags.items) throw new Error('export-timeline 需要 --items <file>');
    const fs = await import('node:fs/promises');
    const items = JSON.parse(await fs.readFile(flags.items, 'utf8'));
    const data = await requestJson(baseUrl, '/api/generation/timeline/export', { method: 'POST', body: { items: Array.isArray(items) ? items : items.items, preset: flags.preset || 'landscape' } }, fetchImpl);
    if (flags.out) {
      const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}${data.url}`);
      await fs.writeFile(flags.out, Buffer.from(await response.arrayBuffer()));
      stderr(`saved ${flags.out}`);
    }
    print(data);
    return 0;
  }
  if (command === 'optimize') {
    print(await requestJson(baseUrl, '/api/generation/prompt/optimize', { method: 'POST', body: { prompt: flags.prompt || '', mode: flags.mode || 'image' } }, fetchImpl));
    return 0;
  }
  if (command === 'translate') {
    print(await requestJson(baseUrl, '/api/generation/prompt/translate', { method: 'POST', body: { prompt: flags.prompt || '' } }, fetchImpl));
    return 0;
  }
  if (command === 'assistant') {
    print(await requestJson(baseUrl, '/api/generation/assistant', { method: 'POST', body: { messages: [{ role: 'user', content: flags.message || '' }], context: null } }, fetchImpl));
    return 0;
  }
  throw new Error(`未知命令：${command}`);
}
