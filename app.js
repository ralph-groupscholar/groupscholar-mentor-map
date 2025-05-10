const storageKey = "mentor-map-data-v2";

const state = {
  mentors: [],
  scholars: [],
  assignments: {},
  notes: "",
};

const elements = {
  mentorForm: document.getElementById("mentor-form"),
  scholarForm: document.getElementById("scholar-form"),
  mentorList: document.getElementById("mentor-list"),
  scholarList: document.getElementById("scholar-list"),
  matchList: document.getElementById("match-list"),
  signalBoard: document.getElementById("signal-board"),
  cohortBoard: document.getElementById("cohort-board"),
  engagementPlan: document.getElementById("engagement-plan"),
  headlineMetrics: document.getElementById("headline-metrics"),
  generateMatches: document.getElementById("generate-matches"),
  autoAssign: document.getElementById("auto-assign"),
  exportJson: document.getElementById("export-json"),
  importJson: document.getElementById("import-json"),
  resetData: document.getElementById("reset-data"),
  jsonPreview: document.getElementById("json-preview"),
  notes: document.getElementById("notes"),
};

const sampleData = {
  mentors: [
    {
      id: crypto.randomUUID(),
      name: "Dr. Aisha Karim",
      role: "Biotech Research Lead",
      tags: ["biotech", "grant writing", "career pivots"],
      availability: 6,
      capacity: 3,
      timezone: "ET",
      notes: "Enjoys early-stage scholars with research goals.",
    },
    {
      id: crypto.randomUUID(),
      name: "Luis Romero",
      role: "Product Design Director",
      tags: ["product", "design", "portfolio"],
      availability: 4,
      capacity: 2,
      timezone: "PT",
      notes: "Prefers visual portfolios and weekly check-ins.",
    },
    {
      id: crypto.randomUUID(),
      name: "Priya Nandakumar",
      role: "Finance & Partnerships",
      tags: ["finance", "internships", "networking"],
      availability: 8,
      capacity: 4,
      timezone: "CT",
      notes: "Strong on internship pipelines and sponsor outreach.",
    },
  ],
  scholars: [
    {
      id: crypto.randomUUID(),
      name: "Maya Chen",
      cohort: "Spring 2026",
      needs: ["biotech", "research", "grant writing"],
      intensity: 4,
      urgency: 4,
      timezone: "ET",
      notes: "Targeting lab placement in Q2.",
    },
    {
      id: crypto.randomUUID(),
      name: "Jordan Ali",
      cohort: "Spring 2026",
      needs: ["product", "design", "portfolio"],
      intensity: 3,
      urgency: 3,
      timezone: "PT",
      notes: "Needs a portfolio review sprint.",
    },
    {
      id: crypto.randomUUID(),
      name: "Elena Torres",
      cohort: "Spring 2026",
      needs: ["finance", "networking"],
      intensity: 5,
      urgency: 5,
      timezone: "CT",
      notes: "Urgent: summer internship outreach.",
    },
  ],
  assignments: {},
  notes: "",
};

const normalizeTags = (value) =>
  value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const saveState = () => {
  localStorage.setItem(storageKey, JSON.stringify(state));
};

const loadState = () => {
  const stored = localStorage.getItem(storageKey);
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    state.mentors = (parsed.mentors || []).map((mentor) => ({
      ...mentor,
      tags: mentor.tags || mentor.expertise || [],
      availability: Number(mentor.availability) || 0,
      capacity: Number(mentor.capacity) || 0,
    }));
    state.scholars = (parsed.scholars || []).map((scholar) => ({
      ...scholar,
      needs: scholar.needs || scholar.interests || [],
      intensity: Number(scholar.intensity) || 0,
      urgency: Number(scholar.urgency) || 1,
    }));
    state.assignments = parsed.assignments || {};
    state.notes = parsed.notes || "";
  } catch (error) {
    console.warn("Failed to parse stored data", error);
  }
};

