import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { validateTelegramInitData } from './telegram.js';

const BOT_TOKEN = 'test-bot-token';

function signedInitData(fields, token = BOT_TOKEN) {
  const params = new URLSearchParams(fields);
  const checkString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = crypto.createHmac('sha256', secret).update(checkString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

function validFields(overrides = {}) {
  return {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'AAE-test-query',
    user: JSON.stringify({ id: 123456789, first_name: 'Vibe Tester', username: 'vibe_test' }),
    ...overrides,
  };
}

test('accepts valid, signed Telegram initData', () => {
  const data = signedInitData(validFields());
  assert.deepEqual(validateTelegramInitData(data, BOT_TOKEN), {
    id: '123456789',
    username: 'vibe_test',
    firstName: 'Vibe Tester',
    photoUrl: null,
  });
});

test('rejects a modified field after signing', () => {
  const data = new URLSearchParams(signedInitData(validFields()));
  data.set('query_id', 'tampered');
  assert.throws(() => validateTelegramInitData(data.toString(), BOT_TOKEN), /signature/i);
});

test('rejects duplicate parameters to avoid ambiguous identity data', () => {
  const signed = signedInitData(validFields());
  assert.throws(() => validateTelegramInitData(`${signed}&user=%7B%22id%22%3A999%2C%22first_name%22%3A%22Other%22%7D`, BOT_TOKEN), /duplicate/i);
});

test('rejects expired initData', () => {
  const data = signedInitData(validFields({ auth_date: String(Math.floor(Date.now() / 1000) - 120) }));
  assert.throws(() => validateTelegramInitData(data, BOT_TOKEN, 60), /expired/i);
});

test('rejects malformed user JSON', () => {
  const data = signedInitData(validFields({ user: '{not-json' }));
  assert.throws(() => validateTelegramInitData(data, BOT_TOKEN), /user/i);
});

test('rejects an invalid Telegram user id', () => {
  const data = signedInitData(validFields({ user: JSON.stringify({ id: -1, first_name: 'Test' }) }));
  assert.throws(() => validateTelegramInitData(data, BOT_TOKEN), /user/i);
});

test('rejects malformed signature hashes before comparing them', () => {
  const data = new URLSearchParams(signedInitData(validFields()));
  data.set('hash', 'not-a-hash');
  assert.throws(() => validateTelegramInitData(data.toString(), BOT_TOKEN), /invalid telegram initData/i);
});
