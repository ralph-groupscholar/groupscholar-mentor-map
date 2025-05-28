const storageKey = "mentor-map-data-v2";

const state = {
  mentors: [],
  scholars: [],
  assignments: {},
  notes: "",
  lastSyncedAt: null,
};

const CLOUD_ENDPOINT = "/api/cloud";

const elements = {
  mentorForm: document.getElementById("mentor-form"),
  scholarForm: document.getElementById("scholar-form"),
  mentorList: document.getElementById("mentor-list"),
  scholarList: document.getElementById("scholar-list"),
  matchList: document.getElementById("match-list"),
  signalBoard: document.getElementById("signal-board"),
  cohortBoard: document.getElementById("cohort-board"),
  engagementPlan: document.getElementById("engagement-plan"),
  actionQueue: document.getElementById("action-queue"),
  dependencyBoard: document.getElementById("dependency-board"),
  coverageBoard: document.getElementById("coverage-board"),
  recruitmentPlan: document.getElementById("recruitment-plan"),
  rebalanceBoard: document.getElementById("rebalance-board"),
  headlineMetrics: document.getElementById("headline-metrics"),
  generateMatches: document.getElementById("generate-matches"),
  autoAssign: document.getElementById("auto-assign"),
  exportJson: document.getElementById("export-json"),
  importJson: document.getElementById("import-json"),
  resetData: document.getElementById("reset-data"),
  saveCloud: document.getElementById("save-cloud"),
  loadCloud: document.getElementById("load-cloud"),
  syncStatus: document.getElementById("sync-status"),
  snapshotList: document.getElementById("snapshot-list"),
  refreshHistory: document.getElementById("refresh-history"),
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

const ingestState = (parsed) => {
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
  state.lastSyncedAt = parsed.lastSyncedAt || null;
  if (elements.notes) {
    elements.notes.value = state.notes;
  }
};

const loadState = () => {
  const stored = localStorage.getItem(storageKey);
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    ingestState(parsed);
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

const getMentorById = (mentorId) => state.mentors.find((mentor) => mentor.id === mentorId);

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
    elements.cohortBoard.innerHTML = "<p>Add scholars to view cohort coverage.</p>";
    return;
  }

  const cohortMap = state.scholars.reduce((acc, scholar) => {
    const cohort = scholar.cohort || "Unassigned cohort";
    if (!acc[cohort]) {
      acc[cohort] = {
        scholars: [],
        assigned: 0,
        unassigned: 0,
        hours: 0,
        urgencyTotal: 0,
        mentors: new Set(),
        needs: {},
      };
    }
    acc[cohort].scholars.push(scholar);
    acc[cohort].hours += scholar.intensity || 0;
    acc[cohort].urgencyTotal += scholar.urgency || 0;
    (scholar.needs || []).forEach((need) => {
      acc[cohort].needs[need] = (acc[cohort].needs[need] || 0) + 1;
    });

    const assignedMentorId = state.assignments[scholar.id];
    if (assignedMentorId) {
      acc[cohort].assigned += 1;
      acc[cohort].mentors.add(assignedMentorId);
    } else {
      acc[cohort].unassigned += 1;
    }
    return acc;
  }, {});

  const list = document.createElement("div");
  list.className = "list";

  const cohortEntries = Object.entries(cohortMap).sort((a, b) => {
    const riskDiff = b[1].unassigned - a[1].unassigned;
    if (riskDiff !== 0) return riskDiff;
    const urgencyA = a[1].urgencyTotal / a[1].scholars.length;
    const urgencyB = b[1].urgencyTotal / b[1].scholars.length;
    return urgencyB - urgencyA;
  });

  cohortEntries.forEach(([cohort, data]) => {
    const coverage = data.scholars.length
      ? Math.round((data.assigned / data.scholars.length) * 100)
      : 0;
    const avgUrgency = data.scholars.length
      ? (data.urgencyTotal / data.scholars.length).toFixed(1)
      : "–";
    const avgIntensity = data.scholars.length
      ? (data.hours / data.scholars.length).toFixed(1)
      : "–";
    const mentorNames = Array.from(data.mentors)
      .map((mentorId) => getMentorById(mentorId))
      .filter(Boolean)
      .map((mentor) => mentor.name);
    const mentorCoverage = mentorNames.length ? mentorNames.join(", ") : "None yet";
    const topNeeds = Object.entries(data.needs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([need, count]) => `${need} (${count})`)
      .join(", ");
    const riskFlags = [];

    if (coverage < 60) {
      riskFlags.push("Low coverage");
    }
    if (data.unassigned > 0) {
      riskFlags.push(`${data.unassigned} unassigned`);
    }
    if (data.scholars.length && data.urgencyTotal / data.scholars.length >= 4) {
      riskFlags.push("High urgency");
    }
    if (mentorNames.length <= 1 && data.scholars.length > 2) {
      riskFlags.push("Mentor concentration");
    }

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-header">
        <h3>${cohort}</h3>
        <span class="badge">Coverage ${coverage}%</span>
      </div>
      <div class="signal">
        <strong>${data.scholars.length} scholars · ${data.hours} hrs demand</strong>
        <span>Avg urgency ${avgUrgency} · ${data.assigned} assigned</span>
      </div>
      <div class="signal">
        <strong>Avg intensity ${avgIntensity} hrs/week</strong>
        <span>Mentors: ${mentorCoverage}</span>
      </div>
      <p><strong>Top needs:</strong> ${topNeeds || "All covered"}</p>
      ${
        riskFlags.length
          ? `<div class="alert">Risks: ${riskFlags.join(", ")}</div>`
          : `<div class="alert">Coverage stable. Keep momentum.</div>`
      }
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

const renderActionQueue = () => {
  elements.actionQueue.innerHTML = "";

  if (!state.mentors.length && !state.scholars.length) {
    elements.actionQueue.innerHTML = "<p>Add mentors and scholars to see action items.</p>";
    return;
  }

  const actions = [];
  const assignedCount = Object.keys(state.assignments).length;

  state.scholars.forEach((scholar) => {
    if (state.assignments[scholar.id]) return;
    const priority = (scholar.urgency || 1) * 2 + (scholar.intensity || 0);
    actions.push({
      title: `Assign mentor for ${scholar.name}`,
      detail: `Urgency ${scholar.urgency || "–"} · ${scholar.intensity || 0} hrs/week · ${
        scholar.cohort || "Cohort TBD"
      }`,
      priority,
      tone: priority >= 10 ? "High" : priority >= 6 ? "Medium" : "Low",
    });
  });

  state.mentors.forEach((mentor) => {
    const overCapacity = getMentorLoadCount(mentor.id) - getMentorCapacity(mentor);
    if (overCapacity > 0) {
      actions.push({
        title: `Rebalance ${mentor.name}'s load`,
        detail: `Over capacity by ${overCapacity} mentee${overCapacity === 1 ? "" : "s"}.`,
        priority: 9 + overCapacity,
        tone: "High",
      });
    }
    const availability = getMentorAvailability(mentor);
    const hourDelta = getMentorLoadHours(mentor.id) - availability;
    if (availability && hourDelta > 0) {
      actions.push({
        title: `Reduce hours for ${mentor.name}`,
        detail: `${hourDelta} hrs/week above availability.`,
        priority: 8 + Math.ceil(hourDelta / 2),
        tone: "High",
      });
    }
  });

  const unmetNeeds = state.scholars
    .filter((scholar) => !state.assignments[scholar.id])
    .reduce((acc, scholar) => {
      (scholar.needs || []).forEach((need) => {
        acc[need] = (acc[need] || 0) + 1;
      });
      return acc;
    }, {});

  Object.entries(unmetNeeds).forEach(([need, count]) => {
    if (count < 2) return;
    actions.push({
      title: `Recruit mentors for ${need}`,
      detail: `${count} unassigned scholars need this expertise.`,
      priority: 6 + count,
      tone: count >= 4 ? "High" : "Medium",
    });
  });

  const cohortRisk = state.scholars
    .filter((scholar) => !state.assignments[scholar.id])
    .reduce((acc, scholar) => {
      const cohort = scholar.cohort || "Unassigned cohort";
      acc[cohort] = (acc[cohort] || 0) + 1;
      return acc;
    }, {});

  Object.entries(cohortRisk).forEach(([cohort, count]) => {
    if (count < 2) return;
    actions.push({
      title: `Stabilize ${cohort} coverage`,
      detail: `${count} scholars waiting for assignment.`,
      priority: 5 + count,
      tone: count >= 3 ? "High" : "Medium",
    });
  });

  if (!actions.length) {
    elements.actionQueue.innerHTML = "<p>All clear. No urgent actions detected.</p>";
    return;
  }

  const list = document.createElement("div");
  list.className = "list";

  actions
    .sort((a, b) => b.priority - a.priority)
    .slice(0, Math.max(6, assignedCount ? 6 : 4))
    .forEach((action, index) => {
      const card = document.createElement("div");
      card.className = "card action-card";
      card.innerHTML = `
        <div class="card-header">
          <h3>${index + 1}. ${action.title}</h3>
          <span class="badge">${action.tone}</span>
        </div>
        <p class="muted">${action.detail}</p>
      `;
      list.appendChild(card);
    });

  elements.actionQueue.appendChild(list);
};

const renderDependencyBoard = () => {
  if (!elements.dependencyBoard) return;
  elements.dependencyBoard.innerHTML = "";

  if (!state.mentors.length) {
    elements.dependencyBoard.innerHTML =
      "<p>Add mentors to surface dependency risk and coverage fragility.</p>";
    return;
  }

  const tagCoverage = state.mentors.reduce((acc, mentor) => {
    (mentor.tags || []).forEach((tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
    });
    return acc;
  }, {});

  const mentorProfiles = state.mentors.map((mentor) => {
    const assignedScholars = getMentorAssignments(mentor.id);
    const assignedCount = assignedScholars.length;
    const loadHours = getMentorLoadHours(mentor.id);
    const utilization = getMentorUtilization(mentor);
    const hoursUtilization = getMentorHoursUtilization(mentor);
    const tags = mentor.tags || [];
    const scarcityScore = tags.reduce((sum, tag) => {
      const coverage = tagCoverage[tag] || 0;
      return sum + (coverage ? 1 / coverage : 1);
    }, 0);
    const soleTags = tags.filter((tag) => (tagCoverage[tag] || 0) === 1);
    const thinTags = tags.filter((tag) => (tagCoverage[tag] || 0) === 2);
    const exclusiveNeeds = new Set();
    assignedScholars.forEach((scholar) => {
      (scholar.needs || []).forEach((need) => {
        if ((tagCoverage[need] || 0) <= 1) {
          exclusiveNeeds.add(need);
        }
      });
    });

    const flags = [];
    if (utilization >= 100 || hoursUtilization >= 100) {
      flags.push("Over capacity");
    } else if (utilization >= 80 || hoursUtilization >= 80) {
      flags.push("High load");
    }
    if (soleTags.length) {
      flags.push(`Sole coverage: ${soleTags.slice(0, 2).join(", ")}`);
    } else if (thinTags.length) {
      flags.push(`Thin bench: ${thinTags.slice(0, 2).join(", ")}`);
    }
    if (exclusiveNeeds.size) {
      flags.push(
        `Exclusive scholar needs: ${Array.from(exclusiveNeeds).slice(0, 2).join(", ")}`
      );
    }

    const score =
      assignedCount * 2 +
      loadHours * 0.5 +
      utilization * 0.4 +
      hoursUtilization * 0.3 +
      scarcityScore * 5;

    return {
      mentor,
      assignedCount,
      loadHours,
      utilization,
      hoursUtilization,
      flags,
      score,
    };
  });

  const sorted = mentorProfiles.sort((a, b) => b.score - a.score).slice(0, 6);
  const maxScore = sorted.length ? sorted[0].score : 0;
  const criticalCutoff = Math.max(20, maxScore * 0.75);
  const watchCutoff = Math.max(10, maxScore * 0.5);

  const list = document.createElement("div");
  list.className = "list";

  sorted.forEach((profile) => {
    let tone = "Stable";
    let toneClass = "is-stable";
    if (profile.score >= criticalCutoff) {
      tone = "Critical";
      toneClass = "is-critical";
    } else if (profile.score >= watchCutoff) {
      tone = "Watch";
      toneClass = "is-watch";
    }

    const card = document.createElement("div");
    card.className = "card dependency-card";
    card.innerHTML = `
      <div class="card-header">
        <h3>${profile.mentor.name}</h3>
        <span class="badge badge-criticality ${toneClass}">${tone}</span>
      </div>
      <p class="muted">${profile.mentor.role || "Mentor"}</p>
      <div class="plan-row">
        <span class="pill">${profile.assignedCount} scholars</span>
        <span class="pill">${profile.utilization}% capacity</span>
        <span class="pill">${profile.hoursUtilization}% hours</span>
      </div>
      <p class="muted">
        ${profile.flags.length ? profile.flags.join(" • ") : "Balanced coverage footprint."}
      </p>
    `;
    list.appendChild(card);
  });

  elements.dependencyBoard.appendChild(list);
};

const renderCoverageBoard = () => {
  elements.coverageBoard.innerHTML = "";

  if (!state.mentors.length && !state.scholars.length) {
    elements.coverageBoard.innerHTML = "<p>Add mentors and scholars to see coverage balance.</p>";
    return;
  }

  const timezoneStats = {};
  state.scholars.forEach((scholar) => {
    const zone = scholar.timezone || "Timezone TBD";
    if (!timezoneStats[zone]) {
      timezoneStats[zone] = { scholars: 0, mentors: 0 };
    }
    timezoneStats[zone].scholars += 1;
  });
  state.mentors.forEach((mentor) => {
    const zone = mentor.timezone || "Timezone TBD";
    if (!timezoneStats[zone]) {
      timezoneStats[zone] = { scholars: 0, mentors: 0 };
    }
    timezoneStats[zone].mentors += 1;
  });

  const timezoneRows = Object.entries(timezoneStats)
    .sort((a, b) => b[1].scholars - a[1].scholars)
    .slice(0, 5)
    .map(([zone, data]) => {
      const coverage = data.scholars
        ? Math.round((data.mentors / data.scholars) * 100)
        : data.mentors
        ? 100
        : 0;
      return `
        <div class="coverage-item">
          <span>${zone}</span>
          <strong>${data.mentors} mentors · ${data.scholars} scholars</strong>
          <span class="muted">Coverage ${coverage}%</span>
        </div>
      `;
    })
    .join("");

  const needCounts = state.scholars.reduce((acc, scholar) => {
    (scholar.needs || []).forEach((need) => {
      acc[need] = (acc[need] || 0) + 1;
    });
    return acc;
  }, {});

  const mentorCoverage = state.mentors.reduce((acc, mentor) => {
    (mentor.tags || []).forEach((tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
    });
    return acc;
  }, {});

  const expertiseRows = Object.entries(needCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([need, demand]) => {
      const bench = mentorCoverage[need] || 0;
      const coverage = demand ? Math.round((bench / demand) * 100) : 0;
      const status =
        bench === 0 ? "Gap" : coverage >= 100 ? "Healthy" : coverage >= 60 ? "Watch" : "Thin";
      return `
        <div class="coverage-item">
          <span>${need}</span>
          <strong>${bench} mentors · ${demand} scholars</strong>
          <span class="muted">Coverage ${coverage}% · ${status}</span>
        </div>
      `;
    })
    .join("");

  const totalAvailability = state.mentors.reduce(
    (sum, mentor) => sum + (getMentorAvailability(mentor) || 0),
    0
  );
  const totalDemand = state.scholars.reduce((sum, scholar) => sum + (scholar.intensity || 0), 0);
  const runway = totalAvailability - totalDemand;
  const runwayLabel =
    runway >= 6 ? "Surplus" : runway >= 0 ? "Balanced" : runway >= -4 ? "Tight" : "Overdrawn";

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="coverage-grid">
      <div class="coverage-block">
        <h4>Timezone balance</h4>
        <div class="coverage-list">
          ${timezoneRows || "<p class=\"muted\">No timezone data yet.</p>"}
        </div>
      </div>
      <div class="coverage-block">
        <h4>Expertise coverage</h4>
        <div class="coverage-list">
          ${expertiseRows || "<p class=\"muted\">No expertise needs captured.</p>"}
        </div>
      </div>
      <div class="coverage-block">
        <h4>Hours runway</h4>
        <div class="coverage-metric">
          <div>
            <span class="muted">Available hours</span>
            <strong>${totalAvailability}</strong>
          </div>
          <div>
            <span class="muted">Scholar demand</span>
            <strong>${totalDemand}</strong>
          </div>
          <div>
            <span class="muted">Runway</span>
            <strong>${runway} hrs · ${runwayLabel}</strong>
          </div>
        </div>
      </div>
    </div>
  `;
  elements.coverageBoard.appendChild(card);
};

const renderRecruitmentPlan = () => {
  if (!elements.recruitmentPlan) return;
  elements.recruitmentPlan.innerHTML = "";

  if (!state.mentors.length && !state.scholars.length) {
    elements.recruitmentPlan.innerHTML = "<p>Add mentors and scholars to see hiring guidance.</p>";
    return;
  }

  const totalScholars = state.scholars.length;
  const totalMentors = state.mentors.length;
  const totalCapacity = state.mentors.reduce((sum, mentor) => sum + (mentor.capacity || 0), 0);
  const totalAvailability = state.mentors.reduce(
    (sum, mentor) => sum + (getMentorAvailability(mentor) || 0),
    0
  );
  const totalDemand = state.scholars.reduce((sum, scholar) => sum + (scholar.intensity || 0), 0);

  const avgCapacity = totalMentors ? totalCapacity / totalMentors : 0;
  const avgAvailability = totalMentors ? totalAvailability / totalMentors : 0;
  const fallbackCapacity = avgCapacity || 2;
  const fallbackAvailability = avgAvailability || 4;

  const capacityDeficit = Math.max(totalScholars - totalCapacity, 0);
  const hoursTarget = Math.ceil(totalDemand * 1.1);
  const hoursDeficit = Math.max(hoursTarget - totalAvailability, 0);
  const neededByCapacity = capacityDeficit
    ? Math.ceil(capacityDeficit / Math.max(fallbackCapacity, 1))
    : 0;
  const neededByHours = hoursDeficit
    ? Math.ceil(hoursDeficit / Math.max(fallbackAvailability, 1))
    : 0;
  const recommendedMentors = Math.max(neededByCapacity, neededByHours);

  const unassignedScholars = state.scholars.filter(
    (scholar) => !state.assignments[scholar.id]
  );
  const unmetNeeds = unassignedScholars.reduce((acc, scholar) => {
    (scholar.needs || []).forEach((need) => {
      acc[need] = (acc[need] || 0) + 1;
    });
    return acc;
  }, {});
  const topNeeds = Object.entries(unmetNeeds)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([need, count]) => `${need} (${count})`)
    .join(", ");

  const timezoneCoverage = {};
  state.scholars.forEach((scholar) => {
    const zone = scholar.timezone || "Timezone TBD";
    if (!timezoneCoverage[zone]) {
      timezoneCoverage[zone] = { scholars: 0, mentors: 0 };
    }
    timezoneCoverage[zone].scholars += 1;
  });
  state.mentors.forEach((mentor) => {
    const zone = mentor.timezone || "Timezone TBD";
    if (!timezoneCoverage[zone]) {
      timezoneCoverage[zone] = { scholars: 0, mentors: 0 };
    }
    timezoneCoverage[zone].mentors += 1;
  });

  const timezoneGaps = Object.entries(timezoneCoverage)
    .filter(([, data]) => data.scholars > 0)
    .map(([zone, data]) => ({
      zone,
      ratio: data.mentors / data.scholars,
      mentors: data.mentors,
      scholars: data.scholars,
    }))
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 3)
    .map((item) => `${item.zone} (${item.mentors}/${item.scholars})`)
    .join(", ");

  const cohortGaps = unassignedScholars.reduce((acc, scholar) => {
    const cohort = scholar.cohort || "Unassigned cohort";
    acc[cohort] = (acc[cohort] || 0) + 1;
    return acc;
  }, {});
  const topCohorts = Object.entries(cohortGaps)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cohort, count]) => `${cohort} (${count})`)
    .join(", ");

  const summaryCard = document.createElement("div");
  summaryCard.className = "card recruitment-card";
  summaryCard.innerHTML = `
    <div class="signal">
      <strong>Recommended net new mentors</strong>
      <span>${recommendedMentors ? recommendedMentors : "0"} needed to hit coverage + buffer</span>
    </div>
    <div class="signal">
      <strong>Capacity gap</strong>
      <span>${capacityDeficit} scholar slots short · Avg capacity ${fallbackCapacity.toFixed(1)}</span>
    </div>
    <div class="signal">
      <strong>Hours buffer</strong>
      <span>${hoursDeficit} hrs short · Target ${hoursTarget} hrs/week</span>
    </div>
  `;

  const focusCard = document.createElement("div");
  focusCard.className = "card recruitment-card";
  focusCard.innerHTML = `
    <div class="signal">
      <strong>Priority expertise</strong>
      <span>${topNeeds || "No unmet expertise gaps."}</span>
    </div>
    <div class="signal">
      <strong>Timezone gaps</strong>
      <span>${timezoneGaps || "No timezone gaps."}</span>
    </div>
    <div class="signal">
      <strong>Cohorts waiting</strong>
      <span>${topCohorts || "All cohorts staffed."}</span>
    </div>
  `;

  const list = document.createElement("div");
  list.className = "list";
  list.appendChild(summaryCard);
  list.appendChild(focusCard);
  elements.recruitmentPlan.appendChild(list);
};

const findReassignmentOptions = (scholar, currentMentorId) =>
  state.mentors
    .filter((mentor) => mentor.id !== currentMentorId)
    .map((mentor) => {
      const hasCapacity = getMentorLoadCount(mentor.id) < mentor.capacity;
      const availability = getMentorAvailability(mentor);
      const hasHours =
        availability === 0 ||
        getMentorLoadHours(mentor.id) + (scholar.intensity || 0) <= availability;
      return {
        mentor,
        score: scoreMentor(mentor, scholar),
        eligible: hasCapacity && hasHours,
      };
    })
    .filter((option) => option.eligible)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

const renderRebalanceBoard = () => {
  if (!elements.rebalanceBoard) return;
  elements.rebalanceBoard.innerHTML = "";

  if (!state.mentors.length && !state.scholars.length) {
    elements.rebalanceBoard.innerHTML = "<p>Add mentors and scholars to see rebalance options.</p>";
    return;
  }

  const overloadedMentors = state.mentors.filter((mentor) => {
    const overCapacity = getMentorLoadCount(mentor.id) > getMentorCapacity(mentor);
    const availability = getMentorAvailability(mentor);
    const overHours = availability > 0 && getMentorLoadHours(mentor.id) > availability;
    return overCapacity || overHours;
  });

  if (!overloadedMentors.length) {
    elements.rebalanceBoard.innerHTML =
      "<p>No mentors are currently overloaded. Coverage looks balanced.</p>";
    return;
  }

  const list = document.createElement("div");
  list.className = "list";

  overloadedMentors.forEach((mentor) => {
    const assignedScholars = getMentorAssignments(mentor.id);
    const card = document.createElement("div");
    card.className = "card rebalance-card";
    const overCapacity = getMentorLoadCount(mentor.id) - getMentorCapacity(mentor);
    const availability = getMentorAvailability(mentor);
    const overHours =
      availability > 0 ? getMentorLoadHours(mentor.id) - availability : 0;

    const scholarRows = assignedScholars
      .map((scholar) => {
        const options = findReassignmentOptions(scholar, mentor.id);
        const optionButtons = options.length
          ? options
              .map(
                (option) => `
                <button class="ghost" data-reassign="1" data-scholar="${scholar.id}" data-mentor="${option.mentor.id}">
                  Move to ${option.mentor.name}
                </button>
              `
              )
              .join("")
          : `<span class="muted">No alternate mentors with capacity.</span>`;

        return `
          <div class="rebalance-row">
            <div>
              <strong>${scholar.name}</strong>
              <p class="muted">${scholar.cohort || "Cohort TBD"} · ${scholar.intensity || 0} hrs/week</p>
            </div>
            <div class="rebalance-actions">
              ${optionButtons}
            </div>
          </div>
        `;
      })
      .join("");

    card.innerHTML = `
      <div class="card-header">
        <h3>${mentor.name}</h3>
        <span class="badge">Rebalance</span>
      </div>
      <div class="signal">
        <strong>${getMentorLoadCount(mentor.id)} assigned · ${getMentorLoadHours(mentor.id)} hrs</strong>
        <span>Capacity ${mentor.capacity} · Availability ${mentor.availability} hrs</span>
      </div>
      <div class="alert">
        ${
          overCapacity > 0
            ? `Over capacity by ${overCapacity} mentee${overCapacity === 1 ? "" : "s"}. `
            : ""
        }${
          overHours > 0
            ? `Over hours by ${overHours} hr${overHours === 1 ? "" : "s"}.`
            : ""
        }
      </div>
      <div class="rebalance-rows">
        ${scholarRows || "<p class=\"muted\">No scholars assigned.</p>"}
      </div>
    `;
    list.appendChild(card);
  });

  elements.rebalanceBoard.appendChild(list);

  elements.rebalanceBoard.querySelectorAll("button[data-reassign]").forEach((button) => {
    button.addEventListener("click", () => {
      const scholarId = button.dataset.scholar;
      const mentorId = button.dataset.mentor;
      if (!scholarId || !mentorId) return;
      assignMentor(scholarId, mentorId);
    });
  });
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

const setSyncStatus = (message, tone = "neutral") => {
  if (!elements.syncStatus) return;
  elements.syncStatus.textContent = message;
  elements.syncStatus.classList.remove("is-error", "is-success", "is-loading");
  if (tone !== "neutral") {
    elements.syncStatus.classList.add(`is-${tone}`);
  }
};

const formatSnapshotTime = (timestamp) => {
  if (!timestamp) return "Unknown time";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString();
};

const renderSnapshotHistory = (snapshots) => {
  if (!elements.snapshotList) return;
  if (!snapshots || !snapshots.length) {
    elements.snapshotList.innerHTML =
      '<div class="snapshot-empty">No cloud snapshots yet. Save one to start a history.</div>';
    return;
  }

  const list = document.createElement("div");
  list.className = "snapshot-list";
  snapshots.forEach((snapshot) => {
    const card = document.createElement("div");
    card.className = "snapshot-card";
    const notePreview = snapshot.notes ? snapshot.notes.slice(0, 120) : "";
    card.innerHTML = `
      <strong>${formatSnapshotTime(snapshot.created_at || snapshot.createdAt)}</strong>
      <div class="snapshot-meta">
        <span>Mentors: ${snapshot.mentor_count ?? "–"}</span>
        <span>Scholars: ${snapshot.scholar_count ?? "–"}</span>
        <span>Assignments: ${snapshot.assignment_count ?? "–"}</span>
      </div>
      ${notePreview ? `<span class="muted">${notePreview}</span>` : ""}
      <div class="snapshot-actions">
        <button class="ghost" data-snapshot-id="${snapshot.id}">Load snapshot</button>
      </div>
    `;
    list.appendChild(card);
  });

  elements.snapshotList.innerHTML = "";
  elements.snapshotList.appendChild(list);
};

const fetchSnapshotHistory = async () => {
  if (!elements.snapshotList) return;
  elements.snapshotList.innerHTML =
    '<div class="snapshot-empty">Loading snapshot history...</div>';
  try {
    const response = await fetch(`${CLOUD_ENDPOINT}?list=1&limit=6`);
    if (!response.ok) {
      throw new Error("History fetch failed");
    }
    const data = await response.json();
    renderSnapshotHistory(data.snapshots || []);
  } catch (error) {
    console.error(error);
    elements.snapshotList.innerHTML =
      '<div class="snapshot-empty">Unable to load snapshot history.</div>';
  }
};

const renderAll = () => {
  renderMentors();
  renderScholars();
  renderMatches();
  renderSignals();
  renderCohortBoard();
  renderEngagementPlan();
  renderActionQueue();
  renderDependencyBoard();
  renderCoverageBoard();
  renderRecruitmentPlan();
  renderRebalanceBoard();
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
  state.lastSyncedAt = null;
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
      ingestState(parsed);
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

const unwrapCloudPayload = (payload) => {
  if (!payload || typeof payload !== "object") return payload;
  if (payload.data && typeof payload.data === "object") return payload.data;
  if (payload.payload && typeof payload.payload === "object") return payload.payload;
  return payload;
};

const saveToCloud = async () => {
  setSyncStatus("Saving snapshot to cloud...", "loading");
  try {
    const payload = {
      ...state,
      lastSyncedAt: new Date().toISOString(),
    };
    const response = await fetch(CLOUD_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error("Save failed");
    }
    const data = await response.json();
    state.lastSyncedAt = data.updatedAt || data.created_at || payload.lastSyncedAt;
    saveState();
    setSyncStatus(`Cloud snapshot saved at ${new Date(state.lastSyncedAt).toLocaleString()}.`, "success");
    fetchSnapshotHistory();
  } catch (error) {
    console.error(error);
    setSyncStatus("Cloud save failed. Check your connection or API status.", "error");
  }
};

const loadFromCloud = async (snapshotId) => {
  setSyncStatus("Loading snapshot from cloud...", "loading");
  try {
    const url = snapshotId ? `${CLOUD_ENDPOINT}?id=${snapshotId}` : CLOUD_ENDPOINT;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Load failed");
    }
    const data = await response.json();
    const rawPayload = data.payload || data.data || {};
    const payload = unwrapCloudPayload(rawPayload) || {};
    ingestState(payload);
    state.lastSyncedAt = data.updatedAt || data.created_at || payload.lastSyncedAt || null;
    saveState();
    renderAll();
    setSyncStatus(
      `Cloud snapshot loaded from ${new Date(state.lastSyncedAt).toLocaleString()}.`,
      "success"
    );
    fetchSnapshotHistory();
  } catch (error) {
    console.error(error);
    setSyncStatus("Cloud load failed. Check your connection or API status.", "error");
  }
};

loadState();
if (elements.notes) {
  elements.notes.value = state.notes;
}
if (state.lastSyncedAt) {
  setSyncStatus(`Last cloud sync: ${new Date(state.lastSyncedAt).toLocaleString()}.`, "success");
}
renderAll();
fetchSnapshotHistory();

elements.mentorForm.addEventListener("submit", handleMentorSubmit);
elements.scholarForm.addEventListener("submit", handleScholarSubmit);
elements.generateMatches.addEventListener("click", renderMatches);
elements.autoAssign.addEventListener("click", autoAssignMatches);
elements.exportJson.addEventListener("click", exportData);
elements.importJson.addEventListener("change", importData);
elements.resetData.addEventListener("click", seedSampleData);
if (elements.saveCloud) {
  elements.saveCloud.addEventListener("click", saveToCloud);
}
if (elements.loadCloud) {
  elements.loadCloud.addEventListener("click", loadFromCloud);
}
if (elements.refreshHistory) {
  elements.refreshHistory.addEventListener("click", fetchSnapshotHistory);
}
if (elements.snapshotList) {
  elements.snapshotList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-snapshot-id]");
    if (!button) return;
    const snapshotId = button.dataset.snapshotId;
    if (!snapshotId) return;
    loadFromCloud(snapshotId);
  });
}
elements.notes.addEventListener("input", handleNotesChange);
