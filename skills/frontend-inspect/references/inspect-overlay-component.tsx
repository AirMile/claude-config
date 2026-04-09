"use client";

import { useEffect } from "react";

export function InspectOverlay() {
  useEffect(() => {
    if (document.getElementById("__inspect-overlay")) return;

    let inspectActive = false;

    // --- Toggle button ---
    const btn = document.createElement("button");
    btn.id = "__inspect-overlay";
    btn.textContent = "\u{1F50D}";
    btn.title = "Toggle Inspect Mode (Ctrl/Cmd+Shift+X)";
    btn.setAttribute("aria-label", "Toggle inspect mode");
    btn.style.cssText =
      "position:fixed;bottom:16px;right:16px;z-index:99999;width:44px;height:44px;" +
      "border-radius:50%;border:2px solid #4a90d9;background:#fff;font-size:20px;" +
      "cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.15);transition:all 0.2s;" +
      "line-height:44px;text-align:center;padding:0;user-select:none;touch-action:manipulation;";
    document.body.appendChild(btn);

    // --- Highlight overlay ---
    const highlight = document.createElement("div");
    highlight.style.cssText =
      "position:fixed;pointer-events:none;z-index:99998;border:2px solid #4a90d9;" +
      "background:rgba(74,144,217,0.08);display:none;transition:all 0.05s ease-out;border-radius:2px;";
    document.body.appendChild(highlight);

    // --- Label ---
    const label = document.createElement("div");
    label.style.cssText =
      "position:fixed;pointer-events:none;z-index:99999;background:#4a90d9;color:#fff;" +
      "font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;padding:2px 8px;" +
      "border-radius:3px;display:none;white-space:nowrap;max-width:90vw;overflow:hidden;" +
      "text-overflow:ellipsis;";
    document.body.appendChild(label);

    // --- Toast ---
    function showToast(text: string) {
      const toast = document.createElement("div");
      toast.textContent = text;
      toast.style.cssText =
        "position:fixed;bottom:70px;right:16px;z-index:99999;background:#333;color:#fff;" +
        "font:13px/1.4 system-ui,sans-serif;padding:8px 16px;border-radius:6px;" +
        "opacity:1;transition:opacity 0.3s;max-width:90vw;overflow:hidden;text-overflow:ellipsis;";
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = "0";
      }, 1500);
      setTimeout(() => {
        toast.remove();
      }, 1800);
    }

    // --- Toggle ---
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

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleInspect();
    });

    // --- Ctrl/Cmd+Shift+X shortcut ---
    function onKeyDown(e: KeyboardEvent) {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key === "x" || e.key === "X")
      ) {
        e.preventDefault();
        toggleInspect();
      }
    }
    document.addEventListener("keydown", onKeyDown);

    // --- Find nearest inspectable element ---
    function findInspectable(el: Element | null): Element | null {
      if (!el || el === document.body || el === document.documentElement)
        return null;
      if (el.id === "__inspect-overlay" || el.closest("#__inspect-overlay"))
        return null;
      return el.closest("[class]") || el;
    }

    // --- Build reference string ---
    function buildRef(el: Element): string {
      const tag = el.tagName.toLowerCase();
      const cls =
        el.className && typeof el.className === "string"
          ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
          : "";
      const text = (el.textContent || "").trim().substring(0, 30);
      return tag + cls + (text ? ` "${text}"` : "");
    }

    // --- Hover ---
    function onMouseMove(e: MouseEvent) {
      if (!inspectActive) return;
      const el = findInspectable(e.target as Element);
      if (!el) {
        highlight.style.display = "none";
        label.style.display = "none";
        return;
      }
      const rect = el.getBoundingClientRect();
      highlight.style.display = "block";
      highlight.style.top = rect.top + "px";
      highlight.style.left = rect.left + "px";
      highlight.style.width = rect.width + "px";
      highlight.style.height = rect.height + "px";

      const ref = buildRef(el);
      label.textContent = ref;
      label.style.display = "block";
      let labelTop = rect.top - 22;
      if (labelTop < 4) labelTop = rect.bottom + 4;
      label.style.top = labelTop + "px";
      label.style.left = rect.left + "px";
    }
    document.addEventListener("mousemove", onMouseMove, true);

    // --- Click: copy reference ---
    function onClick(e: MouseEvent) {
      if (!inspectActive) return;
      const el = findInspectable(e.target as Element);
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();

      const ref = buildRef(el);

      if (navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(ref)
          .then(() => showToast("Copied: " + ref))
          .catch(() => showToast(ref));
      } else {
        showToast(ref);
      }
    }
    document.addEventListener("click", onClick, true);

    // --- Touch support ---
    function onTouchEnd(e: TouchEvent) {
      if (!inspectActive) return;
      const el = findInspectable(e.target as Element);
      if (!el) return;
      e.preventDefault();

      const ref = buildRef(el);

      if (navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(ref)
          .then(() => showToast("Copied: " + ref))
          .catch(() => showToast(ref));
      } else {
        showToast(ref);
      }
    }
    document.addEventListener("touchend", onTouchEnd, true);

    // --- Cleanup ---
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousemove", onMouseMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("touchend", onTouchEnd, true);
      btn.remove();
      highlight.remove();
      label.remove();
    };
  }, []);

  return null;
}
