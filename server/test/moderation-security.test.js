import test from 'node:test';
import assert from 'node:assert/strict';
import { validateListingMedia } from '../src/moderation/media-policy.js';
import { validateReportEvidence } from '../src/moderation/evidence-policy.js';
import { databasePoolOptions } from '../src/database-config.js';
import { profileTextProblem } from '../src/moderation/text-policy.js';

const dataUrl = (mime, bytes) => 'data:' + mime + ';base64,' + Buffer.from(bytes).toString('base64');

test('listing media accepts supported MIME with matching file signature', () => {
  assert.equal(validateListingMedia(dataUrl('image/jpeg', [0xff,0xd8,0xff]), 'image').valid, true);
  assert.equal(validateListingMedia(dataUrl('image/png', [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), 'image').valid, true);
  assert.equal(validateListingMedia(dataUrl('video/mp4', [0,0,0,12,0x66,0x74,0x79,0x70,0,0,0,0]), 'video').valid, true);
});

test('listing media rejects a MIME spoof and malformed base64', () => {
  assert.equal(validateListingMedia(dataUrl('image/jpeg', 'not an image'), 'image').valid, false);
  assert.equal(validateListingMedia('data:image/jpeg;base64,not-base64!', 'image').valid, false);
});

test('report evidence accepts real PDF signature and rejects a spoof', () => {
  assert.equal(validateReportEvidence(dataUrl('application/pdf', '%PDF-1.7')).valid, true);
  assert.equal(validateReportEvidence(dataUrl('application/pdf', 'hello')).valid, false);
});

test('production PostgreSQL config explicitly verifies TLS and strips conflicting sslmode URL options', () => {
  const options = databasePoolOptions({DATABASE_URL:'postgres://user:pass@example.com:5432/vibe?sslmode=prefer',NODE_ENV:'production'});
  assert.deepEqual(options.ssl, {rejectUnauthorized:true});
  assert.equal(new URL(options.connectionString).searchParams.has('sslmode'), false);
});

test('database config rejects invalid pool sizes', () => {
  assert.throws(() => databasePoolOptions({DATABASE_URL:'postgres://localhost/vibe',DATABASE_POOL_MAX:'0'}), /DATABASE_POOL_MAX/);
});

test('profile text policy catches punctuation-obfuscated prohibited terms without matching common substrings', () => {
  assert.equal(profileTextProblem(['s.e.x']), true);
  assert.equal(profileTextProblem(['grape']), false);
  assert.equal(profileTextProblem(['Essex']), false);
});
