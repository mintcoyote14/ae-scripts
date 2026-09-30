// fw_template_rig.jsx
// =====================================================================
//   FESTIWAL WEDLIN - spot template rig
//   (logo tint + page-turn handover + outro blur)
// =====================================================================
//   Rigs the template so the look follows the timeline instead of baked
//   keyframes. Safe to re-run: it only rewrites its own effects and the
//   expressions it put there.
//
//   1. The logo layer gets a Fill effect. On every frame the rig looks
//      for the topmost ACTIVE layer underneath the logo and reads the
//      tint from that layer's name:
//          oferta*                   -> red  D50719
//          fest animation / opening  -> logo off (opacity 0)
//          anything else             -> white
//      Stacking order decides: a layer covered by another one above it
//      never wins, so "opening" under "footage" still reads as white.
//
//   2. Every layer carrying a keyed CC Page Turn is retimed by an
//      expression so the turn STARTS on the in-point of the layer it
//      reveals - the first one below it that comes in later. The keys
//      keep their shape and spacing, only their start is driven.
//          Oferta 01 -> turns when Oferta 02 comes in
//          Oferta 02 -> turns when fest animation comes in
//
//   3. When that turn uncovers a layer the logo must be off over, the
//      logo opacity ramps 100 -> 0 and hits 0 at the MIDDLE of the turn,
//      instead of popping out at the end of the page.
//
//   4. The logo fades 100 -> 0 over 10 frames around the in-point of the
//      outro layer - 5 frames before, 5 after, easy ease on both ends
//      (ease() is the expression form of F9 on two keys).
//
//   5. The adjustment layer gets a Gaussian Blur ramping 0 -> 35 over 10
//      frames from the outro in-point, easy ease.
//
//   Nothing is bound to layer numbers - only to names and to in/out
//   points. Reorder, retime or renumber the layers and the rig follows.
//
//   Layers with no video - audio, and anything matching IGNORE_MATCH -
//   are invisible to the rig, so dropping a music or VO track anywhere in
//   the stack changes nothing.
// =====================================================================

