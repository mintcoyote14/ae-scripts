// change_render_locations.jsx
// =====================================================================
//   Change Render Locations - with a proper window
// =====================================================================
//   Same idea as the stock AE script, but the path is typed or pasted
//   instead of picked in a folder dialog. File names stay as they are -
//   only the output folder changes.
//
//   The scope is either the whole queue or only the items that are ticked
//   in it. A highlighted row means nothing here - After Effects does not
//   expose the selection to scripts, only the tick.
//
//   AE does not allow editing items with status Done / Rendering,
//   so they are skipped and counted separately.
// =====================================================================

(function () {

    var SCRIPT_NAME = "Change Render Locations";
    var SETTINGS    = "ChangeRenderLocations";

    // ------------------------------------------------------------------
    //  Settings kept between runs
    // ------------------------------------------------------------------
    function getSetting(key, def) {
        if (!app.settings.haveSetting(SETTINGS, key)) return def;
        return app.settings.getSetting(SETTINGS, key);
    }

    function setSetting(key, val) {
        app.settings.saveSetting(SETTINGS, key, String(val));
    }

    // ------------------------------------------------------------------
    //  Path
    // ------------------------------------------------------------------
    // Strips quotes from "Copy as path", spaces and a trailing slash
    function cleanPath(s) {
        s = String(s).replace(/^\s+|\s+$/g, "");
        s = s.replace(/^["']|["']$/g, "");
        s = s.replace(/[\\\/]+$/, "");
        return s;
    }

    // If a file path was pasted - take its folder.
    // The folder is tested first on purpose: File("...\20260916").exists is
    // true for a directory as well, and .parent then lands a level too high.
    function asFolder(path) {
        var fo = new Folder(path);
        if (fo.exists) return fo;

        if (/\.[A-Za-z0-9]{2,5}$/.test(path)) {          // looks like a file
            var p = new File(path).parent;
            if (p) return p;
        }
        return fo;                                       // new folder, created on demand
    }

    function fileName(file) {
        return String(file.fsName).replace(/^.*[\\\/]/, "");
    }

    // ExtendScript cannot read the clipboard, so Windows is asked for it.
    // Returns "" when the clipboard holds no text.
    function clipboard() {
        var out = "";
        try {
            var ps  = new File(Folder.temp.fsName + "\\ae_clipboard.ps1");
            var res = new File(Folder.temp.fsName + "\\ae_clipboard.txt");
            if (res.exists) res.remove();

            var code = '$t = Get-Clipboard -Raw\r\n' +
                       'if ($null -eq $t) { $t = "" }\r\n' +
                       '[IO.File]::WriteAllText("' + res.fsName.replace(/\\/g, "\\\\") +
                       '", "<" + $t + ">", [Text.Encoding]::UTF8)\r\n';

            ps.encoding = "UTF-8";
            ps.open("w");
            ps.write("﻿" + code);        // 5.1 reads a BOM-less file as ANSI
            ps.close();

            system.callSystem('cmd.exe /c powershell -NoProfile -ExecutionPolicy Bypass ' +
                              '-WindowStyle Hidden -File "' + ps.fsName + '"');

            if (res.exists) {
                res.encoding = "UTF-8";
                res.open("r");
                var raw = res.read();
                res.close();
                res.remove();
                var m = /<([\s\S]*)>/.exec(raw);
                if (m) out = m[1];
            }
            ps.remove();
        } catch (e) {}

        return String(out).replace(/[\r\n]+/g, " ").replace(/^\s+|\s+$/g, "");
    }

    // ------------------------------------------------------------------
    //  Render queue
    // ------------------------------------------------------------------
    // Ticked in the queue. Highlighted rows are not scriptable, the tick is:
    // an item that is switched on carries Queued (or Needs Output when its
    // file is still unset, Will Continue after a stop), a switched off one
    // carries Unqueued.
    function isQueued(item) {
        var s = item.status;
        return s === RQItemStatus.QUEUED ||
               s === RQItemStatus.NEEDS_OUTPUT ||
               s === RQItemStatus.WILL_CONTINUE;
    }

    function isLocked(item) {
        return item.status === RQItemStatus.RENDERING ||
               item.status === RQItemStatus.DONE;
    }

    // Returns { list: [{item, om, comp}], locked: n, noFile: n }
    function collect(onlyQueued) {
        var rq = app.project.renderQueue;
        var res = { list: [], locked: 0, noFile: 0 };
        var i, j, it, om;

        for (i = 1; i <= rq.numItems; i++) {
            it = rq.item(i);
            if (onlyQueued && !isQueued(it)) continue;
            if (isLocked(it)) { res.locked++; continue; }

            for (j = 1; j <= it.numOutputModules; j++) {
                om = it.outputModule(j);
                if (!om.file) { res.noFile++; continue; }
                res.list.push({ item: it, om: om, comp: it.comp ? it.comp.name : "?" });
            }
        }
        return res;
    }

    // Folder of the first output in the queue - used as the initial field value
    function firstFolder() {
        var rq = app.project.renderQueue, i, om;
        for (i = 1; i <= rq.numItems; i++) {
            if (rq.item(i).numOutputModules < 1) continue;
            om = rq.item(i).outputModule(1);
            if (om.file && om.file.parent) return om.file.parent.fsName;
        }
        return "";
    }

    // ------------------------------------------------------------------
    //  Apply
    // ------------------------------------------------------------------
    function apply(folder, onlyQueued, makeFolder) {
        if (!folder.exists) {
            if (!makeFolder) { alert("No such folder:\n" + folder.fsName); return false; }
            if (!folder.create()) { alert("Could not create folder:\n" + folder.fsName); return false; }
        }

        var data = collect(onlyQueued);
        if (!data.list.length) {
            alert("Nothing to change." +
                  (data.locked ? "\n\nSkipped Done / Rendering: " + data.locked : "") +
                  (onlyQueued ? "\n\nNothing is ticked in the queue?" : ""));
            return false;
        }

        var base = folder.fsName.replace(/[\\\/]+$/, "");
        var done = 0, errors = [], i, t, target;

        app.beginUndoGroup(SCRIPT_NAME);
        try {
            for (i = 0; i < data.list.length; i++) {
                t = data.list[i];
                target = base + "\\" + fileName(t.om.file);
                try {
                    t.om.file = new File(target);
                    done++;
                } catch (e) {
                    errors.push(t.comp + " - " + (e.message || e));
                }
            }
        } finally {
            app.endUndoGroup();
        }

        var msg = "Outputs changed: " + done + "\n" + base;
        if (data.locked) msg += "\n\nSkipped Done / Rendering: " + data.locked;
        if (data.noFile) msg += "\nNo output file: " + data.noFile;
        if (errors.length) msg += "\n\nErrors:\n" + errors.join("\n");
        alert(msg);
        return true;
    }

    // ------------------------------------------------------------------
    //  Window
    // ------------------------------------------------------------------
    function ui() {
        if (app.project.renderQueue.numItems === 0) { alert("The render queue is empty."); return; }

        var w = new Window("dialog", SCRIPT_NAME);
        w.orientation = "column";
        w.alignChildren = ["fill", "top"];
        w.spacing = 8;
        w.margins = 12;

        w.add("statictext", undefined, "Output folder:");

        var pg = w.add("group");
        pg.alignChildren = ["fill", "center"];
        pg.spacing = 4;
        var pathFld = pg.add("edittext", undefined, getSetting("folder", firstFolder()));
        pathFld.characters = 58;
        pathFld.helpTip = "Paste a quoted path or a file path - the folder is taken from it";
        var pasteBtn = pg.add("button", undefined, "Paste");
        pasteBtn.preferredSize = [55, 22];
        pasteBtn.alignment = ["right", "center"];
        pasteBtn.helpTip = "Replace the field with the path copied in Explorer";

        var browse = pg.add("button", undefined, "...");
        browse.preferredSize = [30, 22];
        browse.alignment = ["right", "center"];

        var scope = w.add("panel", undefined, "Apply to");
        scope.orientation = "column";
        scope.alignChildren = ["left", "top"];
        scope.margins = [10, 12, 10, 10];
        scope.spacing = 4;
        var rAll = scope.add("radiobutton", undefined, "the whole queue");
        var rSel = scope.add("radiobutton", undefined, "ticked items only");
        rSel.helpTip = "The tick in the queue, not the highlighted row";
        if (getSetting("onlyQueued", "true") === "true") rSel.value = true; else rAll.value = true;

        var mk = w.add("checkbox", undefined, "Create the folder if missing");
        mk.value = getSetting("makeFolder", "true") === "true";

        var info = w.add("statictext", undefined, "");
        info.alignment = ["fill", "top"];

        var bg = w.add("group");
        bg.alignment = ["fill", "bottom"];
        bg.alignChildren = ["fill", "center"];
        var ok = bg.add("button", undefined, "Change", { name: "ok" });
        var cancel = bg.add("button", undefined, "Cancel", { name: "cancel" });
        ok.preferredSize.height = 24;
        cancel.preferredSize.height = 24;

        function refresh() {
            var d = collect(rSel.value);
            info.text = "To change: " + d.list.length + " outputs" +
                        (d.locked ? "   -   Done / Rendering: " + d.locked : "");
        }

        pasteBtn.onClick = function () {
            var c = cleanPath(clipboard());
            if (!c) { alert("The clipboard holds no text."); return; }
            pathFld.text = c;                       // replaces whatever was there
            refresh();
        };

        browse.onClick = function () {
            var start = cleanPath(pathFld.text);
            var f = Folder.selectDialog("Output folder", start ? new Folder(start) : undefined);
            if (f) pathFld.text = f.fsName;
        };

        rAll.onClick = rSel.onClick = refresh;
        refresh();

        ok.onClick = function () {
            var raw = cleanPath(pathFld.text);
            if (!raw) { alert("Enter a folder."); return; }
            var folder = asFolder(raw);

            setSetting("folder", folder.fsName);
            setSetting("onlyQueued", rSel.value);
            setSetting("makeFolder", mk.value);

            w.close();
            apply(folder, rSel.value, mk.value);
        };

        w.center();
        w.show();
    }

    ui();

})();
