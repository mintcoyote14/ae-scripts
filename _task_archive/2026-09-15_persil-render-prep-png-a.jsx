// !TASK.jsx
// =====================================================================
//   T A S K   -   universal slot for one-off jobs
// =====================================================================
//
//   TASK:  Persil test - duplicate the leftover queue items as png + a
//   DATE:  2026-09-15
//
//   ScriptLauncherPanel reads the "TASK:" line and shows it on the button.
//   Only the task() block below is edited. Everything else is the wrapper:
//   undo group, error handling, report, helper set.
//   Previous versions live in _task_archive\
// =====================================================================

(function () {

    var TASK_NAME = "TASK";      // undo group name
    var SILENT    = false;       // true - do not show the summary window

    // ------------------------------------------------------------------
    //  HELPERS
    // ------------------------------------------------------------------
    var _log = [];

    function log(msg) { _log.push(String(msg)); }

    function fail(msg) { throw new Error(msg); }

    function comp(required) {
        var c = app.project.activeItem;
        if (!(c && c instanceof CompItem)) {
            if (required === false) return null;
            fail("Open a composition.");
        }
        return c;
    }

    // Selected layers; if nothing is selected and allIfEmpty !== false - every layer
    function layers(c, allIfEmpty) {
        c = c || comp();
        var out = [], i;
        if (c.selectedLayers.length) {
            for (i = 0; i < c.selectedLayers.length; i++) out.push(c.selectedLayers[i]);
        } else if (allIfEmpty !== false) {
            for (i = 1; i <= c.numLayers; i++) out.push(c.layer(i));
        }
        if (!out.length) fail("No layers to work on.");
        return out;
    }

    // Selected properties of a layer (what is highlighted in the timeline)
    function props(layer) {
        var sel = layer.selectedProperties, out = [], i;
        for (i = 0; i < sel.length; i++) {
            if (sel[i] instanceof Property) out.push(sel[i]);
        }
        return out;
    }

    // Every comp in the project; sel === true - only those selected in the Project panel
    function comps(sel) {
        var out = [], i, it;
        for (i = 1; i <= app.project.numItems; i++) {
            it = app.project.item(i);
            if (!(it instanceof CompItem)) continue;
            if (sel === true && !it.selected) continue;
            out.push(it);
        }
        return out;
    }

    // Selected Project panel items of any type
    function items() {
        var s = app.project.selection, out = [], i;
        for (i = 0; i < s.length; i++) out.push(s[i]);
        return out;
    }

    // Recursive walk over the items of a project folder
    function walk(folder, fn) {
        var i, it;
        for (i = 1; i <= folder.numItems; i++) {
            it = folder.item(i);
            fn(it);
            if (it instanceof FolderItem) walk(it, fn);
        }
    }

    // Property lookup by path: prop(layer, "Effects", "Gaussian Blur", "Blurriness")
    function prop(root) {
        var p = root, i;
        for (i = 1; i < arguments.length; i++) {
            if (!p) return null;
            p = p.property(arguments[i]);
        }
        return p;
    }

    function ask(question, def) {
        var v = prompt(question, def === undefined ? "" : String(def));
        if (v === null) fail("__CANCEL__");
        return v;
    }

    function askNum(question, def) {
        var v = parseFloat(ask(question, def).replace(",", "."));
        if (isNaN(v)) fail("A number is required.");
        return v;
    }

    function confirmOr(question) {
        if (!confirm(question)) fail("__CANCEL__");
    }

    // ------------------------------------------------------------------
    //  THE JOB  -  the code of the current task goes here
    // ------------------------------------------------------------------
    function task() {

        // The output module every new week is rendered with, and the
        // extension that goes with it
        var TPL = /png\s*\+\s*a/i;
        var EXT = ".png";

        var rq = app.project.renderQueue;
        if (rq.numItems === 0) fail("The render queue is empty.");

        // ---- the template, however this AE spells it ---------------------
        var all = [], tpl = null, i, j;
        try { all = rq.item(1).outputModule(1).templates; } catch (e) { all = []; }
        for (i = 0; i < all.length; i++) if (TPL.test(all[i])) { tpl = all[i]; break; }
        if (!tpl) {
            log("Output module templates in this AE:");
            for (i = 0; i < all.length; i++) log("  " + all[i]);
            fail("No template matching  png + a  was found.");
        }

        // ---- what to duplicate -------------------------------------------
        //  everything the week save left behind: nothing rendered, and not
        //  a png + a item already - so running it twice adds nothing
        var src = [], it;
        for (i = 1; i <= rq.numItems; i++) {
            it = rq.item(i);
            if (it.status === RQItemStatus.DONE || it.status === RQItemStatus.RENDERING) continue;
            if (it.numOutputModules && TPL.test(String(it.outputModule(1).name))) continue;
            src.push(it);
        }
        if (!src.length) fail("Nothing to duplicate - every item in the queue is already " + tpl + ".");

        // ---- duplicate, re-template, re-queue ------------------------------
        var dup, om, old, path, made = 0;
        for (i = 0; i < src.length; i++) {
            it = src[i];
            log("#" + (i + 1) + "  " + (it.comp ? it.comp.name : "?"));

            dup = it.duplicate();
            for (j = 1; j <= dup.numOutputModules; j++) {
                om  = dup.outputModule(j);
                old = it.outputModule(j).file;
                path = old ? String(old.fsName) : "";
                log("    was:  " + (path || "(no output set)"));

                // the template wipes Output To, so the path goes back after it
                om.applyTemplate(tpl);
                if (path) {
                    om.file = new File(path.replace(/\.[^.\\\/]+$/, EXT));
                    log("    now:  " + om.file.fsName);
                }
            }

            dup.render = true;     // only the copy renders
            made++;                // the original is not touched at all - it stays in the project
        }

        log("");
        log("Duplicated as " + tpl + ": " + made);
        log("The originals were left exactly as they were. Nothing was rendered.");
    }

    // ------------------------------------------------------------------
    //  RUN
    // ------------------------------------------------------------------
    app.beginUndoGroup(TASK_NAME);
    var err = null;
    try {
        task();
    } catch (e) {
        if (String(e.message || e).indexOf("__CANCEL__") === -1) err = e;
    } finally {
        app.endUndoGroup();
    }

    if (err) {
        alert(TASK_NAME + " - error:\n\n" + (err.message || err) +
              (err.line ? "\n(line " + err.line + ")" : "") +
              (_log.length ? "\n\n-- before the error --\n" + _log.join("\n") : ""));
    } else if (!SILENT) {
        alert(TASK_NAME + "\n\n" + (_log.length ? _log.join("\n") : "Report is empty - task() returned nothing."));
    }

})();
