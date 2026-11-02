// wipe_reveal.jsx
// =====================================================================
//   Linear Wipe reveal, starting at the playhead
// =====================================================================
//   The selected layers appear one after another, bottom to top, with a
//   Linear Wipe. The first one starts exactly at the playhead, each next
//   one is offset by Step.
//
//   No time remapping, no freeze, nothing is read from the timeline
//   except the playhead. The layers keep their own timing, only a wipe
//   is added. Keys are linear unless easing is ticked.
//
//   Optionally every revealed layer gets a Stroke layer style whose Size
//   and Color are linked by expression to a single null named CTRL,
//   holding a Slider Control and a Color Control. One knob then drives
//   the outline on the whole stack. The null is reused if it is already
//   in the comp, so the values you dialled in are never reset.
//
//   Before its own first key the layer sits at 100% wiped (invisible),
//   after the second key it stays at 0% (visible) - so the stack builds
//   up on screen and stays built.
// =====================================================================

(function () {

    var SCRIPT_NAME = "Wipe reveal";
    var WIPE_NAME   = "Reveal Wipe";

    var FX_WIPE      = "ADBE Linear Wipe";
    var P_COMPLETION = "ADBE Linear Wipe-0001";
    var P_ANGLE      = "ADBE Linear Wipe-0002";
    var P_FEATHER    = "ADBE Linear Wipe-0003";

    // The wipe eats from the side opposite to the reveal, so the picture
    // comes back from the side we want it to grow from
    var DIRECTIONS = [
        { label: "Left -> Right", angle: 270 },
        { label: "Right -> Left", angle: 90  },
        { label: "Top -> Bottom", angle: 180 },
        { label: "Bottom -> Top", angle: 0   }
    ];

    // ------------------------------------------------------------------
    //  Stroke layer style driven by one control null
    // ------------------------------------------------------------------
    var CTRL_NAME  = "CTRL";
    var CTRL_SIZE  = "Slider Control";     // default effect names on purpose,
    var CTRL_COLOR = "Color Control";      // the expressions below use them

    // Walk the children and match on display name or match name
    function childOf(g, names) {
        var i, j, q;
        if (!g) return null;
        for (j = 0; j < names.length; j++) {
            try { q = g.property(names[j]); } catch (a) { q = null; }
            if (q) return q;
        }
        for (i = 1; i <= g.numProperties; i++) {
            q = g.property(i);
            if (!q) continue;
            for (j = 0; j < names.length; j++)
                if (q.name === names[j] || q.matchName === names[j]) return q;
        }
        return null;
    }

    function controlNull(comp, sizePx, rgb) {
        var L = null, i, fx, p;

        for (i = 1; i <= comp.numLayers; i++)
            if (comp.layer(i).name === CTRL_NAME) { L = comp.layer(i); break; }

        if (!L) {
            L = comp.layers.addNull(comp.duration);
            L.name = CTRL_NAME;
            L.guideLayer = true;
            L.moveToBeginning();
            L.startTime = 0;
        }

        fx = L.property("ADBE Effect Parade");
        if (!fx) return null;

        if (!fx.property(CTRL_COLOR)) {
            p = fx.addProperty("ADBE Color Control");
            p.property(1).setValue(rgb);
        }
        if (!fx.property(CTRL_SIZE)) {
            p = fx.addProperty("ADBE Slider Control");
            p.property(1).setValue(sizePx);
        }
        return L;
    }

    function linkStroke(L) {
        var ls = null, st = null, i;
        try { ls = L.property("ADBE Layer Styles"); } catch (e) {}
        if (!ls) return "no Layer Styles group";

        st = childOf(ls, ["Stroke", "ADBE Stroke"]);

        if (!st) {                                   // not applied yet - add it
            try { if (ls.canAddProperty("ADBE Stroke")) st = ls.addProperty("ADBE Stroke"); } catch (e1) {}
        }
        if (!st) {                                   // API refused - use the menu command
            try {
                var id = app.findMenuCommandId("Stroke");
                if (id) {
                    var c = L.containingComp;
                    for (i = 1; i <= c.numLayers; i++) c.layer(i).selected = false;
                    L.selected = true;
                    app.executeCommand(id);
                    st = childOf(L.property("ADBE Layer Styles"), ["Stroke", "ADBE Stroke"]);
                }
            } catch (e2) {}
        }
        if (!st) return "could not add the Stroke style";

        var size  = childOf(st, ["Size", "ADBE Stroke Size"]);
        var color = childOf(st, ["Color", "ADBE Stroke Color"]);
        var bad = [];

        if (size) {
            try { size.expression = 'thisComp.layer("' + CTRL_NAME + '").effect("' + CTRL_SIZE + '")("Slider")'; }
            catch (e3) { bad.push("size not linked"); }
        } else bad.push("no Size");

        if (color) {
            try { color.expression = 'thisComp.layer("' + CTRL_NAME + '").effect("' + CTRL_COLOR + '")("Color")'; }
            catch (e4) { bad.push("colour not linked"); }
        } else bad.push("no Color");

        return bad.length ? bad.join(", ") : "ok";
    }

    // Parameter match names differ between builds - fall back to the
    // English name, then to the position inside the effect
    function fxProp(e, matchName, engName, idx) {
        var p = null;
        try { p = e.property(matchName); } catch (a) {}
        if (p) return p;
        try { p = e.property(engName); } catch (b) {}
        if (p) return p;
        try { p = e.property(idx); } catch (c) {}
        return p;
    }

    function run(o) {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) { alert("Open a composition."); return; }

        var sel = comp.selectedLayers;
        if (!sel.length) { alert("Select the layers to reveal."); return; }

        var list = [], i;
        for (i = 0; i < sel.length; i++)
            if (sel[i].name !== CTRL_NAME) list.push(sel[i]);
        list.sort(function (a, b) { return b.index - a.index; });   // index 1 = top, so this is bottom first
        if (o.skipBottom) list.shift();                             // the plate stays visible
        if (o.topFirst) list.reverse();

        var n = list.length;
        if (!n) { alert("Nothing to reveal - select more layers or untick the bottom layer option."); return; }

        var t0 = comp.time;
        var done = [], failed = [], L, fx, e, c, pa, pf, a, b, k;

        app.beginUndoGroup(SCRIPT_NAME);
        try {
            if (o.stroke && !controlNull(comp, o.strokeSize, o.strokeColor))
                failed.push(CTRL_NAME + " - control null not built");

            for (i = 0; i < n; i++) {
                L = list[i];

                fx = L.property("ADBE Effect Parade");
                if (!fx) { failed.push(L.name + " - takes no effects"); continue; }

                // drop our own previous wipe so repeated runs do not stack
                for (k = fx.numProperties; k >= 1; k--)
                    if (fx.property(k).name === WIPE_NAME) fx.property(k).remove();

                try { e = fx.addProperty(FX_WIPE); }
                catch (err) { failed.push(L.name + " - " + (err.message || err)); continue; }
                e.name = WIPE_NAME;

                pa = fxProp(e, P_ANGLE, "Wipe Angle", 2);
                pf = fxProp(e, P_FEATHER, "Feather", 3);
                c  = fxProp(e, P_COMPLETION, "Transition Completion", 1);

                if (!c) { failed.push(L.name + " - no Transition Completion found"); continue; }
                if (pa) { try { pa.setValue(o.angle); } catch (e1) {} }
                if (pf) { try { pf.setValue(o.feather); } catch (e2) {} }

                a = t0 + o.step * i;
                b = a + o.wipeLen;
                c.setValueAtTime(a, 100);
                c.setValueAtTime(b, 0);

                if (o.ease) {
                    var eo = new KeyframeEase(0, 60);
                    for (k = 1; k <= c.numKeys; k++) {
                        c.setInterpolationTypeAtKey(k, KeyframeInterpolationType.BEZIER,
                                                       KeyframeInterpolationType.BEZIER);
                        c.setTemporalEaseAtKey(k, [eo], [eo]);
                    }
                } else {
                    for (k = 1; k <= c.numKeys; k++)      // linear, spelled out rather than assumed
                        c.setInterpolationTypeAtKey(k, KeyframeInterpolationType.LINEAR,
                                                       KeyframeInterpolationType.LINEAR);
                }

                if (o.stroke) {
                    var sres = linkStroke(L);
                    if (sres !== "ok") failed.push(L.name + " - stroke: " + sres);
                }

                done.push(L.name + "   " + a.toFixed(2) + "s -> " + b.toFixed(2) + "s");
            }
        } finally {
            app.endUndoGroup();
        }

        var msg = "Start " + t0.toFixed(2) + "s   step " + o.step + "s   wipe " + o.wipeLen + "s\n" +
                  "Ends at " + (t0 + o.step * (n - 1) + o.wipeLen).toFixed(2) + "s\n\n" +
                  "Revealed: " + done.length + "\n" + done.join("\n");
        if (failed.length) msg += "\n\nFailed:\n" + failed.join("\n");
        alert(SCRIPT_NAME + "\n\n" + msg);
    }

    function ui() {
        var w = new Window("dialog", SCRIPT_NAME);
        w.orientation = "column";
        w.alignChildren = ["fill", "top"];
        w.spacing = 8;
        w.margins = 12;

        w.add("statictext", undefined, "The reveal starts at the playhead.");

        var dg = w.add("group");
        dg.add("statictext", undefined, "Direction:");
        var dd = dg.add("dropdownlist", undefined, undefined);
        for (var i = 0; i < DIRECTIONS.length; i++) dd.add("item", DIRECTIONS[i].label);
        dd.selection = 0;

        var ag = w.add("group");
        ag.add("statictext", undefined, "Wipe angle:");
        var angleFld = ag.add("edittext", undefined, "270");
        angleFld.characters = 5;
        angleFld.helpTip = "Flip by 180 if the wipe runs the other way";

        var wg = w.add("group");
        wg.add("statictext", undefined, "Wipe length, s:");
        var wipeFld = wg.add("edittext", undefined, "0.6");
        wipeFld.characters = 5;

        var sg = w.add("group");
        sg.add("statictext", undefined, "Step between layers, s:");
        var stepFld = sg.add("edittext", undefined, "0.4");
        stepFld.characters = 5;

        var fg = w.add("group");
        fg.add("statictext", undefined, "Feather, px:");
        var featherFld = fg.add("edittext", undefined, "0");
        featherFld.characters = 5;

        var strokeColor = [1, 1, 1, 1];

        var cbStroke = w.add("checkbox", undefined, "Stroke layer style, driven by a CTRL null");
        cbStroke.value = true;
        cbStroke.helpTip = "Size and colour are linked by expression to one null called CTRL";

        var stg = w.add("group");
        stg.add("statictext", undefined, "Stroke width, px:");
        var strokeFld = stg.add("edittext", undefined, "5");
        strokeFld.characters = 5;
        var colBtn = stg.add("button", undefined, "Colour...");
        colBtn.preferredSize.width = 70;
        colBtn.onClick = function () {
            var v = $.colorPicker();
            if (v >= 0) strokeColor = [((v >> 16) & 0xFF) / 255, ((v >> 8) & 0xFF) / 255, (v & 0xFF) / 255, 1];
        };
        strokeFld.helpTip = "Starting values for the CTRL null; change them there afterwards";

        var cbBottom = w.add("checkbox", undefined, "Leave the bottom layer alone (source plate)");
        cbBottom.value = true;

        var cbTop = w.add("checkbox", undefined, "Start from the top layer instead");

        var cbEase = w.add("checkbox", undefined, "Ease the wipe (off = linear)");
        cbEase.value = false;

        var bg = w.add("group");
        bg.alignment = ["fill", "bottom"];
        bg.alignChildren = ["fill", "center"];
        var ok = bg.add("button", undefined, "Apply", { name: "ok" });
        bg.add("button", undefined, "Cancel", { name: "cancel" });
        ok.preferredSize.height = 24;

        dd.onChange = function () { angleFld.text = String(DIRECTIONS[dd.selection.index].angle); };

        function val(fld, def) {
            var v = parseFloat(String(fld.text).replace(",", "."));
            return isNaN(v) ? def : v;
        }

        ok.onClick = function () {
            var o = {
                angle:      val(angleFld, 270),
                wipeLen:    val(wipeFld, 0.6),
                step:       val(stepFld, 0.4),
                feather:    val(featherFld, 0),
                stroke:      cbStroke.value,
                strokeSize:  val(strokeFld, 5),
                strokeColor: strokeColor,
                skipBottom: cbBottom.value,
                topFirst:   cbTop.value,
                ease:       cbEase.value
            };
            if (o.wipeLen <= 0) { alert("Wipe length must be above zero."); return; }
            w.close();
            run(o);
        };

        w.center();
        w.show();
    }

    ui();

})();
