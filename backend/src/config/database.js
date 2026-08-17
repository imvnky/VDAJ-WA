/**
 * VDAJ Services — Database Connection Pool (PostgreSQL)
 * Multi-tenant aware. Pooled via pg.Pool for MNC-scale concurrency.
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  logger.debug('PostgreSQL pool — new client connected');
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', { error: err.message });
  process.exit(1);
});

/**
 * Executes a parameterized SQL query.
 * @param {string} text - SQL query string with $1, $2... placeholders
 * @param {Array} params - Query parameters
 * @returns {Promise<QueryResult>}
 */
const query = (text, params) => pool.query(text, params);

/**
 * Get a dedicated client from the pool (for transactions).
 * IMPORTANT: Always call client.release() in finally block.
 */
const getClient = () => pool.connect();

/**
 * Run a function inside a transaction. Auto-commits on success, rolls back on error.
 * @param {Function} fn - Async function receiving (client) as argument
 */
const withTransaction = async (fn) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { query, getClient, withTransaction, pool };
