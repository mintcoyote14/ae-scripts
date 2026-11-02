// time_remap_delete_after_cti.jsx
// =====================================================================
//   Time Remap: remove every key after the playhead
// =====================================================================
//   Works on the selected layers. A key sitting exactly on the playhead
//   stays - everything to the right of it is removed.
//
//   Time Remap itself is not switched off and the layer out-point is not
//   moved: after the last key the value simply holds.
// =====================================================================

(function () {

    var SCRIPT_NAME = "Time Remap - cut after CTI";

    var comp = app.project.activeItem;
    if (!(comp && comp instanceof CompItem)) { alert("Open a composition."); return; }

    var sel = comp.selectedLayers;
    if (!sel.length) { alert("Select layers with Time Remap."); return; }

    var t   = comp.time;
    var eps = comp.frameDuration / 2;      // keep the key on the playhead itself

    var done = [], skipped = [], warn = [];
    var total = 0, i, k, L, p, n, rest;

    app.beginUndoGroup(SCRIPT_NAME);
    try {
        for (i = 0; i < sel.length; i++) {
            L = sel[i];

            p = null;
            try { p = L.property("ADBE Time Remapping"); } catch (e) { p = null; }

            if (!p) { skipped.push(L.name + " - layer has no Time Remap"); continue; }

            try {
                if (L.timeRemapEnabled === false) {
                    skipped.push(L.name + " - Time Remap is off");
                    continue;
                }
            } catch (e2) {}

            if (p.numKeys === 0) { skipped.push(L.name + " - no keys"); continue; }

            // from the end, so the indices do not shift
            n = 0;
            for (k = p.numKeys; k >= 1; k--) {
                if (p.keyTime(k) > t + eps) { p.removeKey(k); n++; }
            }

            rest = p.numKeys;
            total += n;
            done.push(L.name + " - removed " + n + ", left " + rest);

            // offset / stretch shift the layer time base against the comp
            if (L.startTime !== 0 || L.stretch !== 100)
                warn.push(L.name + "  (startTime " + L.startTime.toFixed(2) +
                          "s, stretch " + L.stretch + "%)");
        }
    } finally {
        app.endUndoGroup();
    }

    var msg = "Keys removed: " + total + "\n\n";
    if (done.length)    msg += done.join("\n") + "\n";
    if (skipped.length) msg += "\nSkipped:\n" + skipped.join("\n") + "\n";
    if (warn.length)    msg += "\nLayers with offset or stretch - check by eye:\n" + warn.join("\n");

    alert(SCRIPT_NAME + "\n\n" + msg);

})();
