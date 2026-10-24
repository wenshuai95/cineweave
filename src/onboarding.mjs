import {t} from './i18n/index.mjs';

export const ONBOARDING_KEY = 'cineweave.onboarding.v1';

export function shouldShowOnboarding(storage = globalThis.localStorage) {
  try { return storage?.getItem?.(ONBOARDING_KEY) !== 'done'; } catch { return true; }
}

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** First-run setup: connect local ComfyUI and cloud providers before creating a project. */
export function openOnboarding({modal, closeModal, api, toast, onDone} = {}) {
  let step = 0;
  let comfyUrl = 'http://127.0.0.1:8188';
  let comfyResult = null;
  let imageStatus = null;
  let imageMode = 'agent-plan';
  let imageModel = 'doubao-seedream-5.0-flash';
  let videoStatus = null;

  const finish = () => {
    try { globalThis.localStorage?.setItem?.(ONBOARDING_KEY, 'done'); } catch {}
    closeModal();
    onDone?.();
  };
  const next = () => { step = Math.min(4, step + 1); render(); };
  const back = () => { step = Math.max(0, step - 1); render(); };
  const skip = () => { if (step >= 4) finish(); else next(); };

  async function saveComfy() {
    try {
      const url = document.querySelector('#obComfyUrl')?.value?.trim() || comfyUrl;
      if (url && url !== comfyUrl) {
        const saved = await api('/api/comfy/config', {baseUrl: url});
        comfyUrl = saved.status?.baseUrl || url;
      }
      comfyResult = await api('/api/comfy/status');
      if (!comfyResult.ok) throw Error(comfyResult.error || t('onboarding.notDetected'));
      const models = await api('/api/comfy/models');
      comfyResult.models = (models.models || []).map(m => m.id);
      render();
    } catch (e) {
      comfyResult = {ok: false, error: e.message};
      render();
    }
  }

  async function saveImage() {
    const key = document.querySelector('#obCloudKey')?.value?.trim() || '';
    try {
      imageStatus = await api('/api/providers/config', {apiKey: key, mode: document.querySelector('#obCloudMode')?.value || imageMode, model: document.querySelector('#obCloudModel')?.value?.trim() || imageModel});
      imageMode = imageStatus.config?.seedream?.mode || imageMode;
      imageModel = imageStatus.config?.seedream?.model || imageModel;
      render();
    } catch (e) {
      toast?.(e.message);
    }
  }

  async function saveVideo() {
    const payload = {
      accessKey: document.querySelector('#obKlingAccess')?.value?.trim() || '',
      secretKey: document.querySelector('#obKlingSecret')?.value?.trim() || '',
      enabled: !!document.querySelector('#obKlingEnabled')?.checked,
    };
    try {
      if (globalThis.window?.directorDesktop?.saveProviderSecrets) await globalThis.window.directorDesktop.saveProviderSecrets({kling: payload});
      else await api('/api/video/kling/config', {...payload, persist: true});
      videoStatus = await api('/api/video/kling/config');
      render();
    } catch (e) {
      toast?.(e.message);
    }
  }

  function welcomeBody() {
    return `<section class="settings-section"><p>${t('onboarding.welcomeText')}</p><ul class="help-text"><li>${t('onboarding.comfyStep')}</li><li>${t('onboarding.cloudStep')}</li><li>${t('onboarding.videoStep')}</li></ul><p class="help-text">${t('onboarding.localOnly')}</p></section>`;
  }
  function comfyBody() {
    const status = comfyResult ? (comfyResult.ok
      ? `<p class="help-text" style="color:var(--success,#3ecf8e)">${t('onboarding.detected', {version: comfyResult.version || ''})}${comfyResult.models?.length ? ` · ${comfyResult.models.length} checkpoint(s): ${esc(comfyResult.models.slice(0, 3).join(', '))}` : ''}</p>`
      : `<p class="help-text" style="color:var(--danger,#ff6b6b)">${t('onboarding.notDetected')} ${esc(comfyResult.error || '')}</p>`) : '';
    return `<section class="settings-section"><p>${t('onboarding.comfyHelp')}</p><label class="field">${t('onboarding.address')}<input id="obComfyUrl" value="${esc(comfyUrl)}" placeholder="http://127.0.0.1:8188"></label><div class="row"><button id="obComfyDetect">${t('onboarding.detect')}</button><span class="help-text">${t('onboarding.comfyHint')}</span></div>${status}<p class="help-text">${t('onboarding.comfyStartHint')}</p></section>`;
  }
  function imageBody() {
    const configured = imageStatus?.config?.seedream;
    return `<section class="settings-section"><p>${t('onboarding.cloudHelp')}</p>${configured?.configured ? `<p class="help-text">${t('onboarding.cloudConfigured')} · ${esc(configured.mode)} · ${esc(configured.model)}</p>` : ''}<label class="field">${t('onboarding.mode')}<select id="obCloudMode"><option value="agent-plan" ${imageMode === 'agent-plan' ? 'selected' : ''}>${t('onboarding.modeAgent')}</option><option value="ark" ${imageMode === 'ark' ? 'selected' : ''}>${t('onboarding.modeArk')}</option></select></label><label class="field">${t('onboarding.apiKey')}<input id="obCloudKey" type="password" autocomplete="off" placeholder="${t('onboarding.keyPlaceholder')}"></label><label class="field">${t('onboarding.model')}<input id="obCloudModel" value="${esc(imageModel)}"></label><div class="row"><button id="obCloudSave">${t('onboarding.save')}</button><span class="help-text">${t('onboarding.cloudLater')}</span></div></section>`;
  }
  function videoBody() {
    const configured = videoStatus?.config;
    return `<section class="settings-section"><p>${t('onboarding.videoHelp')}</p>${configured?.configured ? `<p class="help-text">${t('onboarding.videoConfigured')} · ${t('onboarding.ending')} ${esc(configured.accessKeyHint || '')}</p>` : ''}<label class="field">${t('onboarding.accessKey')}<input id="obKlingAccess" type="password" autocomplete="off" placeholder="${t('onboarding.keyPlaceholder')}"></label><label class="field">${t('onboarding.secretKey')}<input id="obKlingSecret" type="password" autocomplete="off" placeholder="${t('onboarding.keyPlaceholder')}"></label><label class="field ws-check-field"><input id="obKlingEnabled" type="checkbox"> ${t('onboarding.enableVideo')}</label><div class="row"><button id="obVideoSave">${t('onboarding.save')}</button><span class="help-text">${t('onboarding.videoLater')}</span></div></section>`;
  }
  function doneBody() {
    return `<section class="settings-section"><p>${t('onboarding.doneText')}</p><ul class="help-text"><li>${t('onboarding.doneLocal')}</li><li>${t('onboarding.doneCloud')}</li><li>${t('onboarding.doneVideo')}</li></ul><p class="help-text">${t('onboarding.reopen')}</p></section>`;
  }

  function render() {
    const titles = [t('onboarding.welcomeTitle'), t('onboarding.comfyTitle'), t('onboarding.cloudTitle'), t('onboarding.videoTitle'), t('onboarding.doneTitle')];
    const subtitles = [t('onboarding.welcomeSubtitle'), t('onboarding.comfySubtitle'), t('onboarding.cloudSubtitle'), t('onboarding.videoSubtitle'), t('onboarding.doneSubtitle')];
    const bodies = [welcomeBody(), comfyBody(), imageBody(), videoBody(), doneBody()];
    const actions = step === 0
      ? `<button id="obSkip">${t('onboarding.skip')}</button><button id="obNext" class="primary">${t('onboarding.start')}</button>`
      : step === 4
        ? `<button id="obFinish" class="primary">${t('onboarding.openProjects')}</button>`
        : `<button id="obBack">${t('onboarding.back')}</button><button id="obSkip">${t('onboarding.skip')}</button><button id="obNext" class="primary">${t('onboarding.next')}</button>`;
    modal(`${t('onboarding.title')} · ${step + 1}/5`, subtitles[step], `<div class="onboarding"><p class="help-text">${titles[step]}</p>${bodies[step]}</div>`, actions);
    document.querySelector('#obSkip')?.addEventListener('click', skip);
    document.querySelector('#obBack')?.addEventListener('click', back);
    document.querySelector('#obNext')?.addEventListener('click', async () => {
      if (step === 1 && !comfyResult) await saveComfy();
      next();
    });
    document.querySelector('#obFinish')?.addEventListener('click', finish);
    document.querySelector('#obComfyDetect')?.addEventListener('click', saveComfy);
    document.querySelector('#obCloudSave')?.addEventListener('click', saveImage);
    document.querySelector('#obVideoSave')?.addEventListener('click', saveVideo);
    if (step === 1 && !comfyResult) {
      comfyUrl = document.querySelector('#obComfyUrl')?.value || comfyUrl;
    }
  }

  // Load existing status before showing later steps.
  Promise.allSettled([
    api('/api/providers/config').then(r => { imageStatus = r; imageMode = r.config?.seedream?.mode || imageMode; imageModel = r.config?.seedream?.model || imageModel; }),
    api('/api/video/kling/config').then(r => { videoStatus = r; }),
  ]).then(render);
  render();
}
