const { Pool } = require("pg");

let pool;

const getPool = () => {
  if (!pool) {
    const sslMode = process.env.PGSSLMODE;
    const ssl =
      sslMode && sslMode.toLowerCase() === "disable" ? false : { rejectUnauthorized: false };
    const useConnectionString = Boolean(process.env.DATABASE_URL);
    const config = useConnectionString
      ? {
          connectionString: process.env.DATABASE_URL,
          ssl,
        }
      : {
          host: process.env.PGHOST,
          port: Number(process.env.PGPORT || 5432),
          user: process.env.PGUSER,
          password: process.env.PGPASSWORD,
          database: process.env.PGDATABASE,
          ssl,
        };
    pool = new Pool(config);
  }

  return pool;
};

const ensureSchema = async () => {
  const poolInstance = getPool();
  await poolInstance.query("CREATE SCHEMA IF NOT EXISTS mentor_map;");
  await poolInstance.query(`
    CREATE TABLE IF NOT EXISTS mentor_map.snapshots (
      snapshot_key text PRIMARY KEY,
      payload jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
};

module.exports = {
  getPool,
  ensureSchema,
};
