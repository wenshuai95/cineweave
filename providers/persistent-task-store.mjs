import {mkdir, readFile, writeFile, chmod, rename} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createTaskStore} from './task-store.mjs';

/** Task store with debounced 0600 JSON persistence and startup hydration. */
export function createPersistentTaskStore({file, now = Date.now, idFactory} = {}) {
  let timer = null;
  let writing = Promise.resolve();
  const store = createTaskStore({now, idFactory, onChange: () => schedule()});
  const schedule = () => {
    if (!file || timer) return;
    timer = setTimeout(() => { timer = null; writing = writing.catch(() => {}).then(save); }, 120);
  };
  async function save() {
    if (!file) return;
    await mkdir(dirname(file), {recursive: true, mode: 0o700});
    const temp = join(dirname(file), `.tasks-${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify(store.snapshot()), {mode: 0o600});
    await chmod(temp, 0o600);
    await rename(temp, file);
  }
  const ready = (async () => {
    if (!file) return;
    try {
      const rows = JSON.parse(await readFile(file, 'utf8'));
      if (Array.isArray(rows)) store.hydrate(rows);
    } catch {}
  })();
  return {
    ...store,
    ready,
    async flush() {
      if (timer) { clearTimeout(timer); timer = null; }
      writing = writing.catch(() => {}).then(save);
      await writing;
    },
  };
}
