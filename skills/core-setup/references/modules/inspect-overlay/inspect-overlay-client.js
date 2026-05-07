// --- Double-init guard (module scripts cache, but belt-and-suspenders) ---
if (window.__inspectOverlayActive) {
  // Already running — skip re-init (happens in non-module contexts)
} else {
  window.__inspectOverlayActive = true;

  // --- State (restored from HMR data or fresh) --- // v2: pin-mode + sibling-gap
  var inspectActive =
    (import.meta.hot &&
      import.meta.hot.data &&
      import.meta.hot.data.inspectActive) ||
    false;
  var hasDataAttrs = !!document.querySelector("[data-inspector-relative-path]");
  var pinnedElements =
    (import.meta.hot &&
      import.meta.hot.data &&
      import.meta.hot.data.pinnedElements) ||
    [];
  var MAX_PINS = 20;
  var lastClickedElement = null;

  // --- Region select state ---
  var isDragging = false;
  var dragPending = false;
  var dragStartX = 0;
  var dragStartY = 0;
  var dragCurrentX = 0;
  var dragCurrentY = 0;
  var DRAG_THRESHOLD = 5;
  var regionCandidates = [];
  var dragDidComplete = false;

  // --- Highlight overlay ---
  var highlight = document.createElement("div");
  highlight.style.cssText =
    "position:fixed;pointer-events:none;z-index:99998;border:2px solid #4a90d9;" +
    "display:none;transition:all 0.05s ease-out;border-radius:2px;";
  document.body.appendChild(highlight);

  // --- Label ---
  var label = document.createElement("div");
  label.style.cssText =
    "position:fixed;pointer-events:none;z-index:99999;background:#4a90d9;color:#fff;" +
    "font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;padding:2px 8px;" +
    "border-radius:3px;display:none;white-space:pre;max-width:90vw;overflow:hidden;";
  document.body.appendChild(label);

  // --- Freeze style (disables hover transitions/animations in inspect mode) ---
  var freezeStyle = document.createElement("style");
  freezeStyle.textContent =
    "body.__inspect-active *,body.__inspect-active *::before,body.__inspect-active *::after" +
    "{transition:none!important;animation-play-state:paused!important;" +
    "pointer-events:none!important}";
  document.head.appendChild(freezeStyle);

  // --- Element lookup (pointer-events are disabled, so use elementFromPoint) ---
  function elementAtPoint(x, y) {
    freezeStyle.disabled = true;
    var el = document.elementFromPoint(x, y);
    freezeStyle.disabled = false;
    return el;
  }

  // --- Parent highlight (dashed border showing parent container) ---
  var parentHighlight = document.createElement("div");
  parentHighlight.style.cssText =
    "position:fixed;pointer-events:none;z-index:99996;" +
    "border:1px dashed rgba(255,107,107,0.4);display:none;border-radius:2px;";
  document.body.appendChild(parentHighlight);

  // --- Region select box ---
  var selectionBox = document.createElement("div");
  selectionBox.id = "__inspect-selection";
  selectionBox.style.cssText =
    "position:fixed;pointer-events:none;z-index:99997;" +
    "border:1px dashed #4a90d9;background:rgba(74,144,217,0.08);" +
    "display:none;";
  document.body.appendChild(selectionBox);

  // --- Region candidate highlights (pool pattern) ---
  var candidatePool = [];
  var candidatePoolUsed = 0;

  function getCandidateHighlight(index) {
    if (index < candidatePool.length) return candidatePool[index];
    var div = document.createElement("div");
    div.style.cssText =
      "position:fixed;pointer-events:none;z-index:99996;" +
      "background:rgba(74,144,217,0.12);border:1px solid rgba(74,144,217,0.3);" +
      "display:none;";
    document.body.appendChild(div);
    candidatePool.push(div);
    return div;
  }

  function hideCandidateHighlights() {
    for (var i = 0; i < candidatePool.length; i++) {
      candidatePool[i].style.display = "none";
    }
    candidatePoolUsed = 0;
  }

  // --- Gap indicators (dynamic pool for sibling-gap measurements) ---
  var gapPool = [];
  var gapPoolUsed = 0;
  var childHighlightPool = [];
  var childHighlightUsed = 0;

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
    if (inspectActive) {
      document.body.classList.add("__inspect-active");
      document.body.style.userSelect = "none";
    } else {
      cancelRegionSelect();
      document.body.classList.remove("__inspect-active");
      clearPins();
      highlight.style.display = "none";
      label.style.display = "none";
      hideGapIndicators();
      parentHighlight.style.display = "none";
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  }

  // --- Find nearest inspectable element ---
  function findInspectable(el) {
    if (!el || el === document.body || el === document.documentElement)
      return null;
    if (el.id && el.id.indexOf("__inspect") === 0) return null;
    if (!hasDataAttrs) {
      hasDataAttrs = !!document.querySelector("[data-inspector-relative-path]");
    }
    if (hasDataAttrs) {
      var inspectable = el.closest("[data-inspector-relative-path]");
      if (inspectable) return inspectable;
    }
    return el.closest("[class]") || el;
  }

  // --- Build component name for tooltip ---
  function buildComponentName(el) {
    var path = el.getAttribute("data-inspector-relative-path");
    if (path) {
      // Extract filename without extension, convert kebab-case to PascalCase
      var filename = path
        .split("/")
        .pop()
        .replace(/\.\w+$/, "");
      return filename
        .split(/[-_]/)
        .map(function (part) {
          return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join("");
    }
    // Degraded mode: tag + first 3 classes
    var tag = el.tagName.toLowerCase();
    var cls =
      el.className && typeof el.className === "string"
        ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
        : "";
    return tag + cls;
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

  // --- Tooltip debug info (invisible properties only) ---
  function buildLabelDebug(el) {
    var cs = window.getComputedStyle(el);
    var parts = [];
    var ov = cs.getPropertyValue("overflow");
    if (ov && ov !== "visible") parts.push("overflow:" + ov);
    var pos = cs.getPropertyValue("position");
    if (pos && pos !== "static") parts.push(pos);
    var zi = cs.getPropertyValue("z-index");
    if (zi && zi !== "auto") parts.push("z:" + zi);
    var minW = cs.getPropertyValue("min-width");
    if (minW && minW !== "0px" && minW !== "auto") parts.push("min-w:" + minW);
    var maxW = cs.getPropertyValue("max-width");
    if (maxW && maxW !== "none") parts.push("max-w:" + maxW);
    var minH = cs.getPropertyValue("min-height");
    if (minH && minH !== "0px" && minH !== "auto") parts.push("min-h:" + minH);
    var maxH = cs.getPropertyValue("max-height");
    if (maxH && maxH !== "none") parts.push("max-h:" + maxH);
    return parts.join(" \u00B7 ");
  }

  // --- Tooltip parent context (only for flex/grid/positioned parents) ---
  function buildLabelParent(el) {
    var parent = el.parentElement;
    if (
      !parent ||
      parent === document.body ||
      parent === document.documentElement
    )
      return "";
    var cs = window.getComputedStyle(parent);
    var display = cs.getPropertyValue("display");
    var pos = cs.getPropertyValue("position");
    var isLayout = /flex|grid/.test(display);
    var isPositioned = pos && pos !== "static";
    if (!isLayout && !isPositioned) return "";
    var parts = [];
    if (isPositioned && pos !== "relative") parts.push(pos);
    if (/flex/.test(display)) {
      parts.push("flex " + (cs.getPropertyValue("flex-direction") || "row"));
    } else if (/grid/.test(display)) {
      var cols = cs.getPropertyValue("grid-template-columns");
      var colCount = cols && cols !== "none" ? cols.split(/\s+/).length : 0;
      parts.push("grid" + (colCount ? " " + colCount + "cols" : ""));
    }
    var gap = cs.getPropertyValue("gap");
    if (gap && gap !== "normal" && gap !== "0px") parts.push("gap:" + gap);
    return parts.length ? "\u2191 " + parts.join(" \u00B7 ") : "";
  }

  // --- HTML escaping for innerHTML ---
  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // --- Label line builders ---
  function buildLabelLine3(el, styles) {
    var parts = [];
    var w = el.offsetWidth;
    var h = el.offsetHeight;
    if (w && h) parts.push(w + "\u00D7" + h);
    var padding, margin, display, flexDir;
    for (var i = 0; i < styles.length; i++) {
      var s = styles[i];
      if (s.prop === "padding") padding = s.value;
      else if (s.prop === "margin") margin = s.value;
      else if (s.prop === "display") display = s.value;
      else if (s.prop === "flex-direction") flexDir = s.value;
    }
    var spacing = [];
    if (padding) spacing.push("p:" + padding.replace(/px/g, ""));
    if (margin) spacing.push("m:" + margin.replace(/px/g, ""));
    if (spacing.length) parts.push(spacing.join(" "));
    if (display && /flex|grid/.test(display)) {
      if (display.indexOf("flex") !== -1) {
        parts.push("flex " + (flexDir || "row"));
      } else {
        parts.push("grid");
      }
    }
    return parts.join(" \u00B7 ");
  }

  // --- Viewport clamping ---
  function clampPosition(rect, labelW, labelH) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var top = rect.top - labelH - 2;
    if (top < 4) top = rect.bottom + 4;
    if (top + labelH > vh - 4) top = 4;
    var left = rect.left;
    if (left + labelW > vw - 4) left = vw - labelW - 4;
    if (left < 4) left = 4;
    return { top: top, left: left };
  }

  // --- Gap indicator helpers ---
  function getGapIndicator(index) {
    if (index < gapPool.length) return gapPool[index];
    var bar = document.createElement("div");
    bar.style.cssText =
      "position:fixed;pointer-events:none;z-index:99997;display:none;" +
      "background:rgba(255,107,107,0.15);";
    var lbl = document.createElement("span");
    lbl.style.cssText =
      "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);" +
      "font:10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;" +
      "color:rgba(255,107,107,0.8);pointer-events:none;white-space:nowrap;";
    bar.appendChild(lbl);
    document.body.appendChild(bar);
    gapPool.push({ bar: bar, label: lbl });
    return gapPool[index];
  }

  function getChildHighlight(index) {
    if (index < childHighlightPool.length) return childHighlightPool[index];
    var el = document.createElement("div");
    el.style.cssText =
      "position:fixed;pointer-events:none;z-index:99996;" +
      "border:1px dashed rgba(255,107,107,0.35);display:none;border-radius:2px;";
    document.body.appendChild(el);
    childHighlightPool.push(el);
    return childHighlightPool[index];
  }

  function hideGapIndicators() {
    for (var i = 0; i < gapPool.length; i++) {
      gapPool[i].bar.style.display = "none";
    }
    gapPoolUsed = 0;
    for (var i = 0; i < childHighlightPool.length; i++) {
      childHighlightPool[i].style.display = "none";
    }
    childHighlightUsed = 0;
  }

  function showGap(x, y, w, h, gap) {
    var ind = getGapIndicator(gapPoolUsed++);
    ind.bar.style.display = "block";
    ind.bar.style.left = x + "px";
    ind.bar.style.top = y + "px";
    ind.bar.style.width = w + "px";
    ind.bar.style.height = h + "px";
    ind.label.textContent = Math.round(gap) + "";
    ind.label.style.display = "";
    if (gap < 14) {
      // Small gap: position label to the right of the bar
      ind.label.style.left = "auto";
      ind.label.style.right = "0";
      ind.label.style.top = "50%";
      ind.label.style.transform = "translate(calc(100% + 4px),-50%)";
    } else {
      // Normal: centered inside
      ind.label.style.left = "50%";
      ind.label.style.right = "auto";
      ind.label.style.top = "50%";
      ind.label.style.transform = "translate(-50%,-50%)";
    }
  }

  function showChildGaps(parentEl) {
    gapPoolUsed = 0;
    childHighlightUsed = 0;
    // Collect visible in-flow children (skip overlay elements)
    var rects = [];
    for (var i = 0; i < parentEl.children.length; i++) {
      var ch = parentEl.children[i];
      if (ch.id && ch.id.indexOf("__inspect") === 0) continue;
      if (ch === highlight || ch === parentHighlight || ch === label) continue;
      var cs = window.getComputedStyle(ch);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      if (cs.position === "absolute" || cs.position === "fixed") continue;
      rects.push(ch.getBoundingClientRect());
    }
    if (rects.length < 2) {
      hideGapIndicators();
      return;
    }
    // Show dashed border around each child
    for (var i = 0; i < rects.length; i++) {
      var chl = getChildHighlight(childHighlightUsed++);
      chl.style.display = "block";
      chl.style.top = rects[i].top + "px";
      chl.style.left = rects[i].left + "px";
      chl.style.width = rects[i].width + "px";
      chl.style.height = rects[i].height + "px";
    }
    // Sort top-to-left for row grouping
    rects.sort(function (a, b) {
      return a.top - b.top || a.left - b.left;
    });
    // Group into rows: elements with overlapping vertical ranges
    var rows = [[rects[0]]];
    for (var i = 1; i < rects.length; i++) {
      var row = rows[rows.length - 1];
      var rowTop = row[0].top;
      var rowBottom = row[0].bottom;
      for (var j = 1; j < row.length; j++) {
        rowTop = Math.min(rowTop, row[j].top);
        rowBottom = Math.max(rowBottom, row[j].bottom);
      }
      var overlap =
        Math.min(rects[i].bottom, rowBottom) - Math.max(rects[i].top, rowTop);
      var minH = Math.min(rects[i].height, rowBottom - rowTop);
      if (minH > 0 && overlap > minH * 0.3) {
        row.push(rects[i]);
      } else {
        rows.push([rects[i]]);
      }
    }
    // Horizontal gaps within each row
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r].sort(function (a, b) {
        return a.left - b.left;
      });
      for (var c = 0; c < row.length - 1; c++) {
        var gap = row[c + 1].left - row[c].right;
        if (gap > 0) {
          var t = Math.min(row[c].top, row[c + 1].top);
          var b = Math.max(row[c].bottom, row[c + 1].bottom);
          showGap(row[c].right, t, gap, b - t, gap);
        }
      }
    }
    // Vertical gaps between rows
    for (var r = 0; r < rows.length - 1; r++) {
      var thisBottom = 0;
      for (var c = 0; c < rows[r].length; c++) {
        thisBottom = Math.max(thisBottom, rows[r][c].bottom);
      }
      var nextTop = Infinity;
      for (var c = 0; c < rows[r + 1].length; c++) {
        nextTop = Math.min(nextTop, rows[r + 1][c].top);
      }
      var gap = nextTop - thisBottom;
      if (gap > 0) {
        var minL = Infinity,
          maxR = 0;
        for (var c = 0; c < rows[r].length; c++) {
          minL = Math.min(minL, rows[r][c].left);
          maxR = Math.max(maxR, rows[r][c].right);
        }
        for (var c = 0; c < rows[r + 1].length; c++) {
          minL = Math.min(minL, rows[r + 1][c].left);
          maxR = Math.max(maxR, rows[r + 1][c].right);
        }
        showGap(minL, thisBottom, maxR - minL, gap, gap);
      }
    }
    // Hide unused indicators
    for (var i = gapPoolUsed; i < gapPool.length; i++) {
      gapPool[i].bar.style.display = "none";
    }
    for (var i = childHighlightUsed; i < childHighlightPool.length; i++) {
      childHighlightPool[i].style.display = "none";
    }
  }

  // --- Pin mode helpers ---
  function isPinned(el) {
    return pinnedElements.indexOf(el) !== -1;
  }

  function copyPinnedToClipboard() {
    if (pinnedElements.length === 0) return;
    var items = pinnedElements.map(function (el) {
      return buildClipboardText(el);
    });
    var text =
      pinnedElements.length === 1 ? items[0] : formatMultiClipboard(items);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(function () {
          showToast("Copied " + pinnedElements.length + " pinned");
        })
        .catch(function () {
          showToast("Copy failed");
        });
    }
  }

  function pinElement(el) {
    if (isPinned(el) || pinnedElements.length >= MAX_PINS) return;
    pinnedElements.push(el);
    el.style.outline = "2px dashed #4a90d9";
    el.style.outlineOffset = "-2px";
    copyPinnedToClipboard();
  }

  function unpinElement(el) {
    var idx = pinnedElements.indexOf(el);
    if (idx === -1) return;
    pinnedElements.splice(idx, 1);
    el.style.outline = "";
    el.style.outlineOffset = "";
    copyPinnedToClipboard();
  }

  function clearPins() {
    for (var i = 0; i < pinnedElements.length; i++) {
      pinnedElements[i].style.outline = "";
      pinnedElements[i].style.outlineOffset = "";
    }
    pinnedElements = [];
  }

  // --- Region select helpers ---
  function collectCandidates() {
    regionCandidates = [];
    var seen = [];
    var all = document.body.querySelectorAll("*");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.id && el.id.indexOf("__inspect") === 0) continue;
      if (
        el === highlight ||
        el === parentHighlight ||
        el === label ||
        el === selectionBox
      )
        continue;
      var cs = window.getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      if (parseFloat(cs.opacity) === 0) continue;
      var rect = el.getBoundingClientRect();
      if (rect.width < 5 || rect.height < 5) continue;
      var hasVisibleChild = false;
      for (var j = 0; j < el.children.length; j++) {
        var child = el.children[j];
        if (child.id && child.id.indexOf("__inspect") === 0) continue;
        var ccs = window.getComputedStyle(child);
        if (ccs.display !== "none" && ccs.visibility !== "hidden") {
          hasVisibleChild = true;
          break;
        }
      }
      if (!hasVisibleChild) {
        var inspectable = findInspectable(el);
        if (inspectable && seen.indexOf(inspectable) === -1) {
          if (
            inspectable === document.body ||
            inspectable === document.documentElement
          )
            continue;
          var ir = inspectable.getBoundingClientRect();
          if (
            ir.width >= window.innerWidth &&
            ir.height >= window.innerHeight * 0.9
          )
            continue;
          seen.push(inspectable);
          regionCandidates.push({ el: inspectable, rect: ir });
        }
      }
    }
  }

  function getSelectionRect(x1, y1, x2, y2) {
    return {
      left: Math.min(x1, x2),
      top: Math.min(y1, y2),
      right: Math.max(x1, x2),
      bottom: Math.max(y1, y2),
    };
  }

  function updateRegionSelect(e) {
    var sr = getSelectionRect(dragStartX, dragStartY, e.clientX, e.clientY);
    selectionBox.style.display = "block";
    selectionBox.style.left = sr.left + "px";
    selectionBox.style.top = sr.top + "px";
    selectionBox.style.width = sr.right - sr.left + "px";
    selectionBox.style.height = sr.bottom - sr.top + "px";
    candidatePoolUsed = 0;
    for (var i = 0; i < regionCandidates.length; i++) {
      var c = regionCandidates[i];
      if (
        c.rect.left < sr.right &&
        c.rect.right > sr.left &&
        c.rect.top < sr.bottom &&
        c.rect.bottom > sr.top
      ) {
        if (!isPinned(c.el)) {
          var hl = getCandidateHighlight(candidatePoolUsed++);
          hl.style.display = "block";
          hl.style.left = c.rect.left + "px";
          hl.style.top = c.rect.top + "px";
          hl.style.width = c.rect.width + "px";
          hl.style.height = c.rect.height + "px";
        }
      }
    }
    for (var i = candidatePoolUsed; i < candidatePool.length; i++) {
      candidatePool[i].style.display = "none";
    }
  }

  function finishRegionSelect() {
    var sr = getSelectionRect(
      dragStartX,
      dragStartY,
      dragCurrentX,
      dragCurrentY,
    );
    var pinned = 0;
    for (var i = 0; i < regionCandidates.length; i++) {
      var c = regionCandidates[i];
      if (
        c.rect.left < sr.right &&
        c.rect.right > sr.left &&
        c.rect.top < sr.bottom &&
        c.rect.bottom > sr.top
      ) {
        if (!isPinned(c.el) && pinnedElements.length < MAX_PINS) {
          pinnedElements.push(c.el);
          c.el.style.outline = "2px dashed #4a90d9";
          c.el.style.outlineOffset = "-2px";
          pinned++;
        }
      }
    }
    cancelRegionSelect();
    if (pinned > 0) {
      copyPinnedToClipboard();
      showToast("Selected " + pinned + " element" + (pinned > 1 ? "s" : ""));
    }
  }

  function cancelRegionSelect() {
    isDragging = false;
    dragPending = false;
    selectionBox.style.display = "none";
    hideCandidateHighlights();
    regionCandidates = [];
  }

  // --- Clipboard builder ---
  function buildClipboardText(el) {
    return buildRef(el);
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
    // Toggle inspect: Ctrl+Shift+X (Win/Linux) or Cmd+Shift+X (Mac)
    if (
      (e.ctrlKey || e.metaKey) &&
      e.shiftKey &&
      (e.key === "x" || e.key === "X")
    ) {
      e.preventDefault();
      toggleInspect();
      return;
    }
    if (isDragging && (e.key === "Escape" || (e.ctrlKey && e.key === "z"))) {
      e.preventDefault();
      cancelRegionSelect();
      return;
    }
    if (
      !isDragging &&
      e.ctrlKey &&
      e.key === "z" &&
      pinnedElements.length > 0
    ) {
      e.preventDefault();
      var last = pinnedElements[pinnedElements.length - 1];
      unpinElement(last);
      showToast(
        pinnedElements.length > 0
          ? pinnedElements.length + " pinned"
          : "Pins cleared",
      );
      return;
    }
    if (e.key === "Escape" && inspectActive) {
      e.preventDefault();
      if (pinnedElements.length > 0) {
        clearPins();
        showToast("Pins cleared");
      } else {
        toggleInspect();
      }
    }
  }

  function onMouseDown(e) {
    if (!inspectActive) return;
    e.preventDefault();
    window.getSelection().removeAllRanges();
    if (e.button === 0) {
      dragPending = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragDidComplete = false;
    }
  }

  function onSelectStart(e) {
    if (inspectActive) e.preventDefault();
  }

  function onMouseMove(e) {
    if (!inspectActive) return;
    // Region select: check drag threshold
    if (dragPending && !isDragging) {
      var dx = e.clientX - dragStartX;
      var dy = e.clientY - dragStartY;
      if (dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) {
        isDragging = true;
        dragPending = false;
        collectCandidates();
        highlight.style.display = "none";
        label.style.display = "none";
        hideGapIndicators();
        parentHighlight.style.display = "none";
      }
    }
    // Region select: update during drag
    if (isDragging) {
      dragCurrentX = e.clientX;
      dragCurrentY = e.clientY;
      updateRegionSelect(e);
      return;
    }
    var el = findInspectable(elementAtPoint(e.clientX, e.clientY));
    if (!el) {
      highlight.style.display = "none";
      label.style.display = "none";
      hideGapIndicators();
      parentHighlight.style.display = "none";
      return;
    }
    var rect = el.getBoundingClientRect();
    highlight.style.display = "block";
    highlight.style.top = rect.top + "px";
    highlight.style.left = rect.left + "px";
    highlight.style.width = rect.width + "px";
    highlight.style.height = rect.height + "px";

    // Gap indicators: try element's own children first, then walk up ancestors
    showChildGaps(el);
    if (gapPoolUsed > 0) {
      // Container mode — el has children with gaps
      parentHighlight.style.display = "none";
    } else {
      // Leaf mode — walk up to find nearest ancestor with >= 2 children
      parentHighlight.style.display = "none";
      var ancestor = el.parentElement;
      while (
        ancestor &&
        ancestor !== document.body &&
        ancestor !== document.documentElement
      ) {
        showChildGaps(ancestor);
        if (gapPoolUsed > 0) {
          var ancRect = ancestor.getBoundingClientRect();
          parentHighlight.style.display = "block";
          parentHighlight.style.top = ancRect.top + "px";
          parentHighlight.style.left = ancRect.left + "px";
          parentHighlight.style.width = ancRect.width + "px";
          parentHighlight.style.height = ancRect.height + "px";
          break;
        }
        ancestor = ancestor.parentElement;
      }
    }

    var styles = extractStyles(el);
    var name = escapeHtml(buildComponentName(el));
    var size = escapeHtml(buildLabelLine3(el, styles));
    var debug = escapeHtml(buildLabelDebug(el));
    var parent = escapeHtml(buildLabelParent(el));

    var lines = [];
    if (name) lines.push("<span>" + name + "</span>");
    if (size) lines.push('<span style="opacity:0.7">' + size + "</span>");
    if (debug) lines.push('<span style="opacity:0.6">' + debug + "</span>");
    if (parent) lines.push('<span style="opacity:0.5">' + parent + "</span>");

    label.innerHTML = lines.join("\n");
    label.style.display = "block";
    var pos = clampPosition(rect, label.offsetWidth, label.offsetHeight);
    label.style.top = pos.top + "px";
    label.style.left = pos.left + "px";
  }

  function onMouseUp(e) {
    if (!inspectActive) return;
    if (isDragging) {
      dragCurrentX = e.clientX;
      dragCurrentY = e.clientY;
      finishRegionSelect();
      dragDidComplete = true;
    }
    dragPending = false;
  }

  function onClick(e) {
    if (!inspectActive) return;
    if (dragDidComplete) {
      dragDidComplete = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    var el = findInspectable(elementAtPoint(e.clientX, e.clientY));
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();

    // Shift+Click: toggle pin
    if (e.shiftKey) {
      // If no pins yet but we have a previously clicked element, pin it first
      if (
        pinnedElements.length === 0 &&
        lastClickedElement &&
        lastClickedElement !== el &&
        document.contains(lastClickedElement)
      ) {
        pinElement(lastClickedElement);
      }
      if (isPinned(el)) {
        unpinElement(el);
      } else {
        pinElement(el);
      }
      lastClickedElement = null;
      return;
    }

    // Regular click: clear pins, remember element, copy single element
    clearPins();
    lastClickedElement = el;
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
    var t = e.changedTouches && e.changedTouches[0];
    var el = findInspectable(
      t ? elementAtPoint(t.clientX, t.clientY) : e.target,
    );
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
  document.addEventListener("selectstart", onSelectStart);
  document.addEventListener("mousedown", onMouseDown, true);
  document.addEventListener("mousemove", onMouseMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("mouseup", onMouseUp, true);
  document.addEventListener("touchend", onTouchEnd, true);

  // --- Restore visual state after HMR ---
  if (inspectActive) {
    document.body.classList.add("__inspect-active");
    document.body.style.userSelect = "none";
  }

  // Restore pin state after HMR (filter removed elements)
  pinnedElements = pinnedElements.filter(function (el) {
    return document.body.contains(el);
  });
  if (pinnedElements.length > 0) {
    for (var i = 0; i < pinnedElements.length; i++) {
      pinnedElements[i].style.outline = "2px dashed #4a90d9";
      pinnedElements[i].style.outlineOffset = "-2px";
    }
  }

  // --- Shared dispose logic (used by HMR and window.__inspectDispose) ---
  function disposeOverlay() {
    clearPins();
    document.body.classList.remove("__inspect-active");
    highlight.remove();
    parentHighlight.remove();
    label.remove();
    selectionBox.remove();
    freezeStyle.remove();
    for (var i = 0; i < gapPool.length; i++) {
      gapPool[i].bar.remove();
    }
    for (var i = 0; i < childHighlightPool.length; i++) {
      childHighlightPool[i].remove();
    }
    for (var i = 0; i < candidatePool.length; i++) {
      candidatePool[i].remove();
    }
    isDragging = false;
    dragPending = false;
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("selectstart", onSelectStart);
    document.removeEventListener("mousedown", onMouseDown, true);
    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("mouseup", onMouseUp, true);
    document.removeEventListener("touchend", onTouchEnd, true);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.__inspectOverlayActive = false;
  }

  // --- External dispose (for non-Vite environments) ---
  window.__inspectDispose = disposeOverlay;

  // --- HMR lifecycle (Vite only — import.meta.hot is undefined elsewhere) ---
  if (import.meta.hot) {
    import.meta.hot.accept();

    import.meta.hot.dispose(function (data) {
      data.inspectActive = inspectActive;
      data.pinnedElements = pinnedElements;
      disposeOverlay();
    });

    import.meta.hot.on("vite:afterUpdate", function () {
      hasDataAttrs = !!document.querySelector("[data-inspector-relative-path]");
    });
  }

  // --- End of init guard ---
}
