// FF: freezes every selected layer on the frame under the current-time indicator
// (Time Remap with a single hold keyframe), like Layer > Time > Freeze Frame.
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

    var t = comp.time;
    var skipped = [];

    app.beginUndoGroup("FF: freeze frame");
    try {
        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            if (!(layer instanceof AVLayer) || !layer.canSetTimeRemapEnabled) {
                skipped.push(layer.name);
                continue;
            }

            layer.timeRemapEnabled = true;
            var remap = layer.property("ADBE Time Remapping");
            var frozenTime = remap.valueAtTime(t, false);

            while (remap.numKeys > 0) {
                remap.removeKey(1);
            }
            remap.setValueAtTime(t, frozenTime);
            remap.setInterpolationTypeAtKey(1, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
        }
    } finally {
        app.endUndoGroup();
    }

    if (skipped.length > 0) {
        alert("Skipped (no Time Remap available):\n" + skipped.join("\n"));
    }
})();