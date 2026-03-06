// Patch drag-and-drop: enable intra-column reordering with live card movement
// Overrides inline drag handlers + enforces data.features array order
(function () {
  var _dragEl = null;
  var _dragName = null;
  var _dragOrigStatus = null;
  var _dropOK = false;

  // ── Override global drag handlers ──

  window.handleDragStart = function (e) {
    _dragEl = this;
    _dragName = this.dataset.name;
    var found = typeof findItem !== "undefined" ? findItem(_dragName) : null;
    _dragOrigStatus = found ? found.item.status : null;
    _dropOK = false;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", _dragName);
    // Delay ghost class so browser captures drag image first
    var el = this;
    setTimeout(function () {
      el.classList.add("ghost");
    }, 0);
  };

  window.handleDragEnd = function () {
    if (!_dragEl) return;
    _dragEl.classList.remove("ghost");

    if (_dropOK) {
      // Sync DOM order back to data.features
      var newOrder = [];
      document.querySelectorAll(".cards").forEach(function (container) {
        container.querySelectorAll(".card").forEach(function (card) {
          var item = data.features.find(function (f) {
            return f.name === card.dataset.name;
          });
          if (item) newOrder.push(item);
        });
      });
      data.features.forEach(function (f) {
        if (
          !newOrder.find(function (n) {
            return n.name === f.name;
          })
        )
          newOrder.push(f);
      });
      data.features = newOrder;
      if (typeof syncJSON !== "undefined") syncJSON();

      var found = typeof findItem !== "undefined" ? findItem(_dragName) : null;
      var newStatus = found ? found.item.status : null;
      if (_dragOrigStatus !== newStatus) {
        if (typeof toast !== "undefined")
          toast(_dragName + ": " + _dragOrigStatus + " \u2192 " + newStatus);
      } else {
        if (typeof toast !== "undefined") toast(_dragName + " verplaatst");
      }
    }

    // Always re-render to clean state
    if (typeof render !== "undefined") render();
    _dropOK = false;
    _dragEl = null;
    _dragName = null;
    _dragOrigStatus = null;
  };

  function getClosestCard(container, y) {
    var cards = Array.from(container.querySelectorAll(".card:not(.ghost)"));
    var closest = null;
    var closestOffset = -Infinity;
    for (var i = 0; i < cards.length; i++) {
      var rect = cards[i].getBoundingClientRect();
      var offset = y - rect.top - rect.height / 2;
      if (offset < 0 && offset > closestOffset) {
        closestOffset = offset;
        closest = cards[i];
      }
    }
    return closest;
  }

  window.handleDragOver = function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!_dragEl) return;
    var closest = getClosestCard(this, e.clientY);
    if (closest) {
      this.insertBefore(_dragEl, closest);
    } else {
      this.appendChild(_dragEl);
    }
  };

  window.handleDragLeave = function () {};

  window.handleDrop = function (e) {
    e.preventDefault();
    _dropOK = true;
    if (!_dragEl || !_dragName) return;

    var newStatus = this.dataset.status;
    var found = typeof findItem !== "undefined" ? findItem(_dragName) : null;
    if (!found) return;

    // Update status for cross-column moves
    if (found.item.status !== newStatus) {
      if (typeof updateStatus !== "undefined") {
        if (newStatus === "DOING") {
          updateStatus(_dragName, newStatus, found.item.stage || "defining");
        } else {
          updateStatus(_dragName, newStatus);
        }
      }
    }
  };

  // ── Patch render: enforce data.features order (overrides sort.js + inline sort) ──
  var _prevRenderDrag = window.render;
  if (_prevRenderDrag) {
    window.render = function () {
      _prevRenderDrag();
      // Reorder DOM cards to match data.features array order
      document.querySelectorAll(".cards").forEach(function (container) {
        var status = container.dataset.status;
        var items = data.features.filter(function (f) {
          return f.status === status;
        });
        items.forEach(function (f) {
          var card = container.querySelector(
            '.card[data-name="' + f.name + '"]',
          );
          if (card) container.appendChild(card);
        });
      });
    };
  }

  // Re-render with new handlers + order
  if (window.render) render();
})();
