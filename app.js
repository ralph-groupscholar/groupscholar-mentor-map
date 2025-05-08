const STORAGE_KEY = "mentor-map-data-v1";
const NOTES_KEY = "mentor-map-notes-v1";

const defaultData = {
  mentors: [
    {
      id: "m1",
      name: "Avery Chen",
      role: "AI Program Director",
      tags: ["ai", "scholarships", "mentorship"],
      availability: 6,
      capacity: 4,
      timezone: "ET",
      notes: "Focus on first-gen leadership",
      assignedIds: ["s3"],
    },
    {
      id: "m2",
      name: "Kiana Ngu",
      role: "Product Strategy Lead",
      tags: ["product", "storytelling", "leadership"],
      availability: 4,
      capacity: 3,
      timezone: "CT",
      notes: "Open to mock interviews",
      assignedIds: [],
    },
    {
      id: "m3",
      name: "Mateo Ruiz",
      role: "STEM Partnerships",
      tags: ["stem", "partnering", "funding"],
      availability: 5,
      capacity: 2,
      timezone: "PT",
      notes: "Prefers cohorts with projects",
      assignedIds: ["s1"],
    },
    {
      id: "m4",
      name: "Sabine Okoro",
      role: "Scholar Support Coach",
      tags: ["wellbeing", "career", "interviews"],
      availability: 7,
      capacity: 5,
      timezone: "ET",
      notes: "Strong in mock interview prep",
      assignedIds: ["s2"],
    },
  ],
  scholars: [
    {
      id: "s1",
      name: "Jordan Alvarez",
      cohort: "Spring 2026",
      needs: ["stem", "scholarships", "interviews"],
      intensity: 4,
      urgency: 4,
      timezone: "PT",
      notes: "Needs grant writing support",
      assignedMentorId: "m3",
    },
    {
      id: "s2",
      name: "Renee Patel",
      cohort: "Spring 2026",
      needs: ["career", "leadership", "internships"],
      intensity: 3,
      urgency: 3,
      timezone: "ET",
      notes: "Preparing for summer internship",
      assignedMentorId: "m4",
    },
    {
      id: "s3",
      name: "Malik Robinson",
      cohort: "Spring 2026",
      needs: ["ai", "product", "storytelling"],
      intensity: 2,
      urgency: 2,
      timezone: "CT",
      notes: "Interested in AI storytelling",
      assignedMentorId: "m1",
    },
  ],
};

const state = {
  data: loadData(),
};

