(function () {
    app.beginUndoGroup("Relink missing X: -> Y:");

    var proj = app.project;
    if (!proj) { app.endUndoGroup(); return; }

    function swapDriveToY(pathStr) {
        if (!pathStr || pathStr.length < 3) return null;

        var drive = pathStr.substring(0, 2).toUpperCase(); // "X:"
        if (drive !== "X:") return null;

        var rest = pathStr.substring(2); // keeps leading \ or / if present
        if (rest.length === 0) rest = "\\";
        if (rest.charAt(0) !== "\\" && rest.charAt(0) !== "/") rest = "\\" + rest;

        return "Y:" + rest;
    }

    for (var i = 1; i <= proj.numItems; i++) {
        var it = proj.item(i);
        if (!(it instanceof FootageItem)) continue;

        try {
            var ms = it.mainSource;
            if (!ms || ms instanceof SolidSource) continue;

            var f = ms.file;
            if (!f) continue;

            if (f.exists) continue; // only missing

            var oldPath = f.fsName || f.fullName || ("" + f);
            var newPath = swapDriveToY(oldPath);
            if (!newPath) continue;

            var nf = new File(newPath);
            if (nf.exists) it.replace(nf);
        } catch (e) {}
    }

    app.endUndoGroup();
})();
