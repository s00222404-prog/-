const MAX_LISTING_MEDIA_BYTES = 3 * 1024 * 1024;
const ALLOWED_MEDIA = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']);
function signatureMatches(buffer, mime) {
  if (mime === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (mime === 'image/webp') return buffer.length >= 12 && buffer.toString('ascii',0,4) === 'RIFF' && buffer.toString('ascii',8,12) === 'WEBP';
  if (mime === 'video/mp4') return buffer.length >= 12 && buffer.toString('ascii',4,8) === 'ftyp';
  if (mime === 'video/webm') return buffer.length >= 4 && buffer.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
  return false;
}
export function validateListingMedia(value, mediaType = 'image', maxBytes = MAX_LISTING_MEDIA_BYTES) {
  if (!['image', 'video'].includes(mediaType)) return { valid: false, error: 'Unsupported media type.' };
  if (value === null || value === undefined || value === '') return { valid: true, mime: null, bytes: 0 };
  if (typeof value !== 'string') return { valid: false, error: 'Media must be a data URL.' };
  const match = value.match(/^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || !ALLOWED_MEDIA.has(match[1].toLowerCase())) return { valid: false, error: 'Media must be a supported base64 image or video.' };
  const mime = match[1].toLowerCase();
  if ((mediaType === 'image' && !mime.startsWith('image/')) || (mediaType === 'video' && !mime.startsWith('video/'))) return { valid: false, error: 'Media type does not match the selected type.' };
  const encoded = match[2];
  if (encoded.length % 4 !== 0) return { valid: false, error: 'Media contains invalid base64 data.' };
  const buffer = Buffer.from(encoded, 'base64');
  if (!buffer.length || buffer.length > maxBytes) return { valid: false, error: `Media must be no larger than ${Math.round(maxBytes / (1024 * 1024))} MiB.` };
  if (buffer.toString('base64') !== encoded || !signatureMatches(buffer, mime)) return { valid: false, error: 'Media content does not match its declared file type.' };
  return { valid: true, mime, bytes: buffer.length };
}
