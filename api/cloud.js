const { ensureSchema, getPool } = require("./_db");

const ensureHistoryTable = async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mentor_map.snapshot_history (
      id BIGSERIAL PRIMARY KEY,
      payload JSONB NOT NULL,
      mentor_count INTEGER,
      scholar_count INTEGER,
      assignment_count INTEGER,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
};

const parseBody = (req) => {
  if (!req.body) return null;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      return null;
    }
  }
  return req.body;
};

const normalizePayload = (body) => {
  if (!body) return null;
  if (body.data && typeof body.data === "object") return body.data;
  if (body.payload && typeof body.payload === "object") return body.payload;
  return body;
};

const summarizePayload = (payload) => {
  const mentors = Array.isArray(payload.mentors) ? payload.mentors.length : 0;
  const scholars = Array.isArray(payload.scholars) ? payload.scholars.length : 0;
  const assignments = payload.assignments
    ? Object.keys(payload.assignments).filter((key) => payload.assignments[key]).length
    : 0;
  const notes = typeof payload.notes === "string" ? payload.notes.slice(0, 240) : null;

  return {
    mentors,
    scholars,
    assignments,
    notes,
  };
};

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  try {
    await ensureSchema();
    const pool = getPool();
    await ensureHistoryTable(pool);

    if (req.method === "POST") {
      const body = parseBody(req);
      const payload = normalizePayload(body);
      if (!payload) {
        res.status(400).json({ ok: false, message: "Missing payload" });
        return;
      }

      const summary = summarizePayload(payload);
      const { rows } = await pool.query(
        `
        INSERT INTO mentor_map.snapshot_history (
          payload,
          mentor_count,
          scholar_count,
          assignment_count,
          notes
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at;
      `,
        [payload, summary.mentors, summary.scholars, summary.assignments, summary.notes]
      );

      res.status(200).json({ ok: true, id: rows[0].id, created_at: rows[0].created_at });
      return;
    }

    if (req.method === "GET") {
      const { id, list, limit } = req.query || {};
      if (list) {
        const listLimit = Math.min(Number(limit) || 6, 20);
        const { rows } = await pool.query(
          `
          SELECT id, created_at, mentor_count, scholar_count, assignment_count, notes
          FROM mentor_map.snapshot_history
          ORDER BY created_at DESC
          LIMIT $1;
        `,
          [listLimit]
        );
        res.status(200).json({ ok: true, snapshots: rows });
        return;
      }

      if (id) {
        const { rows } = await pool.query(
          `
          SELECT payload, created_at
          FROM mentor_map.snapshot_history
          WHERE id = $1;
        `,
          [id]
        );
        if (!rows.length) {
          res.status(404).json({ ok: false, message: "Snapshot not found" });
          return;
        }
        const payload = normalizePayload(rows[0].payload);
        res.status(200).json({ ok: true, payload, created_at: rows[0].created_at });
        return;
      }

      const { rows } = await pool.query(
        `
        SELECT payload, created_at
        FROM mentor_map.snapshot_history
        ORDER BY created_at DESC
        LIMIT 1;
      `
      );
      if (!rows.length) {
        res.status(404).json({ ok: false, message: "No snapshot found" });
        return;
      }
      const payload = normalizePayload(rows[0].payload);
      res.status(200).json({ ok: true, payload, created_at: rows[0].created_at });
      return;
    }

    res.status(405).json({ ok: false, message: "Method not allowed" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Server error" });
  }
};
