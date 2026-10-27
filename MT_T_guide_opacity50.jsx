// T: turns each selected layer into a guide layer and sets its Opacity to 50%.
(function () {
    var comp = app.project.activeItem;
    if (!(comp && comp instanceof CompItem)) {
        alert("Open a composition to run this script.");
        return;
    }

    var layers = comp.selectedLayers;
    if (layers.length === 0) {
        alert("Select at least one layer.");
        return;
    }

    app.beginUndoGroup("T: guide layer + opacity 50%");
    try {
        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            layer.guideLayer = true;

            var opacity = layer.property("ADBE Transform Group").property("ADBE Opacity");
            if (opacity.numKeys > 0) {
                opacity.setValueAtTime(comp.time, 50);
            } else {
                opacity.setValue(50);
            }
        }
    } finally {
        app.endUndoGroup();
    }
})();