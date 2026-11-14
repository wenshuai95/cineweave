import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateHost, allowedCorsOrigin, assertAllowedAssetUrl, assertUploadSize } from '../generation/security.mjs';

test('private host detection covers localhost and RFC1918', () => {
  assert.equal(isPrivateHost('127.0.0.1'), true);
  assert.equal(isPrivateHost('localhost'), true);
  assert.equal(isPrivateHost('192.168.3.27'), true);
  assert.equal(isPrivateHost('10.0.0.2'), true);
  assert.equal(isPrivateHost('172.20.1.2'), true);
  assert.equal(isPrivateHost('example.com'), false);
});

test('cors allows local origins and explicit allowlist only', () => {
  assert.equal(allowedCorsOrigin('http://127.0.0.1:5199'), 'http://127.0.0.1:5199');
  assert.equal(allowedCorsOrigin('https://example.com'), '');
  assert.equal(allowedCorsOrigin('https://example.com', 'https://example.com'), 'https://example.com');
  assert.equal(allowedCorsOrigin('file:///tmp/x'), '');
});

test('asset url allows local, comfy host and explicit hosts', () => {
  assert.equal(assertAllowedAssetUrl('/api/generation/assets/x.png'), '/api/generation/assets/x.png');
  assert.match(assertAllowedAssetUrl('http://192.168.3.27:8190/x.png'), /192\.168/);
  assert.match(assertAllowedAssetUrl('https://cdn.example.com/x.png', { extraHosts: 'cdn.example.com' }), /cdn/);
  assert.match(assertAllowedAssetUrl('http://comfy.local/x.png', { comfyBaseUrl: 'http://comfy.local:8188' }), /comfy\.local/);
  assert.throws(() => assertAllowedAssetUrl('https://evil.example.com/x'), /不被允许/);
  assert.throws(() => assertAllowedAssetUrl('file:///etc/passwd'), /http/);
});

test('upload size guard rejects empty and oversized payloads', () => {
  assert.equal(assertUploadSize(Buffer.from('abc')), 3);
  assert.throws(() => assertUploadSize(Buffer.alloc(0)), /为空/);
  assert.throws(() => assertUploadSize(Buffer.alloc(11), 10), /过大/);
});
