import crypto from 'node:crypto';

export function validateTelegramInitData(initData, botToken, maxAgeSeconds = 86400) {
  if (!initData || !botToken) throw new Error('Telegram authentication is not configured');
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  if (!hash || !Number.isFinite(authDate)) throw new Error('Invalid Telegram initData');
  const now = Math.floor(Date.now() / 1000);
  if (authDate > now + 60 || now - authDate > maxAgeSeconds) throw new Error('Expired Telegram initData');

  const checkString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculated = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
  const a = Buffer.from(calculated, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('Invalid Telegram signature');

  const userRaw = params.get('user');
  if (!userRaw) throw new Error('Telegram user is missing');
  const user = JSON.parse(userRaw);
  if (!user.id || !user.first_name) throw new Error('Invalid Telegram user');
  return { id: String(user.id), username: user.username ?? null, firstName: user.first_name, photoUrl: user.photo_url ?? null };
}
