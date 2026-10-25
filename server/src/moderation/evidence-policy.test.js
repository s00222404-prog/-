import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReportEvidence } from './evidence-policy.js';

test('allows an empty optional evidence field', () => {
  assert.deepEqual(validateReportEvidence(''), { valid: true, bytes: 0, mime: null });
});

test('accepts an image data URL within the 2 MiB limit', () => {
  const data = Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), Buffer.alloc(24, 7)]).toString('base64');
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


test('rejects a valid signature when the declared MIME type is different', () => {
  const jpeg = Buffer.from([255, 216, 255, 0]).toString('base64');
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]).toString('base64');
  assert.equal(validateReportEvidence('data:image/jpeg;base64,' + jpeg).valid, true);
  assert.equal(validateReportEvidence('data:application/pdf;base64,' + jpeg).valid, false);
  assert.equal(validateReportEvidence('data:image/png;base64,' + png).valid, true);
  assert.equal(validateReportEvidence('data:image/jpeg;base64,' + png).valid, false);
});

test('rejects non-canonical base64 and unexpected data URL parameters', () => {
  assert.equal(validateReportEvidence('data:image/png;base64,SGVsbG8_').valid, false);
  assert.equal(validateReportEvidence('data:image/png;charset=utf-8;base64,SGVsbG8=').valid, false);
});
