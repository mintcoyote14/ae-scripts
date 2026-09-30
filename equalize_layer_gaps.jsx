/*
  Equalize Layer Gaps  —  AE ExtendScript

  Takes the SELECTED layers in the timeline, groups them into "blocks" and moves
  whole blocks via layer.startTime - in/out, trims and keyframes travel with the layer.
  Inside a block the relative positions stay untouched.
  Layers that are not selected never move.

  GROUPING (how layers form blocks and in which order they go in time):
    "By stack, N layers"  - blocks follow the layer order in the timeline, ignoring time.
                               This is for the case where pairs sit ON TOP of each other at
                               the very same time and have to be spread into a staircase.
                               The direction says which one goes first in time:
                                 bottom layer - staircase up and to the right,
                                 top layer    - the other way round.
    "Auto by time"         - layers that overlap or have a gap of
                               <= "Gap inside block" count as one block.
                               Set -1 if blocks sit flush and get merged into one.
    "By time, N layers"   - layers are sorted by inPoint and cut every N.

  ACTIONS:
    "One after another"  - blocks packed in sequence with a gap of N frames (0 = flush).
                       Only the FIRST block stays put, the rest are pulled up to it.
                       This is what turns a stack into a staircase.
    "Equal gaps"    - the same gap between the end of a block and the start of the next.
                       The first and the last block stay put.
    "Equal starts"   - the same distance between block STARTS.
                       The first and the last block stay put.
    The last two only work when the blocks are already in ascending time order.

  No #targetengine - otherwise it will not run via $.evalFile from ScriptLauncherPanel.
*/

