// !TASK.jsx
// =====================================================================
//   T A S K   -   universal slot for one-off jobs
// =====================================================================
//
//   TASK:  Whole queue -> H.264 15 Mbps + paths in output/20260911/<timing>s
//   DATE:  2026-09-11
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

        var BASE = "X:\\WarszawskiFestiwalFilmowy2026_232446\\output\\20260911";
        var TPL  = "H.264 - Match Render Settings - 15 Mbps";   // stock AE template
        var COMP_SEC = /_(\d+)_\d+x\d+$/;    // timing from the name: "..._15_1080x1920" -> 15

        var base = new Folder(BASE);
        if (!base.exists && !base.create()) fail("Could not create folder:\n" + BASE);
        var root = base.fsName.replace(/[\\\/]+$/, "");

        var rq = app.project.renderQueue;
        if (rq.numItems === 0) fail("The render queue is empty.");

        // ---- template ----------------------------------------------------
        var allTpl = [], i, j;
        try { allTpl = rq.item(1).outputModule(1).templates; } catch (e) { allTpl = []; }

        var tpl = null;
        for (i = 0; i < allTpl.length; i++) if (allTpl[i] === TPL) { tpl = allTpl[i]; break; }
        if (!tpl)                                        // the name may differ
            for (i = 0; i < allTpl.length; i++)
                if (/h\.?\s*264/i.test(allTpl[i]) && /(^|\D)15(\D|$)/.test(allTpl[i])) { tpl = allTpl[i]; break; }

        if (!tpl) {
            log("H.264 15 Mbps template not found. Available:");
            for (i = 0; i < allTpl.length; i++) log("  " + allTpl[i]);
            fail("Cannot change the codec without a template - H.264 bitrate is not scriptable.");
        }

        log(root);
        log("Template: " + tpl);
        log("");

        // ---- walk the queue ----------------------------------------------
        var done = [], locked = [], noName = [], created = [], errors = [];
        var it, om, m, key, dir, name;

        for (i = 1; i <= rq.numItems; i++) {
            it = rq.item(i);

            if (it.status === RQItemStatus.RENDERING || it.status === RQItemStatus.DONE) {
                locked.push("#" + i + " " + (it.comp ? it.comp.name : "?"));
                continue;
            }

            m = it.comp ? COMP_SEC.exec(it.comp.name) : null;
            if (!m) { noName.push("#" + i + " " + (it.comp ? it.comp.name : "?")); continue; }
            key = m[1];

            dir = new Folder(root + "\\" + key + "s");
            if (!dir.exists) {
                if (!dir.create()) { errors.push("could not create " + dir.fsName); continue; }
                created.push(key + "s");
            }

            for (j = 1; j <= it.numOutputModules; j++) {
                om = it.outputModule(j);
                name = it.comp.name + ".mp4";

                try {
                    om.applyTemplate(tpl);          // the template resets Output To,
                    om.file = new File(dir.fsName + "\\" + name);   // so the path comes after it
                    done.push(key + "s  <-  " + name);
                } catch (e) {
                    errors.push(it.comp.name + " - " + (e.message || e));
                }
            }
        }

        // ---- report ---------------------------------------------------------
        log("Outputs updated: " + done.length);
        for (i = 0; i < done.length; i++) log("  " + done[i]);
        if (created.length) log("\nFolders created: " + created.join(", "));
        if (locked.length)  log("\nDone / Rendering - left alone:\n  " + locked.join("\n  "));
        if (noName.length)  log("\nTiming not recognised in the name:\n  " + noName.join("\n  "));
        if (errors.length)  log("\nErrors:\n  " + errors.join("\n  "));
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
