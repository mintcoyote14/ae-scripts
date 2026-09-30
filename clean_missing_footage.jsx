// clean_missing_footage.jsx
// =====================================================================
//   Cleaning up missing footage that affects nothing
// =====================================================================
//   AE complains about missing footage even when the file is used nowhere
//   or sits on a disabled layer. The script sorts all missing files into
//   groups and only lets you remove the ones that never reach the image:
//
//     1. not used anywhere at all;
//     2. used, but only on disabled / guide layers, or in comps that are
//        not reachable from the Render Queue;
//     3. broken proxies - the original is fine, only the proxy is cleared.
//
//   Whatever really renders is never deleted. But every such layer can be
//   reached with the "Reveal" button - the window is modeless, so AE stays
//   usable: look, decide, delete by hand, press "Rescan".
// =====================================================================

(function () {

    var SCRIPT_NAME = "Clean missing";

    // ------------------------------------------------------------------
    //  What counts as missing
    // ------------------------------------------------------------------
    function isMissing(it) {
        if (!(it instanceof FootageItem)) return false;
        try { if (it.footageMissing) return true; } catch (e) {}
        try {
            var s = it.mainSource;
            if ((s instanceof FileSource) && s.missingFootagePath !== "") return true;
        } catch (e2) {}
        return false;
    }

    // ExtendScript exposes no global AVItem - check the concrete types
    function missingProxy(it) {
        if (!(it instanceof FootageItem) && !(it instanceof CompItem)) return false;
        try {
            var p = it.proxySource;                     // throws when there is no proxy
            return !!p && (p instanceof FileSource) && p.missingFootagePath !== "";
        } catch (e) { return false; }
    }

    // ------------------------------------------------------------------
    //  Reachability: comps the Render Queue can reach
    // ------------------------------------------------------------------
    function reachable() {
        var set = {}, stack = [], rq = app.project.renderQueue, i, j, c, L, src;
        var any = false;

        for (i = 1; i <= rq.numItems; i++) {
            c = rq.item(i).comp;
            if (c && !set[c.id]) { set[c.id] = true; stack.push(c); any = true; }
        }

        // Empty queue - nothing to judge by, treat everything as reachable
        if (!any) {
            for (i = 1; i <= app.project.numItems; i++) {
                c = app.project.item(i);
                if (c instanceof CompItem) set[c.id] = true;
            }
            return { set: set, fromQueue: false };
        }

        while (stack.length) {
            c = stack.pop();
            for (j = 1; j <= c.numLayers; j++) {
                L = c.layer(j);
                if (!L.enabled || L.guideLayer) continue;   // a disabled branch leads nowhere
                src = L.source;
                if ((src instanceof CompItem) && !set[src.id]) {
                    set[src.id] = true;
                    stack.push(src);
                }
            }
        }
        return { set: set, fromQueue: true };
    }

    // ------------------------------------------------------------------
    //  Who is used where
    // ------------------------------------------------------------------
    function collectRefs() {
        var refs = {}, i, j, c, L, id;
        for (i = 1; i <= app.project.numItems; i++) {
            c = app.project.item(i);
            if (!(c instanceof CompItem)) continue;
            for (j = 1; j <= c.numLayers; j++) {
                L = c.layer(j);
                if (!L.source) continue;
                id = L.source.id;
                if (!refs[id]) refs[id] = [];
                refs[id].push({ comp: c, layer: L });
            }
        }
        return refs;
    }

    // Does this layer carry the file through to the result?
    function layerCounts(L, reach) {
        if (!reach.set[L.containingComp.id]) return false;
        if (L.guideLayer) return false;
        if (L.enabled) return true;
        try { if (L.hasAudio && L.audioEnabled) return true; }   // video off is not yet silence
        catch (e) {}
        return false;
    }

    // ------------------------------------------------------------------
    //  Analysis: groups to delete + a flat row list for the window
    // ------------------------------------------------------------------
    function scan() {
        var reach = reachable(), refs = collectRefs();
        var r = { unused: [], idle: [], live: [], proxies: [], rows: [], fromQueue: reach.fromQueue };
        var i, k, it, list, counts;

        for (i = 1; i <= app.project.numItems; i++) {
            it = app.project.item(i);

            if (missingProxy(it)) {
                r.proxies.push(it);
                r.rows.push({ tag: "proxy", item: it, comp: null, layer: null, name: it.name });
            }
            if (!isMissing(it)) continue;

            list = refs[it.id];

            if (!list || !list.length) {
                r.unused.push(it);
                r.rows.push({ tag: "unused", item: it, comp: null, layer: null, name: it.name });
                continue;
            }

            counts = false;
            for (k = 0; k < list.length; k++)
                if (layerCounts(list[k].layer, reach)) { counts = true; break; }

            if (counts) r.live.push({ item: it, refs: list });
            else        r.idle.push({ item: it, refs: list });

            // one row per usage - so there is somewhere to jump to
            for (k = 0; k < list.length; k++)
                r.rows.push({
                    tag:   counts ? "RENDERS" : "outside render",
                    item:  it,
                    comp:  list[k].comp,
                    layer: list[k].layer,
                    name:  it.name
                });
        }
        return r;
    }

    // ------------------------------------------------------------------
    //  Jump to a layer / item
    // ------------------------------------------------------------------
    function reveal(row) {
        var i, c, t;

        if (row.layer && row.comp) {
            c = row.comp;
            try { c.openInViewer(); } catch (e) {}
            for (i = 1; i <= c.numLayers; i++) c.layer(i).selected = false;
            row.layer.selected = true;

            // put the playhead where the layer exists - otherwise it is off-screen in time
            t = row.layer.inPoint;
            if (t < 0) t = 0;
            if (t > c.duration - c.frameDuration) t = c.duration - c.frameDuration;
            c.time = t;
            return;
        }

        // no layer - just highlight the file in the Project panel
        try {
            var sel = app.project.selection;
            for (i = 0; i < sel.length; i++) sel[i].selected = false;
            row.item.selected = true;
        } catch (e2) {}
    }

    // ------------------------------------------------------------------
    //  Removal
    // ------------------------------------------------------------------
    function apply(r, doUnused, doIdle, doProxies) {
        var removed = 0, unproxied = 0, i;

        app.beginUndoGroup(SCRIPT_NAME);
        try {
            if (doProxies)
                for (i = 0; i < r.proxies.length; i++) {
                    try { r.proxies[i].setProxyToNone(); unproxied++; } catch (e) {}
                }
            if (doUnused)
                for (i = 0; i < r.unused.length; i++) {
                    try { r.unused[i].remove(); removed++; } catch (e) {}
                }
            if (doIdle)
                for (i = 0; i < r.idle.length; i++) {
                    try { r.idle[i].item.remove(); removed++; } catch (e) {}
                }
        } finally {
            app.endUndoGroup();
        }

        alert(SCRIPT_NAME + "\n\nItems removed: " + removed +
              "\nProxies cleared: " + unproxied);
    }

    // ------------------------------------------------------------------
    //  Window - palette, so AE stays usable
    // ------------------------------------------------------------------
    function ui() {
        var r = scan();
        if (!r.rows.length) { alert("No missing footage in this project."); return; }

        var w = new Window("palette", SCRIPT_NAME, undefined, { resizeable: true });
        w.orientation = "column";
        w.alignChildren = ["fill", "top"];
        w.spacing = 8;
        w.margins = 12;

        var info = w.add("statictext", undefined, "");
        var cbUnused = w.add("checkbox", undefined, "");
        var cbIdle   = w.add("checkbox", undefined, "");
        var cbProxy  = w.add("checkbox", undefined, "");
        cbIdle.helpTip  = "The layers the file sits on are deleted with it";
        cbProxy.helpTip = "The original stays, only the proxy link is cleared";

        var lb = w.add("listbox", undefined, [], {
            numberOfColumns: 4,
            showHeaders: true,
            columnTitles: ["State", "File", "Comp", "Layer"],
            columnWidths: [110, 210, 170, 170]
        });
        lb.alignment = ["fill", "fill"];
        lb.preferredSize = [680, 320];

        var bg = w.add("group");
        bg.alignment = ["fill", "bottom"];
        bg.alignChildren = ["fill", "center"];
        bg.spacing = 4;
        var goBtn    = bg.add("button", undefined, "Reveal");
        var rescan   = bg.add("button", undefined, "Rescan");
        var okBtn    = bg.add("button", undefined, "Remove");
        var closeBtn = bg.add("button", undefined, "Close");
        goBtn.helpTip = "Open the comp, select the layer and move the playhead to its start";

        var note = w.add("statictext", undefined, "");
        note.alignment = ["fill", "bottom"];

        function fill() {
            var i, row, li;
            lb.removeAll();
            for (i = 0; i < r.rows.length; i++) {
                row = r.rows[i];
                li = lb.add("item", row.tag);
                li.subItems[0].text = row.name;
                li.subItems[1].text = row.comp  ? row.comp.name  : "-";
                li.subItems[2].text = row.layer ? row.layer.name : "-";
                li.rowRef = row;
            }

            info.text = "Missing files: " + (r.unused.length + r.idle.length + r.live.length) +
                        (r.proxies.length ? ("   -   broken proxies: " + r.proxies.length) : "");

            cbUnused.text = "Remove unused (" + r.unused.length + ")";
            cbUnused.enabled = r.unused.length > 0;
            cbUnused.value = r.unused.length > 0;

            cbIdle.text = "Remove those only on disabled layers / outside the render (" + r.idle.length + ")";
            cbIdle.enabled = r.idle.length > 0;
            cbIdle.value = false;

            cbProxy.text = "Clear broken proxies (" + r.proxies.length + ")";
            cbProxy.enabled = r.proxies.length > 0;
            cbProxy.value = r.proxies.length > 0;

            note.text = r.fromQueue
                ? ("Rows marked RENDERS (" + r.live.length +
                   ") is never deleted - handle it by hand via Reveal.")
                : "Render Queue is empty - nothing to trace reachability from, so every comp counts as used.";
            w.layout.layout(true);
        }

        goBtn.onClick = function () {
            if (!lb.selection) { alert("Select a row in the list."); return; }
            reveal(lb.selection.rowRef);
        };

        lb.onDoubleClick = function () {
            if (lb.selection) reveal(lb.selection.rowRef);
        };

        rescan.onClick = function () { r = scan(); fill(); };

        okBtn.onClick = function () {
            if (!cbUnused.value && !cbIdle.value && !cbProxy.value) { alert("Nothing is ticked."); return; }
            if (cbIdle.value && !confirm(
                    "Removing the second group also deletes the layers those files sit on.\n\nContinue?")) return;
            apply(r, cbUnused.value, cbIdle.value, cbProxy.value);
            r = scan();
            fill();
        };

        closeBtn.onClick = function () { w.close(); };

        w.onResizing = w.onResize = function () { this.layout.resize(); };

        fill();
        w.center();
        w.show();

        $.global.__cleanMissingPalette = w;   // keep the window from being garbage-collected
    }

    ui();

})();
