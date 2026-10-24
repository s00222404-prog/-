export function ageOnDate(value, now = new Date()) {
  if (!value) return null;
  const iso = String(value).slice(0, 10);
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
    const verifiedAge = ageOnDate(verifiedBirthDate, now);
    return verifiedAge !== null && verifiedAge >= 18 ? 'adult' : 'restricted';
  }
  const age = ageOnDate(birthDate, now);
  return age !== null && age >= 14 && age <= 17 ? 'teen' : 'restricted';
}
