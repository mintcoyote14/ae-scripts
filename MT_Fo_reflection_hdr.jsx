// Fo: adds reflection_hdr.jpg (FOLIE) on top of the active composition,
// sets its blending mode to Soft Light and Opacity to 24%.
(function () {
    var FILE_PATH = "X:/BiedronkaPricesOnGoing2026_231510/vfx/assets/DODATKI_DO_PROJEKTU/FOLIE/reflection_hdr.jpg";

    var comp = app.project.activeItem;
    if (!(comp && comp instanceof CompItem)) {
        alert("Open a composition to run this script.");
        return;
    }

    var file = new File(FILE_PATH);
    if (!file.exists) {
        alert("File not found:\n" + FILE_PATH);
        return;
    }

    app.beginUndoGroup("Fo: reflection_hdr soft light 24%");
    try {
        // Reuse the footage item if this file is already in the project.
        var footage = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof FootageItem && item.mainSource instanceof FileSource &&
                item.mainSource.file && item.mainSource.file.fsName === file.fsName) {
                footage = item;
                break;
            }
        }
        if (footage === null) {
            footage = app.project.importFile(new ImportOptions(file));
        }

        var layer = comp.layers.add(footage);
        layer.blendingMode = BlendingMode.SOFT_LIGHT;
        layer.property("ADBE Transform Group").property("ADBE Opacity").setValue(24);
    } finally {
        app.endUndoGroup();
    }
})();