(function (thisObj) {

    var TOOL_NAME = "Equalize Layer Gaps";
    var SETTINGS_SECTION = "EqualizeLayerGaps";

    // ---------------------------------------------------------------- utilities

    function getComp() {
        var c = app.project ? app.project.activeItem : null;
        return (c instanceof CompItem) ? c : null;
    }

    function toFrames(comp, t) {
        return Math.round(t / comp.frameDuration);
    }

    function snapToFrame(comp, t) {
        return Math.round(t / comp.frameDuration) * comp.frameDuration;
    }

    function num(str, fallback) {
        var v = parseFloat(str);
        return isNaN(v) ? fallback : v;
    }

    function shiftLayer(L, delta, failed) {
        var wasLocked = false;
        try {
            wasLocked = L.locked;
            if (wasLocked) L.locked = false;
            L.startTime = L.startTime + delta;
        } catch (e) {
            failed.push(L.name + " — " + e.toString());
            try { if (wasLocked) L.locked = true; } catch (e1) {}
            return false;
        }
        try { if (wasLocked) L.locked = true; } catch (e2) {}
        return true;
    }

    // ------------------------------------------------------------ grouping

    /*
       Returns { blocks: [...] } or { error: "..." }
       blocks[i] = { items: [{layer, inP, outP, idx}, ...], start, end, dur }
       The order of blocks is the order they will take in time.
    */
    function collectBlocks(comp, layers, opts) {
        var arr = [], i, j, k, cur;
        for (i = 0; i < layers.length; i++) {
            var L = layers[i];
            arr.push({ layer: L, inP: L.inPoint, outP: L.outPoint, idx: L.index });
        }

        if (opts.group === "stack") {
            // by layer order in the timeline; index 1 = topmost layer
            arr.sort(function (a, b) {
                return (opts.bottomFirst) ? (b.idx - a.idx) : (a.idx - b.idx);
            });
        } else {
            // by time; on equal starts - by timeline order
            arr.sort(function (a, b) {
                if (a.inP < b.inP) return -1;
                if (a.inP > b.inP) return 1;
                return a.idx - b.idx;
            });
        }

        var groups = [];

        if (opts.group === "auto") {
            cur = [arr[0]];
            var curEnd = arr[0].outP;
            for (j = 1; j < arr.length; j++) {
                var gapFr = toFrames(comp, arr[j].inP - curEnd);
                if (gapFr <= opts.innerGap) {       // overlap or a small gap -> same block
                    cur.push(arr[j]);
                    if (arr[j].outP > curEnd) curEnd = arr[j].outP;
                } else {
                    groups.push(cur);
                    cur = [arr[j]];
                    curEnd = arr[j].outP;
                }
            }
            groups.push(cur);
        } else {
            var n = opts.groupSize;
            if (n < 1) return { error: "Layers per block must be >= 1." };
            if (arr.length % n !== 0) {
                return { error: "Selected " + arr.length + " layers - not divisible into blocks of "
                              + n + ".\nChange the selection or switch to \"Auto by time\"." };
            }
            for (j = 0; j < arr.length; j += n) {
                cur = [];
                for (k = j; k < j + n; k++) cur.push(arr[k]);
                groups.push(cur);
            }
        }

        var blocks = [];
        for (j = 0; j < groups.length; j++) {
            var g = groups[j];
            var s = g[0].inP, e = g[0].outP;
            for (k = 1; k < g.length; k++) {
                if (g[k].inP < s) s = g[k].inP;
                if (g[k].outP > e) e = g[k].outP;
            }
            blocks.push({ items: g, start: s, end: e, dur: e - s });
        }
        return { blocks: blocks };
    }

    // blocks must run strictly ascending in time (for "Equal gaps" / "Equal starts")
    function isAscending(comp, blocks) {
        var half = comp.frameDuration * 0.5;
        for (var i = 1; i < blocks.length; i++) {
            if (blocks[i].start - blocks[i - 1].start <= half) return false;
        }
        return true;
    }

    function gapsReport(comp, blocks) {
        var out = [];
        for (var i = 1; i < blocks.length; i++) {
            out.push(toFrames(comp, blocks[i].start - blocks[i - 1].end));
        }
        return out.length ? out.join(", ") : "—";
    }

    function describe(comp, blocks) {
        var lines = [];
        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            var names = [];
            for (var k = 0; k < b.items.length; k++) names.push(b.items[k].layer.name);
            lines.push("  #" + (i + 1) + ": frames " + toFrames(comp, b.start) + "–"
                       + toFrames(comp, b.end) + "  [" + names.join(", ") + "]");
        }
        return lines.join("\n");
    }

    // ------------------------------------------------------------ main action

    function run(action, opts, statusFn) {
        var comp = getComp();
        if (!comp) { alert("Open or select a composition first."); return; }

        var sel = comp.selectedLayers;
        if (!sel || sel.length < 2) { alert("Select layers in the timeline."); return; }

        var res = collectBlocks(comp, sel, opts);
        if (res.error) { alert(res.error); return; }

        var blocks = res.blocks;
        var n = blocks.length;
        var i, k;

        if (action === "analyze") {
            statusFn("Blocks: " + n + " | gaps (frames): " + gapsReport(comp, blocks));
            alert("Blocks found: " + n + " (in the order they will sit in time)\n\n"
                  + describe(comp, blocks)
                  + "\n\nGaps between blocks (frames): " + gapsReport(comp, blocks));
            return;
        }

        var minBlocks = (action === "sequence") ? 2 : 3;
        if (n < minBlocks) {
            alert("Blocks found: " + n + ".\nThis mode needs at least "
                  + minBlocks + ".");
            return;
        }

        if (action !== "sequence" && !isAscending(comp, blocks)) {
            alert("Blocks are not in ascending time order (stacked or in a different "
                  + "order).\nPress \"One after another\" first.");
            return;
        }

        // ---- target positions of block starts
        var targets = [];
        if (action === "sequence") {
            var packGap = opts.packGap * comp.frameDuration;
            targets[0] = blocks[0].start;
            for (i = 1; i < n; i++) {
                targets[i] = targets[i - 1] + blocks[i - 1].dur + packGap;
            }
        } else if (action === "gaps") {
            var span = blocks[n - 1].end - blocks[0].start;
            var sumDur = 0;
            for (i = 0; i < n; i++) sumDur += blocks[i].dur;
            var gap = (span - sumDur) / (n - 1);
            var runPos = blocks[0].start;
            for (i = 0; i < n; i++) {
                targets[i] = runPos;
                runPos += blocks[i].dur + gap;
            }
            targets[0] = blocks[0].start;
            targets[n - 1] = blocks[n - 1].start;       // the outer ones stay exactly put
        } else { // "starts"
            var pitch = (blocks[n - 1].start - blocks[0].start) / (n - 1);
            for (i = 0; i < n; i++) targets[i] = blocks[0].start + i * pitch;
            targets[0] = blocks[0].start;
            targets[n - 1] = blocks[n - 1].start;
        }

        // ---- deltas per block
        var eps = comp.frameDuration * 0.25;
        var deltas = [];
        for (i = 0; i < n; i++) {
            var want = opts.snap ? snapToFrame(comp, targets[i]) : targets[i];
            var d = want - blocks[i].start;
            deltas[i] = (Math.abs(d) < eps) ? 0 : d;
        }

        // ---- applying
        var moved = 0, failed = [];

        app.beginUndoGroup(TOOL_NAME + " — " + (action === "sequence" ? "One after another"
                                             : action === "gaps" ? "Equal gaps"
                                             : "Equal starts"));
        try {
            for (i = 0; i < n; i++) {
                if (deltas[i] === 0) continue;
                var items = blocks[i].items;
                for (k = 0; k < items.length; k++) {
                    if (shiftLayer(items[k].layer, deltas[i], failed)) moved++;
                }
                blocks[i].start += deltas[i];
                blocks[i].end += deltas[i];
            }
        } catch (e) {
            alert("Error (line " + e.line + "): " + e.toString());
        } finally {
            app.endUndoGroup();
        }

        statusFn("Blocks: " + n + " | layers moved: " + moved
                 + " | gaps (frames): " + gapsReport(comp, blocks));

        if (failed.length) alert("Could not move:\n" + failed.join("\n"));
    }

    // ------------------------------------------------------------------- UI

    function buildUI(thisObj) {
        var pal = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", TOOL_NAME, undefined, { resizeable: true });

        pal.orientation = "column";
        pal.alignChildren = ["fill", "top"];
        pal.spacing = 8;
        pal.margins = 12;

        // --- grouping
        var gp = pal.add("panel", undefined, "How to build blocks");
        gp.orientation = "column";
        gp.alignChildren = ["left", "top"];
        gp.spacing = 5;
        gp.margins = [12, 14, 12, 10];

        var rStack = gp.add("radiobutton", undefined, "By stack - N layers each, ignoring time");
        var rowStack = gp.add("group");
        rowStack.margins = [18, 0, 0, 0];
        rowStack.add("statictext", undefined, "Layers per block:");
        var etSize = rowStack.add("edittext", undefined, "2");
        etSize.characters = 3;
        rowStack.add("statictext", undefined, "  First in time:");
        var ddDir = rowStack.add("dropdownlist", undefined, ["bottom layer", "top layer"]);
        ddDir.selection = 0;

        var rAuto = gp.add("radiobutton", undefined, "Auto by time - whatever sits together is a block");
        var rowAuto = gp.add("group");
        rowAuto.margins = [18, 0, 0, 0];
        rowAuto.add("statictext", undefined, "Gap inside block, frames:");
        var etInner = rowAuto.add("edittext", undefined, "0");
        etInner.characters = 4;

        var rTime = gp.add("radiobutton", undefined, "By time - N layers each (sorted by inPoint)");

        // --- actions
        var ap = pal.add("panel", undefined, "Lay out blocks");
        ap.orientation = "column";
        ap.alignChildren = ["fill", "top"];
        ap.spacing = 6;
        ap.margins = [12, 14, 12, 10];

        var bSeq = ap.add("button", undefined, "One after another");
        var rowSeq = ap.add("group");
        rowSeq.margins = [4, 0, 0, 0];
        rowSeq.add("statictext", undefined, "Gap between blocks, frames:");
        var etPack = rowSeq.add("edittext", undefined, "0");
        etPack.characters = 4;

        var bGaps   = ap.add("button", undefined, "Equal gaps between blocks");
        var bStarts = ap.add("button", undefined, "Equal distance between starts");

        var cbSnap = pal.add("checkbox", undefined, "Snap to frames");
        cbSnap.value = true;

        var bInfo = pal.add("button", undefined, "Analyse (move nothing)");

        var st = pal.add("statictext", undefined, "Select layers and press a button.",
                         { truncate: "middle" });
        st.alignment = ["fill", "top"];

        function setStatus(s) { st.text = s; }

        function loadSettings() {
            try {
                var g = app.settings.haveSetting(SETTINGS_SECTION, "group")
                      ? app.settings.getSetting(SETTINGS_SECTION, "group") : "stack";
                rStack.value = (g === "stack");
                rAuto.value  = (g === "auto");
                rTime.value  = (g === "time");
                if (!rStack.value && !rAuto.value && !rTime.value) rStack.value = true;

                if (app.settings.haveSetting(SETTINGS_SECTION, "groupSize"))
                    etSize.text = app.settings.getSetting(SETTINGS_SECTION, "groupSize");
                if (app.settings.haveSetting(SETTINGS_SECTION, "innerGap"))
                    etInner.text = app.settings.getSetting(SETTINGS_SECTION, "innerGap");
                if (app.settings.haveSetting(SETTINGS_SECTION, "packGap"))
                    etPack.text = app.settings.getSetting(SETTINGS_SECTION, "packGap");
                if (app.settings.haveSetting(SETTINGS_SECTION, "bottomFirst"))
                    ddDir.selection = (app.settings.getSetting(SETTINGS_SECTION, "bottomFirst") === "0") ? 1 : 0;
                if (app.settings.haveSetting(SETTINGS_SECTION, "snap"))
                    cbSnap.value = (app.settings.getSetting(SETTINGS_SECTION, "snap") === "1");
            } catch (e) { rStack.value = true; }
        }

        function readOpts() {
            var o = {
                group: rStack.value ? "stack" : (rAuto.value ? "auto" : "time"),
                groupSize: Math.round(num(etSize.text, 2)),
                innerGap: Math.round(num(etInner.text, 0)),
                packGap: Math.round(num(etPack.text, 0)),
                bottomFirst: !(ddDir.selection && ddDir.selection.index === 1),
                snap: cbSnap.value
            };
            try {
                app.settings.saveSetting(SETTINGS_SECTION, "group", o.group);
                app.settings.saveSetting(SETTINGS_SECTION, "groupSize", String(o.groupSize));
                app.settings.saveSetting(SETTINGS_SECTION, "innerGap", String(o.innerGap));
                app.settings.saveSetting(SETTINGS_SECTION, "packGap", String(o.packGap));
                app.settings.saveSetting(SETTINGS_SECTION, "bottomFirst", o.bottomFirst ? "1" : "0");
                app.settings.saveSetting(SETTINGS_SECTION, "snap", o.snap ? "1" : "0");
            } catch (e) {}
            return o;
        }

        bSeq.onClick    = function () { run("sequence", readOpts(), setStatus); };
        bGaps.onClick   = function () { run("gaps",     readOpts(), setStatus); };
        bStarts.onClick = function () { run("starts",   readOpts(), setStatus); };
        bInfo.onClick   = function () { run("analyze",  readOpts(), setStatus); };

        loadSettings();

        pal.onResizing = pal.onResize = function () { this.layout.resize(); };

        return pal;
    }

    // drop the palette from a previous run so copies do not pile up
    try {
        if ($.global.__eqGapsPal) {
            $.global.__eqGapsPal.close();
            $.global.__eqGapsPal = null;
        }
    } catch (ePrev) {}

    var pal = buildUI(thisObj);
    if (pal instanceof Window) {
        $.global.__eqGapsPal = pal;
        pal.center();
        pal.show();
    } else {
        pal.layout.layout(true);
        pal.layout.resize();
    }

})(this);
