// import_shot_folders.jsx
// =====================================================================
//   Import shot folders: footage -> project folder -> comp -> _shots
// =====================================================================
//   Point it at a folder like  ...\vfx\making_of  and for every shot
//   subfolder inside it the script does the same four things:
//
//     1. a project folder named after the shot (syp0040);
//     2. every video file of that shot imported into it;
//     3. a comp named after the shot, sized and timed from the footage;
//     4. that comp placed in the _shots folder.
//
//   Layer order in the comp follows the compositing logic:
//   SOURCE at the bottom, then L01, L02, L03..., anything else above
//   them, OUT on top.
//
//   Folders without video files (montaz, music) are ignored. A shot
//   whose comp already exists is skipped, so the script can be re-run
//   after new shots are delivered without duplicating anything.
// =====================================================================

(function () {

    var SCRIPT_NAME = "Import shot folders";
    var SHOTS_FOLDER = "_shots";
    var VIDEO_EXT = /\.(mov|mp4|mxf|avi|mkv|mpg|m4v|r3d|braw)$/i;
    var SETTINGS = "ImportShotFolders";

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
    //  Disk
    // ------------------------------------------------------------------
    function baseName(file) {
        return String(file.fsName).replace(/^.*[\\\/]/, "").replace(/\.[^.]+$/, "");
    }

    function videosIn(folder) {
        var fs = folder.getFiles(function (f) {
            return (f instanceof File) && VIDEO_EXT.test(f.name);
        });
        fs.sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
        return fs;
    }

    function subFolders(folder) {
        var fs = folder.getFiles(function (f) { return f instanceof Folder; });
        fs.sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
        return fs;
    }

    // The part after the shot name: syp0040_L01 -> L01, syp0040_SOURCE -> SOURCE
    function suffixOf(name, shot) {
        var s = name;
        if (s.indexOf(shot) === 0) s = s.substring(shot.length);
        return s.replace(/^[_\-\s]+/, "").replace(/[_\-\s]+$/, "");
    }

    // SOURCE at the bottom, then L01..Lnn, then the rest, OUT on top
    function rankOf(suffix) {
        var s = suffix.toUpperCase();
        if (s.indexOf("SOURCE") !== -1) return 0;
        if (s.indexOf("OUT") !== -1) return 9000;
        var m = /^L\s*(\d+)/.exec(s);
        if (m) return 100 + parseInt(m[1], 10);
        return 5000;
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

    function findComp(name) {
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if ((it instanceof CompItem) && it.name === name) return it;
        }
        return null;
    }

    // Already in the project? Match on the file path, not the name
    function findFootage(file) {
        var i, it, s;
        for (i = 1; i <= app.project.numItems; i++) {
            it = app.project.item(i);
            if (!(it instanceof FootageItem)) continue;
            try {
                s = it.mainSource;
                if ((s instanceof FileSource) && s.file && s.file.fsName === file.fsName) return it;
            } catch (e) {}
        }
        return null;
    }

    function importInto(file, parent) {
        var it = findFootage(file);
        if (!it) {
            var io = new ImportOptions(file);
            io.importAs = ImportAsType.FOOTAGE;
            it = app.project.importFile(io);
        }
        it.parentFolder = parent;
        return it;
    }

    // ------------------------------------------------------------------
    //  One shot
    // ------------------------------------------------------------------
    function doShot(dir, o, report) {
        var files = videosIn(dir);
        if (!files.length) return;                       // montaz, music and the like

        var shot = String(dir.fsName).replace(/^.*[\\\/]/, "");

        if (findComp(shot)) { report.skipped.push(shot + " - comp already exists"); return; }

        var fold = folderItem(shot);
        var items = [], i, it;

        for (i = 0; i < files.length; i++) {
            try {
                it = importInto(files[i], fold);
                items.push({ item: it, rank: rankOf(suffixOf(baseName(files[i]), shot)),
                             name: baseName(files[i]) });
            } catch (e) {
                report.failed.push(files[i].name + " - " + (e.message || e));
            }
        }
        if (!items.length) { report.failed.push(shot + " - nothing imported"); return; }

        items.sort(function (a, b) {
            if (a.rank !== b.rank) return a.rank - b.rank;
            return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
        });

        // Comp settings come from the footage: widest frame, longest duration
        var w = 0, h = 0, dur = 0, fps = 0, par = 1;
        for (i = 0; i < items.length; i++) {
            it = items[i].item;
            if (it.width > w) { w = it.width; h = it.height; par = it.pixelAspect; }
            if (it.duration > dur) dur = it.duration;
            if (it.frameRate > fps) fps = it.frameRate;
        }
        if (!w) { report.failed.push(shot + " - no frame size in the footage"); return; }
        if (!fps) fps = 25;
        if (!dur) dur = 5;

        var comp = app.project.items.addComp(shot, w, h, par, dur, fps);
        comp.parentFolder = folderItem(SHOTS_FOLDER);

        if (o.addLayers)
            for (i = 0; i < items.length; i++) {          // bottom first, each new one lands on top
                var L = comp.layers.add(items[i].item);
                L.startTime = 0;
            }

        report.done.push(shot + "   " + w + "x" + h + "   " + dur.toFixed(2) + "s   " +
                         items.length + " files");
    }

    // ------------------------------------------------------------------
    //  Run
    // ------------------------------------------------------------------
    function run(root, o) {
        var report = { done: [], skipped: [], failed: [] };
        var dirs = subFolders(root), i;

        app.beginUndoGroup(SCRIPT_NAME);
        try {
            if (videosIn(root).length) doShot(root, o, report);   // pointed straight at one shot
            for (i = 0; i < dirs.length; i++) doShot(dirs[i], o, report);
        } finally {
            app.endUndoGroup();
        }

        var msg = root.fsName + "\n\n";
        msg += "Shots built: " + report.done.length + "\n" + report.done.join("\n");
        if (report.skipped.length) msg += "\n\nSkipped:\n" + report.skipped.join("\n");
        if (report.failed.length)  msg += "\n\nFailed:\n" + report.failed.join("\n");
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

        w.add("statictext", undefined, "Folder holding the shot subfolders:");

        var pg = w.add("group");
        pg.alignChildren = ["fill", "center"];
        var pathFld = pg.add("edittext", undefined, getSetting("root", ""));
        pathFld.characters = 52;
        var browse = pg.add("button", undefined, "...");
        browse.preferredSize = [30, 22];
        browse.alignment = ["right", "center"];

        var cbLayers = w.add("checkbox", undefined, "Put the files into the comp as layers");
        cbLayers.value = getSetting("addLayers", "true") === "true";
        cbLayers.helpTip = "SOURCE at the bottom, L01, L02..., OUT on top";

        w.add("statictext", undefined, "Shots whose comp already exists are skipped.");

        var bg = w.add("group");
        bg.alignment = ["fill", "bottom"];
        bg.alignChildren = ["fill", "center"];
        var ok = bg.add("button", undefined, "Import", { name: "ok" });
        bg.add("button", undefined, "Cancel", { name: "cancel" });
        ok.preferredSize.height = 24;

        browse.onClick = function () {
            var start = String(pathFld.text).replace(/^\s+|\s+$/g, "");
            var f = Folder.selectDialog("Folder with the shot subfolders",
                                        start ? new Folder(start) : undefined);
            if (f) pathFld.text = f.fsName;
        };

        ok.onClick = function () {
            var raw = String(pathFld.text).replace(/^\s+|\s+$/g, "").replace(/^["']|["']$/g, "");
            var root = new Folder(raw);
            if (!raw || !root.exists) { alert("No such folder:\n" + raw); return; }

            setSetting("root", root.fsName);
            setSetting("addLayers", cbLayers.value);

            w.close();
            run(root, { addLayers: cbLayers.value });
        };

        w.center();
        w.show();
    }

    ui();

})();
