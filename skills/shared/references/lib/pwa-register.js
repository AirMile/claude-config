// pwa-register.js — registers the service worker so the origin becomes
// installable (Dock/Launchpad/Start icon, standalone window). Defensive: no-op
// in browsers without SW support, and never blocks page render. Also surfaces
// a small "Install app" button when Chrome/Edge signal the page is
// installable and it isn't installed yet — the one-click path to swapping in
// a freshly baked icon after a redesign, without hunting for the address-bar
// install icon.
(function () {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {
      // Installability is a nice-to-have — a failed registration must never
      // break the board/dashboard itself.
    });
  });

  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
  });
  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    hideInstallButton();
  });

  var btn = null;
  function showInstallButton() {
    if (btn) return;
    btn = document.createElement("button");
    btn.textContent = "Install app";
    btn.style.cssText =
      "position:fixed;right:16px;bottom:16px;z-index:9999;" +
      "padding:8px 14px;border-radius:8px;border:1px solid #30363d;" +
      "background:#0d1117;color:#58a6ff;font:13px system-ui,sans-serif;" +
      "cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.4);";
    btn.addEventListener("click", function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () {
        deferredPrompt = null;
        hideInstallButton();
      });
    });
    document.body.appendChild(btn);
  }
  function hideInstallButton() {
    if (!btn) return;
    btn.remove();
    btn = null;
  }
})();
