// GitHub integration: "Push to Done" button on ALL DONE cards
(function () {
  var ghSvg =
    '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';
  var checkSvg =
    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8.5l3.5 3.5 7-7"/></svg>';
  var spinSvg =
    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" class="gh-spin"><path d="M8 1a7 7 0 105 2"/></svg>';

  // Get project directory from URL path (e.g. /my-project/backlog → my-project)
  function getProjectDir() {
    var parts = window.location.pathname.split("/").filter(Boolean);
    return parts[0] || "";
  }

  // Extract issue number from GitHub URL
  function issueNum(url) {
    var m = url && url.match(/\/(\d+)$/);
    return m ? m[1] : null;
  }

  // Config check: only show GitHub buttons if github-project.json exists
  function checkConfig(cb) {
    if (typeof window.__ghConfigured !== "undefined") {
      cb(window.__ghConfigured);
      return;
    }
    fetch("/" + getProjectDir() + "/github/config-check")
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        window.__ghConfigured = !!d.configured;
        cb(window.__ghConfigured);
      })
      .catch(function () {
        window.__ghConfigured = false;
        cb(false);
      });
  }

  // Add GitHub link element to a card
  function addGhLink(card, f) {
    if (!f.github_issue) return;
    var num = issueNum(f.github_issue);
    var link = document.createElement("a");
    link.className = "card-gh-link";
    link.href = f.github_issue;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "#" + (num || "?");
    link.title = f.github_issue;
    // Insert after card-tags or at end of card body
    var tags = card.querySelector(".card-tags");
    if (tags && tags.parentNode) {
      tags.parentNode.insertBefore(link, tags.nextSibling);
    } else {
      var body = card.querySelector(".card-body") || card;
      body.appendChild(link);
    }
  }

  // Collect unpushed DONE feature names from backlog data embedded in page
  function getUnpushedNames() {
    var names = [];
    try {
      var el = document.getElementById("backlog-data");
      if (!el) return names;
      var data = JSON.parse(el.textContent);
      if (!data.features) return names;
      data.features.forEach(function (f) {
        if (f.status === "DONE" && !(f.github_issue && f.github_item_id)) {
          names.push(f.name);
        }
      });
    } catch (e) {}
    return names;
  }

  // Push a single item by name, returns promise with result
  function pushOne(name) {
    var projectDir = getProjectDir();
    return fetch("/" + projectDir + "/github/push-done", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data.ok) return { name: name, ok: true, issue_url: data.issue_url };
        return { name: name, ok: false, error: data.error || "onbekend" };
      })
      .catch(function (err) {
        return { name: name, ok: false, error: err.message };
      });
  }

  // Add bulk push button to DONE column header
  function addBulkButton() {
    if (document.querySelector(".gh-bulk-btn")) return;
    var columns = document.querySelectorAll(".column");
    var doneCol = null;
    columns.forEach(function (col) {
      var header = col.querySelector(".column-header");
      if (
        header &&
        header.textContent.trim().toUpperCase().indexOf("DONE") !== -1
      ) {
        doneCol = col;
      }
    });
    if (!doneCol) return;

    var unpushed = getUnpushedNames();
    if (unpushed.length === 0) return;

    var header = doneCol.querySelector(".column-header");
    if (!header) return;

    var bulkBtn = document.createElement("button");
    bulkBtn.className = "gh-bulk-btn";
    bulkBtn.innerHTML = ghSvg + " Push all";
    bulkBtn.title = "Push alle DONE items naar GitHub";
    bulkBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      doBulkPush(bulkBtn);
    });
    header.appendChild(bulkBtn);
  }

  // Bulk push: sequential fetch calls with progress feedback
  function doBulkPush(bulkBtn) {
    var names = getUnpushedNames();
    var total = names.length;
    if (total === 0) return;

    bulkBtn.disabled = true;
    var origHtml = bulkBtn.innerHTML;
    var done = 0;
    var errors = 0;

    function updateProgress() {
      bulkBtn.innerHTML = spinSvg + " " + done + "/" + total;
    }

    function pushNext(idx) {
      if (idx >= names.length) {
        bulkBtn.innerHTML = checkSvg + " " + done + "/" + total;
        if (errors > 0) {
          bulkBtn.innerHTML += " (" + errors + " fouten)";
        }
        // Re-render to update all cards with new github links/icons
        if (typeof render === "function") render();
        setTimeout(function () {
          bulkBtn.disabled = false;
          bulkBtn.innerHTML = origHtml;
          if (errors === 0) bulkBtn.remove();
        }, 3000);
        return;
      }

      updateProgress();
      pushOne(names[idx]).then(function (result) {
        if (result.ok) {
          done++;
          if (typeof toast === "function")
            toast(result.name + " → GitHub Done ✓");
        } else {
          errors++;
          if (typeof toast === "function")
            toast("Fout " + result.name + ": " + result.error);
        }
        updateProgress();
        pushNext(idx + 1);
      });
    }

    pushNext(0);
  }

  // Patch createCard: add GitHub button on ALL DONE cards
  var origCreate = window.createCard;
  if (origCreate) {
    window.createCard = function (f) {
      var card = origCreate(f);
      if (f.status !== "DONE") return card;

      // Add GitHub link for already-pushed items
      if (f.github_issue) {
        addGhLink(card, f);
      }

      // Skip GitHub buttons if not configured
      if (window.__ghConfigured === false) return card;

      var actions = card.querySelector(".card-actions");
      if (!actions) return card;

      // Already pushed to GitHub — show disabled check
      if (f.github_issue && f.github_item_id) {
        var doneIcon = document.createElement("span");
        doneIcon.className = "card-gh-done";
        doneIcon.title = "Al op GitHub: " + f.github_issue;
        doneIcon.innerHTML = checkSvg;
        doneIcon.style.opacity = "0.5";
        doneIcon.style.cursor = "default";
        actions.appendChild(doneIcon);
        return card;
      }

      var ghBtn = document.createElement("button");
      ghBtn.className = "card-gh-done";
      ghBtn.title = "Push naar Done op GitHub";
      ghBtn.innerHTML = ghSvg;
      ghBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        // Show spinner
        ghBtn.innerHTML = spinSvg;
        ghBtn.disabled = true;

        var projectDir = getProjectDir();
        fetch("/" + projectDir + "/github/push-done", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: f.name }),
        })
          .then(function (res) {
            return res.json();
          })
          .then(function (data) {
            if (data.ok) {
              // Update local data
              f.github_issue = data.issue_url;
              f.github_item_id = data.issue_url;
              ghBtn.innerHTML = checkSvg;
              ghBtn.classList.add("copied");
              ghBtn.title = "Gepusht: " + data.issue_url;
              // Add link to card
              addGhLink(card, f);
              if (typeof toast === "function")
                toast(f.name + " → GitHub Done ✓");
            } else {
              ghBtn.innerHTML = ghSvg;
              ghBtn.disabled = false;
              if (typeof toast === "function")
                toast("Fout: " + (data.error || "onbekend"));
            }
          })
          .catch(function (err) {
            ghBtn.innerHTML = ghSvg;
            ghBtn.disabled = false;
            if (typeof toast === "function") toast("Fout: " + err.message);
          });
      });
      actions.appendChild(ghBtn);
      return card;
    };
  }

  // Init: check config, then render + add bulk button
  checkConfig(function (configured) {
    if (typeof render === "function") render();
    if (configured) {
      // Delay slightly to let render complete
      setTimeout(addBulkButton, 100);
    }
  });
})();
