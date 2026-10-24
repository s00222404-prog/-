const MAX_EVIDENCE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = /^(image\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+|application\/pdf)$/i;

export function validateReportEvidence(value) {
  if (typeof value !== 'string') return { valid: false, error: 'Evidence must be a data URL.' };
  if (value === '') return { valid: true, bytes: 0, mime: null };
  const match = value.match(/^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/);
  if (!match || !ALLOWED_MIME.test(match[1])) {
    return { valid: false, error: 'Evidence must be a base64 image, video, or PDF.' };
  }
  const encoded = match[2];
  if (!encoded || encoded.length % 4 !== 0) {
    return { valid: false, error: 'Evidence contains invalid base64 data.' };
  }
  const bytes = Buffer.byteLength(encoded, 'base64');
  if (bytes === 0 || bytes > MAX_EVIDENCE_BYTES) {
    return { valid: false, error: 'Evidence must be no larger than 2 MiB.' };
  }
  return { valid: true, bytes, mime: match[1].toLowerCase() };
}
