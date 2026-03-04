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
  .phase-p1 { color:#d1453b !important; border-color:#d1453b55 !important; }
  .phase-p2 { color:#eb8909 !important; border-color:#eb890955 !important; }
  .phase-p3 { color:#246fe0 !important; border-color:#246fe055 !important; }
  .phase-p4 { color:#8b949e !important; border-color:#8b949e55 !important; }
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
// Override MoSCoW labels: use plain P1/P2/P3/P4
if (typeof PHASE_LABELS !== "undefined") { PHASE_LABELS.P1 = "P1"; PHASE_LABELS.P2 = "P2"; PHASE_LABELS.P3 = "P3"; PHASE_LABELS.P4 = "P4"; }
// Override status colors: kanban flow (grey→blue→orange→green)
document.documentElement.style.setProperty("--def", "#58a6ff");
document.documentElement.style.setProperty("--blt", "#d29922");
if (typeof STATUS_COLORS !== "undefined") { STATUS_COLORS.DEF = "#58a6ff"; STATUS_COLORS.BLT = "#d29922"; }
// Remove "Geen items" empty placeholders
document.querySelectorAll(".empty").forEach(function(el) { el.remove(); });
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
// Patch: assignee support for existing backlogs
(function(){
  // 1. Inject assignee input field into modal if not present
  if (!document.getElementById("field-assignee")) {
    var depInput = document.getElementById("field-dep");
    if (depInput) {
      var lbl = document.createElement("label");
      lbl.setAttribute("for", "field-assignee");
      lbl.textContent = "Toewijzen aan (optioneel)";
      lbl.style.cssText = "display:block;font-size:11px;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;";
      var inp = document.createElement("input");
      inp.type = "text"; inp.id = "field-assignee"; inp.placeholder = "naam teammate";
      inp.style.cssText = "width:100%;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:6px 8px;font-size:13px;font-family:inherit;margin-bottom:12px;outline:none;";
      depInput.parentNode.insertBefore(lbl, depInput.nextSibling);
      lbl.parentNode.insertBefore(inp, lbl.nextSibling);
    }
  }
  // 2. Patch openAddModal: clear assignee field
  var origAdd = window.openAddModal;
  if (origAdd) {
    window.openAddModal = function(status) {
      origAdd(status);
      var f = document.getElementById("field-assignee");
      if (f) f.value = "";
    };
  }
  // 3. Patch openEditModal: populate assignee field
  var origEdit = window.openEditModal;
  if (origEdit) {
    window.openEditModal = function(name) {
      origEdit(name);
      var found = window.findItem(name);
      var f = document.getElementById("field-assignee");
      if (f && found) f.value = found.item.assignee || "";
    };
  }
  // 4. Patch save: after the template's handler saves, set assignee on the feature
  var saveBtn = document.getElementById("modal-save");
  if (saveBtn) {
    saveBtn.addEventListener("click", function() {
      var f = document.getElementById("field-assignee");
      var nameField = document.getElementById("field-name");
      if (!f || !nameField) return;
      var assigneeVal = f.value.trim() || null;
      var featureName = nameField.value.trim();
      if (!featureName) return;
      // Use setTimeout(0) to run after the template's handler has saved
      setTimeout(function() {
        var found = window.findItem(featureName);
        if (found) {
          found.item.assignee = assigneeVal;
          if (typeof syncJSON === "function") syncJSON();
          if (typeof render === "function") render();
        }
      }, 0);
    });
  }
  // 5. Patch createCard: show assignee badge on cards
  var _baseCreateAssignee = window.createCard;
  if (_baseCreateAssignee) {
    window.createCard = function(f) {
      var card = _baseCreateAssignee(f);
      if (f.assignee && !card.querySelector(".card-assignee")) {
        var el = document.createElement("div");
        el.className = "card-assignee";
        el.innerHTML = '<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg> ' + (typeof esc !== "undefined" ? esc(f.assignee) : f.assignee);
        card.appendChild(el);
      }
      return card;
    };
  }
  // 6. Patch openDetailModal: show assignee in detail view
  var _baseDetail = window.openDetailModal;
  if (_baseDetail) {
    window.openDetailModal = function(name) {
      _baseDetail(name);
      var found = window.findItem(name);
      if (!found) return;
      var body = document.getElementById("detail-body");
      if (body && found.item.assignee && !body.querySelector(".assignee-field")) {
        var tags = body.querySelector(".detail-tags");
        var ref = tags ? tags.closest(".detail-field") : null;
        var html = '<div class="detail-field assignee-field"><div class="detail-label">Toegewezen aan</div><div class="detail-value">' + (typeof esc !== "undefined" ? esc(found.item.assignee) : found.item.assignee) + '</div></div>';
        if (ref && ref.nextSibling) {
          ref.insertAdjacentHTML("afterend", html);
        } else if (body.firstChild) {
          body.children[0].insertAdjacentHTML("afterend", html);
        }
      }
    };
  }
})();
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
      // Swap tag order: phase-tag before badge
      var tags = card.querySelector(".card-tags");
      if (tags) { var phase = tags.querySelector(".phase-tag"); if (phase) tags.insertBefore(phase, tags.firstChild); }
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
        var showClip = verb || f.assignee;
        if (showClip) {
          var clipBtn = document.createElement("button");
          clipBtn.className = "card-clip";
          var clipSvg = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M5 11H3.5A1.5 1.5 0 012 9.5v-7A1.5 1.5 0 013.5 1h7A1.5 1.5 0 0112 2.5V5"/></svg>';
          var checkSvg = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8.5l3.5 3.5 7-7"/></svg>';
          if (f.assignee) {
            clipBtn.title = "Kopieer task brief voor " + f.assignee;
          } else {
            clipBtn.title = "/" + prefix + "-" + verb + " " + f.name;
          }
          clipBtn.innerHTML = clipSvg;
          clipBtn.addEventListener("click", function(e) {
            e.stopPropagation();
            function showCopied(msg) {
              clipBtn.classList.add("copied");
              clipBtn.innerHTML = checkSvg;
              toast(msg);
              setTimeout(function() {
                clipBtn.classList.remove("copied");
                clipBtn.innerHTML = clipSvg;
              }, 1500);
            }
            if (f.assignee && typeof generateTaskBrief === "function") {
              generateTaskBrief(f).then(function(brief) {
                navigator.clipboard.writeText(brief).then(function() {
                  showCopied("Task brief gekopieerd voor " + f.assignee);
                });
              });
            } else if (verb) {
              var cmd = "/" + prefix + "-" + verb + " " + f.name;
              navigator.clipboard.writeText(cmd).then(function() {
                showCopied("Gekopieerd: " + cmd);
              });
            }
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
        var copySvg = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M5 11H3.5A1.5 1.5 0 012 9.5v-7A1.5 1.5 0 013.5 1h7A1.5 1.5 0 0112 2.5V5"/></svg>';
        if (found.item.assignee) {
          cb.innerHTML = copySvg + " Brief";
          cb.title = "Kopieer task brief voor " + found.item.assignee;
          cb.dataset.cmd = "";
          cb.dataset.assignee = found.item.assignee;
          cb.dataset.feature = found.item.name;
          cb.style.display = "";
        } else if (verb) {
          var cmd = "/" + prefix + "-" + verb + " " + found.item.name;
          cb.innerHTML = copySvg + " Kopieer";
          cb.title = cmd;
          cb.dataset.cmd = cmd;
          cb.dataset.assignee = "";
          cb.dataset.feature = "";
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
    window.render = function() { _prevRender(); document.querySelectorAll(".empty").forEach(function(el){ el.remove(); }); patchDeps(); };
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
</script>
<script>
// Task brief generator: produces markdown brief for teammate assignment
window.generateTaskBrief = async function(f) {
  var lines = [];
  lines.push("## " + f.name);
  lines.push("**Type:** " + f.type + " | **Prioriteit:** " + (f.phase || "P1") + " | **Status:** " + f.status);
  lines.push("");
  if (f.description) { lines.push("### Beschrijving"); lines.push(f.description); lines.push(""); }

  // Fetch feature.json for rich data (DEF+ status)
  var detail = null;
  try {
    var basePath = location.pathname.replace(/\\/backlog\\/?$/, "").replace(/\\/+$/, "");
    var res = await fetch(basePath + "/feature/" + encodeURIComponent(f.name));
    if (res.ok) detail = await res.json();
  } catch(e) {}

  if (detail) {
    if (detail.summary) { lines.push(detail.summary); lines.push(""); }
    if (detail.requirements && detail.requirements.length) {
      lines.push("### Requirements");
      lines.push("| # | Requirement | Acceptatiecriteria |");
      lines.push("|---|------------|-------------------|");
      detail.requirements.forEach(function(r) {
        lines.push("| " + r.id + " | " + r.description + " | " + (r.acceptance || "-") + " |");
      });
      lines.push("");
    }
    if (detail.files && detail.files.length) {
      lines.push("### Bestanden");
      detail.files.forEach(function(file) {
        lines.push("- " + file.action + " " + file.path + " — " + (file.purpose || ""));
      });
      lines.push("");
    }
    if (detail.buildSequence && detail.buildSequence.length) {
      lines.push("### Build Volgorde");
      detail.buildSequence.forEach(function(step) {
        lines.push(step.step + ". " + step.description);
      });
      lines.push("");
    }
    if (detail.testStrategy && detail.testStrategy.length) {
      lines.push("### Test Strategie");
      detail.testStrategy.forEach(function(t) {
        lines.push("- " + (t.requirementId || t.id || "") + ": " + (t.description || t.approach || ""));
      });
      lines.push("");
    }
    if (detail.durableDecisions && detail.durableDecisions.length) {
      lines.push("### Beslissingen");
      detail.durableDecisions.forEach(function(d) { lines.push("- " + d); });
      lines.push("");
    }
  }

  if (f.dependency) {
    var depFound = typeof findItem !== "undefined" ? findItem(f.dependency) : null;
    var depStatus = depFound ? depFound.item.status : "onbekend";
    lines.push("### Dependencies");
    lines.push("- Afhankelijk van: **" + f.dependency + "** (status: " + depStatus + ")");
    lines.push("");
  }

  return lines.join("\\n");
};
</script>
<script>
// Patch render: sort cards by priority (P1 first) within each column
(function(){
  var PHASE_ORDER = {P1:1, P2:2, P3:3, P4:4};
  var _origRenderSort = window.render;
  if (_origRenderSort) {
    window.render = function() {
      _origRenderSort();
      document.querySelectorAll(".cards").forEach(function(container) {
        var cards = Array.from(container.children);
        if (cards.length < 2) return;
        cards.sort(function(a, b) {
          var pa = 4, pb = 4;
          var tagA = a.querySelector(".phase-tag");
          var tagB = b.querySelector(".phase-tag");
          if (tagA) { for (var k in PHASE_ORDER) { if (tagA.classList.contains("phase-" + k.toLowerCase())) { pa = PHASE_ORDER[k]; break; } } }
          if (tagB) { for (var k in PHASE_ORDER) { if (tagB.classList.contains("phase-" + k.toLowerCase())) { pb = PHASE_ORDER[k]; break; } } }
          return pa - pb;
        });
        cards.forEach(function(c) { container.appendChild(c); });
      });
    };
  }
  if (window.render) render();
})();
</script>`;

module.exports = backlogPatch;
