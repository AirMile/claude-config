import type { Plugin } from "vite";

export function inspectOverlay(): Plugin {
  const virtualModuleId = "virtual:inspect-overlay";
  const resolvedId = "\0" + virtualModuleId;

  return {
    name: "inspect-overlay",
    apply: "serve",

    resolveId(id) {
      if (id === virtualModuleId) return resolvedId;
    },

    load(id) {
      if (id === resolvedId) return OVERLAY_MODULE;
    },

    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: { type: "module" },
            children: `import "${virtualModuleId}"`,
            injectTo: "body",
          },
        ],
      };
    },
  };
}

const OVERLAY_MODULE = `
// --- State (restored from HMR data or fresh) ---
var inspectActive = (import.meta.hot && import.meta.hot.data && import.meta.hot.data.inspectActive) || false;
var hasDataAttrs = !!document.querySelector("[data-inspector-relative-path]");

// --- Toggle button (bottom-right, touch-friendly) ---
var btn = document.createElement("button");
btn.id = "__inspect-overlay";
btn.textContent = "\\u{1F50D}";
btn.title = "Toggle Inspect Mode (Alt+I)";
btn.setAttribute("aria-label", "Toggle inspect mode");
btn.style.cssText =
  "position:fixed;bottom:16px;right:16px;z-index:99999;width:44px;height:44px;" +
  "border-radius:50%;border:2px solid #4a90d9;background:#fff;font-size:20px;" +
  "cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.15);transition:all 0.2s;" +
  "line-height:44px;text-align:center;padding:0;user-select:none;touch-action:manipulation;";
document.body.appendChild(btn);

// --- Highlight overlay ---
var highlight = document.createElement("div");
highlight.style.cssText =
  "position:fixed;pointer-events:none;z-index:99998;border:2px solid #4a90d9;" +
  "background:rgba(74,144,217,0.08);display:none;transition:all 0.05s ease-out;border-radius:2px;";
document.body.appendChild(highlight);

// --- Label ---
var label = document.createElement("div");
label.style.cssText =
  "position:fixed;pointer-events:none;z-index:99999;background:#4a90d9;color:#fff;" +
  "font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;padding:2px 8px;" +
  "border-radius:3px;display:none;white-space:nowrap;max-width:90vw;overflow:hidden;" +
  "text-overflow:ellipsis;";
document.body.appendChild(label);

// --- Toast ---
function showToast(text) {
  var toast = document.createElement("div");
  toast.textContent = text;
  toast.style.cssText =
    "position:fixed;bottom:70px;right:16px;z-index:99999;background:#333;color:#fff;" +
    "font:13px/1.4 system-ui,sans-serif;padding:8px 16px;border-radius:6px;" +
    "opacity:1;transition:opacity 0.3s;max-width:90vw;overflow:hidden;text-overflow:ellipsis;";
  document.body.appendChild(toast);
  setTimeout(function () {
    toast.style.opacity = "0";
  }, 1500);
  setTimeout(function () {
    toast.remove();
  }, 1800);
}

// --- Toggle inspect mode ---
function toggleInspect() {
  inspectActive = !inspectActive;
  btn.style.background = inspectActive ? "#4a90d9" : "#fff";
  btn.style.borderColor = inspectActive ? "#2a6cb8" : "#4a90d9";
  btn.style.transform = inspectActive ? "scale(1.1)" : "scale(1)";
  if (!inspectActive) {
    highlight.style.display = "none";
    label.style.display = "none";
    document.body.style.cursor = "";
  }
}

btn.addEventListener("click", function (e) {
  e.stopPropagation();
  toggleInspect();
});

// --- Find nearest inspectable element ---
function findInspectable(el) {
  if (!el || el === document.body || el === document.documentElement) return null;
  if (el.id === "__inspect-overlay" || el.closest("#__inspect-overlay")) return null;
  if (hasDataAttrs) {
    return el.closest("[data-inspector-relative-path]");
  }
  return el.closest("[class]") || el;
}

// --- Build reference string ---
function buildRef(el) {
  if (hasDataAttrs) {
    var path = el.getAttribute("data-inspector-relative-path");
    var line = el.getAttribute("data-inspector-line");
    var col = el.getAttribute("data-inspector-column");
    return path + ":" + line + (col ? ":" + col : "");
  }
  var tag = el.tagName.toLowerCase();
  var cls = el.className && typeof el.className === "string"
    ? "." + el.className.trim().split(/\\s+/).slice(0, 3).join(".")
    : "";
  var text = (el.textContent || "").trim().substring(0, 30);
  return tag + cls + (text ? ' "' + text + '"' : "");
}

// --- Event handlers (named for dispose cleanup) ---
function onKeyDown(e) {
  if (e.altKey && (e.key === "i" || e.key === "I")) {
    e.preventDefault();
    toggleInspect();
  }
}

function onMouseMove(e) {
  if (!inspectActive) return;
  var el = findInspectable(e.target);
  if (!el) {
    highlight.style.display = "none";
    label.style.display = "none";
    return;
  }
  var rect = el.getBoundingClientRect();
  highlight.style.display = "block";
  highlight.style.top = rect.top + "px";
  highlight.style.left = rect.left + "px";
  highlight.style.width = rect.width + "px";
  highlight.style.height = rect.height + "px";

  var ref = buildRef(el);
  label.textContent = ref;
  label.style.display = "block";
  var labelTop = rect.top - 22;
  if (labelTop < 4) labelTop = rect.bottom + 4;
  label.style.top = labelTop + "px";
  label.style.left = rect.left + "px";
}

function onClick(e) {
  if (!inspectActive) return;
  var el = findInspectable(e.target);
  if (!el) return;
  e.preventDefault();
  e.stopPropagation();

  var ref = buildRef(el);

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(ref)
      .then(function () {
        showToast("Copied: " + ref);
      })
      .catch(function () {
        showToast(ref);
      });
  } else {
    showToast(ref);
  }
}

function onTouchEnd(e) {
  if (!inspectActive) return;
  var el = findInspectable(e.target);
  if (!el) return;
  e.preventDefault();

  var ref = buildRef(el);

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(ref)
      .then(function () {
        showToast("Copied: " + ref);
      })
      .catch(function () {
        showToast(ref);
      });
  } else {
    showToast(ref);
  }
}

// --- Register listeners ---
document.addEventListener("keydown", onKeyDown);
document.addEventListener("mousemove", onMouseMove, true);
document.addEventListener("click", onClick, true);
document.addEventListener("touchend", onTouchEnd, true);

// --- Restore visual state after HMR ---
if (inspectActive) {
  btn.style.background = "#4a90d9";
  btn.style.borderColor = "#2a6cb8";
  btn.style.transform = "scale(1.1)";
}

// --- HMR lifecycle ---
if (import.meta.hot) {
  import.meta.hot.accept();

  import.meta.hot.dispose(function (data) {
    data.inspectActive = inspectActive;
    btn.remove();
    highlight.remove();
    label.remove();
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("touchend", onTouchEnd, true);
    document.body.style.cursor = "";
  });

  import.meta.hot.on("vite:afterUpdate", function () {
    hasDataAttrs = !!document.querySelector("[data-inspector-relative-path]");
  });
}
`;
