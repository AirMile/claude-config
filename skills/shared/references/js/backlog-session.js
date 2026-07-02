// SSE: live backlog updates + live skill signals (.project/session/active-*.json)
(function () {
  var base = location.pathname.replace(/\/backlog\/?$/, "");

  // Fetch active skill signals → window._activeSessions (map: feature → entry)
  // Consumed by the template (getLiveSignal) for the IN PROGRESS section.
  function refreshSessions() {
    fetch(base + "/session")
      .then(function (r) {
        return r.json();
      })
      .then(function (list) {
        var map = {};
        (list || []).forEach(function (entry) {
          if (entry && entry.feature) map[entry.feature] = entry;
        });
        var changed =
          JSON.stringify(map) !== JSON.stringify(window._activeSessions || {});
        window._activeSessions = map;
        if (!changed) return;
        var modal = document.getElementById("detail-modal");
        if (modal && modal.classList.contains("visible")) return;
        render();
      })
      .catch(function () {});
  }

  var es = new EventSource(base + "/events");
  es.onmessage = function (e) {
    if (e.data === "session") {
      refreshSessions();
      return;
    }
    if (e.data !== "backlog") return;
    var modal = document.getElementById("detail-modal");
    if (modal && modal.classList.contains("visible")) return;
    fetch(base + "/backlog/data")
      .then(function (r) {
        return r.json();
      })
      .then(function (newData) {
        if (JSON.stringify(newData) === JSON.stringify(data)) return;
        data = newData;
        render();
        toast("Backlog bijgewerkt");
      })
      .catch(function () {});
  };

  // Initial load: pick up signals from skills already running, then re-render.
  refreshSessions();
})();
