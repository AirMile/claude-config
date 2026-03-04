// Role guard: restrict backlog UI for teammates
// Must be loaded LAST in the patch chain (after all other patches)
(function () {
  if (window.__role !== "teammate") return;

  // ── Hide add/edit/delete controls ──

  // Hide column "+" add buttons (in header)
  var style = document.createElement("style");
  style.textContent =
    ".column-header button, .add-item-btn, #modal-save, #modal-delete { display:none !important; }" +
    ".detail-actions #detail-edit, .detail-actions #detail-delete, .detail-actions .btn-danger { display:none !important; }" +
    ".detail-actions #detail-copy { display:none !important; }";
  document.head.appendChild(style);

  // ── Add "Claim" button in detail modal ──
  var detailActions = document.querySelector("#detail-modal .detail-actions");
  if (detailActions && !document.getElementById("detail-claim")) {
    var claimBtn = document.createElement("button");
    claimBtn.id = "detail-claim";
    claimBtn.className = "btn-copy";
    claimBtn.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg> Claim';
    claimBtn.style.display = "none";
    detailActions.insertBefore(claimBtn, detailActions.firstChild);

    claimBtn.addEventListener("click", function () {
      var name = claimBtn.dataset.feature;
      if (!name || !window.__userName) return;
      var found = typeof findItem !== "undefined" ? findItem(name) : null;
      if (!found) return;
      found.item.assignee = window.__userName;
      if (typeof syncJSON === "function") syncJSON();
      if (typeof render === "function") render();
      // Close detail modal
      var modal = document.getElementById("detail-modal");
      if (modal) modal.classList.remove("visible");
      if (typeof toast === "function")
        toast("Geclaimed door " + window.__userName);
    });
  }

  // ── Add "Brief" copy button in detail modal ──
  var briefBtn = document.createElement("button");
  briefBtn.id = "detail-brief";
  briefBtn.className = "btn-copy";
  briefBtn.innerHTML =
    '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M5 11H3.5A1.5 1.5 0 012 9.5v-7A1.5 1.5 0 013.5 1h7A1.5 1.5 0 0112 2.5V5"/></svg> Brief';
  briefBtn.style.display = "none";
  if (detailActions) {
    detailActions.insertBefore(briefBtn, detailActions.firstChild);
  }

  briefBtn.addEventListener("click", function () {
    var name = briefBtn.dataset.feature;
    if (!name) return;
    var found = typeof findItem !== "undefined" ? findItem(name) : null;
    if (!found) return;
    if (typeof generateTaskBrief === "function") {
      generateTaskBrief(found.item).then(function (brief) {
        navigator.clipboard.writeText(brief).then(function () {
          if (typeof toast === "function") toast("Brief gekopieerd");
        });
      });
    }
  });

  // ── Patch openDetailModal: show/hide claim + brief buttons ──
  var origDetail = window.openDetailModal;
  if (origDetail) {
    window.openDetailModal = function (name) {
      origDetail(name);
      var found = typeof findItem !== "undefined" ? findItem(name) : null;
      if (!found) return;

      // Claim button: show if not yet assigned to this user
      var cb = document.getElementById("detail-claim");
      if (cb) {
        cb.dataset.feature = name;
        cb.style.display =
          found.item.assignee === window.__userName ? "none" : "";
      }

      // Brief button: always show
      var bb = document.getElementById("detail-brief");
      if (bb) {
        bb.dataset.feature = name;
        bb.style.display = "";
      }
    };
  }

  // ── Override card clipboard: always copy brief ──
  var origCreateCard = window.createCard;
  if (origCreateCard) {
    window.createCard = function (f) {
      var card = origCreateCard(f);
      // Replace existing clip button behavior
      var clipBtn = card.querySelector(".card-clip");
      if (clipBtn) {
        var newClip = clipBtn.cloneNode(true);
        newClip.title = "Kopieer task brief";
        clipBtn.parentNode.replaceChild(newClip, clipBtn);
        newClip.addEventListener("click", function (e) {
          e.stopPropagation();
          if (typeof generateTaskBrief === "function") {
            generateTaskBrief(f).then(function (brief) {
              navigator.clipboard.writeText(brief).then(function () {
                if (typeof toast === "function") toast("Brief gekopieerd");
                newClip.classList.add("copied");
                setTimeout(function () {
                  newClip.classList.remove("copied");
                }, 1500);
              });
            });
          }
        });
      }
      return card;
    };
  }

  // Re-render to apply role guard
  if (typeof render === "function") render();
})();
