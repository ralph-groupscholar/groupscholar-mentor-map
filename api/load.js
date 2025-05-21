const { ensureSchema, getPool } = require("./_db");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, message: "Method not allowed" });
    return;
  }

  try {
    await ensureSchema();
    const pool = getPool();
    const snapshotKey = req.query && req.query.key ? req.query.key : "default";
    const { rows } = await pool.query(
      "SELECT payload, updated_at FROM mentor_map.snapshots WHERE snapshot_key = $1;",
      [snapshotKey]
    );

    if (!rows.length) {
      res.status(404).json({ ok: false, message: "No snapshot found" });
      return;
    }

    res.status(200).json({ ok: true, payload: rows[0].payload, updatedAt: rows[0].updated_at });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Failed to load snapshot" });
  }
};
