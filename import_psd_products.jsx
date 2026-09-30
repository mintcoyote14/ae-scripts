// import_psd_products.jsx
// =====================================================================
//   Import PSD products: comps -> PRODUCTS, layer folders -> Source
// =====================================================================
//   Point it at the folder the client sent, tick the PSD files, Import.
//   Every file comes in as Composition - Retain Layer Sizes, and the two
//   things AE creates out of it are put where they belong:
//
//     420148a              -> PRODUCTS
//     420148a Layers       -> Source
//
//   Files whose comp is already in the project are marked and left
//   unticked, so the window can be re-run when more products arrive.
// =====================================================================

(function () {

    var SCRIPT_NAME  = "Import PSD products";
    var COMP_FOLDER  = "PRODUCTS";      // where the comps go
    var LAYER_FOLDER = "Source";        // where the "... Layers" folders go
    var SETTINGS     = "ImportPsdProducts";

    // ------------------------------------------------------------------
    //  Settings
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
    function cleanPath(s) {
        s = String(s).replace(/^\s+|\s+$/g, "");
        s = s.replace(/^["']|["']$/g, "");
        return s.replace(/[\\\/]+$/, "");
    }

    // ExtendScript cannot read the clipboard, so Windows is asked for it
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
            ps.write("﻿" + code);
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

    function psdsIn(folder) {
        if (!folder.exists) return [];
        var fs = folder.getFiles(function (f) {
            return (f instanceof File) && /\.psd$/i.test(f.name);
        });
        fs.sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
        return fs;
    }

    function baseName(file) {
        return String(file.name).replace(/\.[^.]+$/, "");
    }

    // ------------------------------------------------------------------
    //  Project
    // ------------------------------------------------------------------
    function findFolderItem(name) {
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if ((it instanceof FolderItem) && it.name === name) return it;
        }
        return null;
    }

    function folderItem(name) {
        return findFolderItem(name) || app.project.items.addFolder(name);
    }

    function compNamed(name) {
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if ((it instanceof CompItem) && it.name === name) return it;
        }
        return null;
    }

    function idSnapshot() {
        var map = {}, i;
        for (i = 1; i <= app.project.numItems; i++) map[app.project.item(i).id] = true;
        return map;
    }

    // Import one PSD and sort out what appeared at the root of the project
    function importPsd(file, comps, layers, report) {
        var before = idSnapshot();

        var io = new ImportOptions(file);
        io.importAs = io.canImportAs(ImportAsType.COMP_CROPPED_LAYERS)
                    ? ImportAsType.COMP_CROPPED_LAYERS      // Composition - Retain Layer Sizes
                    : ImportAsType.COMP;
        app.project.importFile(io);

        var root = app.project.rootFolder, fresh = [], i, it, par;
        for (i = 1; i <= app.project.numItems; i++) {
            it = app.project.item(i);
            if (before[it.id]) continue;
            par = it.parentFolder;
            if (!(par === root || par.name === root.name)) continue;   // keep the Layers folder packed
            fresh.push(it);
        }

        var moved = { comp: null, layers: null };
        for (i = 0; i < fresh.length; i++) {
            if (fresh[i] instanceof CompItem) {
                fresh[i].parentFolder = comps;
                moved.comp = fresh[i].name;
            } else {
                fresh[i].parentFolder = layers;
                moved.layers = fresh[i].name;
            }
        }

        report.push("  " + (moved.comp || "?") + "   ->   " + COMP_FOLDER +
                    (moved.layers ? "\n  " + moved.layers + "   ->   " + LAYER_FOLDER : ""));
    }

    // ------------------------------------------------------------------
    //  Run
    // ------------------------------------------------------------------
    function run(files) {
        var comps  = folderItem(COMP_FOLDER);
        var layers = folderItem(LAYER_FOLDER);
        var report = [], failed = [], i;

        app.beginUndoGroup(SCRIPT_NAME);
        try {
            for (i = 0; i < files.length; i++) {
                try {
                    importPsd(files[i], comps, layers, report);
                } catch (e) {
                    failed.push(files[i].name + " - " + (e.message || e));
                }
            }
        } finally {
            app.endUndoGroup();
        }

        var msg = "Imported: " + (report.length) + "\n" + report.join("\n");
        if (failed.length) msg += "\n\nFailed:\n" + failed.join("\n");
        alert(SCRIPT_NAME + "\n\n" + msg);
    }

    // ------------------------------------------------------------------
    //  Window
    // ------------------------------------------------------------------
    function ui() {
        var w = new Window("dialog", SCRIPT_NAME);
        w.orientation = "column";
        w.alignChildren = ["fill", "top"];
        w.spacing = 8;
        w.margins = 12;

        w.add("statictext", undefined, "Folder with the PSD files:");

        var pg = w.add("group");
        pg.alignChildren = ["fill", "center"];
        pg.spacing = 4;
        var fPath = pg.add("edittext", undefined, getSetting("folder", ""));
        fPath.characters = 52;
        var bPaste = pg.add("button", undefined, "Paste");
        var bBrowse = pg.add("button", undefined, "...");
        bPaste.preferredSize = [55, 22];
        bBrowse.preferredSize = [30, 22];
        bPaste.helpTip = "Replace the field with the path copied in Explorer";

        var note = w.add("statictext", undefined, "", { truncate: "middle" });
        var info = w.add("statictext", undefined,
            "Every PSD in the folder comes in as Composition - Retain Layer Sizes.\n" +
            "Comps go to " + COMP_FOLDER + ", the \"... Layers\" folders go to " + LAYER_FOLDER + ".\n" +
            "Files already in the project are left alone.", { multiline: true });
        info.preferredSize.height = 46;

        var bg = w.add("group");
        bg.alignment = ["fill", "bottom"];
        bg.alignChildren = ["fill", "center"];
        var ok = bg.add("button", undefined, "Import", { name: "ok" });
        bg.add("button", undefined, "Cancel", { name: "cancel" });
        ok.preferredSize.height = 24;

        // What the folder holds right now - shown before anything is imported
        function count() {
            var folder = new Folder(cleanPath(fPath.text));
            if (!folder.exists) { note.text = "No such folder."; return null; }

            var files = psdsIn(folder), fresh = [], old = 0, i;
            for (i = 0; i < files.length; i++) {
                if (compNamed(baseName(files[i]))) old++;
                else fresh.push(files[i]);
            }

            note.text = files.length
                ? (files.length + " PSD in the folder,  " + fresh.length + " to import" +
                   (old ? ",  " + old + " already in the project" : ""))
                : "No PSD files in this folder.";
            return fresh;
        }

        fPath.onChange = count;

        bPaste.onClick = function () {
            var c = cleanPath(clipboard());
            if (!c) { note.text = "The clipboard holds no text."; return; }
            fPath.text = c;
            count();
        };

        bBrowse.onClick = function () {
            var start = cleanPath(fPath.text);
            var f = Folder.selectDialog("Folder with the PSD files",
                                        start ? new Folder(start) : undefined);
            if (f) { fPath.text = f.fsName; count(); }
        };

        ok.onClick = function () {
            var folder = new Folder(cleanPath(fPath.text));
            if (!folder.exists) { note.text = "No such folder: " + fPath.text; return; }

            var fresh = count();
            if (!fresh || !fresh.length) { note.text = "Nothing new to import here."; return; }

            setSetting("folder", folder.fsName);
            w.close();
            run(fresh);
        };

        count();
        w.center();
        w.show();
    }


    if (!app.project) { alert(SCRIPT_NAME + "\n\nOpen a project first."); return; }
    ui();

})();
