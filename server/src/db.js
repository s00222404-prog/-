import 'dotenv/config';
import pg from 'pg';
import { databasePoolOptions } from './database-config.js';

// One shared pool for the API. Do not create a new pool per request.
const { Pool } = pg;
export const pool = new Pool(databasePoolOptions());

pool.on('error', (error) => {
  // Idle-client errors are otherwise easy to miss and can precede failed requests.
  console.error('VIBE PostgreSQL pool error:', error.message);
});
