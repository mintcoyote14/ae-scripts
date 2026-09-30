// making_of_reveal.jsx
// =====================================================================
//   Making-of reveal: freeze the shot, wipe the passes in, carry on
// =====================================================================
//   The shot plays, freezes on one frame, the separately rendered passes
//   are revealed one after another with Linear Wipe, then the shot runs
//   on with the finished look.
//
//   Two comp markers set the freeze window: the first one is where the
//   picture stops, the second one is where it starts moving again.
//   With fewer than two markers the window is taken from the playhead
//   and the freeze length in the dialog, and the markers are added.
//
//   How it is built:
//     - every selected layer gets Time Remap with four keys -
//       normal speed, hold between the markers, normal speed after,
//       so the tail of the shot is kept, not cut;
//     - every layer above the bottom one gets a Linear Wipe whose
//       Transition Completion goes 100 -> 0 inside the freeze window,
//       staggered so the passes stack up one by one.
//
//   The bottom layer is treated as the plate: it is frozen but not
//   wiped, so the shot before the freeze is the raw base and after the
//   freeze it is the full composite.
// =====================================================================

(function () {

    var SCRIPT_NAME = "Making-of reveal";
    var WIPE_NAME   = "Making-of Wipe";
    var SETTINGS    = "MakingOfReveal";

    // Linear Wipe match names
    var FX_WIPE       = "ADBE Linear Wipe";
    var P_COMPLETION  = "ADBE Linear Wipe-0001";
    var P_ANGLE       = "ADBE Linear Wipe-0002";
    var P_FEATHER     = "ADBE Linear Wipe-0003";

    // Reveal direction -> Wipe Angle. The wipe eats from the opposite
    // side, so the picture comes back from the side we reveal from.
    var DIRECTIONS = [
        { label: "Left -> Right", angle: 270 },
        { label: "Right -> Left", angle: 90  },
        { label: "Top -> Bottom", angle: 180 },
        { label: "Bottom -> Top", angle: 0   }
    ];

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

    function num(fld, def) {
        var v = parseFloat(String(fld.text).replace(",", "."));
        return isNaN(v) ? def : v;
    }

    // ------------------------------------------------------------------
    //  Freeze window
    // ------------------------------------------------------------------
    // Returns { m1: seconds, m2: seconds, fromMarkers: bool }
    function freezeWindow(comp, fallbackLen) {
        var mp = comp.markerProperty;
        if (mp && mp.numKeys >= 2)
            return { m1: mp.keyTime(1), m2: mp.keyTime(2), fromMarkers: true };

        var m1 = comp.time;
        return { m1: m1, m2: m1 + fallbackLen, fromMarkers: false };
    }

    function addMarkers(comp, m1, m2) {
        var a = new MarkerValue("freeze in");
        var b = new MarkerValue("freeze out");
        comp.markerProperty.setValueAtTime(m1, a);
        comp.markerProperty.setValueAtTime(m2, b);
    }

    // ------------------------------------------------------------------
    //  Time freeze
    // ------------------------------------------------------------------
    // Four keys: layer in, freeze start, freeze end (same value), layer
    // out shifted by the freeze length. Linear all the way, so speed
    // before and after stays exactly as it was.
    function freezeLayer(L, m1, m2) {
        var F = m2 - m1;
        var inP = L.inPoint, outP = L.outPoint;

        // Ends before the freeze - nothing to do at all
        if (outP <= m1) return "ends before the freeze";

        // Starts at or after the freeze - it simply happens later now
        if (inP >= m1) {
            L.startTime = L.startTime + F;
            return "pushed by " + F.toFixed(2) + "s";
        }

        // Spans the freeze. Try Time Remap; do not trust canSetTimeRemapEnabled,
        // it is false for layers that already have it on.
        var tr = null;
        try { if (!L.timeRemapEnabled) L.timeRemapEnabled = true; } catch (e) {}
        try { tr = L.property("ADBE Time Remapping"); } catch (e2) { tr = null; }

        // Stills, solids, shapes and text have no time to hold - they only
        // have to last longer, otherwise they would end during the freeze
        if (!tr || !L.timeRemapEnabled) {
            L.outPoint = outP + F;
            return "static - stretched by " + F.toFixed(2) + "s";
        }

        var hadRemap = tr.numKeys > 0;
        var vIn  = tr.valueAtTime(inP, false);
        var v1   = tr.valueAtTime(m1, false);
        var vOut = tr.valueAtTime(outP, false);

        var k;
        for (k = tr.numKeys; k >= 1; k--) tr.removeKey(k);

        tr.setValueAtTime(inP, vIn);
        tr.setValueAtTime(m1, v1);
        tr.setValueAtTime(m2, v1);
        tr.setValueAtTime(outP + F, vOut);

        for (k = 1; k <= tr.numKeys; k++)
            tr.setInterpolationTypeAtKey(k, KeyframeInterpolationType.LINEAR,
                                            KeyframeInterpolationType.LINEAR);

        L.outPoint = outP + F;
        return hadRemap ? "ok (Time Remap was already on)" : "ok";
    }

    // ------------------------------------------------------------------
    //  Wipe
    // ------------------------------------------------------------------
    function removeOldWipe(L) {
        var fx = L.property("ADBE Effect Parade");
        if (!fx) return;
        for (var i = fx.numProperties; i >= 1; i--)
            if (fx.property(i).name === WIPE_NAME) fx.property(i).remove();
    }

    function addWipe(L, angle, feather, t0, t1, ease) {
        var fx = L.property("ADBE Effect Parade");
        if (!fx) return false;

        var e = fx.addProperty(FX_WIPE);
        e.name = WIPE_NAME;
        e.property(P_ANGLE).setValue(angle);
        e.property(P_FEATHER).setValue(feather);

        var c = e.property(P_COMPLETION);
        c.setValueAtTime(t0, 100);      // before this key the value holds 100 - layer hidden
        c.setValueAtTime(t1, 0);        // after this key it holds 0 - layer visible

        if (ease) {
            var eo = new KeyframeEase(0, 60);
            for (var k = 1; k <= c.numKeys; k++) {
                c.setInterpolationTypeAtKey(k, KeyframeInterpolationType.BEZIER,
                                               KeyframeInterpolationType.BEZIER);
                c.setTemporalEaseAtKey(k, [eo], [eo]);
            }
        }
        return true;
    }

    // ------------------------------------------------------------------
    //  Apply
    // ------------------------------------------------------------------
    function run(o) {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) { alert("Open a composition."); return; }

        var sel = comp.selectedLayers;
        if (sel.length < 2) { alert("Select the layers of the shot - at least two."); return; }

        // top to bottom by stack index
        var layers = [], i;
        for (i = 0; i < sel.length; i++) layers.push(sel[i]);
        layers.sort(function (a, b) { return a.index - b.index; });

        var win = freezeWindow(comp, o.freezeLen);
        var m1 = win.m1, m2 = win.m2, F = m2 - m1;
        if (F <= 0) { alert("The second marker must sit after the first one."); return; }

        // which layers get a wipe: everything except the plate
        var wipeList = [], n;
        for (i = 0; i < layers.length; i++) wipeList.push(layers[i]);
        if (o.keepPlate) wipeList.pop();                 // bottom layer stays as the plate
        if (!o.topFirst) wipeList.reverse();             // default: the lowest pass shows up first

        n = wipeList.length;
        if (!n) { alert("Nothing left to reveal - untick the plate option or select more layers."); return; }

        // stagger: every wipe lasts o.wipeLen, starts spread over the window
        var span = F - o.wipeLen;
        if (span < 0) { alert("Wipe length is longer than the freeze window."); return; }
        var step = (n > 1) ? span / (n - 1) : 0;

        var frozen = [], wiped = [], skipped = [];
        var res, t0, t1;

        app.beginUndoGroup(SCRIPT_NAME);
        try {
            if (!win.fromMarkers && o.addMarkers) addMarkers(comp, m1, m2);

            for (i = 0; i < layers.length; i++) {
                res = freezeLayer(layers[i], m1, m2);
                if (res.indexOf("ok") === 0) frozen.push(layers[i].name + " - " + res);
                else skipped.push(layers[i].name + " - " + res);
            }

            for (i = 0; i < n; i++) {
                t0 = m1 + step * i;
                t1 = t0 + o.wipeLen;
                removeOldWipe(wipeList[i]);
                if (addWipe(wipeList[i], o.angle, o.feather, t0, t1, o.ease))
                    wiped.push(wipeList[i].name + "   " + t0.toFixed(2) + "s -> " + t1.toFixed(2) + "s");
                else
                    skipped.push(wipeList[i].name + " - takes no effects");
            }

            if (o.extendComp) comp.duration = comp.duration + F;
        } finally {
            app.endUndoGroup();
        }

        var msg = "Freeze " + m1.toFixed(2) + "s -> " + m2.toFixed(2) + "s  (" + F.toFixed(2) + "s)" +
                  (win.fromMarkers ? "   from comp markers" : "   from the playhead") + "\n\n" +
                  "Frozen layers: " + frozen.length + "\n" +
                  "Revealed: " + wiped.length + "\n\n" + wiped.join("\n");
        if (skipped.length) msg += "\n\nSkipped:\n" + skipped.join("\n");
        alert(SCRIPT_NAME + "\n\n" + msg);
    }

    // ------------------------------------------------------------------
    //  Window
    // ------------------------------------------------------------------
    function ui() {
        var w = new Window("dialog", SCRIPT_NAME);
        w.orientation = "column";
        w.alignChildren = ["fill", "top"];
        w.spacing = 8;
        w.margins = 12;

        var fp = w.add("panel", undefined, "Freeze");
        fp.orientation = "column";
        fp.alignChildren = ["left", "top"];
        fp.margins = [10, 14, 10, 10];
        fp.spacing = 6;
        fp.add("statictext", undefined, "Comp markers 1 and 2 set the window.");

        var fg = fp.add("group");
        fg.add("statictext", undefined, "No markers - freeze from playhead, s:");
        var freezeFld = fg.add("edittext", undefined, getSetting("freezeLen", "3"));
        freezeFld.characters = 5;

        var cbMarkers = fp.add("checkbox", undefined, "Add the two markers in that case");
        cbMarkers.value = getSetting("addMarkers", "true") === "true";

        var rp = w.add("panel", undefined, "Reveal");
        rp.orientation = "column";
        rp.alignChildren = ["left", "top"];
        rp.margins = [10, 14, 10, 10];
        rp.spacing = 6;

        var dg = rp.add("group");
        dg.add("statictext", undefined, "Direction:");
        var dd = dg.add("dropdownlist", undefined, undefined);
        for (var i = 0; i < DIRECTIONS.length; i++) dd.add("item", DIRECTIONS[i].label);
        dd.selection = parseInt(getSetting("dir", "0"), 10);

        var ag = rp.add("group");
        ag.add("statictext", undefined, "Wipe angle:");
        var angleFld = ag.add("edittext", undefined, String(DIRECTIONS[dd.selection.index].angle));
        angleFld.characters = 5;
        angleFld.helpTip = "Set by the direction. Flip by 180 if the wipe runs the other way.";

        var wg = rp.add("group");
        wg.add("statictext", undefined, "Wipe length per layer, s:");
        var wipeFld = wg.add("edittext", undefined, getSetting("wipeLen", "0.6"));
        wipeFld.characters = 5;

        var feg = rp.add("group");
        feg.add("statictext", undefined, "Feather, px:");
        var featherFld = feg.add("edittext", undefined, getSetting("feather", "0"));
        featherFld.characters = 5;

        var cbBottom = rp.add("checkbox", undefined, "Start from the top layer instead");
        cbBottom.value = getSetting("topFirst", "false") === "true";
        cbBottom.helpTip = "Default order is bottom pass first, the way a composite is built";

        var cbEase = rp.add("checkbox", undefined, "Ease the wipe");
        cbEase.value = getSetting("ease", "true") === "true";

        var cbPlate = w.add("checkbox", undefined, "Keep the bottom layer as the plate (no wipe)");
        cbPlate.value = getSetting("keepPlate", "true") === "true";

        var cbComp = w.add("checkbox", undefined, "Extend comp duration by the freeze");
        cbComp.value = getSetting("extendComp", "true") === "true";

        var bg = w.add("group");
        bg.alignment = ["fill", "bottom"];
        bg.alignChildren = ["fill", "center"];
        var ok = bg.add("button", undefined, "Apply", { name: "ok" });
        var cancel = bg.add("button", undefined, "Cancel", { name: "cancel" });
        ok.preferredSize.height = 24;
        cancel.preferredSize.height = 24;

        dd.onChange = function () {
            angleFld.text = String(DIRECTIONS[dd.selection.index].angle);
        };

        ok.onClick = function () {
            var o = {
                freezeLen:   num(freezeFld, 3),
                addMarkers:  cbMarkers.value,
                angle:       num(angleFld, 270),
                wipeLen:     num(wipeFld, 0.6),
                feather:     num(featherFld, 0),
                topFirst:    cbBottom.value,
                ease:        cbEase.value,
                keepPlate:   cbPlate.value,
                extendComp:  cbComp.value
            };
            if (o.wipeLen <= 0) { alert("Wipe length must be above zero."); return; }

            setSetting("freezeLen", o.freezeLen);
            setSetting("addMarkers", o.addMarkers);
            setSetting("dir", dd.selection.index);
            setSetting("wipeLen", o.wipeLen);
            setSetting("feather", o.feather);
            setSetting("topFirst", o.topFirst);
            setSetting("ease", o.ease);
            setSetting("keepPlate", o.keepPlate);
            setSetting("extendComp", o.extendComp);

            w.close();
            run(o);
        };

        w.center();
        w.show();
    }

    ui();

})();
