// Strip_ThirdParty_FX.jsx
// Removes every third-party effect (Trapcode Particular, Shadow Studio, etc.) from all layers of all comps
// of the open project and saves the result as a copy "<name>_noFX.aep" next to the original.
// Built-in effects (ADBE..., CC..., Pseudo/... expression controls, APC...) are kept.
// The original .aep is not overwritten. Use it in an older After Effects when a project crashes a newer one.

(function () {
    var TITLE = "Strip third-party effects";
    var proj = app.project;

    // effects whose match name starts with one of these are built into After Effects
    var KEEP = ["ADBE ", "ADBE", "CC ", "Pseudo/", "APC ", "CS ", "VISINF ", "EXtractoR", "IDentifier"];

    function isBuiltIn(mn) {
        for (var i = 0; i < KEEP.length; i++) if (mn.indexOf(KEEP[i]) === 0) return true;
        return false;
    }

    if (!proj || !proj.file) {
        alert(TITLE + "\n\nOpen and save the project first.");
        return;
    }

    var src = proj.file;
    var base = src.name.replace(/\.aep$/i, "");
    var out = new File(src.parent.fsName + "/" + base + "_noFX.aep");
    if (out.exists) {
        alert(TITLE + "\n\nThis file already exists:\n" + out.fsName + "\n\nRename or move it, then run again.");
        return;
    }

    var removed = 0, byName = {}, where = [], i, j, k, it, L, fx, e, mn;
    app.beginUndoGroup(TITLE);
    try {
        for (i = 1; i <= proj.numItems; i++) {
            it = proj.item(i);
            if (!(it instanceof CompItem)) continue;
            for (j = 1; j <= it.numLayers; j++) {
                L = it.layer(j);
                fx = L.property("ADBE Effect Parade");
                if (!fx) continue;
                for (k = fx.numProperties; k >= 1; k--) {
                    e = fx.property(k);
                    mn = e.matchName;
                    if (isBuiltIn(mn)) continue;
                    byName[mn + "  (" + e.name + ")"] = (byName[mn + "  (" + e.name + ")"] || 0) + 1;
                    e.remove();
                    removed++;
                    where.push(it.name + "  /  " + L.name);
                }
            }
        }
    } catch (err) {
        app.endUndoGroup();
        alert(TITLE + " - error:\n\n" + err.toString() + (err.line ? "\n(line " + err.line + ")" : ""));
        return;
    }
    app.endUndoGroup();

    if (!removed) {
        alert(TITLE + "\n\nNo third-party effects found. Nothing was saved.");
        return;
    }

    proj.save(out);

    var summary = [];
    for (var n in byName) summary.push(byName[n] + " x  " + n);
    alert(TITLE + "\n\n" +
          "Removed: " + removed + " effect(s)\n" + summary.join("\n") + "\n\n" +
          "Saved as:\n" + out.fsName + "\n\n" +
          "The original file was not changed.\n\n" +
          where.slice(0, 25).join("\n") + (where.length > 25 ? "\n... and " + (where.length - 25) + " more" : ""));
})();
