export function ageOnDate(value, now = new Date()) {
  if (!value) return null;
  // PostgreSQL drivers/configurations may return DATE columns as Date objects
  // instead of YYYY-MM-DD strings. Normalize both forms to the same UTC date.
  const iso = value instanceof Date && !Number.isNaN(value.getTime())
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;

  const [year, month, day] = iso.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) return null;

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (parsed > today) return null;

  let age = today.getUTCFullYear() - year;
  if (
    today.getUTCMonth() < month - 1 ||
    (today.getUTCMonth() === month - 1 && today.getUTCDate() < day)
  ) age--;
  return age;
}

export function ageBandForUser({ birthDate, verifiedBirthDate, verificationStatus }, now = new Date()) {
  if (verificationStatus === 'verified') {
    // A verified status grants adult routing only when the verified birth date
    // establishes adulthood. Invalid or under-18 verified dates stay restricted.
    const verifiedAge = ageOnDate(verifiedBirthDate, now);
    return verifiedAge !== null && verifiedAge >= 18 ? 'adult' : 'restricted';
  }

  // Self-declared dates may route users only into the teen band, never adult access.
  const declaredAge = ageOnDate(birthDate, now);
  return declaredAge !== null && declaredAge >= 14 && declaredAge <= 17
    ? 'teen'
    : 'restricted';
}