(function () {

    var SCRIPT_NAME = "FW template rig";

    // ------------------------------------------------------------------
    //  CONFIG - names are matched as a case-insensitive PREFIX
    // ------------------------------------------------------------------
    var LOGO_MATCH   = ["logo_animation"];              // the layer being tinted
    var OUTRO_MATCH  = ["outro"];                       // drives the fade and the blur
    var RED_MATCH    = ["oferta"];                      // underneath -> red logo
    var HIDE_MATCH   = ["fest animation", "opening"];   // underneath -> logo off
    // Never counted as "underneath". Audio-only layers are skipped anyway
    // (no video), this list is for visible layers that are not content:
    // the outro, adjustment layers, nulls and anything named _something.
    var IGNORE_MATCH = ["outro", "adjustment", "null", "_"];
    // anything else underneath -> white logo

    var RED_HEX   = "D50719";
    var WHITE_HEX = "FFFFFF";

    var FADE_PRE  = 5;      // frames before the outro in-point
    var FADE_POST = 5;      // frames after it  -> 10 frames total

    var BLUR_MAX    = 35;   // Blurriness at the end of the ramp
    var BLUR_OFFSET = 0;    // frames from the outro in-point to the start of the ramp
    var BLUR_LEN    = 10;   // ramp length in frames

    // Page turn. TURN_FX / TURN_PROP are also read from inside the logo
    // expression, so keep them as they read in the Effect Controls panel.
    var TURN_FX   = "CC Page Turn";
    var TURN_PROP = "Fold Position";
    var TURN_MID  = 0.5;    // logo is at 0 at this point of the turn (0.5 = middle)

    var FILL_LABEL = "FW Logo Tint";
    var BLUR_LABEL = "FW Outro Blur";

    var FX_FILL = ["ADBE Fill"];
    var FX_BLUR = ["ADBE Gaussian Blur 2", "ADBE Gaussian Blur"];

    var P_BLURRINESS = ["ADBE Gaussian Blur 2-0001", "ADBE Gaussian Blur-0001"];
    var P_REPEAT     = ["ADBE Gaussian Blur 2-0003", "ADBE Gaussian Blur-0003"];

    // ------------------------------------------------------------------
    //  HELPERS
    // ------------------------------------------------------------------
    function fail(msg) { throw new Error(msg); }

    function hexToRGB(h) {
        h = String(h).replace("#", "");
        return [parseInt(h.substr(0, 2), 16) / 255,
                parseInt(h.substr(2, 2), 16) / 255,
                parseInt(h.substr(4, 2), 16) / 255, 1];
    }

    // ["a","b"] -> a JS array literal ready to paste into an expression
    function jsList(list) {
        var out = [], i;
        for (i = 0; i < list.length; i++) out.push('"' + String(list[i]).toLowerCase() + '"');
        return "[" + out.join(", ") + "]";
    }

    function jsStr(s) { return '"' + String(s).replace(/"/g, '\\"') + '"'; }

    function jsColor(rgba) {
        var out = [], i;
        for (i = 0; i < rgba.length; i++) out.push(String(Math.round(rgba[i] * 1e6) / 1e6));
        return "[" + out.join(", ") + "]";
    }

    function startsAny(name, list) {
        var n = String(name).toLowerCase(), i;
        for (i = 0; i < list.length; i++) {
            if (n.indexOf(String(list[i]).toLowerCase()) === 0) return true;
        }
        return false;
    }

    // Video layers only - an audio file called outro_music.wav must not pass
    // for the outro, and the logo is never an audio layer either
    function findLayer(c, list) {
        for (var i = 1; i <= c.numLayers; i++) {
            var L = c.layer(i);
            if (L.hasVideo === false) continue;
            if (startsAny(L.name, list)) return L;
        }
        return null;
    }

    // Topmost real adjustment layer, or failing that one named "Adjustment Layer ..."
    function findAdjustment(c) {
        var i, L;
        for (i = 1; i <= c.numLayers; i++) {
            L = c.layer(i);
            if (L instanceof AVLayer && L.adjustmentLayer) return L;
        }
        for (i = 1; i <= c.numLayers; i++) if (startsAny(c.layer(i).name, ["adjustment"])) return c.layer(i);
        return null;
    }

    function findEffect(layer, matchNames) {
        var g = layer.property("ADBE Effect Parade"), i, k;
        if (!g) return null;
        for (i = 1; i <= g.numProperties; i++) {
            for (k = 0; k < matchNames.length; k++) {
                if (g.property(i).matchName === matchNames[k]) return g.property(i);
            }
        }
        return null;
    }

    // Reuse the effect when it is already there, so dialled-in values survive a re-run
    function ensureEffect(layer, matchNames, label) {
        var fx = findEffect(layer, matchNames), g, k;
        if (!fx) {
            g = layer.property("ADBE Effect Parade");
            if (!g) fail("Layer \"" + layer.name + "\" cannot take effects.");
            for (k = 0; k < matchNames.length; k++) {
                if (g.canAddProperty(matchNames[k])) { fx = g.addProperty(matchNames[k]); break; }
            }
            if (!fx) fail("Cannot add the effect to \"" + layer.name + "\".");
        }
        try { if (label && fx.name !== label) fx.name = label; } catch (e) { }
        return fx;
    }

    function subProp(fx, matchNames) {
        var k, p;
        for (k = 0; k < matchNames.length; k++) {
            try { p = fx.property(matchNames[k]); if (p) return p; } catch (e) { }
        }
        return null;
    }

    function propOfType(fx, type) {
        for (var i = 1; i <= fx.numProperties; i++) {
            var p = fx.property(i);
            if (p && p.propertyValueType === type) return p;
        }
        return null;
    }

    function setExpr(p, expr, what) {
        if (!p) fail("Property not found: " + what);
        if (!p.canSetExpression) fail("Cannot put an expression on: " + what);
        p.expression = expr;
        p.expressionEnabled = true;
    }

    // ------------------------------------------------------------------
    //  PAGE TURN - script side
    // ------------------------------------------------------------------
    // The turn effect, by display name first (that is how it reads in the
    // panel and how the logo expression looks it up), then by matchName
    function turnEffect(layer) {
        var g = layer.property("ADBE Effect Parade"), i, e;
        if (!g) return null;
        for (i = 1; i <= g.numProperties; i++) {
            e = g.property(i);
            if (e.name === TURN_FX || e.matchName === TURN_FX) return e;
        }
        return null;
    }

    // The keyed driver of the turn: Fold Position if it has keys, else the
    // first keyed property in the effect
    function turnProp(fx) {
        var i, p;
        try { p = fx.property(TURN_PROP); if (p && p.numKeys >= 2) return p; } catch (e) { }
        for (i = 1; i <= fx.numProperties; i++) {
            p = fx.property(i);
            if (p && p.numKeys >= 2) return p;
        }
        return null;
    }

    // The layer a page turn uncovers: the first one below that comes in later
    function revealTarget(c, layer) {
        for (var i = layer.index + 1; i <= c.numLayers; i++) {
            var L = c.layer(i), n = L.name.toLowerCase();
            if (L.hasVideo === false) continue;
            if (startsAny(n, IGNORE_MATCH) || startsAny(n, LOGO_MATCH)) continue;
            if (L.inPoint <= layer.inPoint) continue;
            return L;
        }
        return null;
    }

    // ------------------------------------------------------------------
    //  EXPRESSIONS
    // ------------------------------------------------------------------
    var HIT = [
        "function hit(n, list) {",
        "    for (var k = 0; k < list.length; k++) if (n.indexOf(list[k]) === 0) return true;",
        "    return false;",
        "}"
    ].join("\n");

    // Walk down from just below the logo, stop on the first layer that is live
    // here. That is the whole "stacking order wins" rule.
    var UNDER = [
        "var uIdx = 0;",
        "for (var i = index + 1; i <= thisComp.numLayers; i++) {",
        "    var L = thisComp.layer(i);",
        "    if (!L.hasVideo || !L.active) continue;",
        "    var n = L.name.toLowerCase();",
        "    if (hit(n, IGNORE_N)) continue;",
        "    uIdx = i;",
        "    break;",
        "}",
        "var under = (uIdx > 0) ? thisComp.layer(uIdx).name.toLowerCase() : null;"
    ].join("\n");

    function exprColor() {
        return [
            "// " + SCRIPT_NAME + " - tint follows the topmost layer underneath",
            "var RED      = " + jsColor(hexToRGB(RED_HEX)) + ";",
            "var WHITE    = " + jsColor(hexToRGB(WHITE_HEX)) + ";",
            "var RED_N    = " + jsList(RED_MATCH) + ";",
            "var IGNORE_N = " + jsList(IGNORE_MATCH) + ";",
            HIT,
            UNDER,
            "(under !== null && hit(under, RED_N)) ? RED : WHITE;"
        ].join("\n");
    }

    // turnFallback = the measured turn length in frames, used only if the
    // effect cannot be found by name at evaluation time
    function exprOpacity(turnFallback) {
        return [
            "// " + SCRIPT_NAME + " - off over some layers, hands over on a page turn,",
            "// fades out at the outro",
            "var HIDE_N   = " + jsList(HIDE_MATCH) + ";",
            "var IGNORE_N = " + jsList(IGNORE_MATCH) + ";",
            "var OUTRO_N  = " + jsList(OUTRO_MATCH) + ";",
            "var PRE      = " + FADE_PRE + ";",
            "var POST     = " + FADE_POST + ";",
            "var TURN_FX  = " + jsStr(TURN_FX) + ";",
            "var TURN_PR  = " + jsStr(TURN_PROP) + ";",
            "var TURN_FB  = " + turnFallback + ";   // frames, fallback turn length",
            "var TURN_MID = " + TURN_MID + ";",
            HIT,
            UNDER,
            "var fd = thisComp.frameDuration;",
            "var base = (under !== null && hit(under, HIDE_N)) ? 0 : 100;",
            "",
            "// while the layer on top turns its page away to uncover a layer the",
            "// logo must be off over, ride the opacity down to 0 by mid-turn",
            "if (uIdx > 0 && base > 0) {",
            "    var U = thisComp.layer(uIdx);",
            "    for (var r = uIdx + 1; r <= thisComp.numLayers; r++) {",
            "        var R = thisComp.layer(r);",
            "        if (!R.hasVideo) continue;",
            "        var rn = R.name.toLowerCase();",
            "        if (hit(rn, IGNORE_N)) continue;",
            "        if (R.inPoint <= U.inPoint) continue;",
            "        if (hit(rn, HIDE_N)) {",
            "            var len = TURN_FB * fd;",
            "            try {",
            "                var tp = U.effect(TURN_FX)(TURN_PR);",
            "                if (tp.numKeys >= 2) len = tp.key(tp.numKeys).time - tp.key(1).time;",
            "            } catch (e) { }",
            "            if (len > 0) base = ease(time, R.inPoint, R.inPoint + len * TURN_MID, 100, 0);",
            "        }",
            "        break;",
            "    }",
            "}",
            "",
            "var fade = 100;",
            "for (var j = 1; j <= thisComp.numLayers; j++) {",
            "    if (j === index) continue;",
            "    var O = thisComp.layer(j);",
            "    if (!O.hasVideo || !O.enabled || !hit(O.name.toLowerCase(), OUTRO_N)) continue;",
            "    var t0 = O.inPoint - PRE * fd;",
            "    var t1 = O.inPoint + POST * fd;",
            "    fade = (t1 > t0) ? ease(time, t0, t1, 100, 0) : (time < t0 ? 100 : 0);",
            "    break;",
            "}",
            "Math.min(base, fade);"
        ].join("\n");
    }

    // Slides the whole key group so the first key lands on the in-point of
    // the layer this page uncovers. The keys themselves stay untouched.
    function exprTurn() {
        return [
            "// " + SCRIPT_NAME + " - the turn starts when the layer it uncovers comes in",
            "var SKIP_N = " + jsList(IGNORE_MATCH.concat(LOGO_MATCH)) + ";",
            HIT,
            "var trig = null;",
            "for (var i = index + 1; i <= thisComp.numLayers; i++) {",
            "    var L = thisComp.layer(i);",
            "    if (!L.hasVideo) continue;",
            "    if (hit(L.name.toLowerCase(), SKIP_N)) continue;",
            "    if (L.inPoint <= inPoint) continue;",
            "    trig = L.inPoint;",
            "    break;",
            "}",
            "(numKeys >= 2 && trig !== null) ? valueAtTime(time - (trig - key(1).time)) : value;"
        ].join("\n");
    }

    // ------------------------------------------------------------------
    //  RUN
    // ------------------------------------------------------------------
    function run(c) {
        var report = [], i, fps = c.frameRate;

        function fr(t) { return Math.round(t * fps); }

        var logo = findLayer(c, LOGO_MATCH);
        if (!logo) fail("No layer starting with \"" + LOGO_MATCH[0] + "\" in \"" + c.name + "\".");

        var adj = findAdjustment(c);
        if (!adj) fail("No adjustment layer found in \"" + c.name + "\".");

        var outro = findLayer(c, OUTRO_MATCH);

        // --- 2: page turns, retimed to the layer they uncover -------------
        var turns = [], turnFallback = 0;
        for (i = 1; i <= c.numLayers; i++) {
            var L  = c.layer(i);
            if (startsAny(L.name, IGNORE_MATCH) || startsAny(L.name, LOGO_MATCH)) continue;
            var fx = turnEffect(L);
            if (!fx) continue;
            var tp = turnProp(fx);
            if (!tp) continue;

            var lenFr = fr(tp.keyTime(tp.numKeys) - tp.keyTime(1));
            var rev   = revealTarget(c, L);
            setExpr(tp, exprTurn(), L.name + " > " + fx.name + " > " + tp.name);

            turns.push({ layer: L, prop: tp, len: lenFr, rev: rev });
            if (rev && startsAny(rev.name, HIDE_MATCH) && !turnFallback) turnFallback = lenFr;
        }
        if (!turnFallback && turns.length) turnFallback = turns[0].len;

        // --- 1 + 3 + 4: tint and opacity on the logo ----------------------
        var fill  = ensureEffect(logo, FX_FILL, FILL_LABEL);
        var color = propOfType(fill, PropertyValueType.COLOR);
        setExpr(color, exprColor(), FILL_LABEL + " > Color");
        setExpr(logo.property("ADBE Transform Group").property("ADBE Opacity"),
                exprOpacity(turnFallback), logo.name + " > Opacity");

        report.push("Logo:        " + logo.name + "   (index " + logo.index + ")");
        report.push("   tint      " + RED_HEX + " over " + RED_MATCH.join(" / ") + ", white elsewhere");
        report.push("   opacity   0 over " + HIDE_MATCH.join(" / ") + ", 0 at "
                    + Math.round(TURN_MID * 100) + "% of a turn that uncovers one of them");

        // --- 5: Gaussian Blur on the adjustment layer ---------------------
        var blur = ensureEffect(adj, FX_BLUR, BLUR_LABEL);
        var blurriness = subProp(blur, P_BLURRINESS) || propOfType(blur, PropertyValueType.OneD);
        setExpr(blurriness, exprBlur(), BLUR_LABEL + " > Blurriness");
        var rep = subProp(blur, P_REPEAT);
        if (rep) { try { rep.setValue(1); } catch (e) { } }

        report.push("");
        report.push("Adjustment:  " + adj.name + "   (index " + adj.index + ")");
        report.push("   blur      0 -> " + BLUR_MAX + " over " + BLUR_LEN + " fr from the outro in-point"
                    + (BLUR_OFFSET ? " + " + BLUR_OFFSET + " fr" : ""));

        report.push("");
        if (turns.length) {
            report.push("Page turns:");
            for (i = 0; i < turns.length; i++) {
                var t = turns[i];
                if (!t.rev) {
                    report.push("   " + t.layer.name + "   nothing to uncover - keys left where they are");
                    continue;
                }
                var a = fr(t.rev.inPoint), b = a + t.len;
                var over = (b > fr(t.layer.outPoint))
                         ? "   !! runs " + (b - fr(t.layer.outPoint)) + " fr past the layer out"
                         : "";
                report.push("   " + t.layer.name + "   starts on " + t.rev.name
                            + "   frame " + a + " -> " + b + "   (" + t.len + " fr)" + over);
            }
        } else {
            report.push("Page turns:  none found (" + TURN_FX + " with keys).");
        }

        report.push("");
        if (outro) {
            var f = fr(outro.inPoint);
            report.push("Outro:       " + outro.name);
            report.push("   in        frame " + f + "   ("
                        + timeToCurrentFormat(outro.inPoint, fps) + ")");
            report.push("   fade      frame " + (f - FADE_PRE) + " -> " + (f + FADE_POST));
            report.push("   blur      frame " + (f + BLUR_OFFSET) + " -> " + (f + BLUR_OFFSET + BLUR_LEN));
        } else {
            report.push("Outro:       no layer starting with \"" + OUTRO_MATCH[0]
                        + "\" - fade and blur stay idle until one shows up.");
        }

        return report.join("\n");
    }

    function exprBlur() {
        return [
            "// " + SCRIPT_NAME + " - blur ramps up when the outro starts",
            "var OUTRO_N = " + jsList(OUTRO_MATCH) + ";",
            "var OFFSET  = " + BLUR_OFFSET + ";",
            "var LEN     = " + BLUR_LEN + ";",
            "var MAX     = " + BLUR_MAX + ";",
            HIT,
            "var fd = thisComp.frameDuration;",
            "var v = 0;",
            "for (var i = 1; i <= thisComp.numLayers; i++) {",
            "    if (i === index) continue;",
            "    var L = thisComp.layer(i);",
            "    if (!L.hasVideo || !L.enabled || !hit(L.name.toLowerCase(), OUTRO_N)) continue;",
            "    var t0 = L.inPoint + OFFSET * fd;",
            "    var t1 = t0 + LEN * fd;",
            "    v = (t1 > t0) ? ease(time, t0, t1, 0, MAX) : (time < t0 ? 0 : MAX);",
            "    break;",
            "}",
            "v;"
        ].join("\n");
    }

    var c = app.project.activeItem;
    if (!(c && c instanceof CompItem)) {
        alert(SCRIPT_NAME + "\n\nOpen the spot comp first.");
        return;
    }

    app.beginUndoGroup(SCRIPT_NAME);
    var out = null, err = null;
    try { out = run(c); } catch (e) { err = e; } finally { app.endUndoGroup(); }

    if (err) alert(SCRIPT_NAME + " - error:\n\n" + (err.message || err));
    else     alert(SCRIPT_NAME + "   -   " + c.name + "\n\n" + out);

})();
