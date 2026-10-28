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

            // Add the freeze key first: removing every key would switch Time Remap off
            // and hide the property, which makes setValueAtTime fail.
            remap.setValueAtTime(t, frozenTime);
            var keep = remap.nearestKeyIndex(t);
            for (var k = remap.numKeys; k >= 1; k--) {
                if (k !== keep) {
                    remap.removeKey(k);
                }
            }
            remap.setInterpolationTypeAtKey(1, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
        }
    } finally {
        app.endUndoGroup();
    }

    if (skipped.length > 0) {
        alert("Skipped (no Time Remap available):\n" + skipped.join("\n"));
    }
})();