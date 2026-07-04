// SSE: live backlog updates + live skill signals (.project/session/active-*.json)
(function () {
  var base = location.pathname.replace(/\/backlog\/?$/, "");

  function modalOpen() {
    var modal = document.getElementById("detail-modal");
    return !!(modal && modal.classList.contains("visible"));
  }

  // Compare only meaningful content: /backlog/data returns the raw store,
  // while the page-load data is enriched with worktrees/mainState. Dropping
  // those before comparing avoids false-positive "updated" toasts on reconnect.
  function coreJson(o) {
    if (!o) return "";
    var c = Object.assign({}, o);
    delete c.worktrees;
    delete c.mainState;
    return JSON.stringify(c);
  }

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
        if (!changed || modalOpen()) return;
        render();
      })
      .catch(function () {});
  }

  // Re-fetch backlog data and re-render if the content changed.
  function refreshBacklog() {
    if (modalOpen()) return;
    fetch(base + "/backlog/data")
      .then(function (r) {
        return r.json();
      })
      .then(function (newData) {
        if (coreJson(newData) === coreJson(data)) return;
        data = newData;
        render();
        toast("Backlog updated");
      })
      .catch(function () {});
  }

  var connected = false;

  var es = new EventSource(base + "/events");
  es.onmessage = function (e) {
    if (e.data === "session") {
      refreshSessions();
      return;
    }
    if (e.data !== "backlog") return;
    refreshBacklog();
  };

  // On (re)connect the server captures a fresh mtime baseline and will NOT
  // replay changes that happened while we were disconnected — e.g. after
  // laptop sleep, a network drop, or a `node --watch` restart on a code edit.
  // Catch up explicitly so a tab that was backgrounded shows current state.
  // The very first connect is skipped: the page already has fresh data.
  es.onopen = function () {
    if (!connected) {
      connected = true;
      return;
    }
    refreshBacklog();
    refreshSessions();
  };

  // Background tabs get their SSE callbacks throttled/suspended, so live
  // events can be missed while hidden. Force a catch-up when the tab is
  // shown again (covers the "it changed while I wasn't looking" case).
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      refreshBacklog();
      refreshSessions();
    }
  });

  // Initial load: pick up signals from skills already running, then re-render.
  refreshSessions();
})();
