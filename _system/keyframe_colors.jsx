// keyframe_colors.jsx
// =====================================================================
//   Keyframe colours - a dockable panel
// =====================================================================
//   Click a swatch and every selected keyframe takes that label colour,
//   the same colours that live under right-click > Label. Four of them,
//   one row, and they follow the width of the panel.
//
//   The four buttons in the bottom row pick the keyframes for you, across
//   all selected layers at once:
//
//     F      - the first keyframe of every animated property
//     A      - every keyframe
//     L      - the last keyframe of every animated property
//     None   - strips the colour off whatever is selected
//
//   Scope: the highlighted properties if any are highlighted, otherwise
//   every animated property of the selected layers.
//
//   Keyframe labels came with After Effects 17.0 - on anything older the
//   swatches stay disabled.
// =====================================================================

(function (thisObj) {

    var SCRIPT_NAME = "Keyframe colours";

    // Twelve that stay apart from each other, six to a row. The index is
    // the AE label, so the colour here is the one AE names in its own menu.
    var COLOURS = [
        { label: 1,  name: "Red",    rgb: [0.63, 0.20, 0.20] },
        { label: 2,  name: "Yellow", rgb: [0.85, 0.78, 0.42] },
        { label: 9,  name: "Green",  rgb: [0.38, 0.60, 0.33] },
        { label: 8,  name: "Blue",   rgb: [0.29, 0.36, 0.73] }
    ];

    // Spares, if one of the four ever needs swapping. The label is what AE
    // itself calls the colour, so its own menu stays in step:
    //   11 Orange   [0.91, 0.62, 0.22]      7 Sea Foam  [0.56, 0.78, 0.69]
    //   14 Cyan     [0.23, 0.66, 0.71]      5 Lavender  [0.69, 0.69, 0.86]
    //   10 Purple   [0.48, 0.33, 0.66]     13 Fuchsia   [0.71, 0.26, 0.56]
    //    4 Pink     [0.93, 0.72, 0.75]     12 Brown     [0.47, 0.31, 0.20]

    var SWATCH = 26;      // swatch size
    var COLS   = 4;       // one row of colours, then the row of buttons
    var GAP    = 3;

    // ------------------------------------------------------------------
    //  Comp and properties
    // ------------------------------------------------------------------
    function activeComp() {
        var c = app.project.activeItem;
        return (c && c instanceof CompItem) ? c : null;
    }

    function keyable(p) {
        try {
            return p.propertyType === PropertyType.PROPERTY && p.canVaryOverTime;
        } catch (e) { return false; }
    }

    // Collects the keyable properties under anything - a layer, a group
    // or a single property
    function gather(node, out) {
        if (keyable(node)) { out.push(node); return; }
        var n = 0;
        try { n = node.numProperties; } catch (e) { return; }
        for (var i = 1; i <= n; i++) {
            try { gather(node.property(i), out); } catch (e) {}
        }
    }

    // What the buttons work on: highlighted properties win, otherwise
    // everything animatable on the selected layers
    function scope(comp) {
        var out = [], i, sel;

        sel = comp.selectedProperties;
        if (sel && sel.length) {
            for (i = 0; i < sel.length; i++) gather(sel[i], out);
            if (out.length) return out;
        }

        sel = comp.selectedLayers;
        for (i = 0; i < sel.length; i++) gather(sel[i], out);
        return out;
    }

    // Keyframe selection is cleared comp-wide so the result is exactly
    // what the button says, not a leftover from somewhere else
    function clearKeys(comp) {
        var all = [], i, j;
        for (i = 1; i <= comp.numLayers; i++) gather(comp.layer(i), all);
        for (i = 0; i < all.length; i++)
            for (j = 1; j <= all[i].numKeys; j++) {
                try { if (all[i].keySelected(j)) all[i].setSelectedAtKey(j, false); } catch (e) {}
            }
    }

    // ------------------------------------------------------------------
    //  Actions
    // ------------------------------------------------------------------
    function select(which) {
        var comp = activeComp();
        if (!comp) { say("Open a composition."); return; }

        var props = scope(comp);
        if (!props.length) { say("Select a layer first."); return; }

        var n = 0, i, k;
        app.beginUndoGroup(SCRIPT_NAME + " - select");
        try {
            clearKeys(comp);
            for (i = 0; i < props.length; i++) {
                if (props[i].numKeys === 0) continue;
                if (which === "all") {
                    for (k = 1; k <= props[i].numKeys; k++) { props[i].setSelectedAtKey(k, true); n++; }
                } else {
                    k = (which === "first") ? 1 : props[i].numKeys;
                    props[i].setSelectedAtKey(k, true);
                    n++;
                }
            }
        } finally {
            app.endUndoGroup();
        }

        say(n + " keyframe" + (n === 1 ? "" : "s") + " selected on " +
            comp.selectedLayers.length + " layer(s)");
    }

    function paint(colour) {
        var comp = activeComp();
        if (!comp) { say("Open a composition."); return; }

        var all = [], n = 0, i, k;
        for (i = 1; i <= comp.numLayers; i++) gather(comp.layer(i), all);

        app.beginUndoGroup(SCRIPT_NAME + " - " + colour.name);
        try {
            for (i = 0; i < all.length; i++)
                for (k = 1; k <= all[i].numKeys; k++) {
                    try {
                        if (all[i].keySelected(k)) { all[i].setLabelAtKey(k, colour.label); n++; }
                    } catch (e) {}
                }
        } finally {
            app.endUndoGroup();
        }

        say(n ? (n + " keyframe" + (n === 1 ? "" : "s") + " -> " + colour.name)
              : "No keyframes are selected.");
    }

    // ------------------------------------------------------------------
    //  Window
    // ------------------------------------------------------------------
    var status = null;

    function say(msg) {
        if (status) status.text = msg;
    }

    function swatch(parent, colour) {
        var g = parent.add("group");
        g.preferredSize = [SWATCH, SWATCH];
        g.minimumSize = [16, SWATCH];
        g.maximumSize = [4000, SWATCH];      // grows sideways, keeps its height
        g.alignment = ["fill", "top"];
        g.helpTip = colour.name;

        // The colour is a background brush, not an onDraw handler.
        //
        // onDraw is a script callback: every repaint of the panel runs it,
        // and a repaint that happens while a modal dialog is open - during
        // a render, say - makes After Effects log "Cannot run a script
        // while a modal dialog is waiting for response", once per swatch.
        // A background brush is painted by ScriptUI itself, so a repaint
        // costs nothing and logs nothing.
        var c = colour.rgb;
        try {
            g.graphics.backgroundColor =
                g.graphics.newBrush(g.graphics.BrushType.SOLID_COLOR, [c[0], c[1], c[2], 1]);
        } catch (e) {}

        g.addEventListener("mousedown", function () { paint(colour); });
        return g;
    }

    function build(thisObj) {
        var w = (thisObj instanceof Panel)
              ? thisObj
              : new Window("palette", SCRIPT_NAME, undefined, { resizeable: true });

        w.orientation = "column";
        w.alignChildren = ["fill", "top"];
        w.spacing = 4;
        w.margins = 5;

        // A row of colours, then the row of four buttons
        var grid = w.add("group");
        grid.orientation = "column";
        grid.alignment = ["fill", "top"];
        grid.alignChildren = ["fill", "top"];
        grid.spacing = GAP;
        grid.margins = 0;

        // Every row fills the panel and its cells share that width, so the
        // whole grid follows however wide the panel is docked
        function gridRow() {
            var r = grid.add("group");
            r.alignment = ["fill", "top"];
            r.alignChildren = ["fill", "top"];
            r.spacing = GAP;
            r.margins = 0;
            return r;
        }

        var swatches = [], row = null, i;
        for (i = 0; i < COLOURS.length; i++) {
            if (i % COLS === 0) row = gridRow();
            swatches.push(swatch(row, COLOURS[i]));
        }

        // Third row: F first, A all, L last, None strips the colour off
        var bRow = gridRow();

        function gridButton(label, tip, fn) {
            var b = bRow.add("button", undefined, label);
            b.preferredSize = [SWATCH, SWATCH];
            b.minimumSize = [18, SWATCH];
            b.maximumSize = [4000, SWATCH];
            b.alignment = ["fill", "top"];
            b.helpTip = tip;
            b.onClick = fn;
            return b;
        }

        gridButton("F", "First keyframe of every animated property, on every selected layer",
                   function () { select("first"); });
        gridButton("A", "Every keyframe on every selected layer",
                   function () { select("all"); });
        gridButton("L", "Last keyframe of every animated property, on every selected layer",
                   function () { select("last"); });
        var none = gridButton("None", "Strip the colour off the selected keyframes",
                   function () { paint({ label: 0, name: "None" }); });

        status = w.add("statictext", undefined, "", { truncate: "middle" });
        status.alignment = ["fill", "bottom"];

        // Keyframe labels are a 17.0 feature
        if (parseFloat(app.version) < 17) {
            say("After Effects " + app.version + " cannot colour keyframes - 17.0 is needed.");
            for (i = 0; i < swatches.length; i++) swatches[i].enabled = false;
            none.enabled = false;
        } else {
            say("Select keyframes, then click a colour.");
        }

        w.onResizing = w.onResize = function () { this.layout.resize(); };

        if (w instanceof Window) {
            w.center();
            w.show();
            $.global.__keyframeColoursWindow = w;   // keeps the palette alive
        } else {
            w.layout.layout(true);
            w.layout.resize();
        }
        return w;
    }

    build(thisObj);

})(this);
