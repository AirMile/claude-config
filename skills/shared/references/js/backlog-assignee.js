// Patch: assignee support for existing backlogs
(function () {
  // 1. Inject assignee input field into modal if not present
  if (!document.getElementById("field-assignee")) {
    var depInput = document.getElementById("field-dep");
    if (depInput) {
      var lbl = document.createElement("label");
      lbl.setAttribute("for", "field-assignee");
      lbl.textContent = "Toewijzen aan (optioneel)";
      lbl.style.cssText =
        "display:block;font-size:11px;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;";
      var inp = document.createElement("input");
      inp.type = "text";
      inp.id = "field-assignee";
      inp.placeholder = "naam teammate";
      inp.style.cssText =
        "width:100%;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:6px 8px;font-size:13px;font-family:inherit;margin-bottom:12px;outline:none;";
      depInput.parentNode.insertBefore(lbl, depInput.nextSibling);
      lbl.parentNode.insertBefore(inp, lbl.nextSibling);
    }
  }
  // 2. Patch openAddModal: clear assignee field
  var origAdd = window.openAddModal;
  if (origAdd) {
    window.openAddModal = function (status) {
      origAdd(status);
      var f = document.getElementById("field-assignee");
      if (f) f.value = "";
    };
  }
  // 3. Patch openEditModal: populate assignee field
  var origEdit = window.openEditModal;
  if (origEdit) {
    window.openEditModal = function (name) {
      origEdit(name);
      var found = window.findItem(name);
      var f = document.getElementById("field-assignee");
      if (f && found) f.value = found.item.assignee || "";
    };
  }
  // 4. Patch save: after the template's handler saves, set assignee on the feature
  var saveBtn = document.getElementById("modal-save");
  if (saveBtn) {
    saveBtn.addEventListener("click", function () {
      var f = document.getElementById("field-assignee");
      var nameField = document.getElementById("field-name");
      if (!f || !nameField) return;
      var assigneeVal = f.value.trim() || null;
      var featureName = nameField.value.trim();
      if (!featureName) return;
      // Use setTimeout(0) to run after the template's handler has saved
      setTimeout(function () {
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
    window.createCard = function (f) {
      var card = _baseCreateAssignee(f);
      if (f.assignee && !card.querySelector(".card-assignee")) {
        var el = document.createElement("div");
        el.className = "card-assignee";
        el.innerHTML =
          '<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg> ' +
          (typeof esc !== "undefined" ? esc(f.assignee) : f.assignee);
        card.appendChild(el);
      }
      return card;
    };
  }
  // 6. Patch openDetailModal: show assignee in detail view
  var _baseDetail = window.openDetailModal;
  if (_baseDetail) {
    window.openDetailModal = function (name) {
      _baseDetail(name);
      var found = window.findItem(name);
      if (!found) return;
      var body = document.getElementById("detail-body");
      if (
        body &&
        found.item.assignee &&
        !body.querySelector(".assignee-field")
      ) {
        var tags = body.querySelector(".detail-tags");
        var ref = tags ? tags.closest(".detail-field") : null;
        var html =
          '<div class="detail-field assignee-field"><div class="detail-label">Toegewezen aan</div><div class="detail-value">' +
          (typeof esc !== "undefined"
            ? esc(found.item.assignee)
            : found.item.assignee) +
          "</div></div>";
        if (ref && ref.nextSibling) {
          ref.insertAdjacentHTML("afterend", html);
        } else if (body.firstChild) {
          body.children[0].insertAdjacentHTML("afterend", html);
        }
      }
    };
  }
})();
