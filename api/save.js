const { ensureSchema, getPool } = require("./_db");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, message: "Method not allowed" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!body) {
      res.status(400).json({ ok: false, message: "Missing payload" });
      return;
    }

    await ensureSchema();
    const pool = getPool();
    const snapshotKey = body.snapshotKey || "default";
    const { rows } = await pool.query(
      `
      INSERT INTO mentor_map.snapshots (snapshot_key, payload)
      VALUES ($1, $2)
      ON CONFLICT (snapshot_key)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
      RETURNING updated_at;
    `,
      [snapshotKey, body]
    );

    res.status(200).json({ ok: true, updatedAt: rows[0].updated_at });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Failed to save snapshot" });
  }
};