const getMentorAssignments = (mentorId) =>
  state.scholars.filter((scholar) => state.assignments[scholar.id] === mentorId);

const getMentorLoadCount = (mentorId) => getMentorAssignments(mentorId).length;

const getMentorLoadHours = (mentorId) =>
  getMentorAssignments(mentorId).reduce((sum, scholar) => sum + (scholar.intensity || 0), 0);

const getMentorAvailability = (mentor) => Number(mentor.availability) || 0;

const getMentorCapacity = (mentor) => Number(mentor.capacity) || 0;

const getMentorUtilization = (mentor) => {
  const capacity = getMentorCapacity(mentor);
  if (!capacity) return 0;
  return Math.round((getMentorLoadCount(mentor.id) / capacity) * 100);
};

const getMentorHoursUtilization = (mentor) => {
  const availability = getMentorAvailability(mentor);
  if (!availability) return 0;
  return Math.round((getMentorLoadHours(mentor.id) / availability) * 100);
};

const fairnessMetric = () => {
  if (!state.mentors.length) return "–";
  const loads = state.mentors.map((mentor) => getMentorLoadCount(mentor.id));
  const mean = loads.reduce((sum, value) => sum + value, 0) / loads.length;
  const variance =
    loads.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / loads.length;
  const stdDev = Math.sqrt(variance).toFixed(2);
  return `${stdDev} load stdev`;
};

const scoreMentor = (mentor, scholar) => {
  const mentorTags = new Set(mentor.tags || []);
  const overlap = (scholar.needs || []).filter((tag) => mentorTags.has(tag)).length;
  const timezoneBoost = mentor.timezone && mentor.timezone === scholar.timezone ? 2 : 0;
  const urgencyBoost = scholar.urgency ? (scholar.urgency - 3) * 1.5 : 0;
  const capacityPenalty = getMentorLoadCount(mentor.id) >= mentor.capacity ? -100 : 0;
  const hoursPenalty =
    getMentorAvailability(mentor) > 0 &&
    getMentorLoadHours(mentor.id) + scholar.intensity > getMentorAvailability(mentor)
      ? -10
      : 0;

  return overlap * 5 + timezoneBoost + urgencyBoost + capacityPenalty + hoursPenalty;
};

const buildRationale = (mentor, scholar) => {
  const overlaps = (scholar.needs || []).filter((tag) => (mentor.tags || []).includes(tag));
  const remainingSlots = Math.max(getMentorCapacity(mentor) - getMentorLoadCount(mentor.id), 0);
  const remainingHours = getMentorAvailability(mentor)
    ? Math.max(getMentorAvailability(mentor) - getMentorLoadHours(mentor.id), 0)
    : "Open";
  return [
    overlaps.length ? `Shared needs: ${overlaps.join(", ")}` : "No direct overlap",
    mentor.timezone && scholar.timezone && mentor.timezone === scholar.timezone
      ? "Timezone aligned"
      : "Timezone mismatch",
    `Slots left: ${remainingSlots} · Hours left: ${remainingHours}`,
  ];
};

