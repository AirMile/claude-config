// Active session indicators + SSE
(function () {
  var base = location.pathname.replace(/\/backlog\/?$/, "");
  var SKILL_LABELS = {
    define: "defining",
    plan: "planning",
    build: "building",
    test: "testing",
    debug: "debugging",
    refactor: "refactoring",
  };
  var activeFeatures = [];

  function updateActiveCards() {
    // Remove old indicators
    document.querySelectorAll(".card-active").forEach(function (c) {
      c.classList.remove("card-active");
      var badge = c.querySelector(".active-badge");
      if (badge) badge.remove();
    });
    if (!activeFeatures.length) return;
    // Build lookup: feature name → skill
    var lookup = {};
    activeFeatures.forEach(function (a) {
      if (a.feature) lookup[a.feature] = a.skill;
    });
    // Find matching cards
    document.querySelectorAll(".card").forEach(function (c) {
      var skill = lookup[c.dataset.name];
      if (!skill) return;
      c.classList.add("card-active");
      var label = SKILL_LABELS[skill] || skill;
      var badge = document.createElement("span");
      badge.className = "active-badge";
      badge.innerHTML = '<span class="active-dot"></span>' + label + "\u2026";
      var tags = c.querySelector(".card-tags");
      if (tags) tags.appendChild(badge);
    });
  }

  function fetchSession() {
    fetch(base + "/session")
      .then(function (r) {
        return r.json();
      })
      .then(function (list) {
        if (!Array.isArray(list)) list = list.feature ? [list] : [];
        if (JSON.stringify(list) === JSON.stringify(activeFeatures)) return;
        activeFeatures = list;
        updateActiveCards();
      })
      .catch(function () {});
  }

  // Patch render to re-apply indicators after board redraw
  var origRender = window.render;
  if (origRender) {
    window.render = function () {
      origRender();
      updateActiveCards();
    };
  }

  // Initial fetch
  fetchSession();

  // SSE
  var es = new EventSource(base + "/events");
  es.onmessage = function (e) {
    if (e.data === "session") {
      fetchSession();
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
})();
