/**
 * Keyframe Colors - loader
 *
 * This file only has to live in ScriptUI Panels so the panel shows up in
 * the Window menu and can be docked. The panel itself lives here:
 *   D:/_SCRIPTS_/_system/keyframe_colors.jsx
 * Edit that one - the loader picks the changes up the next time the panel
 * is opened.
 */

(function keyframeColorsLoader(thisObj) {
    var SOURCE_PATHS = [
        "D:/_SCRIPTS_/_system/keyframe_colors.jsx",
        "D:/_SCRIPTS_/keyframe_colors.jsx"
    ];

    function findSource() {
        for (var i = 0; i < SOURCE_PATHS.length; i++) {
            var f = new File(SOURCE_PATHS[i]);
            if (f.exists) return f;
        }
        return null;
    }

    function showError(msg) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "Keyframe Colors", undefined, { resizeable: true });
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.margins = 12;
        win.spacing = 8;
        var t = win.add("statictext", undefined, msg, { multiline: true });
        t.preferredSize = [320, 80];
        if (win instanceof Window) {
            win.center();
            win.show();
        } else {
            win.layout.layout(true);
        }
    }

    var src = findSource();
    if (!src) {
        showError("keyframe_colors.jsx not found.\n\nExpected at:\n" +
                  SOURCE_PATHS.join("\n") +
                  "\n\nPut the file there or fix SOURCE_PATHS in this loader.");
        return;
    }

    var code;
    try {
        src.encoding = "UTF-8";
        src.open("r");
        code = src.read();
    } catch (e) {
        showError("Could not read:\n" + src.fsName + "\n\n" + e.toString());
        return;
    } finally {
        try { src.close(); } catch (e2) {}
    }

    if (code.length && code.charCodeAt(0) === 0xFEFF) code = code.substring(1);

    try {
        // Run the source with its `this` set to thisObj, so the usual
        // (function (thisObj) { ... })(this) pattern receives our panel
        var fn = new Function("thisObj", code);
        fn.call(thisObj, thisObj);
    } catch (e) {
        showError("Error running keyframe_colors.jsx:\n\n" +
                  e.toString() + (e.line ? ("\nline " + e.line) : ""));
    }
})(this);
