const {app, BrowserWindow} = require('electron');
const fs = require('node:fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
app.whenReady().then(async () => {
  const win = new BrowserWindow({show: true, width: 1440, height: 900});
  win.webContents.on('console-message', (e, level, message, line, source) => {
    if (level >= 3) errors.push(`console: ${String(message).slice(0,160)} @${String(source).split('/').pop()}:${line}`);
  });
  win.webContents.on('preload-error', (e, path, err) => errors.push('preload: ' + err.message));
  win.webContents.on('did-frame-finish-load', async (e, isMain) => {
    try {
      await win.webContents.executeJavaScript(`(()=>{ if(window.__auditErr) return; window.__auditErr=[]; window.addEventListener('error',e=>window.__auditErr.push(String(e.message))); window.addEventListener('unhandledrejection',e=>window.__auditErr.push('rejection: '+String(e.reason&&e.reason.message||e.reason))); })()`, true).catch(()=>{});
    } catch {}
  });
  const pageErrors = async () => {
    const frames = win.webContents.mainFrame ? [win.webContents.mainFrame, ...win.webContents.mainFrame.frames] : [];
    const out = [];
    for (const frame of frames) {
      try {
        const errs = await frame.executeJavaScript('window.__auditErr || []');
        if (errs.length) out.push({url: frame.url, errs});
      } catch {}
    }
    return out;
  };
  const state = async label => {
    const s = await win.webContents.executeJavaScript(`(()=>{
      const de=document.documentElement;
      const active=document.querySelector('[data-stage].active')?.dataset.stage;
      const iframe=document.querySelector('#embedFrame');
      return {active, h1:document.querySelector('#stageBody h1')?.textContent||'', pageOverflow:de.scrollWidth-de.clientWidth,
        askbarGap:(()=>{const a=document.querySelector('.askbar')?.getBoundingClientRect(),f=document.querySelector('.foot')?.getBoundingClientRect();return a&&f?Math.round(f.top-a.bottom):null})(),
        iframe: iframe?{src:iframe.getAttribute('src'),w:iframe.clientWidth,h:iframe.clientHeight,doc:!!iframe.contentDocument,bodyClass:iframe.contentDocument?.body.className}:null,
        drawer: document.body.classList.contains('ask-open'), bible: document.querySelector('#bibleState')?.textContent||null};
    })()`);
    return {label, ...s, frameErrors: await pageErrors()};
  };
  const steps = [];
  const record = async label => { steps.push(await state(label)); };
  await win.loadURL('http://127.0.0.1:4181/pipeline.html?v=' + Date.now());
  await sleep(1800);
  await win.webContents.executeJavaScript("document.querySelector('[data-new]').click()");
  await sleep(1600);
  await record('story');
  // 编辑剧本
  await win.webContents.executeJavaScript("(()=>{const t=document.querySelector('#storyEditor');t.value='场景 1 · 雨夜庭院\\n\\n林舟穿过庭院。';t.dispatchEvent(new Event('input',{bubbles:true}));t.dispatchEvent(new Event('blur',{bubbles:true}));})()");
  await sleep(800);
  // 影片信息（旧 prompt）
  await win.webContents.executeJavaScript("document.querySelector('#editMeta').click()");
  await sleep(600);
  // 项目圣经
  await win.webContents.executeJavaScript("document.querySelector('#editBible').click()");
  await sleep(500);
  await win.webContents.executeJavaScript("document.querySelector('#bibleLogline').value='雨夜重逢'; document.querySelector('#saveBible').click()");
  await sleep(700);
  await record('story-bible');
  // 助手
  await win.webContents.executeJavaScript("document.querySelector('#askBtn').click()");
  await sleep(700);
  await record('story-drawer');
  await win.webContents.executeJavaScript("document.querySelector('[data-skill-mode=storyboard]').click()");
  await sleep(300);
  await win.webContents.executeJavaScript("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
  await sleep(500);
  // 分镜
  await win.webContents.executeJavaScript("document.querySelector('[data-stage=shots]').click()");
  await sleep(900);
  await record('shots');
  await win.webContents.executeJavaScript("document.querySelector('#addShotHint').click()");
  await sleep(600);
  const descSet = await win.webContents.executeJavaScript("(()=>{const i=document.querySelector('[data-shot-desc]');i.value='雨夜庭院，林舟停步';i.dispatchEvent(new Event('change',{bubbles:true}));return document.querySelectorAll('[data-shot]').length})()");
  await sleep(700);
  await record('shots-edited');
  // 资产空态
  await win.webContents.executeJavaScript("document.querySelector('[data-stage=assets]').click()");
  await sleep(900);
  await record('assets-empty');
  // 预演/生成/剪辑 iframe
  for (const stage of ['previz','generate','cut']) {
    await win.webContents.executeJavaScript(`document.querySelector('[data-stage=${stage}]').click()`);
    await sleep(6500);
    await record(stage);
  }
  await win.webContents.executeJavaScript("document.querySelector('[data-stage=story]').click()");
  await sleep(1600);
  await record('back-story');
  // 键盘 1-6
  for (const key of ['1','2','3','4','5','6']) {
    await win.webContents.executeJavaScript(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'${key}',bubbles:true}))`);
    await sleep(1200);
  }
  await record('after-keys');
  // 1024 溢出检查
  win.setContentSize(1024,768); await sleep(1500);
  const overflow = await win.webContents.executeJavaScript("document.documentElement.scrollWidth-document.documentElement.clientWidth");
  const frameErrors = await pageErrors();
  console.log('RESULT', JSON.stringify({steps, descSet, overflow1024:overflow, consoleErrors:errors.slice(0,40), frameErrors}, null, 1));
  fs.writeFileSync('/tmp/audit-result.json', JSON.stringify({steps, consoleErrors:errors, frameErrors}, null, 1));
  app.exit(0);
}).catch(e => { console.error('FATAL', e); app.exit(1); });
