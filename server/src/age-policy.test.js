import test from 'node:test';
import assert from 'node:assert/strict';
import { ageOnDate, ageBandForUser } from './age-policy.js';

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


test('verified adult age overrides a conflicting self-reported teen birth date', () => {
  assert.equal(ageBandForUser({
    birthDate: '2012-10-24',
    verifiedBirthDate: '2000-10-24',
    verificationStatus: 'verified'
  }, new Date('2026-10-24T12:00:00Z')), 'adult');
});

test('a verified status without a valid adult birth date never grants adult access', () => {
  assert.equal(ageBandForUser({
    birthDate: '2010-01-01',
    verifiedBirthDate: '2010-01-01',
    verificationStatus: 'verified'
  }, new Date('2026-10-24T12:00:00Z')), 'restricted');
});

test('unverified users are classified as teens only from a valid 14–17 birth date', () => {
  const now = new Date('2026-10-24T12:00:00Z');
  assert.equal(ageBandForUser({ birthDate: '2012-10-24', verificationStatus: 'pending' }, now), 'teen');
  assert.equal(ageBandForUser({ birthDate: '2013-10-24', verificationStatus: 'pending' }, now), 'restricted');
  assert.equal(ageBandForUser({ birthDate: '2000-10-24', verificationStatus: 'pending' }, now), 'restricted');
});
