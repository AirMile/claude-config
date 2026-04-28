// Override MoSCoW labels: use plain P1/P2/P3/P4
if (typeof PHASE_LABELS !== "undefined") {
  PHASE_LABELS.P1 = "P1";
  PHASE_LABELS.P2 = "P2";
  PHASE_LABELS.P3 = "P3";
  PHASE_LABELS.P4 = "P4";
}
// Override columns: 4-column kanban (TODO → DEFINED → DOING → DONE)
if (typeof STATUSES !== "undefined") {
  STATUSES.length = 0;
  STATUSES.push("TODO", "DEFINED", "DOING", "DONE");
}
if (typeof STATUS_COLORS !== "undefined") {
  delete STATUS_COLORS.DEF;
  delete STATUS_COLORS.BLT;
  delete STATUS_COLORS.TST;
  STATUS_COLORS.DEFINED = "var(--defined)";
  STATUS_COLORS.DOING = "var(--doing)";
}
document.documentElement.style.setProperty("--doing", "#58a6ff");
document.documentElement.style.setProperty("--defined", "#d29922");
// Next skill helper (status + stage aware)
window.getNextSkill = function (f) {
  if (f.status === "TODO") return "define";
  if (f.status === "DEFINED") return "build";
  if (f.status === "DOING") {
    return (
      {
        building: "build",
        built: "verify",
        verifying: "verify",
        testing: "verify",
      }[f.stage] || "build"
    );
  }
  return null;
};
// Override updateStatus: support stage field; only DOING auto-defaults a stage
if (typeof updateStatus !== "undefined") {
  window.updateStatus = function (name, newStatus, newStage) {
    var found = typeof findItem !== "undefined" ? findItem(name) : null;
    if (!found) return;
    found.item.status = newStatus;
    if (newStatus === "DOING") {
      var isFE =
        typeof FRONTEND_TYPES !== "undefined" &&
        FRONTEND_TYPES.includes(found.item.type);
      found.item.stage =
        newStage || found.item.stage || (isFE ? "building" : "building");
    } else if (newStatus === "TODO") {
      // allow caller to set defining badge while TODO; otherwise strip
      if (newStage) found.item.stage = newStage;
      else delete found.item.stage;
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
      var isFE2 =
        typeof FRONTEND_TYPES !== "undefined" &&
        FRONTEND_TYPES.includes(found.item.type);
      updateStatus(
        name,
        newStatus,
        found.item.stage && found.item.stage !== "defining"
          ? found.item.stage
          : "building",
      );
    } else {
      // TODO / DEFINED / DONE: strip stage on drop
      updateStatus(name, newStatus);
    }
    if (typeof syncJSON !== "undefined") syncJSON();
    if (typeof render !== "undefined") render();
    if (typeof toast !== "undefined")
      toast(name + ": " + oldStatus + " → " + newStatus);
  };
})();
// Override createCard to add stage badges (TODO+defining or DOING+stage) and refactor badge in DONE
var _origCreateCard = window.createCard;
if (_origCreateCard) {
  window.createCard = function (f) {
    var card = _origCreateCard(f);
    var tags = card.querySelector(".card-tags");
    var showStageBadge =
      (f.status === "DOING" || f.status === "TODO") &&
      f.stage &&
      !card.querySelector(".stage-badge");
    if (showStageBadge && tags) {
      var badge = document.createElement("span");
      badge.className = "stage-badge stage-" + f.stage;
      badge.textContent = f.stage;
      tags.appendChild(badge);
    }
    if (
      f.status === "DONE" &&
      f.refactor &&
      tags &&
      !card.querySelector(".refactor-badge")
    ) {
      var rb = document.createElement("span");
      if (f.refactor === "ROLLED_BACK") {
        rb.className = "refactor-badge refactor-rollback";
        rb.title = "Refactor rolled back";
        rb.textContent = "⚠";
      } else {
        rb.className = "refactor-badge refactor-done";
        rb.title = "Refactored";
        rb.textContent = "✓";
      }
      tags.appendChild(rb);
    }
    return card;
  };
}
// Remove "Geen items" empty placeholders
document.querySelectorAll(".empty").forEach(function (el) {
  el.remove();
});
// Migrate: DEF/BLT/TST legacy + DOING+defined → DEFINED + DOING+defining → TODO
if (typeof data !== "undefined" && data.features) {
  var _migrated = false;
  data.features.forEach(function (f) {
    if (f.status === "DEF") {
      f.status = "DEFINED";
      delete f.stage;
      _migrated = true;
    }
    if (f.status === "BLT") {
      f.status = "DOING";
      f.stage = f.stage || "built";
      _migrated = true;
    }
    if (f.status === "TST") {
      f.status = "DONE";
      delete f.stage;
      _migrated = true;
    }
    if (f.status === "DOING" && f.stage === "defined") {
      f.status = "DEFINED";
      delete f.stage;
      _migrated = true;
    }
    if (f.status === "DOING" && f.stage === "defining") {
      f.status = "TODO";
      _migrated = true; // stage "defining" blijft als badge in TODO
    }
  });
  if (_migrated && typeof syncJSON !== "undefined") syncJSON();
}
