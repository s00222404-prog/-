import test from 'node:test';
import assert from 'node:assert/strict';
import { databasePoolOptions } from './database-config.js';

test('requires a database URL', () => {
  assert.throws(() => databasePoolOptions({}), /DATABASE_URL is required/);
  assert.throws(() => databasePoolOptions({ DATABASE_URL: '  ' }), /DATABASE_URL is required/);
});

test('uses bounded pool settings and validates TLS in production', () => {
  const options = databasePoolOptions({
    DATABASE_URL: 'postgres://example.invalid/vibe',
    NODE_ENV: 'production',
    DATABASE_POOL_MAX: '7'
  });
  assert.equal(options.connectionString, 'postgres://example.invalid/vibe');
  assert.deepEqual(options.ssl, { rejectUnauthorized: true });
  assert.equal(options.max, 7);
  assert.equal(options.connectionTimeoutMillis, 10_000);
  assert.equal(options.idleTimeoutMillis, 30_000);
});

test('uses a safe default pool size outside production', () => {
  const options = databasePoolOptions({ DATABASE_URL: 'postgres://localhost/vibe' });
  assert.equal(options.max, 10);
  assert.equal(options.ssl, undefined);
});

test('rejects invalid pool sizes instead of passing NaN to pg', () => {
  for (const value of ['0', '-1', '1.5', 'NaN', '51', 'abc']) {
    assert.throws(
      () => databasePoolOptions({ DATABASE_URL: 'postgres://localhost/vibe', DATABASE_POOL_MAX: value }),
      /DATABASE_POOL_MAX must be an integer/
    );
  }
});
