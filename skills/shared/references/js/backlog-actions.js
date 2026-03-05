// Card menu, clipboard, detail modal patches
(function () {
  var NEXT = { TODO: "define", DEF: "build", BLT: "test" };
  var prefix =
    window.data && window.data.source && window.data.source.startsWith("/game")
      ? "game"
      : "dev";
  // Patch createCard: replace old buttons with hamburger menu
  var origCreate = window.createCard;
  if (origCreate) {
    window.createCard = function (f) {
      var card = origCreate(f);
      var old = card.querySelector(".copy-cmd-btn");
      if (old) old.remove();
      var actions = card.querySelector(".card-actions");
      // Add clipboard button (visible on hover)
      if (actions && !actions.querySelector(".card-clip")) {
        var verb = NEXT[f.status];
        var showClip = verb || (f.assignee && f.status !== "DONE");
        if (showClip) {
          var clipBtn = document.createElement("button");
          clipBtn.className = "card-clip";
          var clipSvg =
            '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M5 11H3.5A1.5 1.5 0 012 9.5v-7A1.5 1.5 0 013.5 1h7A1.5 1.5 0 0112 2.5V5"/></svg>';
          var checkSvg =
            '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8.5l3.5 3.5 7-7"/></svg>';
          if (f.assignee && f.status === "BLT") {
            clipBtn.title = "/team-test " + f.name;
          } else if (f.assignee) {
            clipBtn.title =
              "/" + prefix + "-" + (verb || "test") + " " + f.name;
          } else {
            clipBtn.title = "/" + prefix + "-" + verb + " " + f.name;
          }
          clipBtn.innerHTML = clipSvg;
          clipBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            function showCopied(msg) {
              clipBtn.classList.add("copied");
              clipBtn.innerHTML = checkSvg;
              toast(msg);
              setTimeout(function () {
                clipBtn.classList.remove("copied");
                clipBtn.innerHTML = clipSvg;
              }, 1500);
            }
            if (f.assignee && f.status === "BLT") {
              var cmd = "/team-test " + f.name;
              navigator.clipboard.writeText(cmd).then(function () {
                showCopied("Gekopieerd: " + cmd);
              });
            } else if (verb) {
              var cmd = "/" + prefix + "-" + verb + " " + f.name;
              navigator.clipboard.writeText(cmd).then(function () {
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
  document.addEventListener(
    "click",
    function (e) {
      var card = e.target.closest(".card");
      if (!card || e.target.closest("button")) return;
      var name = card.dataset.name;
      if (!name) return;
      e.stopImmediatePropagation();
      openDetailModal(name);
    },
    true,
  );
  // Patch detail modal: hide promote, add copy button, make buttons compact with text
  var promoteBtn = document.getElementById("detail-promote");
  if (promoteBtn) promoteBtn.style.display = "none";
  var copySvg =
    '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M5 11H3.5A1.5 1.5 0 012 9.5v-7A1.5 1.5 0 013.5 1h7A1.5 1.5 0 0112 2.5V5"/></svg>';
  var detailActions = document.querySelector("#detail-modal .detail-actions");
  if (detailActions) {
    detailActions.querySelectorAll("button").forEach(function (b) {
      if (b.id === "detail-edit" || b.textContent.match(/bewerk/i)) {
        b.innerHTML = "\u270E Bewerk";
        b.title = "Bewerken";
      }
      if (b.id === "detail-delete" || b.textContent.match(/verwijder/i)) {
        b.innerHTML = "\u2715 Verwijder";
        b.title = "Verwijderen";
        b.className = "btn-danger";
      }
      if (b.classList.contains("btn-cancel") || b.textContent.match(/sluit/i))
        b.remove();
    });
  }
  if (detailActions && !document.getElementById("detail-copy")) {
    var copyBtn = document.createElement("button");
    copyBtn.id = "detail-copy";
    copyBtn.className = "btn-copy";
    copyBtn.innerHTML = copySvg + " Kopieer";
    copyBtn.style.display = "none";
    detailActions.insertBefore(copyBtn, detailActions.firstChild);
    copyBtn.addEventListener("click", function () {
      var assignee = copyBtn.dataset.assignee;
      var feature = copyBtn.dataset.feature;
      if (assignee && feature && typeof generateTaskBrief === "function") {
        var found = window.findItem(feature);
        if (found) {
          generateTaskBrief(found.item).then(function (brief) {
            navigator.clipboard.writeText(brief).then(function () {
              toast("Task brief gekopieerd voor " + assignee);
            });
          });
        }
      } else {
        var cmd = copyBtn.dataset.cmd;
        if (cmd)
          navigator.clipboard.writeText(cmd).then(function () {
            toast("Gekopieerd: " + cmd);
          });
      }
    });
  }
  // Patch openDetailModal to populate copy button
  var origOpen = window.openDetailModal;
  if (origOpen) {
    window.openDetailModal = function (name) {
      origOpen(name);
      var found = window.findItem(name);
      if (!found) return;
      var verb = NEXT[found.item.status];
      var cb = document.getElementById("detail-copy");
      if (cb) {
        var copySvg =
          '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M5 11H3.5A1.5 1.5 0 012 9.5v-7A1.5 1.5 0 013.5 1h7A1.5 1.5 0 0112 2.5V5"/></svg>';
        if (found.item.assignee && found.item.status !== "DONE") {
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
  var lockSvg =
    '<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" style="flex-shrink:0"><path d="M4 7V5a4 4 0 118 0v2h1a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 011-1h1zm2 0h4V5a2 2 0 10-4 0v2z"/></svg>';
  function patchDeps() {
    document.querySelectorAll(".card-dep").forEach(function (el) {
      if (el.dataset.patched) return;
      el.dataset.patched = "1";
      el.innerHTML = el.innerHTML.replace(/\u2192\s*/, lockSvg + " ");
    });
  }
  var origRenderDeps = window.render;
  if (origRenderDeps) {
    var _prevRender = window.render;
    window.render = function () {
      _prevRender();
      document.querySelectorAll(".empty").forEach(function (el) {
        el.remove();
      });
      patchDeps();
    };
  }
  patchDeps();
  if (window.render) render();
})();
