import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReportEvidence } from './evidence-policy.js';

test('allows an empty optional evidence field', () => {
  assert.deepEqual(validateReportEvidence(''), { valid: true, bytes: 0, mime: null });
});

test('accepts an image data URL within the 2 MiB limit', () => {
  const data = Buffer.alloc(32, 7).toString('base64');
  assert.deepEqual(validateReportEvidence('data:image/png;base64,' + data), {
    valid: true, bytes: 32, mime: 'image/png'
  });
});

test('rejects unsupported MIME types and malformed data URLs', () => {
  assert.equal(validateReportEvidence('data:text/html;base64,SGVsbG8=').valid, false);
  assert.equal(validateReportEvidence('not-a-data-url').valid, false);
  assert.equal(validateReportEvidence('data:image/png;base64,%%%').valid, false);
});

test('rejects evidence larger than 2 MiB', () => {
  const data = Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64');
  assert.equal(validateReportEvidence('data:application/pdf;base64,' + data).valid, false);
});

test('rejects empty base64 payloads', () => {
  assert.equal(validateReportEvidence('data:image/png;base64,').valid, false);
});
