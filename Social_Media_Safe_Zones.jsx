// Social_Media_Safe_Zones.jsx
// Shape layers of safe zones for TikTok and YouTube + (optionally) native guides.
//
// Geometry:
//   TikTok 9:16 — Interactive Add-on / Download Card, Standard Version LTR,
//             reference 540x960: margins 60/60, top 126, icon column from 420,
//             bottom block from 640.
//   TikTok 1:1 and 16:9 - measured from the green area of the official TikTok mockups
//             (In-Feed, Standard LTR: "2. Square Feed- 640x640",
//             "3. Horizontal Feed- 960X540"). The bottom edge depends on
//             caption length - 4 variants, as in the spec itself.
//   YouTube - measured from the official Google Ads overlays (answer/13547298):
//             ytsafezoneoverlay-horizontal.png,
//             youtubesafezoneoverlay_vertical_final.png,
//             youtubesafezoneoverlay-square.png.
//             The 16:9 and 1:1 safe zone is not a rectangle but a stepped outline.
//   Meta    - Facebook Ads Guide (Reels/Stories): 14% top, 35% bottom,
//             6% at the sides; a separate preset for ads with a disclaimer,
//             where the bottom 40% must stay clear. For 1:1 and 4:5 Meta
//             publishes no numbers - there are no presets for them.
//
// Each preset is defined in its own reference size and is scaled
// to the actual composition size.

