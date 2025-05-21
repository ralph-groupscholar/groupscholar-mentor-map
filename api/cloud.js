const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.SUPABASE_DB_URL,
  ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
});

const TABLE_NAME = "groupscholar_mentor_map_snapshots";

const ensureTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id BIGSERIAL PRIMARY KEY,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  if (!pool.options.connectionString) {
    res.status(500).json({ error: "Database not configured" });
    return;
  }

  const client = await pool.connect();
  try {
    await ensureTable(client);

    if (req.method === "POST") {
      const { data } = req.body || {};
      if (!data) {
        res.status(400).json({ error: "Missing data" });
        return;
      }

      const result = await client.query(
        `INSERT INTO ${TABLE_NAME} (payload) VALUES ($1) RETURNING created_at`,
        [data]
      );

      res.status(200).json({ created_at: result.rows[0].created_at });
      return;
    }

    if (req.method === "GET") {
      const result = await client.query(
        `SELECT payload, created_at FROM ${TABLE_NAME} ORDER BY created_at DESC LIMIT 1;`
      );
      if (!result.rows.length) {
        res.status(200).json({ data: null, created_at: null });
        return;
      }
      res.status(200).json({
        data: result.rows[0].payload,
        created_at: result.rows[0].created_at,
      });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
};
