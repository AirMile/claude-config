// --- State (restored from HMR data or fresh) ---
var inspectActive =
  (import.meta.hot &&
    import.meta.hot.data &&
    import.meta.hot.data.inspectActive) ||
  false;
var hasDataAttrs = !!document.querySelector("[data-inspector-relative-path]");

// --- Toggle button (bottom-right, touch-friendly) ---
var btn = document.createElement("button");
btn.id = "__inspect-overlay";
btn.textContent = "\u{1F50D}";
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
  "border-radius:3px;display:none;white-space:pre;max-width:90vw;overflow:hidden;";
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
  if (!el || el === document.body || el === document.documentElement)
    return null;
  if (el.id === "__inspect-overlay" || el.closest("#__inspect-overlay"))
    return null;
  if (!hasDataAttrs) {
    hasDataAttrs = !!document.querySelector("[data-inspector-relative-path]");
  }
  if (hasDataAttrs) {
    var inspectable = el.closest("[data-inspector-relative-path]");
    if (inspectable) return inspectable;
  }
  return el.closest("[class]") || el;
}

// --- Build reference string ---
function buildRef(el) {
  var path = el.getAttribute("data-inspector-relative-path");
  if (path) {
    var line = el.getAttribute("data-inspector-line");
    var col = el.getAttribute("data-inspector-column");
    return path + ":" + line + (col ? ":" + col : "");
  }
  var tag = el.tagName.toLowerCase();
  var cls =
    el.className && typeof el.className === "string"
      ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
      : "";
  var text = (el.textContent || "").trim().substring(0, 30);
  return tag + cls + (text ? ' "' + text + '"' : "");
}

