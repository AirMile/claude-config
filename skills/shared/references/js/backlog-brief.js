// Task brief generator: produces markdown brief for teammate assignment
window.generateTaskBrief = async function (f) {
  var lines = [];
  lines.push("## " + f.name);
  lines.push(
    "**Type:** " +
      f.type +
      " | **Prioriteit:** " +
      (f.phase || "P1") +
      " | **Status:** " +
      f.status,
  );
  lines.push("");
  if (f.description) {
    lines.push("### Beschrijving");
    lines.push(f.description);
    lines.push("");
  }

  // Fetch feature.json for rich data (DEF+ status)
  var detail = null;
  try {
    var basePath = location.pathname
      .replace(/\/backlog\/?$/, "")
      .replace(/\/+$/, "");
    var res = await fetch(basePath + "/feature/" + encodeURIComponent(f.name));
    if (res.ok) detail = await res.json();
  } catch (e) {}

  if (detail) {
    if (detail.summary) {
      lines.push(detail.summary);
      lines.push("");
    }
    if (detail.requirements && detail.requirements.length) {
      lines.push("### Requirements");
      lines.push("| # | Requirement | Acceptatiecriteria |");
      lines.push("|---|------------|-------------------|");
      detail.requirements.forEach(function (r) {
        lines.push(
          "| " +
            r.id +
            " | " +
            r.description +
            " | " +
            (r.acceptance || "-") +
            " |",
        );
      });
      lines.push("");
    }
    if (detail.files && detail.files.length) {
      lines.push("### Bestanden");
      detail.files.forEach(function (file) {
        lines.push(
          "- " + file.action + " " + file.path + " — " + (file.purpose || ""),
        );
      });
      lines.push("");
    }
    if (detail.buildSequence && detail.buildSequence.length) {
      lines.push("### Build Volgorde");
      detail.buildSequence.forEach(function (step) {
        lines.push(step.step + ". " + step.description);
      });
      lines.push("");
    }
    if (detail.testStrategy && detail.testStrategy.length) {
      lines.push("### Test Strategie");
      detail.testStrategy.forEach(function (t) {
        lines.push(
          "- " +
            (t.requirementId || t.id || "") +
            ": " +
            (t.description || t.approach || ""),
        );
      });
      lines.push("");
    }
    if (detail.durableDecisions && detail.durableDecisions.length) {
      lines.push("### Beslissingen");
      detail.durableDecisions.forEach(function (d) {
        lines.push("- " + d);
      });
      lines.push("");
    }
  }

  if (f.dependency) {
    var depFound =
      typeof findItem !== "undefined" ? findItem(f.dependency) : null;
    var depStatus = depFound ? depFound.item.status : "onbekend";
    lines.push("### Dependencies");
    lines.push(
      "- Afhankelijk van: **" + f.dependency + "** (status: " + depStatus + ")",
    );
    lines.push("");
  }

  return lines.join("\n");
};