const elements = {
  mentorList: document.querySelector("#mentor-list"),
  scholarList: document.querySelector("#scholar-list"),
  matchList: document.querySelector("#match-list"),
  signalBoard: document.querySelector("#signal-board"),
  headlineMetrics: document.querySelector("#headline-metrics"),
  jsonPreview: document.querySelector("#json-preview"),
  mentorForm: document.querySelector("#mentor-form"),
  scholarForm: document.querySelector("#scholar-form"),
  notes: document.querySelector("#notes"),
};

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return structuredClone(defaultData);
  }
  try {
    return JSON.parse(raw);
  } catch {
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function normalizeTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

function getMentorCapacity(mentor) {
  return mentor.capacity - mentor.assignedIds.length;
}

function scoreMatch(mentor, scholar) {
  const overlap = mentor.tags.filter((tag) => scholar.needs.includes(tag)).length;
  const capacity = getMentorCapacity(mentor);
  const capacityScore = capacity > 0 ? 16 : -30;
  const availabilityScore = mentor.availability >= scholar.intensity ? 10 : 0;
  const timezoneScore = mentor.timezone && mentor.timezone === scholar.timezone ? 6 : 0;
  const urgencyBoost = scholar.urgency * 2;
  const loadPenalty = mentor.assignedIds.length * 4;

  return overlap * 18 + capacityScore + availabilityScore + timezoneScore + urgencyBoost - loadPenalty;
}

function buildMatches() {
  return state.data.scholars.map((scholar) => {
    const ranked = state.data.mentors
      .map((mentor) => ({
        mentor,
        score: scoreMatch(mentor, scholar),
        overlap: mentor.tags.filter((tag) => scholar.needs.includes(tag)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    return { scholar, ranked };
  });
}

function renderMetrics() {
  const mentors = state.data.mentors.length;
  const scholars = state.data.scholars.length;
  const assigned = state.data.scholars.filter((scholar) => scholar.assignedMentorId).length;
  const coverage = Math.round((assigned / Math.max(scholars, 1)) * 100);
  const slots = state.data.mentors.reduce((total, mentor) => total + Math.max(getMentorCapacity(mentor), 0), 0);

  elements.headlineMetrics.innerHTML = `
    <div class="metric"><span>Mentors</span><strong>${mentors}</strong></div>
    <div class="metric"><span>Scholars</span><strong>${scholars}</strong></div>
    <div class="metric"><span>Assigned</span><strong>${coverage}%</strong></div>
    <div class="metric"><span>Open slots</span><strong>${slots}</strong></div>
  `;
}

function renderMentors() {
  elements.mentorList.innerHTML = state.data.mentors
    .map((mentor) => {
      const capacity = getMentorCapacity(mentor);
      return `
        <div class="card">
          <div class="card-header">
            <h3>${mentor.name}</h3>
            <span class="badge">${capacity} open slots</span>
          </div>
          <div>
            <strong>${mentor.role || "Mentor"}</strong>
            <p>${mentor.notes || ""}</p>
          </div>
          <div class="tags">${mentor.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>
          <div class="signal">
            <span>Availability: ${mentor.availability} hrs/week · Capacity: ${mentor.capacity}</span>
            <span>Timezone: ${mentor.timezone || ""}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderScholars() {
  elements.scholarList.innerHTML = state.data.scholars
    .map((scholar) => {
      const mentor = state.data.mentors.find((item) => item.id === scholar.assignedMentorId);
      return `
        <div class="card">
          <div class="card-header">
            <h3>${scholar.name}</h3>
            <span class="badge">Urgency ${scholar.urgency}/5</span>
          </div>
          <div>
            <strong>${scholar.cohort || "Scholar"}</strong>
            <p>${scholar.notes || ""}</p>
          </div>
          <div class="tags">${scholar.needs.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>
          <div class="signal">
            <span>Intensity: ${scholar.intensity} hrs/week · Timezone: ${scholar.timezone || ""}</span>
            <span>Assigned mentor: ${mentor ? mentor.name : "Unassigned"}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderMatches() {
  const matches = buildMatches();
  elements.matchList.innerHTML = matches
    .map((match) => {
      return `
        <div class="card match-card">
          <div class="card-header">
            <h3>${match.scholar.name}</h3>
            <span class="badge">${match.scholar.cohort || "Scholar"}</span>
          </div>
          <div class="tags">${match.scholar.needs.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>
          <div class="list">
            ${match.ranked
              .map((choice) => {
                const remaining = getMentorCapacity(choice.mentor);
                return `
                  <div class="signal">
                    <strong>${choice.mentor.name} · Score ${choice.score}</strong>
                    <span>${choice.mentor.role || "Mentor"} · ${remaining} open slots</span>
                    <span>Overlap: ${choice.overlap.join(", ") || "No shared tags"}</span>
                    <div class="match-actions">
                      <button class="ghost" data-assign="${match.scholar.id}" data-mentor="${choice.mentor.id}">
                        Assign
                      </button>
                      <button class="ghost" data-unassign="${match.scholar.id}">Unassign</button>
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderSignals() {
  const overload = state.data.mentors.filter((mentor) => getMentorCapacity(mentor) < 0);
  const lowCapacity = state.data.mentors.filter((mentor) => getMentorCapacity(mentor) <= 1);
  const loads = state.data.mentors.map((mentor) => mentor.assignedIds.length);
  const maxLoad = Math.max(...loads, 0);
  const minLoad = Math.min(...loads, 0);
  const spread = maxLoad - minLoad;
  const loadAverage = loads.reduce((sum, val) => sum + val, 0) / Math.max(loads.length, 1);

  const scholarNeeds = new Set(state.data.scholars.flatMap((scholar) => scholar.needs));
  const mentorTags = new Set(state.data.mentors.flatMap((mentor) => mentor.tags));
  const gaps = [...scholarNeeds].filter((tag) => !mentorTags.has(tag));

  elements.signalBoard.innerHTML = `
    <div class="signal">
      <strong>Capacity alerts</strong>
      <span>${overload.length} mentors overloaded · ${lowCapacity.length} at risk</span>
      ${lowCapacity
        .map((mentor) => `<div class="alert">${mentor.name}: ${getMentorCapacity(mentor)} slot(s) left</div>`)
        .join("")}
    </div>
    <div class="signal">
      <strong>Fairness spread</strong>
      <span>Load spread is ${spread} mentees · Average ${loadAverage.toFixed(1)} mentees/mentor</span>
    </div>
    <div class="signal">
      <strong>Coverage gaps</strong>
      <span>${gaps.length ? gaps.join(", ") : "All scholar needs are covered by mentor expertise."}</span>
    </div>
  `;
}

function renderPreview() {
  elements.jsonPreview.textContent = JSON.stringify(state.data, null, 2);
}

function renderAll() {
  renderMetrics();
  renderMentors();
  renderScholars();
  renderMatches();
  renderSignals();
  renderPreview();
}

function addMentor(form) {
  const formData = new FormData(form);
  const mentor = {
    id: `m${Date.now()}`,
    name: formData.get("name").toString(),
    role: formData.get("role").toString(),
    tags: normalizeTags(formData.get("tags").toString()),
    availability: Number(formData.get("availability")) || 1,
    capacity: Number(formData.get("capacity")) || 1,
    timezone: formData.get("timezone").toString(),
    notes: formData.get("notes").toString(),
    assignedIds: [],
  };

  state.data.mentors.unshift(mentor);
  saveData();
  renderAll();
  form.reset();
}

function addScholar(form) {
  const formData = new FormData(form);
  const scholar = {
    id: `s${Date.now()}`,
    name: formData.get("name").toString(),
    cohort: formData.get("cohort").toString(),
    needs: normalizeTags(formData.get("needs").toString()),
    intensity: Number(formData.get("intensity")) || 1,
    urgency: Number(formData.get("urgency")) || 1,
    timezone: formData.get("timezone").toString(),
    notes: formData.get("notes").toString(),
    assignedMentorId: null,
  };

  state.data.scholars.unshift(scholar);
  saveData();
  renderAll();
  form.reset();
}

function assignScholar(scholarId, mentorId) {
  const scholar = state.data.scholars.find((item) => item.id === scholarId);
  const mentor = state.data.mentors.find((item) => item.id === mentorId);
  if (!scholar || !mentor) return;

  if (scholar.assignedMentorId && scholar.assignedMentorId !== mentorId) {
    const previous = state.data.mentors.find((item) => item.id === scholar.assignedMentorId);
    if (previous) {
      previous.assignedIds = previous.assignedIds.filter((id) => id !== scholar.id);
    }
  }

  scholar.assignedMentorId = mentorId;
  if (!mentor.assignedIds.includes(scholar.id)) {
    mentor.assignedIds.push(scholar.id);
  }

  saveData();
  renderAll();
}

function unassignScholar(scholarId) {
  const scholar = state.data.scholars.find((item) => item.id === scholarId);
  if (!scholar) return;
  const mentor = state.data.mentors.find((item) => item.id === scholar.assignedMentorId);
  if (mentor) {
    mentor.assignedIds = mentor.assignedIds.filter((id) => id !== scholar.id);
  }
  scholar.assignedMentorId = null;
  saveData();
  renderAll();
}

function autoAssign() {
  const matches = buildMatches();
  matches.forEach((match) => {
    const best = match.ranked.find((choice) => getMentorCapacity(choice.mentor) > 0);
    if (best) {
      assignScholar(match.scholar.id, best.mentor.id);
    }
  });
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "mentor-map-data.json";
  link.click();
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (parsed && parsed.mentors && parsed.scholars) {
        state.data = parsed;
        saveData();
        renderAll();
      }
    } catch {
      // Ignore invalid file
    }
  };
  reader.readAsText(file);
}

function resetData() {
  state.data = structuredClone(defaultData);
  saveData();
  renderAll();
}

function hydrateNotes() {
  const stored = localStorage.getItem(NOTES_KEY);
  if (stored) {
    elements.notes.value = stored;
  }
  elements.notes.addEventListener("input", (event) => {
    localStorage.setItem(NOTES_KEY, event.target.value);
  });
}

function setupEvents() {
  elements.mentorForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addMentor(event.target);
  });

  elements.scholarForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addScholar(event.target);
  });

  document.querySelector("#generate-matches").addEventListener("click", renderAll);
  document.querySelector("#auto-assign").addEventListener("click", autoAssign);
  document.querySelector("#export-json").addEventListener("click", exportJSON);
  document.querySelector("#import-json").addEventListener("change", (event) => {
    if (event.target.files.length) {
      importJSON(event.target.files[0]);
      event.target.value = "";
    }
  });
  document.querySelector("#reset-data").addEventListener("click", resetData);

  elements.matchList.addEventListener("click", (event) => {
    const assignId = event.target.getAttribute("data-assign");
    const mentorId = event.target.getAttribute("data-mentor");
    const unassignId = event.target.getAttribute("data-unassign");
    if (assignId && mentorId) {
      assignScholar(assignId, mentorId);
    }
    if (unassignId) {
      unassignScholar(unassignId);
    }
  });
}

renderAll();
setupEvents();
hydrateNotes();
