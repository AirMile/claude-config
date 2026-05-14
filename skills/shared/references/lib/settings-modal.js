/**
 * Project settings modal (team mode toggle).
 * Self-mounts a floating ⚙ button on project pages (backlog + dashboard).
 *
 * Host page contract:
 *   window.SettingsModal.configure({
 *     projectDir: "<slug>",         // required — used in POST URL
 *     getMode:    () => "solo",      // required — reads current team.mode
 *     onSaved:    (mode) => render() // required — called after successful save
 *   });
 *   window.SettingsModal.mountToggle(container); // inline icon toggle
 *
 * Without configure() the button still mounts but logs a warning on click.
 */
(function () {
  "use strict";

  var config = null;

  function configure(opts) {
    config = opts || {};
  }

  function postMode(mode) {
    var projectDir = (config && config.projectDir) || "";
    return fetch("/" + projectDir + "/settings/team-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: mode }),
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error("HTTP " + res.status + ": " + t);
        });
      }
      return res.json();
    });
  }

  var SOLO_SVG =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>' +
    '<circle cx="12" cy="7" r="4"/>' +
    "</svg>";

  var TEAM_SVG =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>' +
    '<circle cx="9" cy="7" r="4"/>' +
    '<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>' +
    '<path d="M16 3.13a4 4 0 0 1 0 7.75"/>' +
    "</svg>";

  function applyMode(btn, mode) {
    btn.dataset.mode = mode;
    if (mode === "team") {
      btn.innerHTML = TEAM_SVG;
      btn.dataset.tooltip = "Team mode — click for solo";
      btn.setAttribute("aria-label", "Team mode (click to switch to solo)");
    } else {
      btn.innerHTML = SOLO_SVG;
      btn.dataset.tooltip = "Solo mode — click for team";
      btn.setAttribute("aria-label", "Solo mode (click to switch to team)");
    }
    btn.removeAttribute("title");
  }

  function buildToggleEl(current) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "team-mode-icon";
    applyMode(btn, current === "team" ? "team" : "solo");
    return { btn: btn };
  }

  function mountToggle(container) {
    if (!container) return;
    if (container.dataset.toggleMounted) return; // idempotent
    container.dataset.toggleMounted = "1";

    injectStyles(); // guarantee CSS present before icon renders

    if (!config || !config.projectDir) {
      console.warn(
        "[settings-modal] mountToggle called before configure() — call configure() first",
      );
      return;
    }

    var current = (config.getMode && config.getMode()) || "solo";
    var els = buildToggleEl(current);
    container.appendChild(els.btn);

    els.btn.addEventListener("click", function () {
      var newMode = els.btn.dataset.mode === "team" ? "solo" : "team";
      els.btn.classList.add("is-saving");
      postMode(newMode)
        .then(function () {
          els.btn.classList.remove("is-saving");
          applyMode(els.btn, newMode);
          if (config.onSaved) config.onSaved(newMode);
        })
        .catch(function (err) {
          els.btn.classList.remove("is-saving");
          var errEl = container.querySelector(".team-mode-toggle-error");
          if (!errEl) {
            errEl = document.createElement("span");
            errEl.className = "team-mode-toggle-error";
            container.appendChild(errEl);
          }
          errEl.textContent = err.message || String(err);
          setTimeout(function () {
            errEl.textContent = "";
          }, 4000);
        });
    });
  }

  function openModal() {
    if (!config || !config.projectDir) {
      console.warn(
        "[settings-modal] not configured — call SettingsModal.configure() first",
      );
      return;
    }
    var current = (config.getMode && config.getMode()) || "solo";

    var existing = document.querySelector(".settings-modal-overlay");
    if (existing) existing.remove();

    var els = buildToggleEl(current);

    var overlay = document.createElement("div");
    overlay.className = "settings-modal-overlay";

    var modal = document.createElement("div");
    modal.className = "settings-modal";

    var h3 = document.createElement("h3");
    h3.textContent = "Project settings";

    var modeLabel = document.createElement("label");
    modeLabel.className = "settings-modal-label";
    modeLabel.textContent = "Mode";

    var optionsRow = document.createElement("div");
    optionsRow.className = "settings-modal-options";

    var modeText = document.createElement("span");
    modeText.className = "settings-modal-mode-text";
    function syncModeText() {
      modeText.textContent = els.btn.dataset.mode === "team" ? "Team" : "Solo";
    }
    syncModeText();

    els.btn.addEventListener("click", function () {
      var next = els.btn.dataset.mode === "team" ? "solo" : "team";
      applyMode(els.btn, next);
      syncModeText();
    });

    optionsRow.appendChild(els.btn);
    optionsRow.appendChild(modeText);

    var actionsDiv = document.createElement("div");
    actionsDiv.className = "settings-modal-actions";

    var cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "settings-modal-cancel";
    cancelBtn.textContent = "Cancel";

    var saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "settings-modal-save";
    saveBtn.textContent = "Save";

    actionsDiv.appendChild(cancelBtn);
    actionsDiv.appendChild(saveBtn);

    var errBox = document.createElement("div");
    errBox.className = "settings-modal-error";
    errBox.style.display = "none";

    modal.appendChild(h3);
    modal.appendChild(modeLabel);
    modal.appendChild(optionsRow);
    modal.appendChild(actionsDiv);
    modal.appendChild(errBox);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function close() {
      overlay.remove();
    }

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    cancelBtn.addEventListener("click", close);
    saveBtn.addEventListener("click", function () {
      var mode = els.btn.dataset.mode;
      errBox.style.display = "none";
      postMode(mode)
        .then(function () {
          close();
          if (config.onSaved) config.onSaved(mode);
        })
        .catch(function (err) {
          errBox.textContent = err.message || String(err);
          errBox.style.display = "block";
        });
    });
  }

  function injectStyles() {
    if (document.getElementById("settings-modal-styles")) return;
    var s = document.createElement("style");
    s.id = "settings-modal-styles";
    s.textContent =
      // Modal
      ".settings-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:10001}" +
      ".settings-modal{background:var(--surface,#161b22);border:1px solid var(--border,#30363d);border-radius:8px;padding:24px;min-width:340px;max-width:480px;color:var(--text,#e6edf3)}" +
      ".settings-modal h3{margin:0 0 16px;font-size:16px}" +
      ".settings-modal-label{display:block;font-size:12px;color:var(--text-muted,#8b949e);margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em}" +
      ".settings-modal-options{display:flex;align-items:center;gap:10px;margin-bottom:24px}" +
      ".settings-modal-mode-text{font-size:13px;color:var(--text,#e6edf3)}" +
      ".settings-modal-actions{display:flex;justify-content:flex-end;gap:8px}" +
      ".settings-modal-actions button{padding:6px 14px;border-radius:6px;border:1px solid var(--border,#30363d);background:transparent;color:var(--text,#e6edf3);font-size:13px;cursor:pointer}" +
      ".settings-modal-save{background:var(--accent,#58a6ff)!important;border-color:var(--accent,#58a6ff)!important;color:#fff!important}" +
      ".settings-modal-error{margin-top:12px;padding:8px 12px;background:var(--danger-bg,#f8514922);color:var(--danger,#f85149);border-radius:6px;font-size:12px}" +
      // Icon toggle (subtle, dark-mode-icon style)
      ".team-mode-icon{position:relative;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;background:transparent;border:none;border-radius:6px;color:var(--text-muted,#8b949e);cursor:pointer;padding:0;transition:color .15s,background .15s,transform .15s}" +
      ".team-mode-icon:hover{color:var(--text,#e6edf3);background:var(--surface-hover,#1c2333)}" +
      '.team-mode-icon[data-mode="team"]{color:var(--accent,#58a6ff)}' +
      '.team-mode-icon[data-mode="team"]:hover{color:var(--accent,#58a6ff);background:var(--surface-hover,#1c2333)}' +
      ".team-mode-icon.is-saving{opacity:.55;pointer-events:none}" +
      ".team-mode-icon svg{display:block}" +
      // Tooltip on hover
      ".team-mode-icon[data-tooltip]::after{content:attr(data-tooltip);position:absolute;top:calc(100% + 8px);right:0;background:var(--surface,#161b22);color:var(--text,#e6edf3);border:1px solid var(--border,#30363d);border-radius:6px;padding:5px 9px;font-size:11px;font-weight:500;white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis;pointer-events:none;opacity:0;transform:translateY(-4px);transition:opacity .15s,transform .15s;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.25)}" +
      '.team-mode-icon[data-tooltip]::before{content:"";position:absolute;top:calc(100% + 2px);right:10px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:6px solid var(--border,#30363d);pointer-events:none;opacity:0;transition:opacity .15s;z-index:10000}' +
      ".team-mode-icon[data-tooltip]:hover::after,.team-mode-icon[data-tooltip]:focus-visible::after{opacity:1;transform:translateY(0)}" +
      ".team-mode-icon[data-tooltip]:hover::before,.team-mode-icon[data-tooltip]:focus-visible::before{opacity:1}" +
      ".team-mode-toggle-error{font-size:11px;color:var(--danger,#f85149);margin-left:4px}" +
      "@media(max-width:640px){.top-nav-toggle,.content-toolbar-mode-toggle{display:none}}";
    document.head.appendChild(s);
  }

  // Inject styles immediately on script load so the icon never renders unstyled
  // (script is loaded synchronously in <head>, so document.head is available).
  if (document.head) {
    injectStyles();
  } else {
    document.addEventListener("DOMContentLoaded", injectStyles);
  }

  window.SettingsModal = {
    configure: configure,
    open: openModal,
    mountToggle: mountToggle,
  };
})();
