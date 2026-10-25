const MAX_LISTING_MEDIA_BYTES = 3 * 1024 * 1024;
const ALLOWED_MEDIA = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']);

export function validateListingMedia(value, mediaType = 'image', maxBytes = MAX_LISTING_MEDIA_BYTES) {
  if (!['image', 'video'].includes(mediaType)) {
    return { valid: false, error: 'Unsupported media type.' };
  }
  if (value === null || value === undefined || value === '') {
    return { valid: true, mime: null, bytes: 0 };
  }
  if (typeof value !== 'string') {
    return { valid: false, error: 'Media must be a data URL.' };
  }

  const match = value.match(/^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || !ALLOWED_MEDIA.has(match[1].toLowerCase())) {
    return { valid: false, error: 'Media must be a base64 image or video.' };
  }
  if ((mediaType === 'image' && !match[1].startsWith('image/')) ||
      (mediaType === 'video' && !match[1].startsWith('video/'))) {
    return { valid: false, error: 'Media type does not match the selected type.' };
  }

  const encoded = match[2];
  if (encoded.length % 4 !== 0) {
    return { valid: false, error: 'Media contains invalid base64 data.' };
  }
  const bytes = Buffer.byteLength(encoded, 'base64');
  if (bytes === 0 || bytes > maxBytes) {
    return { valid: false, error: `Media must be no larger than ${Math.round(maxBytes / (1024 * 1024))} MiB.` };
  }

  return { valid: true, mime: match[1].toLowerCase(), bytes };
}
