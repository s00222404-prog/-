const MAX_EVIDENCE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf']);
function signatureMatches(buffer, mime) {
  if (mime === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === 'image/png') return buffer.length >= 8 && buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (mime === 'image/webp') return buffer.length >= 12 && buffer.toString('ascii',0,4)==='RIFF' && buffer.toString('ascii',8,12)==='WEBP';
  if (mime === 'video/mp4') return buffer.length >= 12 && buffer.toString('ascii',4,8)==='ftyp';
  if (mime === 'video/webm') return buffer.length >= 4 && buffer.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
  if (mime === 'application/pdf') return buffer.length >= 5 && buffer.toString('ascii',0,5)==='%PDF-';
  return false;
}
export function validateReportEvidence(value) {
  if (typeof value !== 'string') return { valid: false, error: 'Evidence must be a data URL.' };
  if (value === '') return { valid: true, bytes: 0, mime: null };
  const match = value.match(/^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || !ALLOWED_MIME.has(match[1].toLowerCase())) return { valid: false, error: 'Evidence must be a supported image, video, or PDF.' };
  const mime = match[1].toLowerCase(), encoded = match[2];
  if (encoded.length % 4 !== 0) return { valid: false, error: 'Evidence contains invalid base64 data.' };
  const buffer = Buffer.from(encoded, 'base64');
  if (!buffer.length || buffer.length > MAX_EVIDENCE_BYTES) return { valid: false, error: 'Evidence must be no larger than 2 MiB.' };
  if (buffer.toString('base64') !== encoded || !signatureMatches(buffer, mime)) return { valid: false, error: 'Evidence content does not match its declared file type.' };
  return { valid: true, bytes: buffer.length, mime };
}