const renderMentors = () => {
  elements.mentorList.innerHTML = "";
  if (!state.mentors.length) {
    elements.mentorList.innerHTML = "<p>No mentors yet.</p>";
    return;
  }
  const list = document.createElement("div");
  list.className = "list";
  state.mentors.forEach((mentor) => {
    const tags = (mentor.tags || [])
      .map((tag) => `<span class="tag">${tag}</span>`)
      .join("");
    const assignedCount = getMentorLoadCount(mentor.id);
    const assignedHours = getMentorLoadHours(mentor.id);
    const utilization = mentor.capacity
      ? Math.round((assignedCount / mentor.capacity) * 100)
      : 0;

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-header">
        <h3>${mentor.name}</h3>
        <span class="badge">${mentor.role || "Mentor"}</span>
      </div>
      <div class="tags">${tags || ""}</div>
      <div class="signal">
        <strong>${assignedCount} / ${mentor.capacity} mentors · ${assignedHours} hrs</strong>
        <span>${utilization}% utilized · ${mentor.availability} hrs/week available</span>
      </div>
      <p><strong>Timezone:</strong> ${mentor.timezone || "–"}</p>
      <p>${mentor.notes || "No notes yet."}</p>
    `;
    list.appendChild(card);
  });
  elements.mentorList.appendChild(list);
};

const renderScholars = () => {
  elements.scholarList.innerHTML = "";
  if (!state.scholars.length) {
    elements.scholarList.innerHTML = "<p>No scholars yet.</p>";
    return;
  }
  const list = document.createElement("div");
  list.className = "list";
  state.scholars.forEach((scholar) => {
    const tags = (scholar.needs || [])
      .map((tag) => `<span class="tag">${tag}</span>`)
      .join("");
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-header">
        <h3>${scholar.name}</h3>
        <span class="badge">${scholar.cohort || "Cohort"}</span>
      </div>
      <div class="tags">${tags || ""}</div>
      <div class="signal">
        <strong>Urgency ${scholar.urgency} · ${scholar.intensity} hrs/week</strong>
        <span>Timezone ${scholar.timezone || "–"}</span>
      </div>
      <p>${scholar.notes || "No notes yet."}</p>
    `;
    list.appendChild(card);
  });
  elements.scholarList.appendChild(list);
};

