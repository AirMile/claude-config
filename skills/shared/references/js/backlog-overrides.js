// Override MoSCoW labels: use plain P1/P2/P3/P4
if (typeof PHASE_LABELS !== "undefined") {
  PHASE_LABELS.P1 = "P1";
  PHASE_LABELS.P2 = "P2";
  PHASE_LABELS.P3 = "P3";
  PHASE_LABELS.P4 = "P4";
}
// Override status colors: kanban flow (grey→blue→orange→green)
document.documentElement.style.setProperty("--def", "#58a6ff");
document.documentElement.style.setProperty("--blt", "#d29922");
if (typeof STATUS_COLORS !== "undefined") {
  STATUS_COLORS.DEF = "#58a6ff";
  STATUS_COLORS.BLT = "#d29922";
}
// Remove "Geen items" empty placeholders
document.querySelectorAll(".empty").forEach(function (el) {
  el.remove();
});
// Migrate: remove TST column from existing backlogs
// const/let vars are in global scope but not on window — access directly
var _tsi = typeof STATUSES !== "undefined" ? STATUSES.indexOf("TST") : -1;
if (_tsi !== -1) STATUSES.splice(_tsi, 1);
if (typeof STATUS_COLORS !== "undefined") delete STATUS_COLORS.TST;
// Migrate TST features to DONE
if (typeof data !== "undefined" && data.features) {
  var _migrated = false;
  data.features.forEach(function (f) {
    if (f.status === "TST") {
      f.status = "DONE";
      _migrated = true;
    }
  });
  if (_migrated && typeof syncJSON !== "undefined") syncJSON();
}
