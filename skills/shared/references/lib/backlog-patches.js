// Backlog CSS+JS patch: injected into backlog HTML to customize the UI

var backlogPatch = `<style>
  body > header { display:none !important; }
  .promote-btn { display:none !important; }
  #detail-promote { display:none !important; }
  .stats { display:none !important; }
  .board { min-height: calc(100vh - 48px) !important; }
  .column-header { padding: 10px 12px !important; }
  .edit-btn { display:none !important; }
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
  .card-clip { background:none !important; border:none !important; color:var(--text-dim) !important; cursor:pointer; padding:2px !important; opacity:0; transition:opacity 0.15s !important; flex-shrink:0; }
  .card:hover .card-clip { opacity:1; }
  .card-clip:hover { color:var(--accent,#58a6ff) !important; }
  .card-clip.copied { color:var(--done,#3fb950) !important; opacity:1; }
  .card-menu { position:relative; }
  .card-menu-dropdown { display:none; position:absolute; top:100%; right:0; margin-top:4px; background:var(--surface); border:1px solid var(--border); border-radius:6px; padding:2px 0; min-width:80px; z-index:100; box-shadow:0 4px 12px rgba(0,0,0,0.4); }
  .card-menu-dropdown.open { display:block; }
  .card-menu-dropdown button { display:flex; align-items:center; gap:6px; width:100% !important; padding:5px 10px !important; background:none !important; border:none !important; color:var(--text-dim); font-size:12px; cursor:pointer; transition:all 0.1s; font-family:inherit; height:auto !important; border-radius:0 !important; justify-content:flex-start !important; white-space:nowrap; }
  .card-menu-dropdown button:hover { background:var(--surface-hover,#1c2333); color:var(--text,#e6edf3); }
  .card-menu-dropdown .menu-delete:hover { color:var(--danger,#f85149) !important; background:var(--danger-bg,rgba(248,81,73,0.1)) !important; }
</style>
<script>
(function(){
  var NEXT = {TODO:"define",DEF:"build",BLT:"test",TST:"refactor"};
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
          // Insert before hamburger menu
          var menuEl = actions.querySelector(".card-menu");
          if (menuEl) actions.insertBefore(clipBtn, menuEl);
          else actions.appendChild(clipBtn);
        }
      }
      if (actions && !actions.querySelector(".card-menu")) {
        // Remove old buttons
        actions.querySelectorAll(".detail-btn, .delete-btn, .edit-btn").forEach(function(b) { b.remove(); });
        // Add hamburger menu
        var menu = document.createElement("div");
        menu.className = "card-menu";
        menu.innerHTML = '<button class="menu-btn" title="Menu">\\u2630</button><div class="card-menu-dropdown"><button class="menu-details">Details</button><button class="menu-delete">Verwijder</button></div>';
        actions.appendChild(menu);
        menu.querySelector(".menu-btn").addEventListener("click", function(e) {
          e.stopPropagation();
          var dd = menu.querySelector(".card-menu-dropdown");
          document.querySelectorAll(".card-menu-dropdown.open").forEach(function(d) { if (d !== dd) d.classList.remove("open"); });
          dd.classList.toggle("open");
        });
        menu.querySelector(".menu-details").addEventListener("click", function(e) {
          e.stopPropagation();
          menu.querySelector(".card-menu-dropdown").classList.remove("open");
          openDetailModal(f.name);
        });
        menu.querySelector(".menu-delete").addEventListener("click", function(e) {
          e.stopPropagation();
          menu.querySelector(".card-menu-dropdown").classList.remove("open");
          openDeleteModal(f.name);
        });
      }
      return card;
    };
  }
  // Close menus on outside click
  document.addEventListener("click", function() {
    document.querySelectorAll(".card-menu-dropdown.open").forEach(function(d) { d.classList.remove("open"); });
  });
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
  if (window.render) render();
})();
</script>
<script>
(function(){
  var base = location.pathname.replace(/\\/backlog\\/?$/, "");
  var es = new EventSource(base + "/events");
  es.onmessage = function(e) {
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
