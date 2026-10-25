import test from 'node:test';
import assert from 'node:assert/strict';
import { isDeveloperEmail } from './developer-email-policy.js';

test('matches only exact allowlisted email addresses, case-insensitively', () => {
  assert.equal(isDeveloperEmail('Dev@Example.com', 'dev@example.com, admin@example.com'), true);
  assert.equal(isDeveloperEmail('admin@example.com', 'dev@example.com, admin@example.com'), true);
  assert.equal(isDeveloperEmail('notdev@example.com', 'dev@example.com'), false);
  assert.equal(isDeveloperEmail('dev@example.com.attacker.test', 'dev@example.com'), false);
});

test('ignores empty and non-string identities', () => {
  assert.equal(isDeveloperEmail('', 'dev@example.com'), false);
  assert.equal(isDeveloperEmail(null, 'dev@example.com'), false);
  assert.equal(isDeveloperEmail('dev@example.com', ' ,  , '), false);
});
