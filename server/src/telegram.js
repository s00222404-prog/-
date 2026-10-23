import crypto from 'node:crypto';

const TELEGRAM_HASH_PATTERN = /^[a-f0-9]{64}$/i;

export function validateTelegramInitData(initData, botToken, maxAgeSeconds = 86400) {
  if (typeof initData !== 'string' || !initData || typeof botToken !== 'string' || !botToken) {
    throw new Error('Telegram authentication is not configured');
  }
  if (!Number.isSafeInteger(maxAgeSeconds) || maxAgeSeconds < 0) {
    throw new TypeError('maxAgeSeconds must be a non-negative integer');
  }

  const params = new URLSearchParams(initData);
  const entries = [...params.entries()];
  const keys = new Set();
  for (const [key] of entries) {
    if (keys.has(key)) throw new Error('Duplicate Telegram initData field');
    keys.add(key);
  }

  const hash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  if (!hash || !TELEGRAM_HASH_PATTERN.test(hash) || !Number.isSafeInteger(authDate)) {
    throw new Error('Invalid Telegram initData');
  }

  const now = Math.floor(Date.now() / 1000);
  if (authDate > now + 60 || now - authDate > maxAgeSeconds) {
    throw new Error('Expired Telegram initData');
  }

  const checkString = entries
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(checkString).digest();
  const suppliedHash = Buffer.from(hash, 'hex');
  if (calculatedHash.length !== suppliedHash.length || !crypto.timingSafeEqual(calculatedHash, suppliedHash)) {
    throw new Error('Invalid Telegram signature');
  }

  const userRaw = params.get('user');
  if (!userRaw) throw new Error('Telegram user is missing');

  let user;
  try {
    user = JSON.parse(userRaw);
  } catch {
    throw new Error('Invalid Telegram user');
  }

  if (
    !user ||
    !Number.isSafeInteger(Number(user.id)) ||
    Number(user.id) <= 0 ||
    typeof user.first_name !== 'string' ||
    !user.first_name.trim()
  ) {
    throw new Error('Invalid Telegram user');
  }

  return {
    id: String(user.id),
    username: typeof user.username === 'string' ? user.username : null,
    firstName: user.first_name,
    photoUrl: typeof user.photo_url === 'string' ? user.photo_url : null,
  };
}
