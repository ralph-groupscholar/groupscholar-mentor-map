const { ensureSchema, getPool } = require("../api/_db");

const buildId = () => `seed-${Math.random().toString(36).slice(2, 10)}`;

const seedSnapshot = () => {
  const mentors = [
    {
      id: buildId(),
      name: "Dr. Aisha Karim",
      role: "Biotech Research Lead",
      tags: ["biotech", "grant writing", "career pivots"],
      availability: 6,
      capacity: 3,
      timezone: "ET",
      notes: "Enjoys early-stage scholars with research goals.",
    },
    {
      id: buildId(),
      name: "Luis Romero",
      role: "Product Design Director",
      tags: ["product", "design", "portfolio"],
      availability: 4,
      capacity: 2,
      timezone: "PT",
      notes: "Prefers visual portfolios and weekly check-ins.",
    },
    {
      id: buildId(),
      name: "Priya Nandakumar",
      role: "Finance & Partnerships",
      tags: ["finance", "internships", "networking"],
      availability: 8,
      capacity: 4,
      timezone: "CT",
      notes: "Strong on internship pipelines and sponsor outreach.",
    },
    {
      id: buildId(),
      name: "Malik Grant",
      role: "Data Science Manager",
      tags: ["data science", "ml", "career planning"],
      availability: 5,
      capacity: 3,
      timezone: "ET",
      notes: "Focuses on project-based mentoring and portfolio clarity.",
    },
    {
      id: buildId(),
      name: "Sofia Reyes",
      role: "Policy & Advocacy Strategist",
      tags: ["policy", "storytelling", "community"],
      availability: 3,
      capacity: 2,
      timezone: "MT",
      notes: "Best for scholars with civic impact goals.",
    },
  ];

  const scholars = [
    {
      id: buildId(),
      name: "Maya Chen",
      cohort: "Spring 2026",
      needs: ["biotech", "research", "grant writing"],
      intensity: 4,
      urgency: 4,
      timezone: "ET",
      notes: "Targeting lab placement in Q2.",
    },
    {
      id: buildId(),
      name: "Jordan Ali",
      cohort: "Spring 2026",
      needs: ["product", "design", "portfolio"],
      intensity: 3,
      urgency: 3,
      timezone: "PT",
      notes: "Needs a portfolio review sprint.",
    },
    {
      id: buildId(),
      name: "Elena Torres",
      cohort: "Spring 2026",
      needs: ["finance", "networking"],
      intensity: 5,
      urgency: 5,
      timezone: "CT",
      notes: "Urgent: summer internship outreach.",
    },
    {
      id: buildId(),
      name: "Samir Patel",
      cohort: "Spring 2026",
      needs: ["data science", "ml", "career planning"],
      intensity: 4,
      urgency: 4,
      timezone: "ET",
      notes: "Needs clarity on capstone scope and industry targets.",
    },
    {
      id: buildId(),
      name: "Nia Brooks",
      cohort: "Spring 2026",
      needs: ["policy", "storytelling"],
      intensity: 2,
      urgency: 3,
      timezone: "MT",
      notes: "Developing advocacy narrative for fellowship applications.",
    },
  ];

  const assignments = {
    [scholars[0].id]: mentors[0].id,
    [scholars[1].id]: mentors[1].id,
    [scholars[2].id]: mentors[2].id,
  };

  return {
    mentors,
    scholars,
    assignments,
    notes: "Seeded cloud snapshot for mentor map shared use.",
    lastSyncedAt: new Date().toISOString(),
  };
};

const run = async () => {
  await ensureSchema();
  const pool = getPool();
  const payload = seedSnapshot();
  await pool.query(
    `
    INSERT INTO mentor_map.snapshots (snapshot_key, payload)
    VALUES ($1, $2)
    ON CONFLICT (snapshot_key)
    DO UPDATE SET payload = EXCLUDED.payload, updated_at = now();
  `,
    ["default", payload]
  );
  await pool.end();
  console.log("Seeded mentor_map.snapshots with default snapshot.");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
