// Patch render: sort cards by priority (P1 first) within each column
(function () {
  var PHASE_ORDER = { P1: 1, P2: 2, P3: 3, P4: 4 };
  var _origRenderSort = window.render;
  if (_origRenderSort) {
    window.render = function () {
      _origRenderSort();
      document.querySelectorAll(".cards").forEach(function (container) {
        var cards = Array.from(container.children);
        if (cards.length < 2) return;
        cards.sort(function (a, b) {
          var pa = 4,
            pb = 4;
          var tagA = a.querySelector(".phase-tag");
          var tagB = b.querySelector(".phase-tag");
          if (tagA) {
            for (var k in PHASE_ORDER) {
              if (tagA.classList.contains("phase-" + k.toLowerCase())) {
                pa = PHASE_ORDER[k];
                break;
              }
            }
          }
          if (tagB) {
            for (var k in PHASE_ORDER) {
              if (tagB.classList.contains("phase-" + k.toLowerCase())) {
                pb = PHASE_ORDER[k];
                break;
              }
            }
          }
          return pa - pb;
        });
        cards.forEach(function (c) {
          container.appendChild(c);
        });
      });
    };
  }
  if (window.render) render();
})();
