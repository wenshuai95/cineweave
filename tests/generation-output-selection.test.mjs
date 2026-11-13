import test from 'node:test';
import assert from 'node:assert/strict';
import { pickVideoOutput } from '../generation/server.mjs';

test('prefers SaveVideo output over LoadVideo input', () => {
  const outputs = [
    { nodeId: '1', type: 'input', filename: 'source.mp4', isVideo: true },
    { nodeId: '9', type: 'output', filename: 'RelayVSR_x2_00001_.mp4', isVideo: true },
  ];
  assert.equal(pickVideoOutput(outputs).nodeId, '9');
});

test('falls back to non-input video and ignores audio-only outputs', () => {
  assert.equal(pickVideoOutput([{ type: 'input', isVideo: true, filename: 'in.mp4' }, { type: 'output', isVideo: false, filename: 'a.aac' }]), null);
  assert.equal(pickVideoOutput([{ type: 'temp', isVideo: true, filename: 'x.mp4' }]).filename, 'x.mp4');
});
