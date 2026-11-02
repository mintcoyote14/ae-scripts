// MD: duplicates each selected layer and parents the original to its duplicate.
// The duplicate gets "Preserve Underlying Transparency" turned on.
(function () {
    var comp = app.project.activeItem;
    if (!(comp && comp instanceof CompItem)) {
        alert("Open a composition to run this script.");
        return;
    }

    var layers = comp.selectedLayers;
    if (layers.length === 0) {
        alert("Select at least one layer to process.");
        return;
    }

    app.beginUndoGroup("MD: duplicate and parent");
    try {
        for (var i = 0; i < layers.length; i++) {
            var current = layers[i];
            var dup = current.duplicate();
            current.parent = dup;
            dup.preserveTransparency = true;
        }
    } finally {
        app.endUndoGroup();
    }
})();