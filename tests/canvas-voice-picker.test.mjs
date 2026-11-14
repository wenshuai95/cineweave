import test from 'node:test';
import assert from 'node:assert/strict';
import { voiceListHtml, createVoicePicker } from '../src/canvas/voice-picker.mjs';

test('voice list marks current voice and escapes', () => {
  const html = voiceListHtml([{ voiceName: '<小明>', tags: { gender: '男', age: '青年' } }, { voiceName: '小红', voiceId: 'v2' }], '小红');
  assert.match(html, /&lt;小明&gt;/);
  assert.match(html, /男 · 青年/);
  assert.match(html, /cv-voice-item active/);
});

test('picker loads voices once and applies selection', async () => {
  const app = { querySelector: () => ({ innerHTML: '', classList: { add() {}, remove() {} }, querySelectorAll: () => [] }) };
  let calls = 0;
  const picker = createVoicePicker({
    app,
    getNode: () => ({ id: 'n1', generation: {} }),
    listVoices: async () => { calls += 1; return [{ voiceName: '小明', voiceId: 'v1' }]; },
  });
  await picker.open('n1');
  await picker.open('n1');
  assert.equal(calls, 1);
});
