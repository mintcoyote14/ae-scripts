// replace_audio.jsx
// =====================================================================
//   Swap the spot audio for the freshest delivery
// =====================================================================
//   Audio arrives in  <project root>\audio\YYYYMMDD\  and the file name
//   always spells out the show, the week and the offers:
//
//     BIEDR_CNC_REGULAR_T39A_1_MILKA_KAWY_ELSEVE_30_EMIS_TV_-23LUFS_20260915_.wav
//            |          |   | |                  |                  |
//           show       week | spot   offers    length             date
//                         part
//
//   The open project name carries the same three things, so the script
//   ranks every delivered file by how much of it matches:
//
//     W39A_1_Milka_Kawy_Elseve_v01.aep  ->  week 39A, spot 1,
//                                           offers MILKA KAWY ELSEVE
//
//   Ranking goes by matched offers first, then by the length of the spot,
//   then by how fresh the file is on disk - the file date in the name is
//   not to be trusted, the same day often carries several exports.
//
//   Replace keeps the footage item and swaps the file underneath it, so
//   every layer built on that audio stays exactly where it is.
// =====================================================================

(function () {

    var SCRIPT_NAME = "Replace audio";
    var DEST_FOLDER = "_AUDIO";
    var AUDIO_DIR   = "audio";
    var DATED       = /^(\d{8})/;                          // 20260915
    var AUDIO_EXT   = /\.(wav|mp3|aif|aiff|m4a)$/i;
    var SKIP_DIR    = /^(old|stare|archiw|archive|backup)/i;
    var SCAN_LAST   = 15;
    var MIN_SCORE   = 60;
    var MAX_ROWS    = 30;
    var SETTINGS    = "ReplaceAudio";

    function getSetting(key, def) {
        if (!app.settings.haveSetting(SETTINGS, key)) return def;
        return app.settings.getSetting(SETTINGS, key);
    }

    function setSetting(key, val) {
        app.settings.saveSetting(SETTINGS, key, String(val));
    }

    // ------------------------------------------------------------------
    //  Names
    // ------------------------------------------------------------------
    var PL = { "Ą":"A", "Ć":"C", "Ę":"E", "Ł":"L", "Ń":"N",
               "Ó":"O", "Ś":"S", "Ź":"Z", "Ż":"Z" };

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

    // A swap of two letters counts as one mistake: Kilebasy/Kielbasa
    function lev(a, b) {
        var m = a.length, n = b.length, i, j, prev2 = null, prev, cur;
        if (!m) return n;
        if (!n) return m;
        prev = [];
        for (j = 0; j <= n; j++) prev[j] = j;
        for (i = 1; i <= m; i++) {
            cur = [i];
            for (j = 1; j <= n; j++) {
                cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
                                  prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
                if (i > 1 && j > 1 &&
                    a.charAt(i - 1) === b.charAt(j - 2) && a.charAt(i - 2) === b.charAt(j - 1))
                    cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
            }
            prev2 = prev;
            prev = cur;
        }
        return prev[n];
    }

    // Kawa ~ Kawy, Kielbasa ~ Kielbasy, Losos ~ Lososie. A couple of letters
    // may differ, never a whole word - Parowki and Pierogi stay apart.
    function score(a, b) {
        if (!a || !b) return 0;
        if (a === b) return 100;

        var mn = Math.min(a.length, b.length), mx = Math.max(a.length, b.length), d;
        if (mn >= 4 && mx - mn <= 2 && (a.indexOf(b) === 0 || b.indexOf(a) === 0)) return 85;

        d = lev(a, b);
        if (mn >= 4 && d <= 1) return 85;
        if (mn >= 6 && d <= 2) return 70;
        return 0;
    }

    // VITAL_FRESZ arrives as two tokens, the project spells it VitalFresh -
    // so glued neighbours are tried too, through the same tight test
    function bestScore(ft, offer) {
        var best = 0, i, s;
        for (i = 0; i < ft.length; i++) {
            s = score(ft[i], offer);
            if (s > best) best = s;
            if (i + 1 < ft.length) {
                s = score(ft[i] + ft[i + 1], offer);
                if (s > best) best = s;
            }
        }
        return best;
    }

    // Everything in an audio name that is not an offer
    var JUNK = new RegExp("^(V\\d+|\\d+S|\\d+|BIEDR|BIEDRONKA|CNC|EMIS|TV|LUFS|DB|DIGITAL|DIGITALL|DGITAL|" +
                          "MIX|MASTER|FINAL|NEW|COPY|WAV|MP3|OK|BEZ|PAKA|REG|REGULAR)$");
    var WEEK_TOKEN = /^([A-Z]{0,3}[WT]\d{1,2}[A-D]?\d?|\d{1,2}[A-D])$/;

    function tokens(name) {
        var raw = String(name).replace(/\.[^.]+$/, "").split(/[^A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż]+/);
        var out = [], t, i;
        for (i = 0; i < raw.length; i++) {
            t = norm(raw[i]);
            if (!t) continue;
            if (JUNK.test(t)) continue;
            if (WEEK_TOKEN.test(t)) continue;
            if (/^[A-D]$/.test(t)) continue;
            if (/^\d{8}$/.test(t)) continue;               // the date
            out.push(t);
        }
        return out;
    }

    // T39A / W36A1 / W38B_1 / W35 / NSW38C -> { pre: "NS", n: 38, part: "C" }
    function weekOf(name) {
        var m = /(?:^|[^A-Za-z0-9])([A-Z]{0,3})[WT]\s*_?(\d{1,2})\s*_?([A-D])?\d?(?![A-Za-z0-9])/i.exec(String(name));
        if (m) return { pre: m[1].toUpperCase(), n: parseInt(m[2], 10),
                        part: m[3] ? m[3].toUpperCase() : "" };

        m = /^(\d{1,2})\s*_?([A-D])(?![A-Za-z0-9])/i.exec(String(name));
        if (!m) return null;
        return { pre: "", n: parseInt(m[1], 10), part: m[2].toUpperCase() };
    }

    // Weekend runs two shows side by side and writes the show right after
    // the week: W38C_1_NS_Lopatka... takes BIEDR_NS_W38C1_..., never the TW one
    function tagOf(projName) {
        // Two letters exactly, otherwise a spot opening with a short offer
        // - W36B_1_Ser_Parowki_Kosmetyki - would read Ser as a show
        var tk = tokens(projName), k;
        for (k = 0; k < tk.length; k++) {
            if (tk[k].length > 2) break;
            if (tk[k].length === 2 && !/\d/.test(tk[k])) return tk[k];
        }
        return "";
    }

    function hasTag(name, tag) {
        if (!tag) return true;
        var tk = tokens(name), k;
        for (k = 0; k < tk.length; k++) if (tk[k] === tag) return true;
        var w = weekOf(name);
        return !!(w && w.pre && (w.pre === tag || w.pre === tag.replace(/W$/, "")));
    }

    // The spot number, glued to the week (W36A1) or standing on its own
    // (T39A_1). A 1-4 right before EMIS is the spot length, not the spot.
    function spotOf(name) {
        var s = String(name);
        var m = /[WT]\s*_?\d{1,2}\s*_?[A-D]([1-4])(?![A-Za-z0-9])/i.exec(s);
        if (m) return m[1];
        m = /[WT]\s*_?\d{1,2}\s*_?[A-D]?(?:_[A-Z]+)?_([1-4])_(?!EMIS)/i.exec(s);
        return m ? m[1] : "";
    }

    // Spot length: _30_EMIS, _6S_EMIS, and the plain _30_ of a project name.
    // Only real spot lengths count, otherwise the spot number _1_ gets read
    // as a one second spot.
    var LENGTHS = { 5:1, 6:1, 10:1, 15:1, 20:1, 25:1, 30:1, 45:1, 60:1 };

    function lengthOf(name) {
        var s = String(name).replace(/\.[^.]+$/, "");
        var m = /_(\d{1,3})S?_EMIS/i.exec(s);
        if (m) return parseInt(m[1], 10);
        m = /_(\d{1,3})S_/i.exec(s);
        if (m) return parseInt(m[1], 10);

        var re = /_(\d{1,3})(?=_|$)/g, last = 0, n;
        while ((m = re.exec(s)) !== null) {
            n = parseInt(m[1], 10);
            if (LENGTHS[n]) last = n;
        }
        return last;
    }

    function fileName(f) {
        return String(f.fsName).replace(/^.*[\\\/]/, "");
    }

    function two(n) { return n < 10 ? "0" + n : String(n); }

    function stamp(d) {
        if (!d) return "";
        return d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate()) +
               "  " + two(d.getHours()) + ":" + two(d.getMinutes());
    }

    // ------------------------------------------------------------------
    //  Disk
    // ------------------------------------------------------------------
    //  ...\<root>\vfx\shots\...\file.aep  ->  ...\<root>\audio
    function audioFolder(projFile) {
        var parts = String(projFile.fsName).split(/[\\\/]/), i, vfx = -1;
        for (i = 0; i < parts.length; i++)
            if (parts[i].toLowerCase() === "vfx") { vfx = i; break; }
        if (vfx < 1) return null;

        var f = new Folder(parts.slice(0, vfx).join("\\") + "\\" + AUDIO_DIR);
        return f.exists ? f : null;
    }

    function pickFolder(title, start) {
        var f = Folder.selectDialog(title, start ? new Folder(start) : undefined);
        return f ? f.fsName : null;
    }

    function subFolders(folder) {
        var all = folder.getFiles(), out = [], i;
        for (i = 0; i < all.length; i++) if (all[i] instanceof Folder) out.push(all[i]);
        return out;
    }

    function deliveries(root) {
        var dirs = subFolders(root), out = [], i, m;
        for (i = 0; i < dirs.length; i++) {
            m = DATED.exec(dirs[i].name);
            if (m && !SKIP_DIR.test(dirs[i].name)) out.push({ folder: dirs[i], date: m[1] });
        }
        out.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
        return out.slice(0, SCAN_LAST);
    }

    // Audio files of one delivery. The old\ subfolder is what it says it is
    function audioIn(delivery) {
        var out = [];

        function dig(folder, depth) {
            var all = folder.getFiles(), i, f;
            for (i = 0; i < all.length; i++) {
                f = all[i];
                if (f instanceof Folder) {
                    if (depth > 2 || SKIP_DIR.test(f.name)) continue;
                    dig(f, depth + 1);
                } else if (AUDIO_EXT.test(f.name)) {
                    out.push({ file: f, date: delivery.date });
                }
            }
        }

        dig(delivery.folder, 0);
        return out;
    }

    // ------------------------------------------------------------------
    //  Matching
    // ------------------------------------------------------------------
    function collect(root, week, part, spot, offers, len, tag, log) {
        var dels = deliveries(root), out = [], i, j, k, o;

        if (!dels.length) { log.push("No dated folders in " + root.fsName); return out; }
        log.push("Deliveries scanned: " + dels.length +
                 "  (" + dels[dels.length - 1].date + " - " + dels[0].date + ")");

        for (i = 0; i < dels.length; i++) {
            var files = audioIn(dels[i]);

            for (j = 0; j < files.length; j++) {
                var name = fileName(files[j].file);

                if (week) {
                    var w = weekOf(name);
                    if (!w || w.n !== week) continue;
                    if (w.part && part && w.part !== part) continue;
                }

                if (!hasTag(name, tag)) continue;

                // How many of the project offers this file names
                var ft = tokens(name), hits = [];
                for (o = 0; o < offers.length; o++)
                    if (bestScore(ft, offers[o]) >= MIN_SCORE) hits.push(offers[o]);
                if (!hits.length) continue;

                var fl = lengthOf(name), fs = spotOf(name), mod = null;
                try { mod = files[j].file.modified; } catch (e) {}

                out.push({ file: files[j].file, name: name, date: files[j].date,
                           hits: hits, len: fl, spot: fs, modified: mod,
                           rank: hits.length * 100 +
                                 (len && fl === len ? 40 : 0) +
                                 (spot && fs === spot ? 20 : 0) });
            }
        }

        // best match first, and among equals the file that is actually the freshest
        out.sort(function (a, b) {
            if (a.rank !== b.rank) return b.rank - a.rank;
            var am = a.modified ? a.modified.getTime() : 0,
                bm = b.modified ? b.modified.getTime() : 0;
            if (am !== bm) return bm - am;
            return a.date < b.date ? 1 : -1;
        });

        if (out.length > MAX_ROWS) {
            log.push("Showing the best " + MAX_ROWS + " of " + out.length + " matches.");
            out = out.slice(0, MAX_ROWS);
        }
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

    // Every audio footage item already in the project - the replace targets
    function audioItems() {
        var out = [], i, it, s;
        for (i = 1; i <= app.project.numItems; i++) {
            it = app.project.item(i);
            if (!(it instanceof FootageItem)) continue;
            if (!it.hasAudio || it.hasVideo) continue;
            try {
                s = it.mainSource;
                if (s instanceof FileSource) out.push(it);
            } catch (e) {}
        }
        return out;
    }

    function usageCount(item) {
        var n = 0, i, j, c, L;
        for (i = 1; i <= app.project.numItems; i++) {
            c = app.project.item(i);
            if (!(c instanceof CompItem)) continue;
            for (j = 1; j <= c.numLayers; j++) {
                L = c.layer(j);
                try { if (L.source && L.source.id === item.id) n++; } catch (e) {}
            }
        }
        return n;
    }

    function importInto(file, dest) {
        var io = new ImportOptions(file);
        io.importAs = ImportAsType.FOOTAGE;
        var it = app.project.importFile(io);
        it.parentFolder = dest;
        return it;
    }

    // ------------------------------------------------------------------
    //  Run
    // ------------------------------------------------------------------
    function run(rows, log) {
        var dest = findFolderItem(DEST_FOLDER) || app.project.items.addFolder(DEST_FOLDER);
        var done = [], failed = [], i, was, wasDur;

        app.beginUndoGroup(SCRIPT_NAME);
        try {
            for (i = 0; i < rows.length; i++) {
                try {
                    if (rows[i].target) {
                        was = rows[i].target.name;
                        wasDur = rows[i].target.duration;
                        rows[i].target.replace(rows[i].file);

                        done.push(was + "\n      ->  " + rows[i].name + "\n      " +
                                  wasDur.toFixed(2) + "s  ->  " + rows[i].target.duration.toFixed(2) + "s" +
                                  (Math.abs(wasDur - rows[i].target.duration) > 0.04
                                      ? "   (length changed - check the trims)" : ""));
                    } else {
                        importInto(rows[i].file, dest);
                        done.push("added:  " + rows[i].name);
                    }
                } catch (e) {
                    failed.push(rows[i].name + " - " + (e.message || e));
                }
            }
        } finally {
            app.endUndoGroup();
        }

        var msg = done.length ? ("Done: " + done.length + "\n" + done.join("\n")) : "Nothing was changed.";
        if (failed.length) msg += "\n\nFailed:\n" + failed.join("\n");
        if (log.length) msg += "\n\n" + log.join("\n");
        alert(SCRIPT_NAME + "\n\n" + msg);
    }

    // ------------------------------------------------------------------
    //  Window
    // ------------------------------------------------------------------
    function ui(ctx) {
        var W = [150, 330, 110, 45, 230];

        var w = new Window("palette", SCRIPT_NAME, undefined, { resizeable: true });
        w.orientation = "column";
        w.alignChildren = ["fill", "top"];
        w.spacing = 8;
        w.margins = 12;

        var head = w.add("panel", undefined, "Project");
        head.orientation = "column";
        head.alignChildren = ["fill", "top"];
        head.margins = 10;
        head.spacing = 6;

        var ttl = head.add("statictext", undefined, ctx.projName);
        try {
            ttl.graphics.font = ScriptUI.newFont(ttl.graphics.font.name, ScriptUI.FontStyle.BOLD,
                                                 ttl.graphics.font.size);
        } catch (e) {}

        var g1 = head.add("group");
        g1.add("statictext", undefined, "Week:");
        var fWeek = g1.add("edittext", undefined, ctx.week ? String(ctx.week) : "");
        fWeek.characters = 4;
        fWeek.helpTip = "Leave empty to ignore the week and go by the offers alone.";
        g1.add("statictext", undefined, "Part:");
        var fPart = g1.add("edittext", undefined, ctx.part);
        fPart.characters = 3;
        g1.add("statictext", undefined, "Spot:");
        var fSpot = g1.add("edittext", undefined, ctx.spot);
        fSpot.characters = 3;
        g1.add("statictext", undefined, "Length:");
        var fLen = g1.add("edittext", undefined, ctx.len ? String(ctx.len) : "");
        fLen.characters = 4;
        g1.add("statictext", undefined, "Tag:").preferredSize.width = 34;
        var fTag = g1.add("edittext", undefined, ctx.tag);
        fTag.characters = 6;
        fTag.helpTip = "NS, TW, FN and the like - only files of this show are taken.\n" +
                       "Clear it to take everything of this week.";
        fLen.helpTip = "Seconds. Spot and length only push the better match up the list,\n" +
                       "they never throw a file out.";

        var g2 = head.add("group");
        g2.alignChildren = ["fill", "center"];
        g2.add("statictext", undefined, "Offers:");
        var fOffers = g2.add("edittext", undefined, ctx.offers.join(", "));
        fOffers.characters = 60;

        var g3 = head.add("group");
        g3.alignChildren = ["fill", "center"];
        g3.add("statictext", undefined, "Audio:");
        var fRoot = g3.add("edittext", undefined, ctx.root);
        fRoot.characters = 56;
        var paste = g3.add("button", undefined, "Paste");
        paste.preferredSize = [55, 22];
        paste.helpTip = "Empties the field and puts the cursor in it - then Ctrl+V and Rescan.";
        var browse = g3.add("button", undefined, "...");
        browse.preferredSize = [30, 22];
        var rescan = g3.add("button", undefined, "Rescan");
        rescan.preferredSize.width = 70;

        var lp = w.add("panel", undefined, "Delivered audio");
        lp.orientation = "column";
        lp.alignChildren = ["left", "top"];
        lp.margins = 10;
        lp.spacing = 2;

        var hdr = lp.add("group");
        hdr.spacing = 6;
        hdr.add("statictext", undefined, "").preferredSize.width = 16;
        var titles = ["Offers matched", "File", "On disk", "Len", "What to do"];
        for (var t = 0; t < titles.length; t++)
            hdr.add("statictext", undefined, titles[t]).preferredSize.width = W[t];

        var listGrp = lp.add("group");
        listGrp.orientation = "column";
        listGrp.alignChildren = ["left", "top"];
        listGrp.spacing = 2;

        var note = w.add("statictext", undefined, "", { multiline: true });
        note.preferredSize.height = 34;

        var bg = w.add("group");
        bg.alignment = ["fill", "bottom"];
        bg.alignChildren = ["fill", "center"];
        var ok = bg.add("button", undefined, "Apply ticked");
        var close = bg.add("button", undefined, "Close");
        ok.preferredSize.height = 24;
        close.preferredSize = [90, 24];
        close.alignment = ["right", "center"];
        close.onClick = function () { w.close(); };

        var rows = [], log = [];

        function fill() {
            log = [];
            while (listGrp.children.length) listGrp.remove(listGrp.children[0]);
            rows = [];

            var root = new Folder(String(fRoot.text).replace(/^\s+|\s+$/g, ""));
            if (!root.exists) {
                note.text = "No such folder:\n" + fRoot.text;
                w.layout.layout(true);
                return;
            }
            setSetting("root", root.fsName);

            var offers = [], raw = String(fOffers.text).split(","), i, tk;
            for (i = 0; i < raw.length; i++) {
                tk = norm(raw[i]);
                if (tk) offers.push(tk);
            }

            var week = parseInt(fWeek.text, 10);
            if (isNaN(week)) week = 0;
            var len = parseInt(fLen.text, 10);
            if (isNaN(len)) len = 0;

            rows = collect(root, week, String(fPart.text).toUpperCase(),
                           String(fSpot.text).replace(/^\s+|\s+$/g, ""), offers, len,
                           norm(fTag.text), log);

            var targets = audioItems(), j;

            for (i = 0; i < rows.length; i++) {
                var r = rows[i];

                var choices = ["Add as new"];
                for (j = 0; j < targets.length; j++)
                    choices.push("Replace " + targets[j].name);

                var row = listGrp.add("group");
                row.spacing = 6;
                row.alignChildren = ["left", "center"];

                var cb = row.add("checkbox", undefined, "");
                cb.preferredSize.width = 16;
                cb.value = (i === 0);              // the best match is ticked, the rest are there to compare

                row.add("statictext", undefined, r.hits.join(" ")).preferredSize.width = W[0];
                var ft = row.add("statictext", undefined, r.name);
                ft.preferredSize.width = W[1];
                ft.helpTip = r.file.fsName;
                row.add("statictext", undefined, stamp(r.modified) || r.date).preferredSize.width = W[2];
                row.add("statictext", undefined, r.len ? r.len + "s" : "").preferredSize.width = W[3];

                var dd = row.add("dropdownlist", undefined, choices);
                dd.preferredSize.width = W[4];
                dd.selection = targets.length ? 1 : 0;     // replacing the audio that is already there

                r.cb = cb;
                r.dd = dd;
                r.targets = targets;
            }

            note.text = rows.length
                ? (rows.length + " file(s) match.   " + log.join("   "))
                : ("Nothing matches this project.   " + log.join("   "));

            w.layout.layout(true);
            w.layout.resize();
        }

        paste.onClick = function () {
            fRoot.text = "";
            fRoot.active = true;
            note.text = "Press Ctrl+V, then Rescan.";
        };

        browse.onClick = function () {
            var f = pickFolder("Folder with the dated audio deliveries",
                               String(fRoot.text).replace(/^\s+|\s+$/g, ""));
            if (f) { fRoot.text = f; fill(); }
        };

        rescan.onClick = fill;

        ok.onClick = function () {
            var picked = [], i, sel;
            for (i = 0; i < rows.length; i++) {
                if (!rows[i].cb.value) continue;
                sel = rows[i].dd.selection ? rows[i].dd.selection.index : 0;
                rows[i].target = sel > 0 ? rows[i].targets[sel - 1] : null;
                picked.push(rows[i]);
            }
            if (!picked.length) { alert("Nothing is ticked."); return; }

            var used = {}, i2;
            for (i2 = 0; i2 < picked.length; i2++) {
                if (!picked[i2].target) continue;
                if (used[picked[i2].target.id]) {
                    alert("Two files are set to replace the same item:\n" +
                          picked[i2].target.name + "\n\nLeave one of them ticked.");
                    return;
                }
                used[picked[i2].target.id] = true;
            }

            run(picked, log);
            fill();
        };

        fill();
        w.center();
        w.show();
        $.global.__replaceAudioWindow = w;
    }

    // ------------------------------------------------------------------
    //  Start
    // ------------------------------------------------------------------
    if (!app.project || !app.project.file) {
        alert(SCRIPT_NAME + "\n\nSave the project first - the script reads the week,\n" +
                            "the spot and the offers from its file name.");
        return;
    }

    var projName = app.project.file.name.replace(/\.aep[x]?$/i, "");
    var wk = weekOf(projName) || { n: 0, part: "" };
    var guess = audioFolder(app.project.file);
    var root = guess ? guess.fsName : getSetting("root", "");

    var tag = tagOf(projName);
    var offers = [], tk = tokens(projName), n;
    for (n = 0; n < tk.length; n++) if (tk[n] !== tag) offers.push(tk[n]);

    ui({ projName: projName, week: wk.n, part: wk.part, spot: spotOf(projName),
         len: lengthOf(projName), tag: tag, offers: offers, root: root });

})();
