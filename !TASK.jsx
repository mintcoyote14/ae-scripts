// !TASK.jsx
// =====================================================================
//   T A S K   —   універсальний слот для разових завдань
// =====================================================================
//
//   TASK:  Eagle trace: keep one mask per frame + morph into statuette
//   DATE:  2026-11-10
//
//   Рядок "TASK:" читає ScriptLauncherPanel і показує його на кнопці.
//   Редагується тільки блок task() нижче. Все інше — обгортка:
//   undo-група, обробка помилок, звіт, набір хелперів.
//   Попередні версії — у _task_archive\
// =====================================================================

(function () {

    var TASK_NAME = "TASK";      // назва undo-групи
    var SILENT    = false;       // true — не показувати підсумкове вікно

    // ------------------------------------------------------------------
    //  ХЕЛПЕРИ
    // ------------------------------------------------------------------
    var _log = [];

    function log(msg) { _log.push(String(msg)); }

    function fail(msg) { throw new Error(msg); }

    function comp(required) {
        var c = app.project.activeItem;
        if (!(c && c instanceof CompItem)) {
            if (required === false) return null;
            fail("Відкрий композицію.");
        }
        return c;
    }

    // Виділені шари; якщо нічого не виділено і allIfEmpty !== false — всі шари компа
    function layers(c, allIfEmpty) {
        c = c || comp();
        var out = [], i;
        if (c.selectedLayers.length) {
            for (i = 0; i < c.selectedLayers.length; i++) out.push(c.selectedLayers[i]);
        } else if (allIfEmpty !== false) {
            for (i = 1; i <= c.numLayers; i++) out.push(c.layer(i));
        }
        if (!out.length) fail("Немає шарів для обробки.");
        return out;
    }

    // Виділені властивості шару (те, що підсвічено в таймлайні)
    function props(layer) {
        var sel = layer.selectedProperties, out = [], i;
        for (i = 0; i < sel.length; i++) {
            if (sel[i] instanceof Property) out.push(sel[i]);
        }
        return out;
    }

    // Усі композиції проєкту; sel === true — тільки виділені в Project-панелі
    function comps(sel) {
        var out = [], i, it;
        for (i = 1; i <= app.project.numItems; i++) {
            it = app.project.item(i);
            if (!(it instanceof CompItem)) continue;
            if (sel === true && !it.selected) continue;
            out.push(it);
        }
        return out;
    }

    // Виділені елементи Project-панелі (будь-якого типу)
    function items() {
        var s = app.project.selection, out = [], i;
        for (i = 0; i < s.length; i++) out.push(s[i]);
        return out;
    }

    // Рекурсивний обхід елементів папки проєкту
    function walk(folder, fn) {
        var i, it;
        for (i = 1; i <= folder.numItems; i++) {
            it = folder.item(i);
            fn(it);
            if (it instanceof FolderItem) walk(it, fn);
        }
    }

    // Пошук властивості за шляхом: prop(layer, "Effects", "Gaussian Blur", "Blurriness")
    function prop(root) {
        var p = root, i;
        for (i = 1; i < arguments.length; i++) {
            if (!p) return null;
            p = p.property(arguments[i]);
        }
        return p;
    }

    function ask(question, def) {
        var v = prompt(question, def === undefined ? "" : String(def));
        if (v === null) fail("__CANCEL__");
        return v;
    }

    function askNum(question, def) {
        var v = parseFloat(ask(question, def).replace(",", "."));
        if (isNaN(v)) fail("Потрібне число.");
        return v;
    }

    function confirmOr(question) {
        if (!confirm(question)) fail("__CANCEL__");
    }

    // ------------------------------------------------------------------
    //  ЗАВДАННЯ  —  сюди пишеться код конкретної задачі
    // ------------------------------------------------------------------
    function task() {

        // Auto-trace puts the eagle into different masks on different frames
        // and adds small specks/holes. This builds ONE mask "Eagle" that takes,
        // on every frame, the biggest traced mask keyed on that frame, removes
        // the original masks, and then morphs "Eagle" point-by-point into the
        // statuette outline (S6_statuette_top, cut at y = CUT_Y).
        var CUT_Y = 575;      // statuette is shown only above this line
        var N = 160;          // points used for the morph

        var c = comp();

        // --- trace layer: the selected layer, else the first "Auto-traced..." layer
        var L = null, i, j;
        if (c.selectedLayers.length === 1 && c.selectedLayers[0].property("ADBE Mask Parade").numProperties) L = c.selectedLayers[0];
        if (!L) for (i = 1; i <= c.numLayers; i++) if (c.layer(i).name.indexOf("Auto-traced") === 0) { L = c.layer(i); break; }
        if (!L) fail("Select the auto-traced layer.");
        var masks = L.property("ADBE Mask Parade"), nM = masks.numProperties;
        if (!nM) fail("The layer has no masks.");

        // --- statuette outline (shape layer inside the S6_statuette_top precomp)
        var statL = null, statPath = null;
        for (i = 1; i <= c.numLayers; i++) {
            var src = null; try { src = c.layer(i).source; } catch (e) {}
            if (src && src instanceof CompItem && src.name === "S6_statuette_top") { statL = c.layer(i); break; }
        }
        if (!statL) fail("No S6_statuette_top layer in this comp.");
        var sh = statL.source.layer("statuette_top");
        try { statPath = sh.property("ADBE Root Vectors Group").property("statuette").property("ADBE Vectors Group").property("Path 1").property("ADBE Vector Shape").value; } catch (e2) {}
        if (!statPath) fail("Can't read the statuette path (S6_statuette_top > statuette_top > statuette > Path 1).");

        var tEnd = askNum("Morph END time, seconds (statuette fully formed):", Math.round(statL.inPoint * 100) / 100);
        var tStart = askNum("Morph START time, seconds:", Math.round((tEnd - 0.5) * 100) / 100);
        if (tStart >= tEnd) fail("Start must be before end.");

        var fd = c.frameDuration;

        // ---------- 1. one mask per frame ----------
        function area(s) {
            var v = s.vertices, a = 0, k, n = v.length;
            for (k = 0; k < n; k++) { var p = v[k], q = v[(k + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; }
            return Math.abs(a / 2);
        }
        function keyedAt(pr, t) {
            if (pr.numKeys === 0) return true;
            var k = pr.nearestKeyIndex(t);
            return Math.abs(pr.keyTime(k) - t) < fd / 2;
        }

        var times = [], shapes = [], suspicious = [];
        var nFrames = Math.floor((tStart - L.inPoint) / fd + 0.0001);
        for (j = 0; j <= nFrames; j++) {
            var t = L.inPoint + j * fd, best = null, bestA = -1, secondA = 0;
            for (i = 1; i <= nM; i++) {
                var pr = masks.property(i).property("ADBE Mask Shape");
                if (!keyedAt(pr, t)) continue;
                var s = pr.valueAtTime(t, false), a = area(s);
                if (a > bestA) { secondA = bestA; bestA = a; best = s; }
                else if (a > secondA) secondA = a;
            }
            if (!best) continue;
            times.push(t); shapes.push(best);
            if (secondA > bestA * 0.15) suspicious.push(t.toFixed(2) + "s");
        }
        if (!times.length) fail("No traced frames found before " + tStart + " s.");

        var eagle = masks.addProperty("ADBE Mask Atom");
        eagle.name = "Eagle";
        eagle.maskMode = MaskMode.ADD;
        var ep = eagle.property("ADBE Mask Shape");
        ep.setValuesAtTimes(times, shapes);

        for (i = nM; i >= 1; i--) masks.property(i).remove();   // originals out, "Eagle" stays
        eagle = masks.property("Eagle");                          // references go stale after remove()
        ep = eagle.property("ADBE Mask Shape");

        // ---------- 2. morph into the statuette ----------
        function sample(s) {                // bezier outline -> dense polyline
            var v = s.vertices, ti = s.inTangents, to = s.outTangents, n = v.length, out = [], k, m;
            for (k = 0; k < n; k++) {
                var p0 = v[k], p3 = v[(k + 1) % n];
                var p1 = [p0[0] + to[k][0], p0[1] + to[k][1]];
                var p2 = [p3[0] + ti[(k + 1) % n][0], p3[1] + ti[(k + 1) % n][1]];
                for (m = 0; m < 12; m++) {
                    var u = m / 12, w = 1 - u;
                    out.push([w * w * w * p0[0] + 3 * w * w * u * p1[0] + 3 * w * u * u * p2[0] + u * u * u * p3[0],
                              w * w * w * p0[1] + 3 * w * w * u * p1[1] + 3 * w * u * u * p2[1] + u * u * u * p3[1]]);
                }
            }
            return out;
        }
        function resample(pts, count) {     // equal arc-length points along a closed polyline
            var n = pts.length, cum = [0], k, total;
            for (k = 1; k <= n; k++) { var a = pts[k - 1], b = pts[k % n]; cum.push(cum[k - 1] + Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]))); }
            total = cum[n];
            var out = [], seg = 0;
            for (k = 0; k < count; k++) {
                var d = total * k / count;
                while (seg < n - 1 && cum[seg + 1] < d) seg++;
                var a2 = pts[seg], b2 = pts[(seg + 1) % n], len = cum[seg + 1] - cum[seg], f = len > 0 ? (d - cum[seg]) / len : 0;
                out.push([a2[0] + (b2[0] - a2[0]) * f, a2[1] + (b2[1] - a2[1]) * f]);
            }
            return out;
        }
        function signedArea(p) { var a = 0, k, n = p.length; for (k = 0; k < n; k++) { var q = p[(k + 1) % n]; a += p[k][0] * q[1] - q[0] * p[k][1]; } return a; }
        function toShape(p) {
            var s = new Shape(), z = [], k;
            for (k = 0; k < p.length; k++) z.push([0, 0]);
            s.vertices = p; s.inTangents = z; s.outTangents = z.slice(0); s.closed = true;
            return s;
        }

        var A = resample(sample(ep.valueAtTime(tStart, false)), N);
        var raw = sample(statPath), k2;
        for (k2 = 0; k2 < raw.length; k2++) if (raw[k2][1] > CUT_Y) raw[k2][1] = CUT_Y;    // flat cut like the logo
        var B = resample(raw, N);
        if ((signedArea(A) > 0) !== (signedArea(B) > 0)) B.reverse();

        var bestShift = 0, bestCost = 1e30, sft;            // rotate B so points travel the shortest way
        for (sft = 0; sft < N; sft++) {
            var cost = 0;
            for (k2 = 0; k2 < N; k2++) { var b3 = B[(k2 + sft) % N]; cost += (A[k2][0] - b3[0]) * (A[k2][0] - b3[0]) + (A[k2][1] - b3[1]) * (A[k2][1] - b3[1]); }
            if (cost < bestCost) { bestCost = cost; bestShift = sft; }
        }
        var B2 = [];
        for (k2 = 0; k2 < N; k2++) B2.push(B[(k2 + bestShift) % N]);

        for (k2 = ep.numKeys; k2 >= 1; k2--) if (ep.keyTime(k2) >= tStart - fd / 2) ep.removeKey(k2);
        ep.setValueAtTime(tStart, toShape(A));
        ep.setValueAtTime(tEnd, toShape(B2));
        var ease = new KeyframeEase(0, 60);
        var k0 = ep.nearestKeyIndex(tStart), k1 = ep.nearestKeyIndex(tEnd);
        ep.setInterpolationTypeAtKey(k0, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        ep.setTemporalEaseAtKey(k0, [new KeyframeEase(0, 0.1)], [ease]);
        ep.setInterpolationTypeAtKey(k1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        ep.setTemporalEaseAtKey(k1, [ease], [ease]);

        log("Layer: " + L.name);
        log("Masks before: " + nM + "  ->  now 1 (\"Eagle\")");
        log("Frames rebuilt: " + times.length + "  (" + times[0].toFixed(2) + " - " + times[times.length - 1].toFixed(2) + " s)");
        log("Morph: " + tStart + " s  ->  " + tEnd + " s, " + N + " points, statuette cut at y=" + CUT_Y);
        if (suspicious.length) log("\nCheck these frames - a second big piece was dropped:\n  " + suspicious.join(", "));
    }

    // ------------------------------------------------------------------
    //  ЗАПУСК
    // ------------------------------------------------------------------
    app.beginUndoGroup(TASK_NAME);
    var err = null;
    try {
        task();
    } catch (e) {
        if (String(e.message || e).indexOf("__CANCEL__") === -1) err = e;
    } finally {
        app.endUndoGroup();
    }

    if (err) {
        alert(TASK_NAME + " — помилка:\n\n" + (err.message || err) +
              (err.line ? "\n(рядок " + err.line + ")" : "") +
              (_log.length ? "\n\n—— до помилки ——\n" + _log.join("\n") : ""));
    } else if (_log.length && !SILENT) {
        alert(TASK_NAME + "\n\n" + _log.join("\n"));
    }

})();
