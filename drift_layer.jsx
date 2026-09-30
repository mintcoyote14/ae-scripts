// drift_layer.jsx
// =====================================================================
//   Layer drift via Transform > Position and Scale
// =====================================================================
//   An arrow acts immediately: the layer starts moving that way. Scale is
//   off by default and Scale is not touched at all; tick
//   "Add to the arrow" and the zoom rides along with the motion.
//   The "Scale only" button gives zoom without motion.
//   The layer gets a Slider Control ("Drift Speed" in px/sec for motion,
//   "Drift Scale" in %/sec for scale) and an expression on the matching
//   property. Speed is then dialled on the slider, keyframes included;
//   a minus goes the other way. Keys on Position / Scale are no problem:
//   the drift is added on top of the animation.
//
//   Motion and scale are independent - both can sit on one layer.
//   Running it again on a layer that already drifts only re-aims the
//   vector - the speed set on the slider stays as it was.
//   "Disable" mutes the expression keeping the settings, "Remove"
//   erases the expression and the slider.
// =====================================================================

(function () {

    var SCRIPT_NAME   = "Drift";
    var EFFECT_NAME   = "Drift Speed";    // motion, px/sec
    var SCALE_EFFECT  = "Drift Scale";    // scale, %/sec
    var DEFAULT_SPEED = 20;               // px/sec
    var DEFAULT_SCALE = 5;                // %/sec
    var TAG           = "// drift";       // marks the expression as ours
    var SETTINGS      = "DriftLayer";

    // ------------------------------------------------------------------
    //  Settings kept between runs
    // ------------------------------------------------------------------
    function getSetting(key, def) {
        if (!app.settings.haveSetting(SETTINGS, key)) return def;
        return app.settings.getSetting(SETTINGS, key);
    }

    function setSetting(key, val) {
        app.settings.saveSetting(SETTINGS, key, String(val));
    }

    // ------------------------------------------------------------------
    //  Expressions
    // ------------------------------------------------------------------
    function offsetLine(effectName, fromIn) {
        return "var o = effect(\"" + effectName + "\")(1) * " +
               (fromIn ? "(time - inPoint)" : "time") + ";";
    }

    // dx / dy: -1, 0 or 1
    function vectorExpr(dx, dy, fromIn) {
        var d;
        if (dx) d = "[" + (dx > 0 ? "o" : "-o") + ", 0]";
        else    d = "[0, " + (dy > 0 ? "o" : "-o") + "]";
        return TAG + "\n" +
               offsetLine(EFFECT_NAME, fromIn) + "\n" +
               "var d = " + d + ";\n" +
               "value.length == 3 ? value + [d[0], d[1], 0] : value + d";
    }

    // Position with separated dimensions - expression on one axis
    function axisExpr(sign, fromIn) {
        return TAG + "\n" +
               offsetLine(EFFECT_NAME, fromIn) + "\n" +
               "value " + (sign > 0 ? "+" : "-") + " o";
    }

    // Scale: gain in percentage points per second, the same on both axes
    function scaleExpr(sign, fromIn) {
        return TAG + "\n" +
               offsetLine(SCALE_EFFECT, fromIn) + "\n" +
               "var d = " + (sign > 0 ? "o" : "-o") + ";\n" +
               "value.length == 3 ? value + [d, d, d] : value + [d, d]";
    }

    // ------------------------------------------------------------------
    //  Working with the layer
    // ------------------------------------------------------------------
    function transform(layer) {
        return layer.property("ADBE Transform Group");
    }

    function positionProp(layer) {
        var tr = transform(layer);
        return tr ? tr.property("ADBE Position") : null;
    }

    function scaleProp(layer) {
        var tr = transform(layer);
        return tr ? tr.property("ADBE Scale") : null;
    }

    // Separate axes exist only with Separate Dimensions
    function axisProp(layer, xAxis) {
        var tr = transform(layer);
        if (!tr) return null;
        try { return tr.property(xAxis ? "ADBE Position_0" : "ADBE Position_1"); }
        catch (e) { return null; }
    }

    // Removes our drift from a property, leaves other expressions alone
    function clearOurs(p) {
        if (!p) return false;
        try {
            if (p.expression && p.expression.indexOf(TAG) !== -1) {
                p.expression = "";
                return true;
            }
        } catch (e) {}
        return false;
    }

    // The slider is created with the starting speed; an existing one is left
    // alone - running again should only re-aim the vector.
    function slider(layer, name, speed) {
        var fx = layer.property("ADBE Effect Parade");
        if (!fx) return null;                       // cameras / lights take no effects
        var s = fx.property(name);
        if (s) return s;
        s = fx.addProperty("ADBE Slider Control");
        s.name = name;
        s.property(1).setValue(speed);
        return s;
    }

    // ------------------------------------------------------------------
    //  Apply
    // ------------------------------------------------------------------
    function isForeign(p) {
        return p.expression && p.expression.indexOf(TAG) === -1;
    }

    // dir  - null or { dx, dy, speed };  no direction chosen => Position untouched
    // zoom - null or { sign, speed };    no scale chosen     => Scale untouched
    function apply(dir, zoom, fromIn) {
        var c = app.project.activeItem;
        if (!(c && c instanceof CompItem)) { alert("Open a composition."); return; }
        if (!c.selectedLayers.length)      { alert("Select a layer."); return; }

        var sel = c.selectedLayers;
        var jobs = [], skipped = [], foreign = [], i, L, pos, sep, t;

        for (i = 0; i < sel.length; i++) {
            L = sel[i];
            if (!L.property("ADBE Effect Parade")) {
                skipped.push(L.name + " - layer takes no effects");
                continue;
            }

            if (dir) {
                pos = positionProp(L);
                if (!pos) skipped.push(L.name + " - no Position");
                else {
                    sep = pos.dimensionsSeparated;
                    t = sep ? axisProp(L, dir.dx !== 0) : pos;
                    if (!t) skipped.push(L.name + " - could not get the Position axis");
                    else {
                        if (isForeign(t)) foreign.push(L.name + " - Position");
                        jobs.push({ kind: "pos", layer: L, target: t, separated: sep });
                    }
                }
            }

            if (zoom) {
                t = scaleProp(L);
                if (!t) skipped.push(L.name + " - no Scale");
                else {
                    if (isForeign(t)) foreign.push(L.name + " - Scale");
                    jobs.push({ kind: "scl", layer: L, target: t });
                }
            }
        }

        if (foreign.length && !confirm(
                "There is already an expression here:\n\n" + foreign.join("\n") +
                "\n\nOverwrite?")) return;

        if (!jobs.length) { alert(skipped.join("\n") || "Nothing to process."); return; }

        var moved = 0, zoomed = 0;

        app.beginUndoGroup(SCRIPT_NAME);
        try {
            for (i = 0; i < jobs.length; i++) {
                L = jobs[i].layer;
                t = jobs[i].target;

                if (jobs[i].kind === "scl") {
                    slider(L, SCALE_EFFECT, zoom.speed);
                    t.expression = scaleExpr(zoom.sign, fromIn);
                    zoomed++;
                } else {
                    slider(L, EFFECT_NAME, dir.speed);
                    // Clear previous drift from the axes not used this time,
                    // otherwise changing direction would give a diagonal
                    if (jobs[i].separated) {
                        clearOurs(axisProp(L, dir.dx === 0));
                        t.expression = axisExpr(dir.dx ? dir.dx : dir.dy, fromIn);
                    } else {
                        clearOurs(axisProp(L, true));
                        clearOurs(axisProp(L, false));
                        t.expression = vectorExpr(dir.dx, dir.dy, fromIn);
                    }
                    moved++;
                }
                t.expressionEnabled = true;     // the expression may be off after an error
            }
        } finally {
            app.endUndoGroup();
        }

        if (skipped.length)
            alert("Move: " + moved + "   Scale: " + zoomed +
                  "\n\nSkipped:\n" + skipped.join("\n"));
    }

    // ------------------------------------------------------------------
    //  Removing the drift
    //  full === false - the expression stays but is disabled (an arrow re-enables it)
    //  full === true  - the expression is erased and the slider deleted
    // ------------------------------------------------------------------
    function remove(full) {
        var c = app.project.activeItem;
        if (!(c && c instanceof CompItem)) { alert("Open a composition."); return; }
        if (!c.selectedLayers.length)      { alert("Select a layer."); return; }

        var sel = c.selectedLayers;
        var names = [EFFECT_NAME, SCALE_EFFECT];
        var layers = 0, sliders = 0, i, j, L, hit, targets, p, fx, s;

        app.beginUndoGroup(SCRIPT_NAME + (full ? " remove" : " off"));
        try {
            for (i = 0; i < sel.length; i++) {
                L = sel[i];
                hit = false;
                targets = [positionProp(L), axisProp(L, true), axisProp(L, false), scaleProp(L)];

                for (j = 0; j < targets.length; j++) {
                    p = targets[j];
                    if (!p) continue;
                    try {
                        if (!p.expression || p.expression.indexOf(TAG) === -1) continue;
                        if (full) p.expression = "";
                        else      p.expressionEnabled = false;
                        hit = true;
                    } catch (e) {}
                }

                if (full) {
                    fx = L.property("ADBE Effect Parade");
                    for (j = 0; j < names.length; j++) {
                        s = fx ? fx.property(names[j]) : null;
                        if (s) { s.remove(); sliders++; hit = true; }
                    }
                }
                if (hit) layers++;
            }
        } finally {
            app.endUndoGroup();
        }

        if (!layers) alert("No drift on the selected layers.");
        else if (full && !sliders) alert("Cleared from layers: " + layers + "\nNo sliders found.");
    }

    // ------------------------------------------------------------------
    //  Dialog
    // ------------------------------------------------------------------
    function ui() {
        var w = new Window("dialog", SCRIPT_NAME);
        w.orientation = "column";
        w.alignChildren = ["fill", "top"];
        w.spacing = 8;
        w.margins = 12;

        // --- Motion --------------------------------------------------
        var mp = w.add("panel", undefined, "Move");
        mp.orientation = "column";
        mp.alignChildren = ["center", "top"];
        mp.margins = [10, 14, 10, 10];
        mp.spacing = 6;

        var pad = mp.add("group");
        pad.orientation = "column";
        pad.alignChildren = ["center", "center"];
        pad.spacing = 3;

        var r1 = pad.add("group"); r1.spacing = 3;
        var up = r1.add("button", undefined, "↑");
        var r2 = pad.add("group"); r2.spacing = 3;
        var lf = r2.add("button", undefined, "←");
        var rt = r2.add("button", undefined, "→");
        var r3 = pad.add("group"); r3.spacing = 3;
        var dn = r3.add("button", undefined, "↓");

        var sg = mp.add("group");
        sg.alignChildren = ["left", "center"];
        sg.add("statictext", undefined, "Speed, px/s:");
        var speedFld = sg.add("edittext", undefined, String(DEFAULT_SPEED));
        speedFld.characters = 6;
        speedFld.helpTip = "Starting value of the Drift Speed slider on new layers";

        // --- Scale ----------------------------------------------------
        var zp = w.add("panel", undefined, "Scale");
        zp.orientation = "column";
        zp.alignChildren = ["center", "top"];
        zp.margins = [10, 14, 10, 10];
        zp.spacing = 6;

        var addScale = zp.add("checkbox", undefined, "Add to the arrow");
        addScale.alignment = ["left", "top"];
        addScale.value = getSetting("addScale", "false") === "true";
        addScale.helpTip = "Off - an arrow gives motion only, Scale is left untouched";

        var zr = zp.add("group");
        zr.alignment = ["left", "top"];
        zr.spacing = 10;
        var zin  = zr.add("radiobutton", undefined, "+ bigger");
        var zout = zr.add("radiobutton", undefined, "- smaller");
        zin.helpTip  = "Zoom in - the layer grows";
        zout.helpTip = "Zoom out - the layer shrinks";
        if (getSetting("zoom", "in") === "out") zout.value = true; else zin.value = true;

        var zg = zp.add("group");
        zg.alignment = ["left", "top"];
        zg.alignChildren = ["left", "center"];
        zg.add("statictext", undefined, "Speed, %/s:");
        var scaleFld = zg.add("edittext", undefined, String(DEFAULT_SCALE));
        scaleFld.characters = 6;
        scaleFld.helpTip = "Gain in percentage points per second.\nStarting value of the Drift Scale slider.";

        var onlyScale = zp.add("button", undefined, "Scale only");
        onlyScale.alignment = ["fill", "top"];
        onlyScale.preferredSize.height = 22;
        onlyScale.helpTip = "Apply scale without motion";

        var arrows = [up, lf, rt, dn], i;
        for (i = 0; i < arrows.length; i++) arrows[i].preferredSize = [46, 30];

        var fromIn = w.add("checkbox", undefined, "From layer in-point");
        fromIn.value = getSetting("fromIn", "true") === "true";
        fromIn.helpTip = "Off - motion is counted from the start of the comp";

        var og = w.add("group");
        og.alignChildren = ["fill", "center"];
        og.spacing = 3;
        var offBtn = og.add("button", undefined, "Disable");
        var clrBtn = og.add("button", undefined, "Remove");
        offBtn.preferredSize.height = 22;
        clrBtn.preferredSize.height = 22;
        offBtn.helpTip = "Disables both expressions - move and scale. Sliders keep their\nspeed, any button switches it back on.";
        clrBtn.helpTip = "Erases the expressions and deletes the Drift Speed / Drift Scale sliders - the layer is clean.";

        var cancel = w.add("button", undefined, "Cancel", { name: "cancel" });
        cancel.preferredSize.height = 22;

        function num(fld) {
            return parseFloat(String(fld.text).replace(",", "."));
        }

        // Scale is applied only when the checkbox is on (or "Scale only" is pressed)
        function zoomArg(force) {
            if (!force && !addScale.value) return null;
            var v = num(scaleFld);
            if (isNaN(v)) { alert("Scale speed must be a number."); return false; }
            return { sign: zin.value ? 1 : -1, speed: v };
        }

        function save() {
            setSetting("fromIn",   fromIn.value);
            setSetting("addScale", addScale.value);
            setSetting("zoom",     zin.value ? "in" : "out");
        }

        // An arrow acts immediately: motion, plus scale when the checkbox is on
        function go(dx, dy) {
            var v = num(speedFld);
            if (isNaN(v)) { alert("Move speed must be a number."); return; }
            var z = zoomArg(false);
            if (z === false) return;
            save();
            w.close();
            apply({ dx: dx, dy: dy, speed: v }, z, fromIn.value);
        }

        up.onClick = function () { go( 0, -1); };
        dn.onClick = function () { go( 0,  1); };
        lf.onClick = function () { go(-1,  0); };
        rt.onClick = function () { go( 1,  0); };

        onlyScale.onClick = function () {
            var z = zoomArg(true);
            if (z === false) return;
            save();
            w.close();
            apply(null, z, fromIn.value);
        };

        offBtn.onClick = function () { w.close(); remove(false); };
        clrBtn.onClick = function () { w.close(); remove(true);  };

        w.center();
        w.show();
    }

    ui();

})();
