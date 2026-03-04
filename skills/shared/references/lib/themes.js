/**
 * Theme system for backlog and dashboard.
 * Provides color profiles (GitHub, Catppuccin, Tokyo Night, Nord, Custom)
 * with dark/light mode toggle, persisted via localStorage.
 *
 * Usage: loaded synchronously in <head> before CSS to prevent FOUC.
 */
(function () {
  "use strict";

  const STORAGE_PROFILE = "dashboard-theme-profile";
  const STORAGE_MODE = "dashboard-theme-mode";
  const STORAGE_CUSTOM = "dashboard-theme-custom";

  // ─── Theme definitions ──────────────────────────────────────
  // Each profile has dark + light variants with all CSS token values.
  const THEMES = {
    github: {
      name: "GitHub",
      dark: {
        "--bg": "#0d1117",
        "--surface": "#161b22",
        "--surface-hover": "#1c2333",
        "--border": "#30363d",
        "--text": "#e6edf3",
        "--text-muted": "#8b949e",
        "--text-dim": "#6e7681",
        "--accent": "#58a6ff",
        "--accent-subtle": "#58a6ff08",
        "--accent-tint": "#58a6ff11",
        "--active-bg": "rgba(88, 166, 255, 0.12)",
        "--danger": "#f85149",
        "--danger-bg": "#f8514922",
        "--done": "#3fb950",
        "--warn": "#d29922",
        "--orange": "#ffa657",
        "--purple": "#d2a8ff",
        "--pink": "#f778ba",
        "--todo": "#8b949e",
        "--def": "#58a6ff",
        "--blt": "#d29922",
        "--tst": "#ffa657",
        "--p1": "#d1453b",
        "--p2": "#eb8909",
        "--p3": "#246fe0",
        "--p4": "#8b949e",
        "--todo-color": "#9ca3af",
        "--def-color": "#a78bfa",
        "--blt-color": "#60a5fa",
        "--tst-color": "#fb923c",
        "--done-color": "#34d399",
      },
      light: {
        "--bg": "#ffffff",
        "--surface": "#f6f8fa",
        "--surface-hover": "#eef1f5",
        "--border": "#d0d7de",
        "--text": "#1f2328",
        "--text-muted": "#656d76",
        "--text-dim": "#8b949e",
        "--accent": "#0969da",
        "--accent-subtle": "#0969da08",
        "--accent-tint": "#0969da11",
        "--active-bg": "rgba(9, 105, 218, 0.12)",
        "--danger": "#cf222e",
        "--danger-bg": "#cf222e22",
        "--done": "#1a7f37",
        "--warn": "#9a6700",
        "--orange": "#bc4c00",
        "--purple": "#8250df",
        "--pink": "#bf3989",
        "--todo": "#656d76",
        "--def": "#0969da",
        "--blt": "#9a6700",
        "--tst": "#bc4c00",
        "--p1": "#cf222e",
        "--p2": "#bc4c00",
        "--p3": "#0969da",
        "--p4": "#656d76",
        "--todo-color": "#656d76",
        "--def-color": "#8250df",
        "--blt-color": "#0969da",
        "--tst-color": "#bc4c00",
        "--done-color": "#1a7f37",
      },
    },
    catppuccin: {
      name: "Catppuccin",
      dark: {
        // Mocha
        "--bg": "#1e1e2e",
        "--surface": "#181825",
        "--surface-hover": "#313244",
        "--border": "#45475a",
        "--text": "#cdd6f4",
        "--text-muted": "#a6adc8",
        "--text-dim": "#6c7086",
        "--accent": "#89b4fa",
        "--accent-subtle": "#89b4fa08",
        "--accent-tint": "#89b4fa11",
        "--active-bg": "rgba(137, 180, 250, 0.12)",
        "--danger": "#f38ba8",
        "--danger-bg": "#f38ba822",
        "--done": "#a6e3a1",
        "--warn": "#f9e2af",
        "--orange": "#fab387",
        "--purple": "#cba6f7",
        "--pink": "#f5c2e7",
        "--todo": "#6c7086",
        "--def": "#89b4fa",
        "--blt": "#f9e2af",
        "--tst": "#fab387",
        "--p1": "#f38ba8",
        "--p2": "#fab387",
        "--p3": "#89b4fa",
        "--p4": "#6c7086",
        "--todo-color": "#a6adc8",
        "--def-color": "#cba6f7",
        "--blt-color": "#89b4fa",
        "--tst-color": "#fab387",
        "--done-color": "#a6e3a1",
      },
      light: {
        // Latte
        "--bg": "#eff1f5",
        "--surface": "#e6e9ef",
        "--surface-hover": "#ccd0da",
        "--border": "#bcc0cc",
        "--text": "#4c4f69",
        "--text-muted": "#6c6f85",
        "--text-dim": "#9ca0b0",
        "--accent": "#1e66f5",
        "--accent-subtle": "#1e66f508",
        "--accent-tint": "#1e66f511",
        "--active-bg": "rgba(30, 102, 245, 0.12)",
        "--danger": "#d20f39",
        "--danger-bg": "#d20f3922",
        "--done": "#40a02b",
        "--warn": "#df8e1d",
        "--orange": "#fe640b",
        "--purple": "#8839ef",
        "--pink": "#ea76cb",
        "--todo": "#9ca0b0",
        "--def": "#1e66f5",
        "--blt": "#df8e1d",
        "--tst": "#fe640b",
        "--p1": "#d20f39",
        "--p2": "#fe640b",
        "--p3": "#1e66f5",
        "--p4": "#9ca0b0",
        "--todo-color": "#6c6f85",
        "--def-color": "#8839ef",
        "--blt-color": "#1e66f5",
        "--tst-color": "#fe640b",
        "--done-color": "#40a02b",
      },
    },
    tokyonight: {
      name: "Tokyo Night",
      dark: {
        // Night
        "--bg": "#1a1b26",
        "--surface": "#24283b",
        "--surface-hover": "#292e42",
        "--border": "#414868",
        "--text": "#c0caf5",
        "--text-muted": "#a9b1d6",
        "--text-dim": "#565f89",
        "--accent": "#7aa2f7",
        "--accent-subtle": "#7aa2f708",
        "--accent-tint": "#7aa2f711",
        "--active-bg": "rgba(122, 162, 247, 0.12)",
        "--danger": "#f7768e",
        "--danger-bg": "#f7768e22",
        "--done": "#9ece6a",
        "--warn": "#e0af68",
        "--orange": "#ff9e64",
        "--purple": "#bb9af7",
        "--pink": "#ff007c",
        "--todo": "#565f89",
        "--def": "#7aa2f7",
        "--blt": "#e0af68",
        "--tst": "#ff9e64",
        "--p1": "#f7768e",
        "--p2": "#ff9e64",
        "--p3": "#7aa2f7",
        "--p4": "#565f89",
        "--todo-color": "#a9b1d6",
        "--def-color": "#bb9af7",
        "--blt-color": "#7aa2f7",
        "--tst-color": "#ff9e64",
        "--done-color": "#9ece6a",
      },
      light: {
        // Day
        "--bg": "#e1e2e7",
        "--surface": "#d5d6db",
        "--surface-hover": "#c9cad0",
        "--border": "#b4b5b9",
        "--text": "#3760bf",
        "--text-muted": "#6172b0",
        "--text-dim": "#8990b3",
        "--accent": "#2e7de9",
        "--accent-subtle": "#2e7de908",
        "--accent-tint": "#2e7de911",
        "--active-bg": "rgba(46, 125, 233, 0.12)",
        "--danger": "#f52a65",
        "--danger-bg": "#f52a6522",
        "--done": "#587539",
        "--warn": "#8c6c3e",
        "--orange": "#b15c00",
        "--purple": "#7847bd",
        "--pink": "#9854f1",
        "--todo": "#8990b3",
        "--def": "#2e7de9",
        "--blt": "#8c6c3e",
        "--tst": "#b15c00",
        "--p1": "#f52a65",
        "--p2": "#b15c00",
        "--p3": "#2e7de9",
        "--p4": "#8990b3",
        "--todo-color": "#6172b0",
        "--def-color": "#7847bd",
        "--blt-color": "#2e7de9",
        "--tst-color": "#b15c00",
        "--done-color": "#587539",
      },
    },
    nord: {
      name: "Nord",
      dark: {
        // Polar Night
        "--bg": "#2e3440",
        "--surface": "#3b4252",
        "--surface-hover": "#434c5e",
        "--border": "#4c566a",
        "--text": "#eceff4",
        "--text-muted": "#d8dee9",
        "--text-dim": "#7b88a1",
        "--accent": "#88c0d0",
        "--accent-subtle": "#88c0d008",
        "--accent-tint": "#88c0d011",
        "--active-bg": "rgba(136, 192, 208, 0.12)",
        "--danger": "#bf616a",
        "--danger-bg": "#bf616a22",
        "--done": "#a3be8c",
        "--warn": "#ebcb8b",
        "--orange": "#d08770",
        "--purple": "#b48ead",
        "--pink": "#b48ead",
        "--todo": "#7b88a1",
        "--def": "#88c0d0",
        "--blt": "#ebcb8b",
        "--tst": "#d08770",
        "--p1": "#bf616a",
        "--p2": "#d08770",
        "--p3": "#88c0d0",
        "--p4": "#7b88a1",
        "--todo-color": "#d8dee9",
        "--def-color": "#b48ead",
        "--blt-color": "#88c0d0",
        "--tst-color": "#d08770",
        "--done-color": "#a3be8c",
      },
      light: {
        // Snow Storm
        "--bg": "#eceff4",
        "--surface": "#e5e9f0",
        "--surface-hover": "#d8dee9",
        "--border": "#c2c9d6",
        "--text": "#2e3440",
        "--text-muted": "#4c566a",
        "--text-dim": "#7b88a1",
        "--accent": "#5e81ac",
        "--accent-subtle": "#5e81ac08",
        "--accent-tint": "#5e81ac11",
        "--active-bg": "rgba(94, 129, 172, 0.12)",
        "--danger": "#bf616a",
        "--danger-bg": "#bf616a22",
        "--done": "#a3be8c",
        "--warn": "#d08770",
        "--orange": "#d08770",
        "--purple": "#b48ead",
        "--pink": "#b48ead",
        "--todo": "#7b88a1",
        "--def": "#5e81ac",
        "--blt": "#d08770",
        "--tst": "#d08770",
        "--p1": "#bf616a",
        "--p2": "#d08770",
        "--p3": "#5e81ac",
        "--p4": "#7b88a1",
        "--todo-color": "#4c566a",
        "--def-color": "#b48ead",
        "--blt-color": "#5e81ac",
        "--tst-color": "#d08770",
        "--done-color": "#a3be8c",
      },
    },
  };

  // ─── Core functions ─────────────────────────────────────────

  function getProfile() {
    return localStorage.getItem(STORAGE_PROFILE) || "github";
  }

  function getMode() {
    return localStorage.getItem(STORAGE_MODE) || "auto";
  }

  function resolveMode(mode) {
    if (mode === "dark" || mode === "light") return mode;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function getCustomTheme() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_CUSTOM)) || null;
    } catch {
      return null;
    }
  }

  function getTokens(profileId, mode) {
    const resolved = resolveMode(mode);
    if (profileId === "custom") {
      const custom = getCustomTheme();
      if (custom && custom[resolved]) return custom[resolved];
      // Fallback to github
      return THEMES.github[resolved];
    }
    const profile = THEMES[profileId];
    if (!profile) return THEMES.github[resolved];
    return profile[resolved];
  }

  function applyTheme(profileId, mode) {
    const tokens = getTokens(profileId || getProfile(), mode || getMode());
    const root = document.documentElement;
    for (const [prop, value] of Object.entries(tokens)) {
      root.style.setProperty(prop, value);
    }
    // Update color-scheme for native form controls
    const resolved = resolveMode(mode || getMode());
    root.style.setProperty("color-scheme", resolved);
  }

  // Apply theme immediately (before DOM renders)
  applyTheme(getProfile(), getMode());

  // Listen for OS color scheme changes when in auto mode
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", function () {
      if (getMode() === "auto") {
        applyTheme(getProfile(), "auto");
        updatePickerState();
      }
    });

  // ─── Theme Picker UI ───────────────────────────────────────

  function createPicker() {
    const picker = document.createElement("div");
    picker.className = "theme-picker";
    picker.innerHTML = `
      <button class="theme-picker-toggle" title="Theme" aria-label="Theme instellen">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="8" cy="8" r="3"/>
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/>
        </svg>
      </button>
      <div class="theme-picker-dropdown">
        <div class="theme-picker-section">
          <div class="theme-picker-label">Modus</div>
          <div class="theme-picker-modes">
            <button data-mode="dark" class="theme-mode-btn">Dark</button>
            <button data-mode="light" class="theme-mode-btn">Light</button>
            <button data-mode="auto" class="theme-mode-btn">Auto</button>
          </div>
        </div>
        <div class="theme-picker-section">
          <div class="theme-picker-label">Profiel</div>
          <div class="theme-picker-profiles">
            <button data-profile="github" class="theme-profile-btn">GitHub</button>
            <button data-profile="catppuccin" class="theme-profile-btn">Catppuccin</button>
            <button data-profile="tokyonight" class="theme-profile-btn">Tokyo Night</button>
            <button data-profile="nord" class="theme-profile-btn">Nord</button>
            <button data-profile="custom" class="theme-profile-btn">Custom</button>
          </div>
        </div>
        <button class="theme-edit-btn" style="display:none">Kleuren bewerken...</button>
      </div>
    `;

    // Toggle dropdown
    const toggle = picker.querySelector(".theme-picker-toggle");
    const dropdown = picker.querySelector(".theme-picker-dropdown");

    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      dropdown.classList.toggle("open");
    });

    document.addEventListener("click", function (e) {
      if (!picker.contains(e.target)) {
        dropdown.classList.remove("open");
      }
    });

    // Mode buttons
    picker.querySelectorAll(".theme-mode-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        localStorage.setItem(STORAGE_MODE, btn.dataset.mode);
        applyTheme(getProfile(), btn.dataset.mode);
        updatePickerState();
      });
    });

    // Profile buttons
    picker.querySelectorAll(".theme-profile-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        localStorage.setItem(STORAGE_PROFILE, btn.dataset.profile);
        applyTheme(btn.dataset.profile, getMode());
        updatePickerState();
      });
    });

    // Edit button
    picker
      .querySelector(".theme-edit-btn")
      .addEventListener("click", function () {
        dropdown.classList.remove("open");
        openCustomEditor();
      });

    return picker;
  }

  function updatePickerState() {
    var picker = document.querySelector(".theme-picker");
    if (!picker) return;

    var currentProfile = getProfile();
    var currentMode = getMode();

    picker.querySelectorAll(".theme-mode-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.mode === currentMode);
    });

    picker.querySelectorAll(".theme-profile-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.profile === currentProfile);
    });

    var editBtn = picker.querySelector(".theme-edit-btn");
    editBtn.style.display = currentProfile === "custom" ? "block" : "none";
  }

  // ─── Custom Editor ─────────────────────────────────────────

  var EDITABLE_TOKENS = [
    { key: "--bg", label: "Achtergrond" },
    { key: "--surface", label: "Surface" },
    { key: "--border", label: "Border" },
    { key: "--text", label: "Tekst" },
    { key: "--text-muted", label: "Tekst (muted)" },
    { key: "--accent", label: "Accent" },
    { key: "--danger", label: "Danger" },
    { key: "--done", label: "Done / Success" },
    { key: "--warn", label: "Waarschuwing" },
    { key: "--purple", label: "Paars" },
    { key: "--pink", label: "Roze" },
    { key: "--orange", label: "Oranje" },
  ];

  function openCustomEditor() {
    // Remove existing
    var existing = document.querySelector(".theme-editor-overlay");
    if (existing) existing.remove();

    var currentMode = resolveMode(getMode());
    var custom = getCustomTheme() || {};
    var tokens = custom[currentMode] || { ...THEMES.github[currentMode] };

    var overlay = document.createElement("div");
    overlay.className = "theme-editor-overlay active";

    var fields = EDITABLE_TOKENS.map(function (t) {
      var val = tokens[t.key] || "#000000";
      // Ensure val is a proper hex for color input
      if (!val.startsWith("#") || val.length > 7) val = "#000000";
      return (
        '<div class="theme-editor-field">' +
        "<label>" +
        t.label +
        "</label>" +
        '<div class="theme-editor-input-row">' +
        '<input type="color" data-token="' +
        t.key +
        '" value="' +
        val +
        '" />' +
        '<span class="theme-editor-hex">' +
        val +
        "</span>" +
        "</div>" +
        "</div>"
      );
    }).join("");

    overlay.innerHTML =
      '<div class="theme-editor-modal">' +
      "<h3>Custom profiel — " +
      currentMode +
      " mode</h3>" +
      '<div class="theme-editor-fields">' +
      fields +
      "</div>" +
      '<div class="theme-editor-actions">' +
      '<button class="theme-editor-reset">Reset</button>' +
      '<button class="theme-editor-cancel">Annuleren</button>' +
      '<button class="theme-editor-save">Opslaan</button>' +
      "</div>" +
      "</div>";

    document.body.appendChild(overlay);

    // Close
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) overlay.remove();
    });

    overlay
      .querySelector(".theme-editor-cancel")
      .addEventListener("click", function () {
        overlay.remove();
      });

    // Live preview on color change
    overlay.querySelectorAll('input[type="color"]').forEach(function (input) {
      input.addEventListener("input", function () {
        var hex = input.parentElement.querySelector(".theme-editor-hex");
        hex.textContent = input.value;
        document.documentElement.style.setProperty(
          input.dataset.token,
          input.value,
        );
      });
    });

    // Save
    overlay
      .querySelector(".theme-editor-save")
      .addEventListener("click", function () {
        var updated = {};
        overlay
          .querySelectorAll('input[type="color"]')
          .forEach(function (input) {
            updated[input.dataset.token] = input.value;
          });

        // Derive computed tokens from base tokens
        updated["--surface-hover"] = shiftColor(
          updated["--surface"] || "#161b22",
          15,
        );
        updated["--text-dim"] = updated["--text-muted"] || "#6e7681";
        updated["--accent-subtle"] = (updated["--accent"] || "#58a6ff") + "08";
        updated["--accent-tint"] = (updated["--accent"] || "#58a6ff") + "11";
        updated["--active-bg"] =
          "rgba(" + hexToRgb(updated["--accent"] || "#58a6ff") + ", 0.12)";
        updated["--danger-bg"] = (updated["--danger"] || "#f85149") + "22";
        // Copy status tokens
        updated["--todo"] = updated["--text-muted"] || "#8b949e";
        updated["--def"] = updated["--accent"] || "#58a6ff";
        updated["--blt"] = updated["--warn"] || "#d29922";
        updated["--tst"] = updated["--orange"] || "#ffa657";
        // Dashboard status colors
        updated["--todo-color"] = updated["--text-muted"] || "#9ca3af";
        updated["--def-color"] = updated["--purple"] || "#a78bfa";
        updated["--blt-color"] = updated["--accent"] || "#60a5fa";
        updated["--tst-color"] = updated["--orange"] || "#fb923c";
        updated["--done-color"] = updated["--done"] || "#34d399";
        updated["--p1"] = updated["--danger"] || "#d1453b";
        updated["--p2"] = updated["--orange"] || "#eb8909";
        updated["--p3"] = updated["--accent"] || "#246fe0";
        updated["--p4"] = updated["--text-muted"] || "#8b949e";

        var custom = getCustomTheme() || {};
        custom[currentMode] = updated;
        localStorage.setItem(STORAGE_CUSTOM, JSON.stringify(custom));
        localStorage.setItem(STORAGE_PROFILE, "custom");
        applyTheme("custom", getMode());
        updatePickerState();
        overlay.remove();
      });

    // Reset
    overlay
      .querySelector(".theme-editor-reset")
      .addEventListener("click", function () {
        var defaults = THEMES.github[currentMode];
        overlay
          .querySelectorAll('input[type="color"]')
          .forEach(function (input) {
            var val = defaults[input.dataset.token] || "#000000";
            if (!val.startsWith("#") || val.length > 7) val = "#000000";
            input.value = val;
            input.parentElement.querySelector(".theme-editor-hex").textContent =
              val;
            document.documentElement.style.setProperty(
              input.dataset.token,
              val,
            );
          });
      });
  }

  // ─── Helpers ────────────────────────────────────────────────

  function hexToRgb(hex) {
    var h = hex.replace("#", "");
    return (
      parseInt(h.substring(0, 2), 16) +
      ", " +
      parseInt(h.substring(2, 4), 16) +
      ", " +
      parseInt(h.substring(4, 6), 16)
    );
  }

  function shiftColor(hex, amount) {
    var h = hex.replace("#", "");
    var r = Math.min(
      255,
      Math.max(0, parseInt(h.substring(0, 2), 16) + amount),
    );
    var g = Math.min(
      255,
      Math.max(0, parseInt(h.substring(2, 4), 16) + amount),
    );
    var b = Math.min(
      255,
      Math.max(0, parseInt(h.substring(4, 6), 16) + amount),
    );
    return (
      "#" +
      r.toString(16).padStart(2, "0") +
      g.toString(16).padStart(2, "0") +
      b.toString(16).padStart(2, "0")
    );
  }

  // ─── Init on DOM ready ─────────────────────────────────────

  function init() {
    // Picker UI alleen op het hoofdmenu (/)
    if (location.pathname === "/") {
      var picker = createPicker();
      document.body.appendChild(picker);
      updatePickerState();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
