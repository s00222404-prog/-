import test from 'node:test';
import assert from 'node:assert/strict';
import { ageOnDate } from './age-policy.js';

test('calculates age using the exact calendar birthday', () => {
  assert.equal(ageOnDate('2012-10-24', new Date('2026-10-24T12:00:00Z')), 14);
  assert.equal(ageOnDate('2012-10-25', new Date('2026-10-24T12:00:00Z')), 13);
  assert.equal(ageOnDate('2008-10-23', new Date('2026-10-24T00:01:00Z')), 18);
});

test('rejects malformed, impossible, and future dates', () => {
  const now = new Date('2026-10-24T12:00:00Z');
  assert.equal(ageOnDate('', now), null);
  assert.equal(ageOnDate('not-a-date', now), null);
  assert.equal(ageOnDate('2020-02-30', now), null);
  assert.equal(ageOnDate('2027-01-01', now), null);
});

test('does not shift a birth date because of local timezone', () => {
  assert.equal(ageOnDate('2000-10-24', new Date('2026-10-24T00:05:00Z')), 26);
});
