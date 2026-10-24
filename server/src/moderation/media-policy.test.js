import test from 'node:test';
import assert from 'node:assert/strict';
import { validateListingMedia } from './media-policy.js';

test('allows no optional media', () => {
  assert.equal(validateListingMedia(null).valid, true);
  assert.equal(validateListingMedia('').valid, true);
});

test('accepts valid base64 image and video with matching selected type', () => {
  assert.equal(validateListingMedia('data:image/png;base64,aGVsbG8=', 'image').valid, true);
  assert.equal(validateListingMedia('data:video/mp4;base64,aGVsbG8=', 'video').valid, true);
});

test('rejects mismatched media type and malformed data URLs', () => {
  assert.equal(validateListingMedia('data:video/mp4;base64,aGVsbG8=', 'image').valid, false);
  assert.equal(validateListingMedia('data:image/png,hello', 'image').valid, false);
  assert.equal(validateListingMedia('data:text/html;base64,aGVsbG8=', 'image').valid, false);
  assert.equal(validateListingMedia('data:image/png;base64,***', 'image').valid, false);
});

test('rejects empty encoded data and payloads larger than 3 MiB', () => {
  assert.equal(validateListingMedia('data:image/png;base64,', 'image').valid, false);
  const oversized = Buffer.alloc(3 * 1024 * 1024 + 1).toString('base64');
  assert.equal(validateListingMedia('data:image/png;base64,' + oversized, 'image').valid, false);
});

test('rejects unsupported selected media types', () => {
  assert.equal(validateListingMedia('data:image/png;base64,aGVsbG8=', 'audio').valid, false);
});
