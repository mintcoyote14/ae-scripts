// text_letter_colors.jsx
// =====================================================================
//   Colour every letter of a text layer separately
// =====================================================================
//   Select a text layer, run the script, and every letter of it shows up
//   as a square. Click a square to pick that letter's colour, or press
//   Cycle / Shuffle to spread the poster palette over the word. Apply
//   writes the colours into the layer.
//
//   Per-character colour is a real text attribute (the same thing you get
//   by selecting one letter with the type tool and changing the fill), so
//   it survives editing and rendering. It needs After Effects 17.1+.
// =====================================================================

(function () {

    var SCRIPT_NAME = "Letter colours";
    var CELL = 34;
    var COLS = 8;
    var GAP  = 3;

    // Poster palette
    var PALETTE = [
        [0.90, 0.22, 0.50],   // pink
        [0.37, 0.73, 0.27],   // green
        [0.95, 0.76, 0.19],   // yellow
        [0.93, 0.48, 0.18],   // orange
        [0.21, 0.72, 0.78],   // cyan
        [0.23, 0.44, 0.72],   // blue
        [0.56, 0.35, 0.66],   // purple
        [0.85, 0.23, 0.21]    // red
    ];

    // ------------------------------------------------------------------
    //  Layer
    // ------------------------------------------------------------------
    function textProp() {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) return null;

        var sel = comp.selectedLayers, i, p;
        for (i = 0; i < sel.length; i++) {
            try {
                p = sel[i].property("ADBE Text Properties").property("ADBE Text Document");
                if (p) return { prop: p, layer: sel[i] };
            } catch (e) {}
        }
        return null;
    }

    function colourOfChar(doc, i) {
        try {
            var r = doc.characterRange(i, i + 1);
            var c = r.fillColor;
            if (c && c.length >= 3) return [c[0], c[1], c[2]];
        } catch (e) {}
        return null;
    }

    // ------------------------------------------------------------------
    //  Window
    // ------------------------------------------------------------------
    function ui(target) {
        var doc = target.prop.value;
        var text = String(doc.text);

        // One cell per visible character; spaces and line breaks keep their
        // place in the string but get no square
        var cells = [], i, ch;
        for (i = 0; i < text.length; i++) {
            ch = text.charAt(i);
            if (ch === " " || ch === "\r" || ch === "\n" || ch === "\t") continue;
            cells.push({ index: i, ch: ch, rgb: colourOfChar(doc, i) || PALETTE[cells.length % PALETTE.length] });
        }

        if (!cells.length) { alert("This layer has no letters."); return; }

        var w = new Window("dialog", SCRIPT_NAME);
        w.orientation = "column";
        w.alignChildren = ["fill", "top"];
        w.spacing = 8;
        w.margins = 12;

        var head = w.add("statictext", undefined, target.layer.name + "   -   " + text.replace(/[\r\n]+/g, " "));
        head.alignment = ["fill", "top"];

        var grid = w.add("group");
        grid.orientation = "column";
        grid.alignChildren = ["left", "top"];
        grid.spacing = GAP;

        var font = ScriptUI.newFont("Arial", ScriptUI.FontStyle.BOLD, 15);

        function draw() {
            for (var k = 0; k < cells.length; k++) cells[k].ui.notify("onDraw");
        }

        function makeCell(row, cell) {
            var g = row.add("group");
            g.preferredSize = [CELL, CELL];
            g.helpTip = cell.ch + "  -  click to pick a colour";

            g.onDraw = function () {
                var gr = this.graphics, c = cell.rgb;
                var fill = gr.newBrush(gr.BrushType.SOLID_COLOR, [c[0], c[1], c[2], 1]);
                gr.newPath();
                gr.rectPath(0, 0, this.size.width, this.size.height);
                gr.fillPath(fill);
                gr.strokePath(gr.newPen(gr.PenType.SOLID_COLOR, [0, 0, 0, 1], 1));

                // dark letter on a light colour, light letter on a dark one
                var lum = 0.30 * c[0] + 0.59 * c[1] + 0.11 * c[2];
                var ink = lum > 0.55 ? [0, 0, 0, 1] : [1, 1, 1, 1];
                var m = gr.measureString(cell.ch, font);
                gr.drawString(cell.ch, gr.newPen(gr.PenType.SOLID_COLOR, ink, 1),
                              (this.size.width - m.width) / 2,
                              (this.size.height - m.height) / 2, font);
            };

            g.addEventListener("mousedown", function () {
                var picked = $.colorPicker();          // -1 when cancelled
                if (picked === null || picked < 0) return;
                cell.rgb = [((picked >> 16) & 255) / 255,
                            ((picked >> 8) & 255) / 255,
                            (picked & 255) / 255];
                g.notify("onDraw");
            });

            cell.ui = g;
        }

        var row = null;
        for (i = 0; i < cells.length; i++) {
            if (i % COLS === 0) {
                row = grid.add("group");
                row.spacing = GAP;
                row.margins = 0;
            }
            makeCell(row, cells[i]);
        }

        var tools = w.add("group");
        tools.alignment = ["fill", "top"];
        var bCycle = tools.add("button", undefined, "Cycle");
        var bShuffle = tools.add("button", undefined, "Shuffle");
        bCycle.helpTip = "Lay the palette over the letters in order";
        bShuffle.helpTip = "Same palette, random order";

        bCycle.onClick = function () {
            for (var k = 0; k < cells.length; k++) cells[k].rgb = PALETTE[k % PALETTE.length];
            draw();
        };

        bShuffle.onClick = function () {
            var prev = -1, n;
            for (var k = 0; k < cells.length; k++) {
                do { n = Math.floor(Math.random() * PALETTE.length); } while (n === prev && PALETTE.length > 1);
                prev = n;
                cells[k].rgb = PALETTE[n];
            }
            draw();
        };

        var bg = w.add("group");
        bg.alignment = ["fill", "bottom"];
        bg.alignChildren = ["fill", "center"];
        var ok = bg.add("button", undefined, "Apply", { name: "ok" });
        bg.add("button", undefined, "Cancel", { name: "cancel" });
        ok.preferredSize.height = 24;

        ok.onClick = function () {
            var done = 0, failed = [], k, r;

            app.beginUndoGroup(SCRIPT_NAME);
            try {
                var d = target.prop.value;             // fresh copy of the document
                for (k = 0; k < cells.length; k++) {
                    try {
                        r = d.characterRange(cells[k].index, cells[k].index + 1);
                        r.applyFill = true;
                        r.fillColor = cells[k].rgb;
                        done++;
                    } catch (e) {
                        failed.push(cells[k].ch + " - " + (e.message || e));
                    }
                }
            } finally {
                app.endUndoGroup();
            }

            w.close();
            if (failed.length)
                alert(SCRIPT_NAME + "\n\nColoured: " + done + "\n\nFailed:\n" + failed.join("\n"));
        };

        w.center();
        w.show();
    }

    // ------------------------------------------------------------------
    //  Start
    // ------------------------------------------------------------------
    if (parseFloat(app.version) < 17.1) {
        alert(SCRIPT_NAME + "\n\nPer-character colour needs After Effects 17.1 or newer.\n" +
              "This one is " + app.version + ".");
        return;
    }

    var target = textProp();
    if (!target) { alert(SCRIPT_NAME + "\n\nSelect a text layer in an open composition."); return; }

    if (target.prop.numKeys > 0)
        alert(SCRIPT_NAME + "\n\nThe source text of this layer is keyframed.\n" +
              "The colours go onto the text as it is right now.");

    ui(target);

})();
