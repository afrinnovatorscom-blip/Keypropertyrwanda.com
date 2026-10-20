import mysql from 'mysql2';
import config from './environment.js';

const baseOptions = {
  host: config.DB_HOST,
  port: config.DB_PORT,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  // All DATETIME values are stored and read as UTC.
  timezone: 'Z',
  dateStrings: false,
  decimalNumbers: true,
  supportBigNumbers: true,
  charset: 'utf8mb4_unicode_ci',
};

let corePool = null;
let promisePool = null;

function createPool() {
  corePool = mysql.createPool({
    ...baseOptions,
    database: config.DB_NAME,
    waitForConnections: true,
    connectionLimit: config.DB_CONNECTION_LIMIT,
    queueLimit: 0,
    namedPlaceholders: false,
  });
  // Keep the MySQL session clock in UTC so NOW() matches JavaScript Date values.
  corePool.on('connection', (connection) => {
    connection.query("SET time_zone = '+00:00'");
  });
  promisePool = corePool.promise();
  return promisePool;
}

/** Shared MySQL connection pool (promise API). */
export function getPool() {
  return promisePool ?? createPool();
}

/** Run a parameterized query and return the rows (or the result header for writes). */
export async function query(sql, params = []) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

/** Run a parameterized query and return the first row or null. */
export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

/**
 * Execute `work(conn)` inside a transaction. `conn` exposes the same
 * `query(sql, params)` contract as the pool so models can accept either.
 */
export async function transaction(work) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

/** Pick the executor for model methods that optionally participate in a transaction. */
export function executor(conn) {
  return conn ?? getPool();
}

/** Lightweight connectivity check used by /api/health. */
export async function pingDatabase() {
  const started = Date.now();
  await getPool().query('SELECT 1');
  return { latencyMs: Date.now() - started };
}

/** Create the configured database if it does not exist (used by migrations and tests). */
export async function ensureDatabaseExists(name = config.DB_NAME) {
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error(`Unsafe database name: ${name}`);
  const conn = await mysql.createConnection(baseOptions).promise();
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await conn.end();
  }
}

export async function closePool() {
  if (promisePool) {
    const pool = promisePool;
    promisePool = null;
    corePool = null;
    await pool.end();
  }
}
