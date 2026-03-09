// SSE: live backlog updates
(function () {
  var base = location.pathname.replace(/\/backlog\/?$/, "");

  var es = new EventSource(base + "/events");
  es.onmessage = function (e) {
    if (e.data !== "backlog") return;
    var modal = document.getElementById("detail-modal");
    if (modal && modal.classList.contains("visible")) return;
    fetch(base + "/backlog/data")
      .then(function (r) {
        return r.json();
      })
      .then(function (newData) {
        if (JSON.stringify(newData) === JSON.stringify(data)) return;
        data = newData;
        render();
        toast("Backlog bijgewerkt");
      })
      .catch(function () {});
  };
})();
