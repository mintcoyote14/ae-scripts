(function () {
    app.beginUndoGroup("Relink missing: multiple roots -> production (NO SEQUENCE)");

    var proj = app.project;
    if (!proj) { app.endUndoGroup(); return; }

    function norm(p) { return (p || "").replace(/\//g, "\\"); }
    function trimEndSlash(p) {
        p = norm(p);
        while (p.length && p.charAt(p.length - 1) === "\\") p = p.substring(0, p.length - 1);
        return p;
    }
    function startsWithPathI(p, root) {
        var a = (p || "").toLowerCase();
        var b = (root || "").toLowerCase();
        if (a.indexOf(b) !== 0) return false;
        return (a.length === b.length) || (a.charAt(b.length) === "\\");
    }
    function getExt(p) {
        p = "" + (p || "");
        var m = p.match(/\.([^.\\\/]+)$/);
        return m ? m[1].toLowerCase() : "";
    }
    function isImageExt(ext) {
        return (
            ext === "png" || ext === "jpg" || ext === "jpeg" ||
            ext === "tif" || ext === "tiff" || ext === "psd" ||
            ext === "exr" || ext === "bmp" || ext === "gif"
        );
    }

    var mappings = [
        {
            oldRoots: ["X:\\BiedronkaNCP2025_230336", "Y:\\BiedronkaNCP2025_230336"],
            newRoot:  "X:\\BiedronkaPricesOnGoing2026_231510\\production\\BiedronkaNCP2025_230336"
        },
        {
            oldRoots: ["X:\\BiedronkaNewWeekendPlatform2024_229962", "Y:\\BiedronkaNewWeekendPlatform2024_229962"],
            newRoot:  "X:\\BiedronkaWeekend2026_231673\\production\\BiedronkaNewWeekendPlatform2024_229962"
        }
    ];

    function mapPath(p) {
        var pN = norm(p);
        for (var m = 0; m < mappings.length; m++) {
            var newRoot = trimEndSlash(mappings[m].newRoot);
            for (var r = 0; r < mappings[m].oldRoots.length; r++) {
                var oldRoot = trimEndSlash(mappings[m].oldRoots[r]);
                if (startsWithPathI(pN, oldRoot)) {
                    return newRoot + pN.substring(oldRoot.length);
                }
            }
        }
        return null;
    }

    for (var i = 1; i <= proj.numItems; i++) {
        var it = proj.item(i);
        if (!(it instanceof FootageItem)) continue;

        try {
            var ms = it.mainSource;
            if (!ms || ms instanceof SolidSource) continue;

            var f = ms.file;
            if (!f) continue;

            // ONLY the missing ones
            if (f.exists) continue;

            var oldPath = f.fsName || f.fullName || ("" + f);
            var newPath = mapPath(oldPath);
            if (!newPath) continue;

            var nf = new File(newPath);
            if (!nf.exists) continue;

            var ext = getExt(newPath);
            var forceStill = isImageExt(ext);

            it.replace(nf);

            // Do not import as a sequence: force still for image types
            if (forceStill) {
                try {
                    if (it.mainSource && ("isStill" in it.mainSource)) it.mainSource.isStill = true;
                } catch (e2) {}
            }
        } catch (e) {}
    }

    app.endUndoGroup();
})();
