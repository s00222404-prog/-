import pg from 'pg';

// Keep database construction in one module so the API and background jobs can
// share one pool configuration instead of opening ad-hoc connections.
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to start VIBE API');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : undefined,
  max: Number.parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (error) => {
  // Idle-client errors are otherwise easy to miss and can precede failed requests.
  console.error('VIBE PostgreSQL pool error:', error.message);
});