const renderMatches = () => {
  elements.matchList.innerHTML = "";
  if (!state.mentors.length || !state.scholars.length) {
    elements.matchList.innerHTML = "<p>Add mentors and scholars to generate matches.</p>";
    return;
  }

  const list = document.createElement("div");
  list.className = "list";

  state.scholars.forEach((scholar) => {
    const ranked = state.mentors
      .map((mentor) => ({
        mentor,
        score: scoreMentor(mentor, scholar),
        rationale: buildRationale(mentor, scholar),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const assignedMentorId = state.assignments[scholar.id];
    const assignedMentor = state.mentors.find((mentor) => mentor.id === assignedMentorId);

    const card = document.createElement("div");
    card.className = "card match-card";
    card.innerHTML = `
      <div class="card-header">
        <h3>${scholar.name}</h3>
        <span class="badge">Urgency ${scholar.urgency}</span>
      </div>
      ${ranked
        .map(
          (match, index) => `
          <div>
            <strong>${index + 1}. ${match.mentor.name}</strong> — score ${match.score.toFixed(1)}
            <p>${match.rationale.join(" • ")}</p>
            <p><em>${match.mentor.notes || "No notes"}</em></p>
            <div class="match-actions">
              <button class="ghost" data-scholar="${scholar.id}" data-mentor="${match.mentor.id}">
                Assign mentor
              </button>
            </div>
          </div>
        `
        )
        .join("")}
      ${
        assignedMentor
          ? `<div class="alert"><strong>Assigned:</strong> ${assignedMentor.name}
              <div class="match-actions">
                <button class="ghost" data-unassign="${scholar.id}">Unassign</button>
              </div>
            </div>`
          : ""
      }
    `;
    list.appendChild(card);
  });

  elements.matchList.appendChild(list);

  elements.matchList.querySelectorAll("button[data-scholar]").forEach((button) => {
    button.addEventListener("click", () => {
      const scholarId = button.dataset.scholar;
      const mentorId = button.dataset.mentor;
      assignMentor(scholarId, mentorId);
    });
  });

  elements.matchList.querySelectorAll("button[data-unassign]").forEach((button) => {
    button.addEventListener("click", () => {
      const scholarId = button.dataset.unassign;
      delete state.assignments[scholarId];
      saveState();
      renderAll();
    });
  });
};

const renderSignals = () => {
  elements.signalBoard.innerHTML = "";

  const totalAvailability = state.mentors.reduce(
    (sum, mentor) => sum + (getMentorAvailability(mentor) || 0),
    0
  );
  const totalDemand = state.scholars.reduce((sum, scholar) => sum + (scholar.intensity || 0), 0);
  const assignedCount = Object.keys(state.assignments).length;
  const unassigned = Math.max(state.scholars.length - assignedCount, 0);
  const totalCapacity = state.mentors.reduce((sum, mentor) => sum + (mentor.capacity || 0), 0);
  const capacityUtilization = totalCapacity
    ? Math.round((assignedCount / totalCapacity) * 100)
    : 0;
  const hoursUtilization = totalAvailability
    ? Math.round((totalDemand / totalAvailability) * 100)
    : 0;
  const overloadedMentors = state.mentors.filter(
    (mentor) => getMentorLoadCount(mentor.id) >= mentor.capacity
  );
  const overHoursMentors = state.mentors.filter((mentor) => {
    const availability = getMentorAvailability(mentor);
    if (!availability) return false;
    return getMentorLoadHours(mentor.id) > availability;
  });
  const highUrgencyUnassigned = state.scholars
    .filter((scholar) => !state.assignments[scholar.id])
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, 3);
  const assignedPairs = state.scholars
    .filter((scholar) => state.assignments[scholar.id])
    .map((scholar) => {
      const mentor = state.mentors.find((item) => item.id === state.assignments[scholar.id]);
      return mentor ? { scholar, mentor } : null;
    })
    .filter(Boolean);
  const averageScore = assignedPairs.length
    ? (
        assignedPairs.reduce((sum, pair) => sum + scoreMentor(pair.mentor, pair.scholar), 0) /
        assignedPairs.length
      ).toFixed(1)
    : "–";
  const timezoneAligned = assignedPairs.filter(
    (pair) => pair.mentor.timezone && pair.mentor.timezone === pair.scholar.timezone
  ).length;
  const timezoneAlignment = assignedPairs.length
    ? Math.round((timezoneAligned / assignedPairs.length) * 100)
    : 0;
  const unmetNeeds = state.scholars
    .filter((scholar) => !state.assignments[scholar.id])
    .reduce((acc, scholar) => {
      (scholar.needs || []).forEach((need) => {
        acc[need] = (acc[need] || 0) + 1;
      });
      return acc;
    }, {});
  const topNeeds = Object.entries(unmetNeeds)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([need, count]) => `${need} (${count})`)
    .join(", ");
  const cohortRisk = state.scholars
    .filter((scholar) => !state.assignments[scholar.id])
    .reduce((acc, scholar) => {
      const cohort = scholar.cohort || "Unassigned cohort";
      acc[cohort] = (acc[cohort] || 0) + 1;
      return acc;
    }, {});
  const cohortAlert = Object.entries(cohortRisk)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([cohort, count]) => `${cohort} (${count})`)
    .join(", ");

  const capacityCard = document.createElement("div");
  capacityCard.className = "card";
  capacityCard.innerHTML = `
    <div class="signal">
      <strong>Coverage</strong>
      <span>${totalDemand} hrs demand · ${totalAvailability} hrs available</span>
    </div>
    <div class="signal">
      <strong>Unassigned scholars</strong>
      <span>${unassigned} awaiting mentor</span>
    </div>
    <div class="signal">
      <strong>Utilization</strong>
      <span>${capacityUtilization}% capacity · ${hoursUtilization}% hours</span>
    </div>
    <div class="signal">
      <strong>Overloaded mentors</strong>
      <span>${
        overloadedMentors.length ? overloadedMentors.map((m) => m.name).join(", ") : "None"
      }</span>
    </div>
    <div class="signal">
      <strong>Hours risk</strong>
      <span>${overHoursMentors.length ? overHoursMentors.map((m) => m.name).join(", ") : "None"}</span>
    </div>
    <div class="signal">
      <strong>High urgency unassigned</strong>
      <span>${
        highUrgencyUnassigned.length
          ? highUrgencyUnassigned.map((s) => `${s.name} (U${s.urgency})`).join(", ")
          : "All covered"
      }</span>
    </div>
  `;
  elements.signalBoard.appendChild(capacityCard);

  const matchCard = document.createElement("div");
  matchCard.className = "card";
  matchCard.innerHTML = `
    <div class="signal">
      <strong>Match quality</strong>
      <span>Average score ${averageScore} · ${timezoneAlignment}% timezone aligned</span>
    </div>
    <div class="signal">
      <strong>Top unmet needs</strong>
      <span>${topNeeds || "All covered"}</span>
    </div>
    <div class="signal">
      <strong>Cohort coverage risk</strong>
      <span>${cohortAlert || "Balanced coverage"}</span>
    </div>
  `;
  elements.signalBoard.appendChild(matchCard);
};

