export function databasePoolOptions(env = process.env) {
  if (typeof env.DATABASE_URL !== 'string' || !env.DATABASE_URL.trim()) {
    throw new Error('DATABASE_URL is required to start VIBE API');
  }

  const rawMax = env.DATABASE_POOL_MAX ?? '10';
  const max = Number(rawMax);
  if (!Number.isInteger(max) || max < 1 || max > 50) {
    throw new Error('DATABASE_POOL_MAX must be an integer between 1 and 50');
  }

  let connectionString = env.DATABASE_URL;
  if (env.NODE_ENV === 'production') {
    // Keep TLS validation explicit; avoid URL sslmode options overriding the driver setting.
    try {
      const parsed = new URL(connectionString);
      for (const key of ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert']) parsed.searchParams.delete(key);
      connectionString = parsed.toString();
    } catch {
      throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL');
    }
  }

  return {
    connectionString,
    ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  };
}
