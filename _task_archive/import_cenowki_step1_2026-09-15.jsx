// import_cenowki.jsx
// =====================================================================
//   Import CENOWKI (price tags) into the open week project
// =====================================================================
//   The open project tells the script everything it needs:
//
//     ...\vfx\shots\2026\NISKIE CENY\W39\compo\W39A_1_Milka_Kawy_Elseve_v01.aep
//                             |          |     |    |  |
//                        subproject     week   |   spot offers
//                                             week + part
//
//   From that it walks to  ...\client\NISKIE CENY\ , looks through the
//   newest  YYYYMMDD_CENOWKI\HHMM\  deliveries, keeps the PSD files of
//   the same week and part, and matches their offer names against the
//   offers in the project name.
//
//   Matching survives the way the files are really named: Kawa ~ Kawy,
//   Kielbasa ~ Kielbasy, Coccolino ~ Cocolino, VITAL_FRESZ ~ VitalFresh,
//   Oueen ~ Queen, CNC_w38B_LOSOSIE_wedzone ~ Lososie.
//
//   Everything is shown in a list first. Nothing is imported until the
//   Import button is pressed. The files land in the _CENOWKI folder as
//   Composition - Retain Layer Sizes.
// =====================================================================

(function () {

    var SCRIPT_NAME = "Import CENOWKI";
    var DEST_FOLDER = "_CENOWKI";
    var CLIENT_DIR  = "client";
    var DELIVERY    = /^(\d{8})_CENOWKI$/i;    // 20260915_CENOWKI
    var TIME_DIR    = /^(\d{3,4})$/;           // 1049
    var SCAN_LAST   = 15;                      // how many deliveries to look through
    var MIN_SCORE   = 60;                      // below this an offer is not a match

    // ------------------------------------------------------------------
    //  Names
    // ------------------------------------------------------------------
    var PL = { "Ą":"A", "Ć":"C", "Ę":"E", "Ł":"L", "Ń":"N",
               "Ó":"O", "Ś":"S", "Ź":"Z", "Ż":"Z" };

    // "CNC_w38B_LOSOSIE_wedzone" -> comparable letters only
    function norm(s) {
        s = String(s).toUpperCase();
        var out = "", ch, i;
        for (i = 0; i < s.length; i++) {
            ch = s.charAt(i);
            if (PL[ch]) ch = PL[ch];
            if ((ch >= "A" && ch <= "Z") || (ch >= "0" && ch <= "9")) out += ch;
        }
        return out;
    }

    function lev(a, b) {
        var m = a.length, n = b.length, i, j, prev, cur;
        if (!m) return n;
        if (!n) return m;
        prev = [];
        for (j = 0; j <= n; j++) prev[j] = j;
        for (i = 1; i <= m; i++) {
            cur = [i];
            for (j = 1; j <= n; j++)
                cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
                                  prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
            prev = cur;
        }
        return prev[n];
    }

    // How close two offer names are. 100 - the same word, 0 - unrelated
    function score(a, b) {
        if (!a || !b) return 0;
        if (a === b) return 100;
        var mn = Math.min(a.length, b.length), d;
        if (mn >= 4 && (a.indexOf(b) === 0 || b.indexOf(a) === 0)) return 90;
        d = lev(a, b);
        if (mn >= 4 && d <= 1) return 80;
        if (mn >= 6 && d <= 2) return 70;
        if (mn >= 5 && (a.indexOf(b) !== -1 || b.indexOf(a) !== -1)) return 60;
        return 0;
    }

    // Everything that is not an offer name
    var JUNK = /^(V\d+|\d+S|\d+|DIGITAL|BUMPER|CNC|OK|FINAL|NEW|COPY|PSD|JPG|REGULAR|START)$/;
    var WEEK_TOKEN = /^[WT]\d{1,2}[AB]?$/;

    function tokens(name) {
        var raw = String(name).replace(/\.[^.]+$/, "").split(/[^A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż]+/);
        var out = [], t, i;
        for (i = 0; i < raw.length; i++) {
            t = norm(raw[i]);
            if (!t) continue;
            if (JUNK.test(t)) continue;
            if (WEEK_TOKEN.test(t)) continue;
            if (/^[AB]$/.test(t)) continue;
            out.push(t);
        }
        return out;
    }

    // W39A / w38B / w37_B / T38A -> { n: 39, part: "A" }
    function weekOf(name) {
        var m = /(?:^|[^A-Za-z0-9])[WT]\s*_?(\d{1,2})\s*_?([AB])?(?![A-Za-z0-9])/i.exec(String(name));
        if (!m) return null;
        return { n: parseInt(m[1], 10), part: m[2] ? m[2].toUpperCase() : "" };
    }

    function spotOf(name) {
        var m = /[WT]\s*_?\d{1,2}\s*_?[AB]?_(\d)_/i.exec(String(name));
        return m ? m[1] : "";
    }

    function versionOf(name) {
        var m = /_V(\d+)/i.exec(String(name));
        return m ? parseInt(m[1], 10) : 0;
    }

    function fileName(f) {
        return String(f.fsName).replace(/^.*[\\\/]/, "");
    }

    // ------------------------------------------------------------------
    //  Where the client files are
    // ------------------------------------------------------------------
    //  ...\<root>\vfx\shots\2026\<subproject>\<week>\compo\file.aep
    //  ->  ...\<root>\client\<subproject>
    //  Nothing here is fatal: whatever the guess ends up being, the path
    //  stays editable in the window.
    function clientFolder(projFile, tried) {
        var parts = String(projFile.fsName).split(/[\\\/]/), i, vfx = -1, f;
        for (i = 0; i < parts.length; i++)
            if (parts[i].toLowerCase() === "vfx") { vfx = i; break; }
        if (vfx < 1) return null;

        var root = parts.slice(0, vfx).join("\\") + "\\" + CLIENT_DIR;

        // Any folder name between vfx and the project file can be the
        // subproject - take the first one that really sits in client\
        for (i = parts.length - 2; i > vfx; i--) {
            if (/^\d{4}$/.test(parts[i])) continue;          // year
            if (/^(shots|compo|assets)$/i.test(parts[i])) continue;
            if (/^[WT]\d{1,2}[AB]?$/i.test(parts[i])) continue;   // week folder
            f = new Folder(root + "\\" + parts[i]);
            tried.push(f.fsName);
            if (f.exists) return f;
        }

        f = new Folder(root);
        tried.push(f.fsName);
        return f.exists ? f : null;
    }

    function subFolders(folder) {
        var all = folder.getFiles(), out = [], i;
        for (i = 0; i < all.length; i++) if (all[i] instanceof Folder) out.push(all[i]);
        return out;
    }

    // Deliveries, newest first, capped at SCAN_LAST
    function deliveries(client) {
        var dirs = subFolders(client), out = [], i, m;
        for (i = 0; i < dirs.length; i++) {
            m = DELIVERY.exec(dirs[i].name);
            if (m) out.push({ folder: dirs[i], date: m[1] });
        }
        out.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
        return out.slice(0, SCAN_LAST);
    }

    // Every PSD under a delivery folder, tagged with its HHMM
    function psdsIn(delivery) {
        var out = [];

        function dig(folder, time, depth) {
            var all = folder.getFiles(), i, f, m;
            for (i = 0; i < all.length; i++) {
                f = all[i];
                if (f instanceof Folder) {
                    if (depth > 3) continue;
                    m = TIME_DIR.exec(f.name);
                    dig(f, m ? (m[1].length === 3 ? "0" + m[1] : m[1]) : time, depth + 1);
                } else if (/\.psd$/i.test(f.name)) {
                    out.push({ file: f, date: delivery.date, time: time || "0000" });
                }
            }
        }

        dig(delivery.folder, "", 0);
        return out;
    }

    // ------------------------------------------------------------------
    //  Matching
    // ------------------------------------------------------------------
    //  For every offer of the project - the newest PSD that matches it
    function collect(client, week, part, offers, log) {
        var dels = deliveries(client), all = [], i, j, k;

        if (!dels.length) return [];
        log.push("Deliveries scanned: " + dels.length +
                 "  (" + dels[dels.length - 1].date + " - " + dels[0].date + ")");

        for (i = 0; i < dels.length; i++) {
            var psds = psdsIn(dels[i]);
            for (j = 0; j < psds.length; j++) {
                var name = fileName(psds[j].file);
                var w = weekOf(name);
                if (!w || w.n !== week) continue;
                if (w.part && w.part !== part) continue;   // W37_Ariel with no part - both halves

                var ft = tokens(name), best = 0, hit = "", s;
                for (k = 0; k < ft.length; k++)
                    for (var o = 0; o < offers.length; o++) {
                        s = score(ft[k], offers[o]);
                        if (s > best) { best = s; hit = offers[o]; }
                    }
                if (best < MIN_SCORE) continue;

                all.push({ file: psds[j].file, name: name, offer: hit, score: best,
                           date: psds[j].date, time: psds[j].time, ver: versionOf(name) });
            }
        }

        // newest first: date, then time of day, then version in the name
        all.sort(function (a, b) {
            if (a.date !== b.date) return a.date < b.date ? 1 : -1;
            if (a.time !== b.time) return a.time < b.time ? 1 : -1;
            if (a.ver !== b.ver) return b.ver - a.ver;
            return a.name < b.name ? -1 : 1;
        });

        // one file per offer - the first one left standing after the sort
        var taken = {}, out = [];
        for (i = 0; i < all.length; i++) {
            if (taken[all[i].offer]) continue;
            taken[all[i].offer] = true;
            out.push(all[i]);
        }

        for (i = 0; i < offers.length; i++)
            if (!taken[offers[i]]) log.push("No cenowka yet for: " + offers[i]);

        return out;
    }

    // ------------------------------------------------------------------
    //  Project
    // ------------------------------------------------------------------
    function findFolderItem(name) {
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if ((it instanceof FolderItem) && it.name === name) return it;
        }
        return null;
    }

    function compNamed(name) {
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if ((it instanceof CompItem) && it.name === name) return it;
        }
        return null;
    }

    function idSnapshot() {
        var map = {}, i;
        for (i = 1; i <= app.project.numItems; i++) map[app.project.item(i).id] = true;
        return map;
    }

    // Import as Composition - Retain Layer Sizes and move what appeared
    // at the root of the project into the destination folder
    function importPsd(file, dest) {
        var before = idSnapshot();

        var io = new ImportOptions(file);
        io.importAs = io.canImportAs(ImportAsType.COMP_CROPPED_LAYERS)
                    ? ImportAsType.COMP_CROPPED_LAYERS      // Composition - Retain Layer Sizes
                    : ImportAsType.COMP;
        var comp = app.project.importFile(io);

        var root = app.project.rootFolder, moved = [], i, it, par;
        for (i = 1; i <= app.project.numItems; i++) {
            it = app.project.item(i);
            if (before[it.id]) continue;
            par = it.parentFolder;
            if (!(par === root || par.name === root.name)) continue;  // keep the Layers folder packed
            moved.push(it);
        }
        for (i = 0; i < moved.length; i++) moved[i].parentFolder = dest;

        return comp;
    }

    // ------------------------------------------------------------------
    //  Run
    // ------------------------------------------------------------------
    function run(rows, log) {
        var dest = findFolderItem(DEST_FOLDER) || app.project.items.addFolder(DEST_FOLDER);
        var done = [], failed = [], i;

        app.beginUndoGroup(SCRIPT_NAME);
        try {
            for (i = 0; i < rows.length; i++) {
                try {
                    var c = importPsd(rows[i].file, dest);
                    done.push(rows[i].offer + "   <-   " + (c ? c.name : rows[i].name));
                } catch (e) {
                    failed.push(rows[i].name + " - " + (e.message || e));
                }
            }
        } finally {
            app.endUndoGroup();
        }

        var msg = "Imported into " + DEST_FOLDER + ": " + done.length + "\n" + done.join("\n");
        if (failed.length) msg += "\n\nFailed:\n" + failed.join("\n");
        if (log.length) msg += "\n\n" + log.join("\n");
        alert(SCRIPT_NAME + "\n\n" + msg);
    }

    // ------------------------------------------------------------------
    //  Window
    // ------------------------------------------------------------------
    function ui(ctx) {
        var w = new Window("dialog", SCRIPT_NAME);
        w.orientation = "column";
        w.alignChildren = ["fill", "top"];
        w.spacing = 8;
        w.margins = 12;

        var head = w.add("panel", undefined, "Project");
        head.orientation = "column";
        head.alignChildren = ["fill", "top"];
        head.margins = 10;
        head.spacing = 6;

        head.add("statictext", undefined, ctx.projName);
        head.add("statictext", undefined, ctx.client.fsName);

        var g1 = head.add("group");
        g1.add("statictext", undefined, "Week:");
        var fWeek = g1.add("edittext", undefined, String(ctx.week));
        fWeek.characters = 4;
        g1.add("statictext", undefined, "Part:");
        var fPart = g1.add("edittext", undefined, ctx.part);
        fPart.characters = 3;
        g1.add("statictext", undefined, "Spot:");
        g1.add("statictext", undefined, ctx.spot || "-");

        var g2 = head.add("group");
        g2.alignChildren = ["fill", "center"];
        g2.add("statictext", undefined, "Offers:");
        var fOffers = g2.add("edittext", undefined, ctx.offers.join(", "));
        fOffers.characters = 46;
        fOffers.helpTip = "Comma separated. Edit if the project name does not spell them out.";

        var rescan = head.add("button", undefined, "Rescan");
        rescan.alignment = ["left", "center"];

        var list = w.add("listbox", undefined, [], {
            multiselect: true, numberOfColumns: 4, showHeaders: true,
            columnTitles: ["Offer", "File", "Delivered", "In project"]
        });
        list.preferredSize = [720, 220];

        var note = w.add("statictext", undefined, "");
        var info = w.add("statictext", undefined,
            "Selected rows are imported as Composition - Retain Layer Sizes into " + DEST_FOLDER + ".");

        var bg = w.add("group");
        bg.alignment = ["fill", "bottom"];
        bg.alignChildren = ["fill", "center"];
        var ok = bg.add("button", undefined, "Import", { name: "ok" });
        bg.add("button", undefined, "Cancel", { name: "cancel" });
        ok.preferredSize.height = 24;

        var rows = [], log = [];

        function fill() {
            log = [];
            var offers = [], raw = String(fOffers.text).split(","), i, t;
            for (i = 0; i < raw.length; i++) {
                t = norm(raw[i]);
                if (t) offers.push(t);
            }

            rows = collect(ctx.client, parseInt(fWeek.text, 10),
                           String(fPart.text).toUpperCase(), offers, log);

            list.removeAll();
            for (i = 0; i < rows.length; i++) {
                var exists = compNamed(rows[i].name.replace(/\.psd$/i, ""));
                rows[i].exists = !!exists;
                var item = list.add("item", rows[i].offer);
                item.subItems[0].text = rows[i].name;
                item.subItems[1].text = rows[i].date + "  " + rows[i].time;
                item.subItems[2].text = exists ? "already there" : "";
                item.selected = !exists;
            }
            note.text = rows.length
                ? (rows.length + " file(s) found. " + log.join("   "))
                : ("Nothing found for this week. " + log.join("   "));
        }

        rescan.onClick = fill;

        ok.onClick = function () {
            var picked = [], i;
            for (i = 0; i < rows.length; i++)
                if (list.items[i].selected) picked.push(rows[i]);
            if (!picked.length) { alert("Nothing is selected."); return; }
            w.close();
            run(picked, log);
        };

        fill();
        w.center();
        w.show();
    }

    // ------------------------------------------------------------------
    //  Start
    // ------------------------------------------------------------------
    if (!app.project || !app.project.file) {
        alert(SCRIPT_NAME + "\n\nSave the week project first - the script reads the week,\n" +
                            "the part and the offers from its file name.");
        return;
    }

    var projName = app.project.file.name.replace(/\.aep[x]?$/i, "");
    var wk = weekOf(projName);
    if (!wk) {
        alert(SCRIPT_NAME + "\n\nNo week in the project name:\n" + projName +
              "\n\nExpected something like W39A_1_Milka_Kawy_Elseve_v01.aep");
        return;
    }

    var client = clientFolder(app.project.file);
    if (!client) {
        alert(SCRIPT_NAME + "\n\nCould not find the client folder next to the project.\n" +
              "Expected ...\\" + CLIENT_DIR + "\\<subproject> beside vfx\\shots\\<year>\\<subproject>");
        return;
    }

    ui({ projName: projName, week: wk.n, part: wk.part, spot: spotOf(projName),
         offers: tokens(projName), client: client });

})();
