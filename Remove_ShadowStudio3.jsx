// Remove_ShadowStudio3.jsx
// Removes every Shadow Studio 3 effect (match name "PESS3") from all layers of all comps
// of the open project and saves the result as a copy "<name>_noSS3.aep" next to the original.
// The original .aep is not overwritten. Useful when a project crashes a newer After Effects
// because of the plugin.

(function () {
    var MATCH = "PESS3";
    var proj = app.project;

    if (!proj || !proj.file) {
        alert("Remove Shadow Studio 3\n\nOpen and save the project first.");
        return;
    }

    var src = proj.file;
    var base = src.name.replace(/\.aep$/i, "");
    var out = new File(src.parent.fsName + "/" + base + "_noSS3.aep");
    if (out.exists) {
        alert("Remove Shadow Studio 3\n\nThis file already exists:\n" + out.fsName + "\n\nRename or move it, then run again.");
        return;
    }

    var removed = 0, where = [], i, j, k, it, L, fx;
    app.beginUndoGroup("Remove Shadow Studio 3");
    try {
        for (i = 1; i <= proj.numItems; i++) {
            it = proj.item(i);
            if (!(it instanceof CompItem)) continue;
            for (j = 1; j <= it.numLayers; j++) {
                L = it.layer(j);
                fx = L.property("ADBE Effect Parade");
                if (!fx) continue;
                for (k = fx.numProperties; k >= 1; k--) {
                    if (fx.property(k).matchName === MATCH) {
                        fx.property(k).remove();
                        removed++;
                        where.push(it.name + "  /  " + L.name);
                    }
                }
            }
        }
    } catch (e) {
        app.endUndoGroup();
        alert("Remove Shadow Studio 3 - error:\n\n" + e.toString() + (e.line ? "\n(line " + e.line + ")" : ""));
        return;
    }
    app.endUndoGroup();

    if (!removed) {
        alert("Remove Shadow Studio 3\n\nNo Shadow Studio 3 effects found in this project. Nothing was saved.");
        return;
    }

    proj.save(out);

    alert("Remove Shadow Studio 3\n\n" +
          "Removed: " + removed + " effect(s).\n" +
          "Saved as:\n" + out.fsName + "\n\n" +
          "The original file was not changed.\n\n" +
          where.slice(0, 30).join("\n") + (where.length > 30 ? "\n... and " + (where.length - 30) + " more" : ""));
})();
