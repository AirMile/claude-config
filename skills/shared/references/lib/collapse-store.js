// collapse-store.js — persisted expand/collapse state for backlog + dashboard
(function (global) {
  let _scope = "collapse:default";

  function initCollapseStore(namespace, projectName) {
    _scope = `${namespace}:collapse:v1:${projectName || "default"}`;
  }
  function _load() {
    try {
      return JSON.parse(localStorage.getItem(_scope) || "{}");
    } catch {
      return {};
    }
  }
  function _save(s) {
    localStorage.setItem(_scope, JSON.stringify(s));
  }
  function setCollapsed(key, collapsed) {
    const s = _load();
    s[key] = collapsed ? 1 : 0;
    _save(s);
  }
  function isCollapsed(key, defaultValue = false) {
    const s = _load();
    if (!(key in s)) return defaultValue;
    return s[key] === 1;
  }
  function setSingle(name, value) {
    const s = _load();
    if (value == null) delete s["single:" + name];
    else s["single:" + name] = value;
    _save(s);
  }
  function getSingle(name) {
    return _load()["single:" + name] ?? null;
  }
  function loadAll() {
    return _load();
  }

  Object.assign(global, {
    initCollapseStore,
    setCollapsed,
    isCollapsed,
    setSingle,
    getSingle,
    loadAll,
  });
})(window);
