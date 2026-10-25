/**
 * Server-only allowlist for granting developer test access to Supabase OTP accounts.
 * Configure VIBE_DEVELOPER_EMAILS on the API service (comma-separated verified email
 * addresses). Never expose this value as a VITE_* client environment variable.
 */
export function isDeveloperEmail(email, allowlist = process.env.VIBE_DEVELOPER_EMAILS || '') {
  if (typeof email !== 'string') return false;
  const candidate = email.trim().toLowerCase();
  if (!candidate) return false;
  return String(allowlist)
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(candidate);
}
