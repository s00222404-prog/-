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
  const verified = verificationStatus === 'verified';
  // A self-declared adult birth date is not sufficient for adult-group access.
  // Unverified users may be routed to the 14–17 group only when their date is valid.
  const age = verified
    ? ageOnDate(verifiedBirthDate, now)
    : ageOnDate(birthDate, now);
  if (age === null || age < 14) return 'restricted';
  if (age <= 17) return 'teen';
  if (!verified) return 'restricted';
  return 'adult';
}
