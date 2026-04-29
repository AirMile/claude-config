// Override phase labels: plain P1/P2/P3/P4
if (typeof PHASE_LABELS !== "undefined") {
  PHASE_LABELS.P1 = "P1";
  PHASE_LABELS.P2 = "P2";
  PHASE_LABELS.P3 = "P3";
  PHASE_LABELS.P4 = "P4";
}

// Override statuses: 4-status list (To define → To build → To verify → To refactor)
if (typeof STATUSES !== "undefined") {
  STATUSES.length = 0;
  STATUSES.push("TODO", "DEFINED", "DOING", "DONE");
}

// Display labels for status sections
if (typeof STATUS_LABELS === "undefined") {
  window.STATUS_LABELS = {};
}
STATUS_LABELS.TODO = "To define";
STATUS_LABELS.DEFINED = "To build";
STATUS_LABELS.DOING = "To verify";
STATUS_LABELS.DONE = "To refactor";

if (typeof STATUS_COLORS !== "undefined") {
  delete STATUS_COLORS.DEF;
  delete STATUS_COLORS.BLT;
  delete STATUS_COLORS.TST;
  STATUS_COLORS.DEFINED = "var(--defined)";
  STATUS_COLORS.DOING = "var(--doing)";
  STATUS_COLORS.DONE = "var(--done)";
}
document.documentElement.style.setProperty("--doing", "#58a6ff");
document.documentElement.style.setProperty("--defined", "#d29922");

// Next skill helper: status-only routing
window.getNextSkill = function (f) {
  if (f.status === "TODO") return "define";
  if (f.status === "DEFINED") return "build";
  if (f.status === "DOING") return "verify";
  return null;
};

// Override updateStatus: no stage logic
if (typeof updateStatus !== "undefined") {
  window.updateStatus = function (name, newStatus) {
    var found = typeof findItem !== "undefined" ? findItem(name) : null;
    if (!found) return;
    found.item.status = newStatus;
    delete found.item.stage;
    if (newStatus === "DONE") {
      found.item.date = new Date().toISOString().slice(0, 10);
    }
  };
}

// Migrate: strip stage from all existing items
if (typeof data !== "undefined" && data.features) {
  var _migrated = false;
  data.features.forEach(function (f) {
    if (f.stage !== undefined) {
      delete f.stage;
      _migrated = true;
    }
  });
  if (_migrated && typeof syncJSON !== "undefined") syncJSON();
}
