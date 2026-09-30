// linear_wipe_stagger.jsx
// =====================================================================
//   Staggered Linear Wipe reveal on the selected layers
// =====================================================================
//   Every selected layer gets a Linear Wipe that goes from hidden to
//   visible, one layer after the other. The bottom layer is the source
//   plate: it stays on screen and gets no wipe.
//
//   Two markers are the In and Out of the reveal - markers on the comp
//   and on any layer both count. The pair around the playhead wins, so
//   markers of other shots on a long timeline do not interfere. The
//   wipes are spread evenly between them: the first starts on the In
//   marker, the last finishes exactly on the Out marker.
//   Without markers the reveal starts at the playhead and uses the
//   fixed step from the dialog.
//
//   Before its own key the layer is fully wiped (invisible), after the
//   second key it stays visible - so the stack builds up on screen.
//
//   Optionally every revealed layer also gets a Stroke layer style.
//   Width and colour are not baked in: a null called STROKE CTRL holds
//   a slider and a colour control, and every stroke is linked to it by
//   an expression - so one knob changes them all. The dialog values are
//   only the starting point for that null when it is first created.
// =====================================================================

(function () {

    var SCRIPT_NAME = "Linear Wipe stagger";
    var WIPE_NAME   = "Stagger Wipe";
    var CTRL_LAYER  = "STROKE CTRL";
    var CTRL_WIDTH  = "Stroke Width";
    var CTRL_COLOR  = "Stroke Color";

    var FX_WIPE      = "ADBE Linear Wipe";
    var P_COMPLETION = "ADBE Linear Wipe-0001";
    var P_ANGLE      = "ADBE Linear Wipe-0002";
    var P_FEATHER    = "ADBE Linear Wipe-0003";

    var DIRECTIONS = [
        { label: "Left -> Right", angle: 270 },
        { label: "Right -> Left", angle: 90  },
        { label: "Top -> Bottom", angle: 180 },
        { label: "Bottom -> Top", angle: 0   }
    ];

    // Match names vary between builds - fall back to the English name,
    // then to the parameter position inside the effect
    function fxProp(e, matchName, engName, idx) {
        var p = null;
        try { p = e.property(matchName); } catch (a) {}
        if (p) return p;
        try { p = e.property(engName); } catch (b) {}
        if (p) return p;
        try { p = e.property(idx); } catch (c) {}
        return p;
    }

    // ------------------------------------------------------------------
    //  Stroke layer style
    // ------------------------------------------------------------------
    // Layer style match names are not documented consistently, so walk the
    // children and match on either the match name or the display name
    function childOf(g, names) {
        var i, q, j;
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

    // What the Stroke group is called varies; find it by walking as well
    function findStrokeGroup(ls) {
        var i, q;
        q = childOf(ls, ["ADBE Stroke", "Stroke"]);
        if (q) return q;
        for (i = 1; i <= ls.numProperties; i++) {
            q = ls.property(i);
            if (q && String(q.matchName).indexOf("Stroke") !== -1) return q;
        }
        return null;
    }

    // One null drives the stroke on every layer: width slider + colour
    // control, linked by expressions. Reused if it is already in the comp.
    function strokeControl(comp, sizePx, rgb) {
        var L = null, i, fx, p;

        for (i = 1; i <= comp.numLayers; i++)
            if (comp.layer(i).name === CTRL_LAYER) { L = comp.layer(i); break; }

        if (!L) {
            L = comp.layers.addNull(comp.duration);
            L.name = CTRL_LAYER;
            L.guideLayer = true;                 // never rendered, just a knob holder
            L.moveToBeginning();
            L.startTime = 0;
        }

        fx = L.property("ADBE Effect Parade");
        if (!fx) return null;

        p = fx.property(CTRL_WIDTH);
        if (!p) {
            p = fx.addProperty("ADBE Slider Control");
            p.name = CTRL_WIDTH;
            p.property(1).setValue(sizePx);
        }

        p = fx.property(CTRL_COLOR);
        if (!p) {
            p = fx.addProperty("ADBE Color Control");
            p.name = CTRL_COLOR;
            p.property(1).setValue(rgb);
        }
        return L;
    }

    // The API refuses to add layer styles in some builds, so fall back to
    // the Layer > Layer Styles > Stroke menu command
    function addStroke(L, sizePx, rgb) {
        var ls = null, st = null;
        try { ls = L.property("ADBE Layer Styles"); } catch (e) {}
        if (!ls) return "no Layer Styles group";

        st = findStrokeGroup(ls);

        if (!st) {
            try { if (ls.canAddProperty("ADBE Stroke")) st = ls.addProperty("ADBE Stroke"); } catch (e2) {}
        }

        if (!st) {
            try {
                var id = app.findMenuCommandId("Stroke");
                if (id) {
                    var c = L.containingComp, i;
                    for (i = 1; i <= c.numLayers; i++) c.layer(i).selected = false;
                    L.selected = true;
                    app.executeCommand(id);
                    st = findStrokeGroup(L.property("ADBE Layer Styles"));
                }
            } catch (e3) {}
        }

        if (!st) return "could not add the Stroke style";

        var size  = childOf(st, ["ADBE Stroke Size", "Size"]);
        var color = childOf(st, ["ADBE Stroke Color", "Color"]);

        // index instead of the parameter name - language independent
        var ref = 'thisComp.layer("' + CTRL_LAYER + '")';
        var bad = [];

        if (size) {
            try { size.expression = ref + '.effect("' + CTRL_WIDTH + '")(1)'; }
            catch (a1) { try { size.setValue(sizePx); } catch (a2) {} bad.push("size not linked"); }
        } else bad.push("no Size property");

        if (color) {
            try { color.expression = ref + '.effect("' + CTRL_COLOR + '")(1)'; }
            catch (b1) { try { color.setValue(rgb); } catch (b2) {} bad.push("colour not linked"); }
        } else bad.push("no Color property");

        return bad.length ? bad.join(", ") : "ok";
    }

    // Markers on the comp and on any layer, sorted by time.
    // The first two are the In and Out of the reveal.
    function collectMarkers(comp) {
        var out = [], i, k, mp, L;

        mp = comp.markerProperty;
        for (k = 1; mp && k <= mp.numKeys; k++) out.push(mp.keyTime(k));

        for (i = 1; i <= comp.numLayers; i++) {
            L = comp.layer(i);
            mp = L.property("ADBE Marker");
            for (k = 1; mp && k <= mp.numKeys; k++) out.push(mp.keyTime(k));
        }

        out.sort(function (a, b) { return a - b; });

        var uniq = [];                                  // markers on the same frame count once
        for (i = 0; i < out.length; i++)
            if (!uniq.length || out[i] - uniq[uniq.length - 1] > comp.frameDuration / 2)
                uniq.push(out[i]);
        return uniq;
    }

    // On a long timeline there can be markers from other shots, so take the
    // pair around the playhead: the interval that contains it, otherwise the
    // first interval that starts after it.
    function pickPair(comp, mk) {
        if (mk.length < 2) return [];
        var t = comp.time, eps = comp.frameDuration / 2, i;

        for (i = 0; i + 1 < mk.length; i++)
            if (mk[i] <= t + eps && mk[i + 1] >= t - eps) return [mk[i], mk[i + 1]];

        for (i = 0; i + 1 < mk.length; i++)
            if (mk[i] >= t - eps) return [mk[i], mk[i + 1]];

        return [mk[0], mk[1]];
    }

    function run(o) {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) { alert("Open a composition."); return; }

        var sel = comp.selectedLayers;
        if (!sel.length) { alert("Select the layers to reveal."); return; }

        var list = [], i;
        for (i = 0; i < sel.length; i++)
            if (sel[i].name !== CTRL_LAYER) list.push(sel[i]);      // never wipe the knob holder
        list.sort(function (a, b) { return a.index - b.index; });   // index 1 = topmost
        if (o.keepPlate) list.pop();                                // bottom layer is the plate
        if (!o.topFirst) list.reverse();                            // lowest pass reveals first

        var n = list.length;
        if (!n) { alert("Nothing to reveal - select more layers or untick the plate option."); return; }

        // In / Out markers set the window; the wipes are spread evenly so the
        // last one lands exactly on the second marker
        var mk = pickPair(comp, collectMarkers(comp)), t0, step, span = "";
        if (mk.length >= 2) {
            t0 = mk[0];
            var F = mk[1] - t0;
            if (o.wipeLen > F) o.wipeLen = F;
            step = (n > 1) ? (F - o.wipeLen) / (n - 1) : 0;
            span = "markers " + t0.toFixed(2) + "s -> " + mk[1].toFixed(2) + "s";
        } else {
            t0 = comp.time;
            step = o.step;
            span = "no markers - from the playhead, step " + step + "s";
        }

        var done = [], failed = [], e, c, pa, pf, a, b, k;

        app.beginUndoGroup(SCRIPT_NAME);
        try {
            if (o.stroke && !strokeControl(comp, o.strokeSize, o.strokeColor))
                failed.push(CTRL_LAYER + " - could not build the control null");
            for (i = 0; i < list.length; i++) {
                var L = list[i];
                var fx = L.property("ADBE Effect Parade");
                if (!fx) { failed.push(L.name + " - takes no effects"); continue; }

                // clear our own previous wipe so repeats do not stack
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

                a = t0 + step * i;
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
                }
                if (o.stroke) {
                    var sres = addStroke(L, o.strokeSize, o.strokeColor);
                    if (sres !== "ok") failed.push(L.name + " - stroke: " + sres);
                }

                done.push(L.name + "   " + a.toFixed(2) + "s -> " + b.toFixed(2) + "s");
            }
            for (i = 0; i < sel.length; i++) sel[i].selected = true;   // menu route drops it
        } finally {
            app.endUndoGroup();
        }

        var msg = span + "   wipe " + o.wipeLen + "s   step " + step.toFixed(2) + "s\n\n" +
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
        sg.add("statictext", undefined, "Step, s (only without markers):");
        var stepFld = sg.add("edittext", undefined, "0.4");
        stepFld.characters = 5;

        var fg = w.add("group");
        fg.add("statictext", undefined, "Feather, px:");
        var featherFld = fg.add("edittext", undefined, "0");
        featherFld.characters = 5;

        var strokeColor = [1, 1, 1, 1];

        var cbStroke = w.add("checkbox", undefined, "Add a Stroke layer style");
        cbStroke.value = true;

        var stg = w.add("group");
        stg.add("statictext", undefined, "Stroke size, px:");
        var strokeFld = stg.add("edittext", undefined, "5");
        strokeFld.characters = 5;
        strokeFld.helpTip = "Starting width for the STROKE CTRL null; change it there afterwards";
        var colBtn = stg.add("button", undefined, "Colour...");
        colBtn.preferredSize.width = 70;
        colBtn.helpTip = "Starting colour for the STROKE CTRL null - white by default";
        colBtn.onClick = function () {
            var n = $.colorPicker();
            if (n >= 0) strokeColor = [((n >> 16) & 0xFF) / 255, ((n >> 8) & 0xFF) / 255, (n & 0xFF) / 255, 1];
        };

        var cbPlate = w.add("checkbox", undefined, "Keep the bottom layer visible (no wipe)");
        cbPlate.value = true;
        cbPlate.helpTip = "The source plate stays on screen the whole time";

        var cbTop = w.add("checkbox", undefined, "Start from the top layer instead");
        var cbEase = w.add("checkbox", undefined, "Ease the wipe");
        cbEase.value = true;

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
                angle:    val(angleFld, 270),
                wipeLen:  val(wipeFld, 0.6),
                step:     val(stepFld, 0.4),
                feather:  val(featherFld, 0),
                stroke:      cbStroke.value,
                strokeSize:  val(strokeFld, 5),
                strokeColor: strokeColor,
                keepPlate: cbPlate.value,
                topFirst: cbTop.value,
                ease:     cbEase.value
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
