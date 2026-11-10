// eagle_trace_morph.jsx
// Panel for an Auto-traced silhouette layer:
//   1. Clean masks - keep ONE mask ("Eagle") that takes, on every frame, the biggest
//      traced mask keyed on that frame; the original masks are removed.
//   2. Morph       - morph that mask point-by-point into a target outline
//      (shape layer, or a precomp holding a shape layer, e.g. S6_statuette_top).
// Frames are entered in comp display frames. Works docked (ScriptUI Panels) or as a window.

(function (thisObj) {

    var SCRIPT_NAME = "Eagle Trace Morph";

    // ------------------------------------------------------------------ helpers
    function activeComp() {
        var c = app.project.activeItem;
        return (c && c instanceof CompItem) ? c : null;
    }
    function fps(c) { return Math.round(1 / c.frameDuration * 1000) / 1000; }
    function frameToTime(c, f) { return f * c.frameDuration - c.displayStartTime; }
    function timeToFrame(c, t) { return Math.round((t + c.displayStartTime) / c.frameDuration); }

    function masksOf(layer) {
        var m = null;
        try { m = layer.property("ADBE Mask Parade"); } catch (e) {}
        return m;
    }

    // first vector path found in a shape layer (depth-first), or null
    function firstPath(group) {
        var i, p;
        for (i = 1; i <= group.numProperties; i++) {
            p = group.property(i);
            if (p.matchName === "ADBE Vector Shape - Group") return p.property("ADBE Vector Shape");
            if (p.propertyType === PropertyType.INDEXED_GROUP || p.propertyType === PropertyType.NAMED_GROUP) {
                var r = firstPath(p);
                if (r) return r;
            }
        }
        return null;
    }

    // layer transform without rotation: (pt - anchor) * scale + position
    function xf(layer, pt, t) {
        var tr = layer.property("ADBE Transform Group");
        var a = tr.property("ADBE Anchor Point").valueAtTime(t, false);
        var s = tr.property("ADBE Scale").valueAtTime(t, false);
        var p = tr.property("ADBE Position").valueAtTime(t, false);
        return [(pt[0] - a[0]) * s[0] / 100 + p[0], (pt[1] - a[1]) * s[1] / 100 + p[1]];
    }
    function xfInv(layer, pt, t) {
        var tr = layer.property("ADBE Transform Group");
        var a = tr.property("ADBE Anchor Point").valueAtTime(t, false);
        var s = tr.property("ADBE Scale").valueAtTime(t, false);
        var p = tr.property("ADBE Position").valueAtTime(t, false);
        return [(pt[0] - p[0]) * 100 / s[0] + a[0], (pt[1] - p[1]) * 100 / s[1] + a[1]];
    }

    function area(s) {
        var v = s.vertices, a = 0, k, n = v.length;
        for (k = 0; k < n; k++) { var p = v[k], q = v[(k + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; }
        return Math.abs(a / 2);
    }

    function sampleShape(s) {               // bezier outline -> dense polyline
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

    function resample(pts, count) {         // equal arc-length points on a closed polyline
        var n = pts.length, cum = [0], k, total;
        for (k = 1; k <= n; k++) {
            var a = pts[k - 1], b = pts[k % n];
            cum.push(cum[k - 1] + Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1])));
        }
        total = cum[n];
        var out = [], seg = 0;
        for (k = 0; k < count; k++) {
            var d = total * k / count;
            while (seg < n - 1 && cum[seg + 1] < d) seg++;
            var a2 = pts[seg], b2 = pts[(seg + 1) % n], len = cum[seg + 1] - cum[seg];
            var f = (len > 0) ? (d - cum[seg]) / len : 0;
            out.push([a2[0] + (b2[0] - a2[0]) * f, a2[1] + (b2[1] - a2[1]) * f]);
        }
        return out;
    }

    function signedArea(p) {
        var a = 0, k, n = p.length;
        for (k = 0; k < n; k++) { var q = p[(k + 1) % n]; a += p[k][0] * q[1] - q[0] * p[k][1]; }
        return a;
    }

    function toShape(p) {
        var s = new Shape(), z = [], k;
        for (k = 0; k < p.length; k++) z.push([0, 0]);
        s.vertices = p; s.inTangents = z; s.outTangents = z.slice(0); s.closed = true;
        return s;
    }

    // ------------------------------------------------------------------ core
    function cleanMasks(c, L) {
        var masks = masksOf(L), nM = masks ? masks.numProperties : 0, i, j, k;
        if (nM < 2) return "Nothing to clean: the layer has " + nM + " mask(s).";
        var fd = c.frameDuration;

        // time span covered by mask keys
        var tFirst = 1e9, tLast = -1e9;
        for (i = 1; i <= nM; i++) {
            var pr0 = masks.property(i).property("ADBE Mask Shape");
            if (pr0.numKeys) {
                if (pr0.keyTime(1) < tFirst) tFirst = pr0.keyTime(1);
                if (pr0.keyTime(pr0.numKeys) > tLast) tLast = pr0.keyTime(pr0.numKeys);
            }
        }
        if (tLast < tFirst) return "The masks have no keyframes.";

        function keyedAt(pr, t) {
            if (pr.numKeys === 0) return true;
            k = pr.nearestKeyIndex(t);
            return Math.abs(pr.keyTime(k) - t) < fd / 2;
        }

        var times = [], shapes = [], suspicious = [];
        var nFrames = Math.round((tLast - tFirst) / fd);
        for (j = 0; j <= nFrames; j++) {
            var t = tFirst + j * fd, best = null, bestA = -1, secondA = 0;
            for (i = 1; i <= nM; i++) {
                var pr = masks.property(i).property("ADBE Mask Shape");
                if (!keyedAt(pr, t)) continue;
                var s = pr.valueAtTime(t, false), a = area(s);
                if (a > bestA) { secondA = bestA; bestA = a; best = s; }
                else if (a > secondA) { secondA = a; }
            }
            if (!best) continue;
            times.push(t); shapes.push(best);
            if (secondA > bestA * 0.15) suspicious.push(timeToFrame(c, t));
        }
        if (!times.length) return "No traced frames found.";

        var eagle = masks.addProperty("ADBE Mask Atom");
        eagle.name = "Eagle";
        eagle.maskMode = MaskMode.ADD;
        eagle.property("ADBE Mask Shape").setValuesAtTimes(times, shapes);
        for (i = nM; i >= 1; i--) masks.property(i).remove();

        var msg = "Masks: " + nM + " -> 1 (\"Eagle\"), " + times.length + " frames ("
                + timeToFrame(c, times[0]) + "-" + timeToFrame(c, times[times.length - 1]) + ").";
        if (suspicious.length) msg += "\nCheck frames (a second big piece was dropped): " + suspicious.join(", ");
        return msg;
    }

    function targetPath(c, T) {             // target outline in COMP space, sampled
        var t = c.time, pts = null, shapeLayer = null, outer = null;
        if (T instanceof ShapeLayer) {
            shapeLayer = T;
        } else {
            var src = null;
            try { src = T.source; } catch (e) {}
            if (src && src instanceof CompItem) {
                for (var i = 1; i <= src.numLayers; i++) if (src.layer(i) instanceof ShapeLayer && src.layer(i).enabled) { shapeLayer = src.layer(i); break; }
                outer = T;
            }
        }
        if (!shapeLayer) return null;
        var path = firstPath(shapeLayer.property("ADBE Root Vectors Group"));
        if (!path) return null;
        pts = sampleShape(path.value);
        for (var k = 0; k < pts.length; k++) {
            pts[k] = xf(shapeLayer, pts[k], outer ? 0 : t);
            if (outer) pts[k] = xf(outer, pts[k], t);
        }
        return pts;
    }

    function morph(c, L, T, fStart, fEnd, nPts, cutY) {
        var masks = masksOf(L);
        if (!masks || !masks.numProperties) return "The trace layer has no masks.";
        if (masks.numProperties > 1) return "The trace layer has " + masks.numProperties + " masks - run Clean masks first.";
        var tStart = frameToTime(c, fStart), tEnd = frameToTime(c, fEnd), fd = c.frameDuration, k;
        if (tStart >= tEnd) return "Start frame must be before end frame.";

        var ep = masks.property(1).property("ADBE Mask Shape");
        var raw = targetPath(c, T);
        if (!raw) return "No vector path found in the target layer.";

        // target -> trace layer space, flat cut at cutY (comp space)
        for (k = 0; k < raw.length; k++) {
            if (cutY !== null && raw[k][1] > cutY) raw[k][1] = cutY;
            raw[k] = xfInv(L, raw[k], tEnd);
        }

        var A = resample(sampleShape(ep.valueAtTime(tStart, false)), nPts);
        var B = resample(raw, nPts);
        if ((signedArea(A) > 0) !== (signedArea(B) > 0)) B.reverse();

        var bestShift = 0, bestCost = 1e30, sft;
        for (sft = 0; sft < nPts; sft++) {
            var cost = 0;
            for (k = 0; k < nPts; k++) {
                var b = B[(k + sft) % nPts];
                cost += (A[k][0] - b[0]) * (A[k][0] - b[0]) + (A[k][1] - b[1]) * (A[k][1] - b[1]);
            }
            if (cost < bestCost) { bestCost = cost; bestShift = sft; }
        }
        var B2 = [];
        for (k = 0; k < nPts; k++) B2.push(B[(k + bestShift) % nPts]);

        for (k = ep.numKeys; k >= 1; k--) if (ep.keyTime(k) >= tStart - fd / 2) ep.removeKey(k);
        ep.setValueAtTime(tStart, toShape(A));
        ep.setValueAtTime(tEnd, toShape(B2));

        var ease = new KeyframeEase(0, 60);
        var k0 = ep.nearestKeyIndex(tStart), k1 = ep.nearestKeyIndex(tEnd);
        ep.setInterpolationTypeAtKey(k0, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        ep.setTemporalEaseAtKey(k0, [new KeyframeEase(0, 0.1)], [ease]);
        ep.setInterpolationTypeAtKey(k1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        ep.setTemporalEaseAtKey(k1, [ease], [ease]);

        return "Morph: frame " + fStart + " -> " + fEnd + " (" + (fEnd - fStart) + " frames), " + nPts + " points"
             + (cutY !== null ? ", cut at y=" + cutY : "") + ". Keys after frame " + fStart + " were replaced.";
    }

    // ------------------------------------------------------------------ cut wings
    // A wing cut by the edge of the source clip shows up in the trace as a long,
    // straight, axis-aligned edge. Each such edge is replaced by a feathered tip
    // that continues the outline outward (away from the shape's centre).
    // The clip edge is always an EXTREME of the outline (its top, bottom, left or right):
    // several vertices sit on one axis-aligned line there, with finger gaps in between.
    // The whole run of outline between the first and the last vertex on that line is
    // replaced by one feathered tip that grows outward from the line.
    function rebuildShape(s, opt, compW, compH) {
        var v = s.vertices, ti = s.inTangents, to = s.outTangents, n = v.length, k, j;
        if (n < 4) return null;
        var TOL = 1.6;

        var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, cx = 0, cy = 0;
        for (k = 0; k < n; k++) {
            var x = v[k][0], y = v[k][1];
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            cx += x; cy += y;
        }
        cx /= n; cy /= n;

        // candidate cut lines: [axis (0=x,1=y), value]
        var lines = [[1, minY], [1, maxY], [0, minX], [0, maxX]], cuts = [];
        for (var li = 0; li < lines.length; li++) {
            var ax = lines[li][0], val = lines[li][1], other = 1 - ax;
            if (opt.skipCompEdge) {
                var lim = ax === 1 ? compH : compW;
                if (val < 3 || val > lim - 3) continue;            // on the comp border = entering the frame
            }
            var on = [], lo = 1e9, hi = -1e9;
            for (k = 0; k < n; k++) if (Math.abs(v[k][ax] - val) <= TOL) {
                on.push(k);
                if (v[k][other] < lo) lo = v[k][other];
                if (v[k][other] > hi) hi = v[k][other];
            }
            if (on.length < 2 || hi - lo < opt.minCut) continue;
            // the run starts after the biggest index gap between on-line vertices (cyclic)
            var gapAt = 0, gapLen = -1, g;
            for (g = 0; g < on.length; g++) {
                var a = on[g], b = on[(g + 1) % on.length];
                var len = (b - a + n) % n; if (on.length === 1) len = n;
                if (len > gapLen) { gapLen = len; gapAt = g; }
            }
            var start = on[(gapAt + 1) % on.length], end = on[gapAt];
            cuts.push({ start: start, end: end, ax: ax, val: val });
        }
        if (!cuts.length) return null;

        function unit(x, y) { var l = Math.sqrt(x * x + y * y) || 1; return [x / l, y / l]; }
        function rot(d, deg) { var r = deg * Math.PI / 180, c = Math.cos(r), s2 = Math.sin(r); return [d[0] * c - d[1] * s2, d[0] * s2 + d[1] * c]; }

        // For every cut: wing direction from the two sides of the wing next to the cut,
        // then every piece of outline lying ON the cut line (a cut feather) gets its own
        // feather tip. Gaps between the original feathers stay as they are.
        var fingerAt = {};                       // vertex index -> finger spec for segment k -> k+1
        for (var ci = 0; ci < cuts.length; ci++) {
            var cu = cuts[ci], m = 8;
            var sA = v[(cu.start - m + n) % n], sB = v[(cu.end + m) % n];
            var dA = unit(v[cu.start][0] - sA[0], v[cu.start][1] - sA[1]);
            var dB = unit(v[cu.end][0] - sB[0], v[cu.end][1] - sB[1]);
            var d = unit(dA[0] + dB[0], dA[1] + dB[1]);
            var outN = cu.ax === 1 ? [0, (cu.val < cy) ? -1 : 1] : [(cu.val < cx) ? -1 : 1, 0];
            if (d[0] * outN[0] + d[1] * outN[1] < 0.35) d = unit(d[0] + outN[0], d[1] + outN[1]);   // keep it outward

            var P = v[cu.start], Q = v[cu.end], other2 = 1 - cu.ax;
            var runLo = Math.min(P[other2], Q[other2]), runHi = Math.max(P[other2], Q[other2]), runW = Math.max(1, runHi - runLo);
            var Lt = runW * opt.tipLen;
            for (k = cu.start; k !== cu.end; k = (k + 1) % n) {
                var a2 = v[k], b2 = v[(k + 1) % n];
                if (Math.abs(a2[cu.ax] - cu.val) > TOL || Math.abs(b2[cu.ax] - cu.val) > TOL) continue;   // dips between feathers
                fingerAt[k] = { d: d, Lt: Lt, runLo: runLo, runW: runW, other: other2 };
            }
        }

        var nv = [], nin = [], nout = [];
        for (k = 0; k < n; k++) {
            var fs = fingerAt[k], kn = (k + 1) % n;
            nv.push(v[k]); nin.push(fingerAt[(k - 1 + n) % n] ? [0, 0] : ti[k]); nout.push(fs ? [0, 0] : to[k]);
            if (!fs) continue;

            var A = v[k], B = v[kn], segL = Math.sqrt((B[0] - A[0]) * (B[0] - A[0]) + (B[1] - A[1]) * (B[1] - A[1]));
            var parts = Math.max(1, Math.round(segL / opt.fingerW));
            for (j = 0; j < parts; j++) {
                var u0 = j / parts, u1 = (j + 1) / parts;
                var a0 = [A[0] + (B[0] - A[0]) * u0, A[1] + (B[1] - A[1]) * u0];
                var a1 = [A[0] + (B[0] - A[0]) * u1, A[1] + (B[1] - A[1]) * u1];
                var mid = [(a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2];
                var pos = (mid[fs.other] - fs.runLo) / fs.runW;                    // 0..1 across the whole cut
                var dir = rot(fs.d, (pos - 0.5) * 18);                             // a slight fan
                var len = fs.Lt * (0.7 + 0.3 * Math.sin(Math.PI * Math.min(1, Math.max(0, pos))));
                var apex = [mid[0] + dir[0] * len, mid[1] + dir[1] * len];
                // feather: keeps most of its width, then a rounded point
                var shL = [a0[0] + (apex[0] - mid[0]) * 0.72, a0[1] + (apex[1] - mid[1]) * 0.72];
                var shR = [a1[0] + (apex[0] - mid[0]) * 0.72, a1[1] + (apex[1] - mid[1]) * 0.72];
                var rdL = [shL[0] + (apex[0] - shL[0]) * 0.6, shL[1] + (apex[1] - shL[1]) * 0.6];
                var rdR = [shR[0] + (apex[0] - shR[0]) * 0.6, shR[1] + (apex[1] - shR[1]) * 0.6];
                rdL = [rdL[0] + dir[0] * len * 0.04, rdL[1] + dir[1] * len * 0.04];
                rdR = [rdR[0] + dir[0] * len * 0.04, rdR[1] + dir[1] * len * 0.04];
                // a little narrower than the cut so neighbours keep a gap
                var inset = 0.12;
                shL = [shL[0] + (shR[0] - shL[0]) * inset, shL[1] + (shR[1] - shL[1]) * inset];
                shR = [shR[0] + (shL[0] - shR[0]) * inset, shR[1] + (shL[1] - shR[1]) * inset];
                if (j > 0) { nv.push(a0); nin.push([0, 0]); nout.push([0, 0]); }    // notch between split feathers
                nv.push(shL); nin.push([0, 0]); nout.push([0, 0]);
                nv.push(rdL); nin.push([0, 0]); nout.push([0, 0]);
                nv.push(apex); nin.push([0, 0]); nout.push([0, 0]);
                nv.push(rdR); nin.push([0, 0]); nout.push([0, 0]);
                nv.push(shR); nin.push([0, 0]); nout.push([0, 0]);
            }
        }

        var out = new Shape();
        out.vertices = nv; out.inTangents = nin; out.outTangents = nout; out.closed = s.closed;
        return { shape: out, cuts: cuts.length };
    }

    function rebuildCutWings(c, L, fFrom, fTo, opt) {
        var masks = masksOf(L), nM = masks ? masks.numProperties : 0, i, f;
        if (!nM) return "The trace layer has no masks.";
        if (fFrom > fTo) { var tmp = fFrom; fFrom = fTo; fTo = tmp; }
        var fd = c.frameDuration, frames = [], cutsTotal = 0;

        for (f = fFrom; f <= fTo; f++) {
            var t = frameToTime(c, f), touched = false;
            for (i = 1; i <= nM; i++) {
                var pr = masks.property(i).property("ADBE Mask Shape");
                if (pr.numKeys) {
                    var kk = pr.nearestKeyIndex(t);
                    if (Math.abs(pr.keyTime(kk) - t) >= fd / 2) continue;   // not traced on this frame
                }
                var r = rebuildShape(pr.valueAtTime(t, false), opt, c.width, c.height);
                if (!r) continue;
                pr.setValueAtTime(t, r.shape);
                cutsTotal += r.cuts; touched = true;
            }
            if (touched) frames.push(f);
        }
        if (!frames.length) return "No cut edges found in frames " + fFrom + "-" + fTo + " (try a smaller Min cut).";
        return "Cut wings rebuilt: " + cutsTotal + " edge(s) on " + frames.length + " frame(s): " + frames.join(", ");
    }

    // ------------------------------------------------------------------ UI
    var win = (thisObj instanceof Panel) ? thisObj
            : new Window("palette", SCRIPT_NAME, undefined, { resizeable: true });
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 8; win.margins = 10;

    var pLayers = win.add("panel", undefined, "Layers");
    pLayers.alignChildren = ["fill", "top"]; pLayers.margins = [10, 14, 10, 10];
    var gTrace = pLayers.add("group"); gTrace.add("statictext", undefined, "Trace:").preferredSize.width = 52;
    var ddTrace = gTrace.add("dropdownlist"); ddTrace.alignment = ["fill", "center"];
    ddTrace.helpTip = "Layer with the Auto-trace masks";
    var gTarget = pLayers.add("group"); gTarget.add("statictext", undefined, "Target:").preferredSize.width = 52;
    var ddTarget = gTarget.add("dropdownlist"); ddTarget.alignment = ["fill", "center"];
    ddTarget.helpTip = "Shape layer, or a precomp with a shape layer, whose outline is the morph target";
    var btnRefresh = pLayers.add("button", undefined, "Refresh from active comp");

    var pMorph = win.add("panel", undefined, "Morph");
    pMorph.alignChildren = ["fill", "top"]; pMorph.margins = [10, 14, 10, 10];
    function frameRow(label, tip) {
        var g = pMorph.add("group");
        g.add("statictext", undefined, label).preferredSize.width = 70;
        var e = g.add("edittext", undefined, "0"); e.characters = 6; e.helpTip = tip;
        var b = g.add("button", undefined, "Current frame"); b.helpTip = "Take the current time indicator";
        return { edit: e, btn: b };
    }
    var rStart = frameRow("Start frame:", "Frame where the morph begins (comp display frames)");
    var rEnd = frameRow("End frame:", "Frame where the target shape is fully formed");
    var gOpt = pMorph.add("group");
    gOpt.add("statictext", undefined, "Points:").preferredSize.width = 70;
    var ePts = gOpt.add("edittext", undefined, "160"); ePts.characters = 5;
    ePts.helpTip = "Points used for the morph; more = smoother outline";
    var chkCut = gOpt.add("checkbox", undefined, "Cut at Y:"); chkCut.value = true;
    chkCut.helpTip = "Flatten the target below this comp Y (the statuette is shown only above 575)";
    var eCut = gOpt.add("edittext", undefined, "575"); eCut.characters = 5;
    var stInfo = pMorph.add("statictext", undefined, " ", { multiline: false });

    var pCut = win.add("panel", undefined, "Cut wings");
    pCut.alignChildren = ["fill", "top"]; pCut.margins = [10, 14, 10, 10];
    function cutRow(label, tip) {
        var g = pCut.add("group");
        g.add("statictext", undefined, label).preferredSize.width = 70;
        var e = g.add("edittext", undefined, "0"); e.characters = 6; e.helpTip = tip;
        var b = g.add("button", undefined, "Current frame"); b.helpTip = "Take the current time indicator";
        return { edit: e, btn: b };
    }
    var rFrom = cutRow("From frame:", "First frame to repair (comp display frames)");
    var rTo = cutRow("To frame:", "Last frame to repair");
    rFrom.edit.text = "40"; rTo.edit.text = "64";
    var gCutOpt = pCut.add("group");
    gCutOpt.add("statictext", undefined, "Tip length %:");
    var eTip = gCutOpt.add("edittext", undefined, "80"); eTip.characters = 4;
    eTip.helpTip = "How far the feathers reach past the cut, in % of the cut width";
    gCutOpt.add("statictext", undefined, "Feather px:");
    var eFing = gCutOpt.add("edittext", undefined, "28"); eFing.characters = 3;
    eFing.helpTip = "Width of one feather; a wide straight cut is split into feathers of this width";
    var gCutOpt2 = pCut.add("group");
    gCutOpt2.add("statictext", undefined, "Min cut px:");
    var eMin = gCutOpt2.add("edittext", undefined, "20"); eMin.characters = 4;
    eMin.helpTip = "Straight edges shorter than this are not treated as cuts";
    var chkEdge = gCutOpt2.add("checkbox", undefined, "Skip comp border"); chkEdge.value = true;
    chkEdge.helpTip = "Do not touch edges lying on the comp border (the eagle entering the frame)";
    var btnCut = pCut.add("button", undefined, "3. Rebuild cut wings");
    btnCut.helpTip = "Replace straight cut edges with a feathered wing tip on every frame of the range";

    var gBtns = win.add("group"); gBtns.alignChildren = ["fill", "center"];
    var btnClean = gBtns.add("button", undefined, "1. Clean masks");
    btnClean.helpTip = "Keep one mask per frame (the biggest) and remove the rest";
    var btnMorph = gBtns.add("button", undefined, "2. Morph");
    btnMorph.helpTip = "Morph the single mask into the target outline between the two frames";
    var btnBoth = win.add("button", undefined, "Clean + Morph");

    var stStatus = win.add("statictext", undefined, "Open the comp and press Refresh.", { multiline: true });
    stStatus.preferredSize.height = 70;

    var layerRefs = [];

    function refresh() {
        var c = activeComp();
        ddTrace.removeAll(); ddTarget.removeAll(); layerRefs = [];
        if (!c) { stStatus.text = "Open a composition first."; return; }
        var traceIdx = -1, targetIdx = -1, i, L, src;
        for (i = 1; i <= c.numLayers; i++) {
            L = c.layer(i);
            layerRefs.push(L);
            var m = masksOf(L), nm = m ? m.numProperties : 0;
            ddTrace.add("item", i + ". " + L.name + (nm ? "  [" + nm + " masks]" : ""));
            ddTarget.add("item", i + ". " + L.name);
            if (traceIdx < 0 && L.name.indexOf("Auto-traced") === 0) traceIdx = i - 1;
            src = null; try { src = L.source; } catch (e) {}
            if (targetIdx < 0 && src && src instanceof CompItem && src.name.indexOf("statuette") !== -1) targetIdx = i - 1;
        }
        if (traceIdx < 0 && c.selectedLayers.length) traceIdx = c.selectedLayers[0].index - 1;
        ddTrace.selection = traceIdx >= 0 ? traceIdx : 0;
        if (targetIdx >= 0) {
            ddTarget.selection = targetIdx;
            var fEnd = timeToFrame(c, layerRefs[targetIdx].inPoint);
            rEnd.edit.text = String(fEnd);
            rStart.edit.text = String(Math.max(0, fEnd - Math.round(0.5 * fps(c))));
        } else {
            ddTarget.selection = 0;
        }
        stInfo.text = c.name + "  |  " + fps(c) + " fps";
        stStatus.text = "Ready.";
    }

    function pick() {
        var c = activeComp();
        if (!c) throw new Error("Open a composition first.");
        if (!ddTrace.selection || !ddTarget.selection) throw new Error("Press Refresh and pick the layers.");
        var L = layerRefs[ddTrace.selection.index], T = layerRefs[ddTarget.selection.index];
        if (!L || !T) throw new Error("Layer list is out of date - press Refresh.");
        if (L === T) throw new Error("Trace and target must be different layers.");
        return { c: c, L: L, T: T };
    }

    function run(doClean, doMorph) {
        var out = [], sel, err = null;
        try { sel = pick(); } catch (e0) { stStatus.text = e0.message; return; }
        var fS = parseInt(rStart.edit.text, 10), fE = parseInt(rEnd.edit.text, 10), nP = parseInt(ePts.text, 10);
        var cut = chkCut.value ? parseFloat(eCut.text.replace(",", ".")) : null;
        if (doMorph && (isNaN(fS) || isNaN(fE))) { stStatus.text = "Enter start and end frames."; return; }
        if (isNaN(nP) || nP < 16) nP = 160;
        if (cut !== null && isNaN(cut)) cut = null;

        app.beginUndoGroup(SCRIPT_NAME);
        try {
            if (doClean) out.push(cleanMasks(sel.c, sel.L));
            if (doMorph) out.push(morph(sel.c, sel.L, sel.T, fS, fE, nP, cut));
        } catch (e) {
            err = e;
        } finally {
            app.endUndoGroup();
        }
        stStatus.text = err ? ("Error: " + (err.message || err) + (err.line ? " (line " + err.line + ")" : "")) : out.join("\n");
        refreshTraceLabel(sel);
    }

    function refreshTraceLabel(sel) {
        try {
            var m = masksOf(sel.L), it = ddTrace.items[ddTrace.selection.index];
            it.text = sel.L.index + ". " + sel.L.name + "  [" + m.numProperties + " masks]";
        } catch (e) {}
    }

    function setFromCTI(edit) {
        var c = activeComp();
        if (c) edit.text = String(timeToFrame(c, c.time));
    }

    function runCut() {
        var sel, err = null, msg = "";
        try { sel = pick(); } catch (e0) { stStatus.text = e0.message; return; }
        var fA = parseInt(rFrom.edit.text, 10), fB = parseInt(rTo.edit.text, 10);
        if (isNaN(fA) || isNaN(fB)) { stStatus.text = "Enter the frame range."; return; }
        var tip = parseFloat(eTip.text.replace(",", ".")), fing = parseInt(eFing.text, 10), mc = parseFloat(eMin.text.replace(",", "."));
        var opt = {
            tipLen: (isNaN(tip) ? 80 : tip) / 100,
            fingerW: (isNaN(fing) || fing < 4) ? 28 : fing,
            minCut: (isNaN(mc) || mc < 2) ? 20 : mc,
            skipCompEdge: chkEdge.value
        };
        app.beginUndoGroup(SCRIPT_NAME + " - cut wings");
        try { msg = rebuildCutWings(sel.c, sel.L, fA, fB, opt); }
        catch (e) { err = e; }
        finally { app.endUndoGroup(); }
        stStatus.text = err ? ("Error: " + (err.message || err) + (err.line ? " (line " + err.line + ")" : "")) : msg;
    }

    btnRefresh.onClick = refresh;
    rFrom.btn.onClick = function () { setFromCTI(rFrom.edit); };
    rTo.btn.onClick = function () { setFromCTI(rTo.edit); };
    btnCut.onClick = runCut;
    rStart.btn.onClick = function () { setFromCTI(rStart.edit); };
    rEnd.btn.onClick = function () { setFromCTI(rEnd.edit); };
    chkCut.onClick = function () { eCut.enabled = chkCut.value; };
    btnClean.onClick = function () { run(true, false); };
    btnMorph.onClick = function () { run(false, true); };
    btnBoth.onClick = function () { run(true, true); };

    refresh();
    win.onResizing = win.onResize = function () { this.layout.resize(); };
    if (win instanceof Window) { win.center(); win.show(); } else { win.layout.layout(true); }

})(this);