(function SocialMediaSafeZones() {

    // --- Settings -------------------------------------------------------------

    var FILL_OPACITY   = 25;    // % opacity of the zone fill
    var STROKE_WIDTH   = 4;     // px, zone outline
    var AS_GUIDE_LAYER = true;  // the layer does not render
    var LOCK_LAYER     = true;

    // Preview overlays: placed as a guide layer and stretched over the whole comp.
    // Buttons are built from the folder contents - a new file there = a new button.
    var TEMPLATE_DIR = "X:\\_users\\ArtemP\\sm_safe_zones";
    var TEMPLATE_EXT = /\.(png|jpg|jpeg|tif|tiff|psd|ai)$/i;

    // --- Presets --------------------------------------------------------------
    // poly   - outline of the safe zone in ref pixels
    // guides - guide coordinates in the same units

    var PRESETS = [
        {
            label:  "TikTok 9:16 — Download Card (LTR)",
            name:   "TikTok — Safe Zone (LTR)",
            ref:    [540, 960],
            color:  [0.40, 0.85, 0.70],
            // the "tail" on top: down to y=180 the zone reaches the right margin 60,
            // below that it narrows to the icon column (120 from the right edge)
            poly:   [[60, 126], [480, 126], [480, 180], [420, 180],
                     [420, 640], [60, 640]],
            guides: { v: [60, 420, 480], h: [126, 180, 640] }
        },
        {
            label:  "TikTok 1:1 — In-Feed (LTR)",
            name:   "TikTok — Safe Zone 1:1 (LTR)",
            ref:    [640, 640],
            color:  [0.40, 0.85, 0.70],
            // "B" - bottom edge, taken from bottoms by caption length
            bottoms: [408, 368, 328, 288],
            poly:   [[60, 0], [500, 0], [500, "B"], [60, "B"]],
            guides: { v: [60, 500], h: ["B"] }
        },
        {
            label:  "TikTok 16:9 — In-Feed (LTR)",
            name:   "TikTok — Safe Zone 16:9 (LTR)",
            ref:    [960, 540],
            color:  [0.40, 0.85, 0.70],
            bottoms: [402, 342, 282, 221],
            poly:   [[100, 0], [750, 0], [750, "B"], [100, "B"]],
            guides: { v: [100, 750], h: ["B"] }
        },
        {
            label:  "YouTube 9:16 (1080x1920)",
            name:   "YouTube — Safe Zone 9:16",
            ref:    [1080, 1920],
            color:  [1.00, 0.30, 0.30],
            poly:   [[48, 288], [888, 288], [888, 1248], [48, 1248]],
            guides: { v: [48, 888], h: [288, 1248] }
        },
        {
            label:  "YouTube 16:9 (1920x1080)",
            name:   "YouTube — Safe Zone 16:9",
            ref:    [1920, 1080],
            color:  [1.00, 0.30, 0.30],
            poly:   [[496, 38], [1444, 38], [1444, 133], [1758, 133],
                     [1758, 693], [38, 693], [38, 183], [496, 183]],
            guides: { v: [38, 496, 1444, 1758], h: [38, 133, 183, 693] }
        },
        {
            label:  "YouTube 1:1 (1080x1080)",
            name:   "YouTube — Safe Zone 1:1",
            ref:    [1080, 1080],
            color:  [1.00, 0.30, 0.30],
            poly:   [[48, 48], [534, 48], [534, 105], [979, 105],
                     [979, 690], [48, 690]],
            guides: { v: [48, 534, 979], h: [48, 105, 690] }
        },
        {
            // Meta: 14% top, 35% bottom, 6% at the sides (Ads Guide, Reels/Stories)
            label:  "Facebook/Meta 9:16 — Stories & Reels",
            name:   "Meta — Safe Zone 9:16",
            ref:    [1080, 1920],
            color:  [0.10, 0.47, 0.95],
            poly:   [[65, 269], [1015, 269], [1015, 1248], [65, 1248]],
            guides: { v: [65, 1015], h: [269, 1248] }
        },
        {
            // Same frame but with a disclaimer: the bottom 40% stays clear
            label:  "Facebook/Meta 9:16 - with disclaimer (bottom 40%)",
            name:   "Meta — Safe Zone 9:16 (disclaimer)",
            ref:    [1080, 1920],
            color:  [0.10, 0.47, 0.95],
            poly:   [[65, 269], [1015, 269], [1015, 1152], [65, 1152]],
            guides: { v: [65, 1015], h: [269, 1152] }
        }
    ];

    var HORIZ = 0, VERT = 1;   // guide orientationType in AE

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function targetComps() {
        var out = [], sel = app.project.selection, i;
        for (i = 0; i < sel.length; i++) if (sel[i] instanceof CompItem) out.push(sel[i]);
        if (!out.length) {
            var a = app.project.activeItem;
            if (a instanceof CompItem) out.push(a);
        }
        return out;
    }

    function guessPreset(comp) {
        if (!comp) return 0;
        var r = comp.width / comp.height;
        if (r > 1.2)  return 4;    // wide     -> YouTube 16:9
        if (r > 0.85) return 5;    // square   -> YouTube 1:1
        return 0;                  // vertical -> TikTok
    }

    // "B" in the coordinates = bottom edge, depends on caption length
    function resolve(v, bottom) { return (v === "B") ? bottom : v; }

    function bottomOf(preset, capIndex) {
        return preset.bottoms ? preset.bottoms[capIndex] : 0;
    }

    function removeLayerByName(comp, name) {
        for (var i = comp.numLayers; i >= 1; i--) {
            if (comp.layer(i).name === name) {
                comp.layer(i).locked = false;
                comp.layer(i).remove();
            }
        }
    }

    // --- Preview overlay ------------------------------------------------------

    // Do not pull the same file into the project twice
    function findFootage(file) {
        var i, it, s;
        for (i = 1; i <= app.project.numItems; i++) {
            it = app.project.item(i);
            if (!(it instanceof FootageItem)) continue;
            try {
                s = it.mainSource;
                if ((s instanceof FileSource) && s.file && s.file.fsName === file.fsName) return it;
            } catch (e) {}
        }
        return null;
    }

    // What sits in the overlay folder
    function templateFiles() {
        var dir = new Folder(TEMPLATE_DIR), out = [], i, fs, nm;
        if (!dir.exists) return out;

        fs = dir.getFiles(function (f) {
            return (f instanceof File) && TEMPLATE_EXT.test(f.name);
        });
        fs.sort(function (a, b) {
            return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
        });

        for (i = 0; i < fs.length; i++) {
            // fsName, not name - otherwise spaces arrive as %20
            nm = String(fs[i].fsName).replace(/^.*[\\\/]/, "").replace(/\.[^.]+$/, "");
            out.push({ file: fs[i], label: nm });
        }
        return out;
    }

    function templateItem(f) {
        if (!f || !f.exists) return null;
        var found = findFootage(f);
        if (found) return found;
        return app.project.importFile(new ImportOptions(f));
    }

    // Guide layer over the whole comp: stretched on both axes, like Fit to Comp
    function addTemplate(comp, item) {
        removeLayerByName(comp, item.name);

        var lay = comp.layers.add(item);
        lay.guideLayer = true;
        lay.startTime = 0;
        try { lay.outPoint = comp.duration; } catch (e) {}

        var tr = lay.property("ADBE Transform Group");
        tr.property("ADBE Position").setValue([comp.width / 2, comp.height / 2]);

        var sc = tr.property("ADBE Scale");
        var sx = comp.width  / item.width  * 100;
        var sy = comp.height / item.height * 100;
        sc.setValue(sc.value.length === 3 ? [sx, sy, 100] : [sx, sy]);

        lay.moveToBeginning();
        lay.locked = LOCK_LAYER;          // lock last, otherwise nothing can be changed
        return lay;
    }

    function makeShape(comp, preset, bottom) {
        var sx = comp.width  / preset.ref[0];
        var sy = comp.height / preset.ref[1];

        removeLayerByName(comp, preset.name);

        var lay = comp.layers.addShape();
        lay.name = preset.name;

        var tr = lay.property("ADBE Transform Group");
        tr.property("ADBE Anchor Point").setValue([0, 0]);
        tr.property("ADBE Position").setValue([0, 0]);

        var grp = lay.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        grp.name = "Safe Area";
        var vec = grp.property("ADBE Vectors Group");

        var verts = [], tang = [], i;
        for (i = 0; i < preset.poly.length; i++) {
            verts.push([Math.round(resolve(preset.poly[i][0], bottom) * sx),
                        Math.round(resolve(preset.poly[i][1], bottom) * sy)]);
            tang.push([0, 0]);
        }
        var s = new Shape();
        s.vertices = verts;
        s.inTangents = tang;
        s.outTangents = tang;
        s.closed = true;

        var path = vec.addProperty("ADBE Vector Shape - Group");
        path.name = "Outline";
        path.property("ADBE Vector Shape").setValue(s);

        var fill = vec.addProperty("ADBE Vector Graphic - Fill");
        fill.property("ADBE Vector Fill Color").setValue(
            [preset.color[0], preset.color[1], preset.color[2], 1]);
        fill.property("ADBE Vector Fill Opacity").setValue(FILL_OPACITY);

        var stroke = vec.addProperty("ADBE Vector Graphic - Stroke");
        stroke.property("ADBE Vector Stroke Color").setValue([1, 1, 1, 1]);
        stroke.property("ADBE Vector Stroke Width").setValue(STROKE_WIDTH);

        lay.guideLayer = AS_GUIDE_LAYER;
        lay.moveToBeginning();
        lay.locked = LOCK_LAYER;
        return lay;
    }

    function makeGuides(comp, preset, bottom) {
        if (typeof comp.addGuide !== "function") return 0;
        var sx = comp.width  / preset.ref[0];
        var sy = comp.height / preset.ref[1];
        var i, n = 0;
        for (i = comp.guides.length - 1; i >= 0; i--) comp.removeGuide(i);
        for (i = 0; i < preset.guides.v.length; i++) {
            comp.addGuide(VERT, Math.round(resolve(preset.guides.v[i], bottom) * sx)); n++;
        }
        for (i = 0; i < preset.guides.h.length; i++) {
            comp.addGuide(HORIZ, Math.round(resolve(preset.guides.h[i], bottom) * sy)); n++;
        }
        return n;
    }

    // --- Dialog ---------------------------------------------------------------

    function askOptions(defIndex) {
        var w = new Window("dialog", "Social Media Safe Zones");
        w.alignChildren = ["fill", "top"];
        w.spacing = 8;
        w.margins = 14;

        w.add("statictext", undefined, "Preset:");
        var dd = w.add("dropdownlist", undefined, undefined);
        for (var i = 0; i < PRESETS.length; i++) dd.add("item", PRESETS[i].label);
        dd.selection = defIndex;
        dd.preferredSize.width = 260;

        var capLabel = w.add("statictext", undefined, "Caption lines (TikTok In-Feed):");
        var cap = w.add("dropdownlist", undefined,
            ["1 line", "2 lines", "3 lines", "4 lines (smallest zone)"]);
        cap.selection = 3;
        cap.preferredSize.width = 260;

        var cbShape  = w.add("checkbox", undefined, "Zone shape layer");
        var cbGuides = w.add("checkbox", undefined, "Guides");
        cbShape.value  = true;
        cbGuides.value = true;

        // caption length only affects the zone in the TikTok In-Feed presets
        function syncCap() {
            var on = !!PRESETS[dd.selection.index].bottoms;
            capLabel.enabled = on;
            cap.enabled = on;
        }
        dd.onChange = syncCap;
        syncCap();

        // every file from the overlay folder gets its own instant-action button
        var tpls = templateFiles(), chosen = null, ti;
        var tp = w.add("panel", undefined, "Preview overlay");
        tp.orientation = "column";
        tp.alignChildren = ["fill", "top"];
        tp.margins = [10, 14, 10, 10];
        tp.spacing = 4;

        if (!tpls.length) {
            tp.add("statictext", undefined,
                   new Folder(TEMPLATE_DIR).exists
                       ? ("in " + TEMPLATE_DIR + " has no images")
                       : ("folder unavailable:\n" + TEMPLATE_DIR),
                   { multiline: true });
        } else {
            for (ti = 0; ti < tpls.length; ti++) {
                (function (t) {
                    var b = tp.add("button", undefined, t.label);
                    b.helpTip = t.file.fsName + "\nas a guide layer across the whole comp";
                    b.onClick = function () { chosen = t; w.close(2); };
                })(tpls[ti]);
            }
        }

        var row = w.add("group");
        row.alignment = ["fill", "top"];
        var ok = row.add("button", undefined, "OK", { name: "ok" });
        row.add("button", undefined, "Cancel", { name: "cancel" });
        ok.active = true;

        var res = w.show();
        if (res === 2) return { template: chosen };
        if (res !== 1) return null;
        return {
            preset:   PRESETS[dd.selection.index],
            capIndex: cap.selection.index,
            shape:    cbShape.value,
            guides:   cbGuides.value
        };
    }

    // ─── Run ──────────────────────────────────────────────────────────────────

    var comps = targetComps();
    if (!comps.length) {
        alert("Open a composition or select comps in the Project panel.");
        return;
    }

    var opt = askOptions(guessPreset(comps[0]));
    if (!opt) return;

    if (opt.template) {
        var tpl = templateItem(opt.template.file);
        if (!tpl) { alert("File not found:\n" + opt.template.file.fsName); return; }

        app.beginUndoGroup("SM Safe Zones - overlay " + opt.template.label);
        var tplReport = [], t;
        try {
            for (t = 0; t < comps.length; t++) {
                addTemplate(comps[t], tpl);
                tplReport.push(comps[t].name + "  " + comps[t].width + "x" + comps[t].height);
            }
        } finally {
            app.endUndoGroup();
        }

        alert(tpl.name + " - added as a guide layer to:\n\n" + tplReport.join("\n"));
        return;
    }

    if (!opt.shape && !opt.guides) return;

    app.beginUndoGroup("SM Safe Zones - " + opt.preset.name);

    var bottom = bottomOf(opt.preset, opt.capIndex);

    var report = [], c;
    for (c = 0; c < comps.length; c++) {
        var comp = comps[c], made = [];
        if (opt.shape) { makeShape(comp, opt.preset, bottom); made.push("shape"); }
        if (opt.guides) {
            var n = makeGuides(comp, opt.preset, bottom);
            made.push(n ? n + " guides" : "guides unavailable (AE < 22.6)");
        }
        report.push(comp.name + "  " + comp.width + "x" + comp.height + " - " + made.join(", "));
    }

    app.endUndoGroup();

    alert(opt.preset.label
        + (opt.preset.bottoms ? "  -  caption " + (opt.capIndex + 1) + " lines" : "")
        + "\n\n" + report.join("\n"));

}());
