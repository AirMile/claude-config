// Patch dependency: hide when dependency feature is DONE
(function () {
  var _baseCreate = typeof createCard !== "undefined" ? createCard : null;
  if (_baseCreate) {
    createCard = function (f) {
      var origDep = f.dependency;
      if (f.dependency && typeof findItem !== "undefined") {
        var dep = findItem(f.dependency);
        if (dep && dep.item.status === "DONE") f.dependency = null;
      }
      var card = _baseCreate(f);
      f.dependency = origDep;
      // Swap tag order: phase-tag before badge
      var tags = card.querySelector(".card-tags");
      if (tags) {
        var phase = tags.querySelector(".phase-tag");
        if (phase) tags.insertBefore(phase, tags.firstChild);
      }
      return card;
    };
  }
})();
