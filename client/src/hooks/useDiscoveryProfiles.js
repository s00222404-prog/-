import { useMemo } from 'react';

/**
 * Derives discovery results from the current server-provided profile list.
 * Age-group eligibility remains enforced by the API; this hook only handles
 * presentation filters and never widens the server's result set.
 */
export function useDiscoveryProfiles(people, search, cityFilter) {
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    return people.filter((person) => {
      const searchable = [
        person.name,
        person.city,
        person.country,
        person.description,
        person.hobbies,
        ...(Array.isArray(person.interests) ? person.interests : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase();

      return (!query || searchable.includes(query))
        && (!cityFilter || person.city?.toLocaleLowerCase() === cityFilter.toLocaleLowerCase());
    });
  }, [people, search, cityFilter]);

  const cities = useMemo(
    () => [...new Set(people.map((person) => person.city).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b)),
    [people],
  );

  const popularInterests = useMemo(() => {
    const counts = new Map();

    people.forEach((person) => {
      const interests = Array.isArray(person.interests) ? person.interests : [];
      interests.forEach((rawInterest) => {
        const interest = String(rawInterest || '').trim();
        if (interest) counts.set(interest, (counts.get(interest) || 0) + 1);
      });
    });

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8);
  }, [people]);

  return { filtered, cities, popularInterests };
}
