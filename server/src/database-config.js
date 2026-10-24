export function databasePoolOptions(env = process.env) {
  if (typeof env.DATABASE_URL !== 'string' || !env.DATABASE_URL.trim()) {
    throw new Error('DATABASE_URL is required to start VIBE API');
  }

  const rawMax = env.DATABASE_POOL_MAX ?? '10';
  const max = Number(rawMax);
  if (!Number.isInteger(max) || max < 1 || max > 50) {
    throw new Error('DATABASE_POOL_MAX must be an integer between 1 and 50');
  }

  return {
    connectionString: env.DATABASE_URL,
    ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  };
}
