// Backlog CSS+JS patch: injected into backlog HTML to customize the UI

var backlogPatch = `<style>
  body > header { display:none !important; }
  .promote-btn { display:none !important; }
  #detail-promote { display:none !important; }
  .stats { display:none !important; }
  .board { min-height: calc(100vh - 48px) !important; }
  .column-header { padding: 10px 12px !important; }
  .edit-btn, .delete-btn, .detail-btn, .add-btn, .column-header .count { display:none !important; }
  .card-actions button { width:20px !important; height:20px !important; border-radius:3px !important; font-size:10px !important; }
  .detail-actions { justify-content:flex-start !important; }
  .detail-actions button { flex:none !important; width:auto !important; height:auto !important; padding:4px 10px !important; font-size:12px !important; display:inline-flex !important; align-items:center !important; gap:4px !important; background:var(--surface) !important; color:var(--text-muted) !important; border:1px solid var(--border) !important; border-radius:4px !important; transition:all 0.15s !important; }
  .detail-actions button:hover { border-color:var(--text-dim) !important; color:var(--text) !important; }
  .detail-actions button.btn-danger:hover { background:var(--danger) !important; color:#fff !important; border-color:var(--danger) !important; }
  .detail-actions .btn-copy:hover { background:var(--accent) !important; color:#fff !important; border-color:var(--accent) !important; }
  .phase-tag { background:transparent !important; border:1px solid !important; }
  .phase-p1 { border-color:#58a6ff55 !important; }
  .phase-p2 { border-color:#d2a8ff55 !important; }
  .phase-p3 { border-color:#8b949e55 !important; }
  .phase-p4 { border-color:#ffa65755 !important; }
  .status-tag { font-size:10px; padding:1px 6px; border-radius:10px; font-weight:600; display:inline-flex; align-items:center; gap:4px; background:transparent; letter-spacing:0.3px; }
  .status-tag::before { content:""; width:6px; height:6px; border-radius:50%; background:currentColor; flex-shrink:0; }
  .copy-cmd-btn { display:none !important; }
  .card-menu { display:none !important; }
  .card-clip { background:none !important; border:none !important; color:var(--text-dim) !important; cursor:pointer; padding:2px !important; opacity:0; transition:opacity 0.15s !important; flex-shrink:0; }
  .card:hover .card-clip { opacity:1; }
  .card-clip:hover { color:var(--accent,#58a6ff) !important; }
  .card-clip.copied { color:var(--done,#3fb950) !important; opacity:1; }
  .card-active { }
  .active-badge { display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:600; padding:1px 7px; border-radius:8px; background:rgba(88,166,255,0.12); color:#58a6ff; letter-spacing:0.2px; white-space:nowrap; }
  .active-badge .active-dot { width:6px; height:6px; border-radius:50%; background:#58a6ff; animation:activeDot 1.5s ease-in-out infinite; flex-shrink:0; }
  @keyframes activeDot { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
</style>
<script>
// Migrate: remove TST column from existing backlogs
// const/let vars are in global scope but not on window — access directly
var _tsi = typeof STATUSES !== "undefined" ? STATUSES.indexOf("TST") : -1;
if (_tsi !== -1) STATUSES.splice(_tsi, 1);
if (typeof STATUS_COLORS !== "undefined") delete STATUS_COLORS.TST;
// Migrate TST features to DONE
if (typeof data !== "undefined" && data.features) {
  var _migrated = false;
  data.features.forEach(function(f) {
    if (f.status === "TST") { f.status = "DONE"; _migrated = true; }
  });
  if (_migrated && typeof syncJSON !== "undefined") syncJSON();
}
// Patch dependency: hide when dependency feature is DONE
(function(){
  var _baseCreate = typeof createCard !== "undefined" ? createCard : null;
  if (_baseCreate) {
    createCard = function(f) {
      var origDep = f.dependency;
      if (f.dependency && typeof findItem !== "undefined") {
        var dep = findItem(f.dependency);
        if (dep && dep.item.status === "DONE") f.dependency = null;
      }
      var card = _baseCreate(f);
      f.dependency = origDep;
      return card;
    };
  }
})();
</script>
<script>
(function(){
  var NEXT = {TODO:"define",DEF:"build",BLT:"test"};
  var prefix = (window.data && window.data.source && window.data.source.startsWith("/game")) ? "game" : "dev";
  // Patch createCard: replace old buttons with hamburger menu
  var origCreate = window.createCard;
  if (origCreate) {
    window.createCard = function(f) {
      var card = origCreate(f);
      var old = card.querySelector(".copy-cmd-btn");
      if (old) old.remove();
      var actions = card.querySelector(".card-actions");
      // Add clipboard button (visible on hover)
      if (actions && !actions.querySelector(".card-clip")) {
        var verb = NEXT[f.status];
        if (verb) {
          var clipBtn = document.createElement("button");
          clipBtn.className = "card-clip";
          clipBtn.title = "/" + prefix + "-" + verb + " " + f.name;
          clipBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M5 11H3.5A1.5 1.5 0 012 9.5v-7A1.5 1.5 0 013.5 1h7A1.5 1.5 0 0112 2.5V5"/></svg>';
          clipBtn.addEventListener("click", function(e) {
            e.stopPropagation();
            var cmd = "/" + prefix + "-" + verb + " " + f.name;
            navigator.clipboard.writeText(cmd).then(function() {
              clipBtn.classList.add("copied");
              clipBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8.5l3.5 3.5 7-7"/></svg>';
              toast("Gekopieerd: " + cmd);
              setTimeout(function() {
                clipBtn.classList.remove("copied");
                clipBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M5 11H3.5A1.5 1.5 0 012 9.5v-7A1.5 1.5 0 013.5 1h7A1.5 1.5 0 0112 2.5V5"/></svg>';
              }, 1500);
            });
          });
          actions.appendChild(clipBtn);
        }
      }
      return card;
    };
  }
  // Capture card clicks: open detail modal
  document.addEventListener("click", function(e) {
    var card = e.target.closest(".card");
    if (!card || e.target.closest("button")) return;
    var name = card.dataset.name;
    if (!name) return;
    e.stopImmediatePropagation();
    openDetailModal(name);
  }, true);
  // Patch detail modal: hide promote, add copy button, make buttons compact with text
  var promoteBtn = document.getElementById("detail-promote");
  if (promoteBtn) promoteBtn.style.display = "none";
  var copySvg = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M5 11H3.5A1.5 1.5 0 012 9.5v-7A1.5 1.5 0 013.5 1h7A1.5 1.5 0 0112 2.5V5"/></svg>';
  var detailActions = document.querySelector("#detail-modal .detail-actions");
  if (detailActions) {
    detailActions.querySelectorAll("button").forEach(function(b) {
      if (b.id === "detail-edit" || b.textContent.match(/bewerk/i)) { b.innerHTML = "\\u270E Bewerk"; b.title = "Bewerken"; }
      if (b.id === "detail-delete" || b.textContent.match(/verwijder/i)) { b.innerHTML = "\\u2715 Verwijder"; b.title = "Verwijderen"; b.className = "btn-danger"; }
      if (b.classList.contains("btn-cancel") || b.textContent.match(/sluit/i)) b.remove();
    });
  }
  if (detailActions && !document.getElementById("detail-copy")) {
    var copyBtn = document.createElement("button");
    copyBtn.id = "detail-copy";
    copyBtn.className = "btn-copy";
    copyBtn.innerHTML = copySvg + " Kopieer";
    copyBtn.style.display = "none";
    detailActions.insertBefore(copyBtn, detailActions.firstChild);
    copyBtn.addEventListener("click", function() {
      var cmd = copyBtn.dataset.cmd;
      if (cmd) navigator.clipboard.writeText(cmd).then(function() { toast("Gekopieerd: " + cmd); });
    });
  }
  // Patch openDetailModal to populate copy button
  var origOpen = window.openDetailModal;
  if (origOpen) {
    window.openDetailModal = function(name) {
      origOpen(name);
      var found = window.findItem(name);
      if (!found) return;
      var verb = NEXT[found.item.status];
      var cb = document.getElementById("detail-copy");
      if (cb) {
        if (verb) {
          var cmd = "/" + prefix + "-" + verb + " " + found.item.name;
          cb.innerHTML = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M5 11H3.5A1.5 1.5 0 012 9.5v-7A1.5 1.5 0 013.5 1h7A1.5 1.5 0 0112 2.5V5"/></svg> Kopieer';
          cb.title = cmd;
          cb.dataset.cmd = cmd;
          cb.style.display = "";
        } else {
          cb.style.display = "none";
        }
      }
    };
  }
  // Patch card-dep: replace arrow with lock icon
  var lockSvg = '<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" style="flex-shrink:0"><path d="M4 7V5a4 4 0 118 0v2h1a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 011-1h1zm2 0h4V5a2 2 0 10-4 0v2z"/></svg>';
  function patchDeps() {
    document.querySelectorAll(".card-dep").forEach(function(el) {
      if (el.dataset.patched) return;
      el.dataset.patched = "1";
      el.innerHTML = el.innerHTML.replace(/\\u2192\\s*/, lockSvg + " ");
    });
  }
  var origRenderDeps = window.render;
  if (origRenderDeps) {
    var _prevRender = window.render;
    window.render = function() { _prevRender(); patchDeps(); };
  }
  patchDeps();
  if (window.render) render();
})();
</script>
<script>
(function(){
  var base = location.pathname.replace(/\\/backlog\\/?$/, "");
  var SKILL_LABELS = {define:"defining",plan:"planning",build:"building",test:"testing",debug:"debugging",refactor:"refactoring"};
  var activeFeatures = [];

  function updateActiveCards() {
    // Remove old indicators
    document.querySelectorAll(".card-active").forEach(function(c) {
      c.classList.remove("card-active");
      var badge = c.querySelector(".active-badge");
      if (badge) badge.remove();
    });
    if (!activeFeatures.length) return;
    // Build lookup: feature name → skill
    var lookup = {};
    activeFeatures.forEach(function(a) { if (a.feature) lookup[a.feature] = a.skill; });
    // Find matching cards
    document.querySelectorAll(".card").forEach(function(c) {
      var skill = lookup[c.dataset.name];
      if (!skill) return;
      c.classList.add("card-active");
      var label = SKILL_LABELS[skill] || skill;
      var badge = document.createElement("span");
      badge.className = "active-badge";
      badge.innerHTML = '<span class="active-dot"></span>' + label + "\\u2026";
      var tags = c.querySelector(".card-tags");
      if (tags) tags.appendChild(badge);
    });
  }

  function fetchSession() {
    fetch(base + "/session").then(function(r){ return r.json(); }).then(function(list) {
      if (!Array.isArray(list)) list = list.feature ? [list] : [];
      if (JSON.stringify(list) === JSON.stringify(activeFeatures)) return;
      activeFeatures = list;
      updateActiveCards();
    }).catch(function(){});
  }

  // Patch render to re-apply indicators after board redraw
  var origRender = window.render;
  if (origRender) {
    window.render = function() {
      origRender();
      updateActiveCards();
    };
  }

  // Initial fetch
  fetchSession();

  // SSE
  var es = new EventSource(base + "/events");
  es.onmessage = function(e) {
    if (e.data === "session") {
      fetchSession();
      return;
    }
    if (e.data !== "backlog") return;
    var modal = document.getElementById("detail-modal");
    if (modal && modal.classList.contains("visible")) return;
    fetch(base + "/backlog/data").then(function(r){ return r.json(); }).then(function(newData) {
      if (JSON.stringify(newData) === JSON.stringify(data)) return;
      data = newData;
      render();
      toast("Backlog bijgewerkt");
    }).catch(function(){});
  };
})();
</script>`;

module.exports = backlogPatch;