const renderCohortBoard = () => {
  elements.cohortBoard.innerHTML = "";

  if (!state.scholars.length) {
    elements.cohortBoard.innerHTML = "<p>Add scholars to see cohort coverage.</p>";
    return;
  }

  const cohortMap = state.scholars.reduce((acc, scholar) => {
    const cohort = scholar.cohort || "Unassigned cohort";
    if (!acc[cohort]) {
      acc[cohort] = {
        scholars: [],
      };
    }
    acc[cohort].scholars.push(scholar);
    return acc;
  }, {});

  const list = document.createElement("div");
  list.className = "list";

  Object.entries(cohortMap).forEach(([cohort, data]) => {
    const cohortScholars = data.scholars;
    const assignedScholars = cohortScholars.filter((scholar) => state.assignments[scholar.id]);
    const unassignedCount = cohortScholars.length - assignedScholars.length;
    const coverage = cohortScholars.length
      ? Math.round((assignedScholars.length / cohortScholars.length) * 100)
      : 0;
    const avgUrgency = cohortScholars.length
      ? (
          cohortScholars.reduce((sum, scholar) => sum + (scholar.urgency || 0), 0) /
          cohortScholars.length
        ).toFixed(1)
      : "–";
    const avgIntensity = cohortScholars.length
      ? (
          cohortScholars.reduce((sum, scholar) => sum + (scholar.intensity || 0), 0) /
          cohortScholars.length
        ).toFixed(1)
      : "–";
    const needsCount = cohortScholars
      .filter((scholar) => !state.assignments[scholar.id])
      .reduce((acc, scholar) => {
        (scholar.needs || []).forEach((need) => {
          acc[need] = (acc[need] || 0) + 1;
        });
        return acc;
      }, {});
    const topNeed = Object.entries(needsCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 1)
      .map(([need, count]) => `${need} (${count})`)
      .join(", ");
    const uniqueMentors = new Set(
      assignedScholars
        .map((scholar) => state.assignments[scholar.id])
        .filter(Boolean)
    ).size;

    const status =
      unassignedCount === 0 && Number(avgUrgency) <= 3
        ? "Stable"
        : unassignedCount / cohortScholars.length > 0.3 || Number(avgUrgency) >= 4
          ? "High risk"
          : "Watch";

    const action =
      unassignedCount === 0
        ? "Keep cadence steady; reinforce momentum."
        : topNeed
          ? `Recruit mentors for ${topNeed}.`
          : "Assign mentors and confirm kickoff timing.";

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-header">
        <h3>${cohort}</h3>
        <span class="badge">${status}</span>
      </div>
      <div class="signal">
        <strong>${coverage}% covered</strong>
        <span>${unassignedCount} unassigned · ${uniqueMentors} active mentors</span>
      </div>
      <div class="signal">
        <strong>Avg urgency ${avgUrgency}</strong>
        <span>Avg intensity ${avgIntensity} hrs/week</span>
      </div>
      <p class="muted">Next action: ${action}</p>
    `;
    list.appendChild(card);
  });

  elements.cohortBoard.appendChild(list);
};

const determineCadence = (scholar) => {
  if (scholar.urgency >= 4 || scholar.intensity >= 4) return "Weekly check-ins";
  if (scholar.urgency <= 2 && scholar.intensity <= 2) return "Biweekly check-ins";
  return "Every 10 days";
};

const renderEngagementPlan = () => {
  elements.engagementPlan.innerHTML = "";

  if (!state.scholars.length) {
    elements.engagementPlan.innerHTML = "<p>Add scholars to draft engagement plans.</p>";
    return;
  }

  const list = document.createElement("div");
  list.className = "list";

  const sortedScholars = [...state.scholars].sort(
    (a, b) => b.urgency - a.urgency || b.intensity - a.intensity
  );

  sortedScholars.forEach((scholar) => {
    const assignedMentorId = state.assignments[scholar.id];
    const mentor = state.mentors.find((item) => item.id === assignedMentorId);
    const overlap = mentor
      ? (scholar.needs || []).filter((tag) => (mentor.tags || []).includes(tag)).length
      : 0;
    const timezoneAligned = mentor && mentor.timezone && mentor.timezone === scholar.timezone;
    const cadence = determineCadence(scholar);
    const riskFlags = [];

    if (!mentor) {
      riskFlags.push("Unassigned");
    } else {
      if (getMentorLoadCount(mentor.id) >= mentor.capacity) {
        riskFlags.push("Capacity risk");
      }
      if (
        getMentorAvailability(mentor) > 0 &&
        getMentorLoadHours(mentor.id) + scholar.intensity > getMentorAvailability(mentor)
      ) {
        riskFlags.push("Hours risk");
      }
      if (!overlap) {
        riskFlags.push("Coverage gap");
      }
      if (!timezoneAligned) {
        riskFlags.push("Timezone mismatch");
      }
    }

    const kickoff = mentor
      ? timezoneAligned
        ? "Schedule a live kickoff within 7 days."
        : "Start async kickoff; schedule overlap within 10 days."
      : "Assign a mentor and schedule kickoff within 5 days.";

    const card = document.createElement("div");
    card.className = "card plan-card";
    card.innerHTML = `
      <div class="card-header">
        <h3>${scholar.name}</h3>
        <span class="badge">Urgency ${scholar.urgency}</span>
      </div>
      <p><strong>Mentor:</strong> ${mentor ? mentor.name : "Unassigned"}</p>
      <div class="plan-row">
        <span class="pill">${cadence}</span>
        <span class="pill">Intensity ${scholar.intensity} hrs/week</span>
        <span class="pill">${mentor ? mentor.timezone || "–" : "Timezone TBD"}</span>
      </div>
      <p class="muted">Next step: ${kickoff}</p>
      ${
        riskFlags.length
          ? `<div class="alert">Risks: ${riskFlags.join(", ")}</div>`
          : `<div class="alert">No immediate risks flagged.</div>`
      }
    `;
    list.appendChild(card);
  });

  elements.engagementPlan.appendChild(list);
};

const renderMetrics = () => {
  const assignedCount = Object.keys(state.assignments).length;
  const coverageRatio = state.scholars.length
    ? Math.round((assignedCount / state.scholars.length) * 100)
    : 0;
  elements.headlineMetrics.innerHTML = `
    <div class="metric">
      <span>Mentors</span>
      <strong>${state.mentors.length}</strong>
    </div>
    <div class="metric">
      <span>Scholars</span>
      <strong>${state.scholars.length}</strong>
    </div>
    <div class="metric">
      <span>Coverage</span>
      <strong>${coverageRatio}%</strong>
    </div>
    <div class="metric">
      <span>Fairness</span>
      <strong>${fairnessMetric()}</strong>
    </div>
  `;
};

const renderPreview = () => {
  elements.jsonPreview.textContent = JSON.stringify(state, null, 2);
};

const renderAll = () => {
  renderMentors();
  renderScholars();
  renderMatches();
  renderSignals();
  renderCohortBoard();
  renderEngagementPlan();
  renderMetrics();
  renderPreview();
};

const assignMentor = (scholarId, mentorId) => {
  state.assignments[scholarId] = mentorId;
  saveState();
  renderAll();
};

const handleMentorSubmit = (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const mentor = {
    id: crypto.randomUUID(),
    name: formData.get("name").trim(),
    role: formData.get("role").trim(),
    tags: normalizeTags(formData.get("tags")),
    availability: Number(formData.get("availability")),
    capacity: Number(formData.get("capacity")),
    timezone: formData.get("timezone").trim(),
    notes: formData.get("notes").trim(),
  };
  state.mentors.push(mentor);
  saveState();
  event.target.reset();
  renderAll();
};

const handleScholarSubmit = (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const scholar = {
    id: crypto.randomUUID(),
    name: formData.get("name").trim(),
    cohort: formData.get("cohort").trim(),
    needs: normalizeTags(formData.get("needs")),
    intensity: Number(formData.get("intensity")),
    urgency: Number(formData.get("urgency")),
    timezone: formData.get("timezone").trim(),
    notes: formData.get("notes").trim(),
  };
  state.scholars.push(scholar);
  saveState();
  event.target.reset();
  renderAll();
};

const seedSampleData = () => {
  state.mentors = sampleData.mentors.map((mentor) => ({ ...mentor }));
  state.scholars = sampleData.scholars.map((scholar) => ({ ...scholar }));
  state.assignments = { ...sampleData.assignments };
  state.notes = sampleData.notes;
  if (elements.notes) {
    elements.notes.value = state.notes;
  }
  saveState();
  renderAll();
};

const autoAssignMatches = () => {
  const scholars = [...state.scholars].sort(
    (a, b) => b.urgency - a.urgency || b.intensity - a.intensity
  );

  scholars.forEach((scholar) => {
    const ranked = state.mentors
      .map((mentor) => ({ mentor, score: scoreMentor(mentor, scholar) }))
      .sort((a, b) => b.score - a.score);

    const pick = ranked.find(({ mentor }) => {
      const hasCapacity = getMentorLoadCount(mentor.id) < mentor.capacity;
      const hasHours =
        getMentorAvailability(mentor) === 0 ||
        getMentorLoadHours(mentor.id) + scholar.intensity <= getMentorAvailability(mentor);
      return hasCapacity && hasHours;
    });

    if (pick) {
      state.assignments[scholar.id] = pick.mentor.id;
    }
  });

  saveState();
  renderAll();
};

const exportData = () => {
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "mentor-map-data.json";
  link.click();
  URL.revokeObjectURL(url);
};

const importData = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      state.mentors = parsed.mentors || [];
      state.scholars = parsed.scholars || [];
      state.assignments = parsed.assignments || {};
      state.notes = parsed.notes || "";
      if (elements.notes) {
        elements.notes.value = state.notes;
      }
      saveState();
      renderAll();
    } catch (error) {
      alert("Invalid JSON file.");
    }
  };
  reader.readAsText(file);
};

const handleNotesChange = (event) => {
  state.notes = event.target.value;
  saveState();
  renderPreview();
};

loadState();
if (elements.notes) {
  elements.notes.value = state.notes;
}
renderAll();

elements.mentorForm.addEventListener("submit", handleMentorSubmit);
elements.scholarForm.addEventListener("submit", handleScholarSubmit);
elements.generateMatches.addEventListener("click", renderMatches);
elements.autoAssign.addEventListener("click", autoAssignMatches);
elements.exportJson.addEventListener("click", exportData);
elements.importJson.addEventListener("change", importData);
elements.resetData.addEventListener("click", seedSampleData);
elements.notes.addEventListener("input", handleNotesChange);
