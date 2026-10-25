import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/lib/api.js';

const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
});

test('rejects requests when the API base URL is missing', async () => {
  const request = createApiClient({ baseUrl: '' });
  await assert.rejects(request('/api/me'), /VITE_API_URL/);
});

test('returns parsed JSON and sends the Telegram init data header', async () => {
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return { ok: true, status: 200, json: async () => ({ user: { id: 'u1' } }) };
  };

  const request = createApiClient({
    baseUrl: 'https://api.example.test/',
    getInitData: () => 'telegram-init-data',
  });
  const result = await request('/api/me');

  assert.deepEqual(result, { user: { id: 'u1' } });
  assert.equal(captured.url, 'https://api.example.test/api/me');
  assert.equal(captured.options.headers['X-Telegram-Init-Data'], 'telegram-init-data');
});

test('uses the saved session token when Telegram init data is absent', async () => {
  let capturedHeaders;
  globalThis.localStorage = { getItem: (key) => key === 'vibe-session' ? 'session-token' : null };
  globalThis.fetch = async (_url, options) => {
    capturedHeaders = options.headers;
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };

  const request = createApiClient({ baseUrl: 'https://api.example.test' });
  await request('/api/me');
  assert.equal(capturedHeaders.Authorization, 'Bearer session-token');
});

test('preserves server status and payload on HTTP errors', async () => {
  globalThis.fetch = async () => ({
    ok: false,
    status: 403,
    json: async () => ({ error: 'Access denied', reason: 'blocked' }),
  });

  const request = createApiClient({ baseUrl: 'https://api.example.test' });
  await assert.rejects(request('/api/me'), (error) => {
    assert.equal(error.message, 'Access denied');
    assert.equal(error.status, 403);
    assert.deepEqual(error.data, { error: 'Access denied', reason: 'blocked' });
    return true;
  });
});

test('normalizes network failures into a user-readable message', async () => {
  globalThis.fetch = async () => { throw new TypeError('socket failed'); };
  const request = createApiClient({ baseUrl: 'https://api.example.test' });
  await assert.rejects(request('/api/me'), /Проверь интернет/);
});