// --- Style extraction ---
function toHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function rgbToHex(rgb) {
  if (rgb.startsWith("#")) return rgb;
  var m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (m) {
    if (m[4] !== undefined && parseFloat(m[4]) < 1) return rgb;
    return toHex(+m[1], +m[2], +m[3]);
  }
  // color-mix fallback for oklch, lab, lch, color() etc.
  var span = document.createElement("span");
  span.style.display = "none";
  span.style.color = "color-mix(in srgb, " + rgb + " 100%, transparent 0%)";
  document.body.appendChild(span);
  var computed = window.getComputedStyle(span).color;
  document.body.removeChild(span);
  var cm = computed.match(
    /color\(srgb\s+([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)(?:\s*\/\s*([\d.e+-]+))?\)/,
  );
  if (cm) {
    if (cm[4] !== undefined && parseFloat(cm[4]) < 1) {
      return (
        "rgba(" +
        Math.round(cm[1] * 255) +
        ", " +
        Math.round(cm[2] * 255) +
        ", " +
        Math.round(cm[3] * 255) +
        ", " +
        cm[4] +
        ")"
      );
    }
    return toHex(
      Math.round(cm[1] * 255),
      Math.round(cm[2] * 255),
      Math.round(cm[3] * 255),
    );
  }
  return rgb;
}

function getCoreStyles(cs) {
  var styles = [
    { prop: "font-family", value: cs.getPropertyValue("font-family") },
    { prop: "font-size", value: cs.getPropertyValue("font-size") },
    { prop: "line-height", value: cs.getPropertyValue("line-height") },
    { prop: "color", value: cs.getPropertyValue("color") },
  ];
  var fw = cs.getPropertyValue("font-weight");
  if (fw !== "400") styles.push({ prop: "font-weight", value: fw });
  var bg = cs.getPropertyValue("background-color");
  if (bg !== "rgba(0, 0, 0, 0)")
    styles.push({ prop: "background-color", value: bg });
  var pad = cs.getPropertyValue("padding");
  if (pad.replace(/0px/g, "").trim() !== "")
    styles.push({ prop: "padding", value: pad });
  var mar = cs.getPropertyValue("margin");
  if (mar.replace(/0px/g, "").trim() !== "")
    styles.push({ prop: "margin", value: mar });
  var br = cs.getPropertyValue("border-radius");
  if (br !== "0px") styles.push({ prop: "border-radius", value: br });
  return styles;
}

function getConditionalStyles(cs) {
  var styles = [];
  var display = cs.getPropertyValue("display");
  if (/^(inline-)?(flex|grid)$/.test(display)) {
    styles.push({ prop: "display", value: display });
    var gap = cs.getPropertyValue("gap");
    if (gap && gap !== "normal" && gap !== "0px")
      styles.push({ prop: "gap", value: gap });
    if (display.indexOf("flex") !== -1) {
      styles.push({
        prop: "flex-direction",
        value: cs.getPropertyValue("flex-direction"),
      });
    }
    if (display.indexOf("grid") !== -1) {
      styles.push({
        prop: "grid-template-columns",
        value: cs.getPropertyValue("grid-template-columns"),
      });
    }
  }
  var bw = cs.getPropertyValue("border-top-width");
  if (bw && bw !== "0px") {
    styles.push({
      prop: "border",
      value:
        bw +
        " " +
        cs.getPropertyValue("border-top-style") +
        " " +
        cs.getPropertyValue("border-top-color"),
    });
  }
  var bs = cs.getPropertyValue("box-shadow");
  if (bs && bs !== "none") styles.push({ prop: "box-shadow", value: bs });
  var op = cs.getPropertyValue("opacity");
  if (op !== "1") styles.push({ prop: "opacity", value: op });
  return styles;
}

function extractStyles(el) {
  var cs = window.getComputedStyle(el);
  return getCoreStyles(cs).concat(getConditionalStyles(cs));
}

// --- Style formatting ---
function formatValue(prop, value) {
  if (
    prop === "color" ||
    prop === "background-color" ||
    prop.indexOf("border") !== -1
  ) {
    return value
      .replace(/rgba?\(\d+,\s*\d+,\s*\d+(?:,\s*[\d.]+)?\)/g, rgbToHex)
      .replace(/oklch\([^)]+\)|lab\([^)]+\)|lch\([^)]+\)/g, rgbToHex);
  }
  if (prop === "font-family") {
    return value.split(",")[0].trim().replace(/['"]/g, "");
  }
  return value;
}

function formatStylesClipboard(styles) {
  var lines = [];
  var fontSize, lineHeight, fontFamily;
  var rest = [];
  for (var i = 0; i < styles.length; i++) {
    var s = styles[i];
    if (s.prop === "font-size") fontSize = s.value;
    else if (s.prop === "line-height") lineHeight = s.value;
    else if (s.prop === "font-family")
      fontFamily = formatValue(s.prop, s.value);
    else rest.push(s);
  }
  if (fontSize) {
    var lh =
      lineHeight && fontSize
        ? parseFloat(lineHeight) / parseFloat(fontSize)
        : null;
    var lhStr = lh ? String(Math.round(lh * 10) / 10) : "";
    lines.push(
      "  font: " +
        fontSize +
        (lhStr ? "/" + lhStr : "") +
        (fontFamily ? " " + fontFamily : ""),
    );
  }
  for (var j = 0; j < rest.length; j++) {
    lines.push(
      "  " + rest[j].prop + ": " + formatValue(rest[j].prop, rest[j].value),
    );
  }
  return lines.join("\n");
}

function formatStylesLabel(styles) {
  var parts = [];
  var fontSize, fontFamily, color, padding, margin, borderRadius;
  for (var i = 0; i < styles.length; i++) {
    var s = styles[i];
    if (s.prop === "font-size") fontSize = s.value;
    else if (s.prop === "font-family")
      fontFamily = s.value.split(",")[0].trim().replace(/['"]/g, "");
    else if (s.prop === "color") color = rgbToHex(s.value);
    else if (s.prop === "padding") padding = s.value;
    else if (s.prop === "margin") margin = s.value;
    else if (s.prop === "border-radius") borderRadius = s.value;
  }
  if (fontSize) parts.push(fontSize + (fontFamily ? " " + fontFamily : ""));
  if (color) parts.push(color);
  var layout = [];
  if (padding) layout.push("p:" + padding.replace(/px/g, ""));
  if (margin) layout.push("m:" + margin.replace(/px/g, ""));
  if (borderRadius) layout.push("r:" + borderRadius.replace(/px/g, ""));
  if (layout.length) parts.push(layout.join(" "));
  return parts.join(" . ");
}

// --- Clipboard helpers ---
function buildClassName(el) {
  var cn = el.className;
  if (cn && typeof cn === "string" && cn.trim()) {
    return "  class: " + cn.trim();
  }
  return null;
}

function buildSize(el) {
  return (
    "  size: " +
    el.offsetWidth +
    " x " +
    el.offsetHeight +
    " @" +
    window.innerWidth +
    "w"
  );
}

// --- Clipboard builder ---
function buildClipboardText(el) {
  var lines = [buildRef(el)];
  var cn = buildClassName(el);
  if (cn) lines.push(cn);
  lines.push(buildSize(el));
  var styles = extractStyles(el);
  var styleStr = formatStylesClipboard(styles);
  if (styleStr) lines.push(styleStr);
  return lines.join("\n");
}

function formatMultiClipboard(items) {
  var total = items.length;
  return items
    .map(function (text, i) {
      return "--- " + (i + 1) + "/" + total + " ---\n" + text;
    })
    .join("\n\n");
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
  var styles = extractStyles(el);
  var styleSummary = formatStylesLabel(styles);
  label.textContent = ref + "\n" + styleSummary;
  label.style.display = "block";
  var labelHeight = label.offsetHeight;
  var labelTop = rect.top - labelHeight - 2;
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
  var clipText = buildClipboardText(el);

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(clipText)
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
  var clipText = buildClipboardText(el);

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(clipText)
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
