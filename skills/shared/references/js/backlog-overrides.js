// Override MoSCoW labels: use plain P1/P2/P3/P4
if (typeof PHASE_LABELS !== "undefined") {
  PHASE_LABELS.P1 = "P1";
  PHASE_LABELS.P2 = "P2";
  PHASE_LABELS.P3 = "P3";
  PHASE_LABELS.P4 = "P4";
}
// Override columns: 3-column kanban (TODO → DOING → DONE)
if (typeof STATUSES !== "undefined") {
  STATUSES.length = 0;
  STATUSES.push("TODO", "DOING", "DONE");
}
if (typeof STATUS_COLORS !== "undefined") {
  delete STATUS_COLORS.DEF;
  delete STATUS_COLORS.BLT;
  delete STATUS_COLORS.TST;
  STATUS_COLORS.DOING = "var(--doing)";
}
document.documentElement.style.setProperty("--doing", "#58a6ff");
// Next skill helper (stage-aware)
window.getNextSkill = function (f) {
  if (f.status === "TODO") return "define";
  if (f.status === "DOING") {
    return (
      {
        defining: "define",
        defined: "build",
        building: "build",
        built: "test",
        testing: "test",
      }[f.stage] || "define"
    );
  }
  return null;
};
// Override updateStatus: support stage field
if (typeof updateStatus !== "undefined") {
  window.updateStatus = function (name, newStatus, newStage) {
    var found = typeof findItem !== "undefined" ? findItem(name) : null;
    if (!found) return;
    found.item.status = newStatus;
    if (newStatus === "DOING") {
      found.item.stage = newStage || found.item.stage || "defining";
    } else {
      delete found.item.stage;
      if (newStatus === "DONE") {
        found.item.date = new Date().toISOString().slice(0, 10);
      }
    }
  };
}
// Override handleDrop to pass stage
(function () {
  var _origCards = document.querySelectorAll(".cards");
  _origCards.forEach(function (cards) {
    cards.removeEventListener("drop", window.handleDrop);
  });
  window.handleDrop = function (e) {
    e.preventDefault();
    this.classList.remove("drag-over");
    var name = e.dataTransfer.getData("text/plain");
    var newStatus = this.dataset.status;
    if (!name || !newStatus) return;
    var found = typeof findItem !== "undefined" ? findItem(name) : null;
    if (!found) return;
    if (found.item.status === newStatus) return;
    var oldStatus = found.item.status;
    if (newStatus === "DOING") {
      updateStatus(name, newStatus, found.item.stage || "defining");
    } else {
      updateStatus(name, newStatus);
    }
    if (typeof syncJSON !== "undefined") syncJSON();
    if (typeof render !== "undefined") render();
    if (typeof toast !== "undefined")
      toast(name + ": " + oldStatus + " \u2192 " + newStatus);
  };
})();
// Override createCard to add stage badges (skip if template already added one)
var _origCreateCard = window.createCard;
if (_origCreateCard) {
  window.createCard = function (f) {
    var card = _origCreateCard(f);
    if (
      f.status === "DOING" &&
      f.stage &&
      !card.querySelector(".stage-badge")
    ) {
      var badge = document.createElement("span");
      badge.className = "stage-badge stage-" + f.stage;
      badge.textContent = f.stage;
      var tags = card.querySelector(".card-tags");
      if (tags) tags.appendChild(badge);
    }
    return card;
  };
}
// Remove "Geen items" empty placeholders
document.querySelectorAll(".empty").forEach(function (el) {
  el.remove();
});
// Migrate: DEF/BLT/TST → DOING+stage / DONE
if (typeof data !== "undefined" && data.features) {
  var _migrated = false;
  data.features.forEach(function (f) {
    if (f.status === "DEF") {
      f.status = "DOING";
      f.stage = f.stage || "defined";
      _migrated = true;
    }
    if (f.status === "BLT") {
      f.status = "DOING";
      f.stage = f.stage || "built";
      _migrated = true;
    }
    if (f.status === "TST") {
      f.status = "DONE";
      _migrated = true;
    }
  });
  if (_migrated && typeof syncJSON !== "undefined") syncJSON();
}
