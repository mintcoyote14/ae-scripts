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

    var SCRIPT_NAME = "Import CENOWKI + WIZKI";
    var DEST_FOLDER = "_CENOWKI";
    var WIZKI_NAMES = ["WIZKI", "_WIZKI"];     // whichever of the two the project already uses
    var WIZKI_EXT   = /\.(png|tif|tiff|tga|psd|jpg|jpeg)$/i;
    var OUT_DIR     = "_out";
    var PLANSZE     = "Plansze_Do_Spotu";
    var CLIENT_DIR  = "client";
    var DELIVERY     = /^(\d{8})_CENOWK[AI]/i; // 20260915_CENOWKI, 20260126_CENOWKA
    var DELIVERY_ANY = /^(\d{8})/;             // any dated delivery folder
    var TIME_DIR    = /^(\d{3,4})$/;           // 1049
    var SCAN_LAST   = 15;                      // how many deliveries to look through
    var MIN_SCORE   = 60;                      // below this an offer is not a match
    var OLD_FOLDER  = "_OLD";                  // where replaced cenowki are parked
    var SETTINGS    = "ImportCenowki";

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

    // Edit distance that also counts a swap of two letters as one mistake,
    // because that is what the typos actually look like: Kilebasy/Kielbasa
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

    // How close two offer names are. 100 - the same word, 0 - unrelated.
    // A couple of letters may differ - a declension, a typo, a missing
    // ending - but never a whole word: Parowki and Pierogi are four letters
    // apart and must stay apart.
    function score(a, b) {
        if (!a || !b) return 0;
        if (a === b) return 100;

        var mn = Math.min(a.length, b.length), mx = Math.max(a.length, b.length), d;

        // one is the start of the other, with at most two letters hanging off:
        // Losos / Lososie
        if (mn >= 4 && mx - mn <= 2 && (a.indexOf(b) === 0 || b.indexOf(a) === 0)) return 85;

        d = lev(a, b);
        if (mn >= 4 && d <= 1) return 85;      // Kawa / Kawy, Oueen / Queen
        if (mn >= 6 && d <= 2) return 70;      // Kilebasy / Kielbasa
        return 0;
    }

    // Offer names get split by underscores, so VITAL_FRESZ arrives as two
    // tokens while the project spells it VitalFresh. Glued neighbours are
    // tried as well, and they go through the same tight test.
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

    // Everything that is not an offer name
    var JUNK = /^(V\d+|\d+S|\d+|DIGITAL|BUMPER|CNC|OK|FINAL|NEW|COPY|PSD|JPG|PNG|REGULAR|START|ALPHA|RGB|MATTE|BLAT|TLO)$/;
    var WEEK_TOKEN = /^([A-Z]{0,3}[WT]\d{1,2}[A-D]?|\d{1,2}[A-D])$/;

    function tokens(name) {
        var raw = String(name).replace(/\.[^.]+$/, "").split(/[^A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż]+/);
        var out = [], t, i;
        for (i = 0; i < raw.length; i++) {
            t = norm(raw[i]);
            if (!t) continue;
            if (JUNK.test(t)) continue;
            if (WEEK_TOKEN.test(t)) continue;
            if (/^[AB]$/.test(t)) continue;

            // a forgotten underscore glues the version onto the offer:
            // W37C_1_NS_Banany_Slaska_Mielone_Praniev01 -> Pranie
            var g = /^(.{4,})V\d+$/.exec(t);
            out.push(g ? g[1] : t);
        }
        return out;
    }

    // Every spelling the week shows up in across the Biedronka projects:
    // W39A, w38B, w37_B, T38A, NSW37C, TW37C, GANG_W37A, FN_W37,
    // and the bare 17A that the Swiezaki shot folders use
    function weekOf(name) {
        var s = String(name);
        var m = /(?:^|[^A-Za-z0-9])([A-Z]{0,3})[WT]\s*_?(\d{1,2})\s*_?([A-D])?(?![A-Za-z0-9])/i.exec(s);
        if (m) return { pre: m[1].toUpperCase(), n: parseInt(m[2], 10),
                        part: m[3] ? m[3].toUpperCase() : "" };

        m = /^(\d{1,2})\s*_?([A-D])(?![A-Za-z0-9])/i.exec(s);
        if (!m) return null;
        return { pre: "", n: parseInt(m[1], 10), part: m[2].toUpperCase() };
    }

    function spotOf(name) {
        var m = /[WT]\s*_?\d{1,2}\s*_?[A-D]?_(\d)_/i.exec(String(name));
        return m ? m[1] : "";
    }

    function versionOf(name) {
        var m = /_V(\d+)/i.exec(String(name));
        return m ? parseInt(m[1], 10) : 0;
    }

    function fileName(f) {
        return String(f.fsName).replace(/^.*[\\\/]/, "");
    }

    // Several productions run two shows out of one client folder, and the
    // show is written as a short tag right after the week:
    //   W38_FN_Jaja_Kefiry_v01.aep          -> FN_W38_Jaja_v02.psd
    //   W38C_1_NS_Lopatka_Kawa_v01.aep      -> NSW38C_Kawa.psd
    //   W38C_TW_Sliwka_Filet_v01.aep        -> TW38C_Sliwka.psd
    // Both Weekend shows carry a Filet, so without the tag they would take
    // each other's files.
    function tagOf(projFile, projName) {
        var tk = tokens(projName), k;

        // The two-letter word right after the week is the show: NS, TW, FN, FW.
        // Two letters exactly, otherwise a spot that opens with a short offer
        // - W36B_1_Ser_Parowki_Kosmetyki - would read Ser as a show.
        for (k = 0; k < tk.length; k++) {
            if (tk[k].length > 2) break;              // an offer name, so there was no tag
            if (tk[k].length === 2 && !/\d/.test(tk[k])) return tk[k];
        }

        // otherwise the initials of the shot folder, if the project name
        // spells them out as well
        var parts = String(projFile.fsName).split(/[\\\/]/), i, shots = -1, folder = "";
        for (i = 0; i < parts.length; i++)
            if (parts[i].toLowerCase() === "shots") { shots = i; break; }
        if (shots < 0) return "";

        for (i = shots + 1; i < parts.length - 1; i++) {
            if (/^\d{4}$/.test(parts[i])) continue;            // year
            folder = parts[i];
            break;
        }
        if (!folder) return "";

        var words = folder.split(/[^A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]+/), tag = "";
        for (k = 0; k < words.length; k++)
            if (words[k].length >= 3) tag += norm(words[k].charAt(0));
        if (tag.length < 2) return "";

        for (k = 0; k < tk.length; k++) if (tk[k] === tag) return tag;
        return "";
    }

    // Does this file belong to the tagged show? The tag shows up either as
    // a word of its own (W38C_NS_Kawa, FN_W38_Jaja) or glued to the week
    // (NSW38C_Kawa, TW38C_Sliwka). A project tag of TW matches a TW38C file,
    // whose week prefix reads as plain T.
    function hasTag(name, tag, folderName) {
        if (!tag) return true;

        var tk = tokens(name), k;
        for (k = 0; k < tk.length; k++) if (tk[k] === tag) return true;

        var w = weekOf(name);
        if (w && w.pre && (w.pre === tag || w.pre === tag.replace(/W$/, ""))) return true;

        if (folderName) {
            tk = tokens(folderName);
            for (k = 0; k < tk.length; k++) if (tk[k] === tag) return true;
        }
        return false;
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

    //  The product shots live under  vfx\_out , sometimes one or two
    //  levels down:
    //    ...\vfx\_out\Plansze_Do_Spotu\NISKIE_CENY\W39\W39A_Milka_v03_Alpha.png
    //    ...\vfx\_out\W39\...
    //  Swiezaki is the odd one - its wizki sit in the PricesOnGoing
    //  project, under Plansze_Do_Spotu\FRESH - so the guess is only a
    //  starting point and the field stays editable.
    function wizkiFolder(projFile) {
        var parts = String(projFile.fsName).split(/[\\\/]/), i, vfx = -1, f, sub = "";
        for (i = 0; i < parts.length; i++)
            if (parts[i].toLowerCase() === "vfx") { vfx = i; break; }
        if (vfx < 1) return null;

        // the subproject the project sits in, if there is one
        for (i = vfx + 1; i < parts.length - 1; i++) {
            if (/^(shots|compo)$/i.test(parts[i])) continue;
            if (/^\d{4}$/.test(parts[i])) continue;
            if (/^[A-Z]{0,3}[WT]\d{1,2}[A-D]?$/i.test(parts[i])) continue;
            sub = parts[i];
            break;
        }

        var out = new Folder(parts.slice(0, vfx + 1).join("\\") + "\\" + OUT_DIR);
        if (!out.exists) return null;

        var deeper = new Folder(out.fsName + "\\" + PLANSZE);
        if (deeper.exists) out = deeper;

        if (sub) {
            var dirs = subFolders(out), want = norm(sub);
            for (i = 0; i < dirs.length; i++)
                if (norm(dirs[i].name) === want) return dirs[i];
        }
        return out;
    }

    // Wizki of one week. The week folders are W39 and the like; when there
    // is no such folder the root itself is read.
    function wizkiIn(root, week) {
        var out = [], dirs = subFolders(root), i, hit = [];

        if (week)
            for (i = 0; i < dirs.length; i++) {
                var w = weekOf(dirs[i].name);
                if (w && w.n === week) hit.push(dirs[i]);
            }
        if (!hit.length) hit = [root];

        function dig(folder, depth) {
            var all = folder.getFiles(), j, f;
            for (j = 0; j < all.length; j++) {
                f = all[j];
                if (f instanceof Folder) {
                    if (depth < 1) dig(f, depth + 1);
                } else if (WIZKI_EXT.test(f.name)) {
                    out.push(f);
                }
            }
        }

        for (i = 0; i < hit.length; i++) dig(hit[i], week ? 0 : 1);
        return out;
    }

    // ------------------------------------------------------------------
    //  Folder picker
    // ------------------------------------------------------------------
    //  The plain built-in dialog: it opens instantly and opens nothing else
    //  along with it. For a path copied from Explorer use Paste instead.
    function pickFolder(title, start) {
        var f = Folder.selectDialog(title, start ? new Folder(start) : undefined);
        return f ? f.fsName : null;
    }

    function subFolders(folder) {
        var all = folder.getFiles(), out = [], i;
        for (i = 0; i < all.length; i++) if (all[i] instanceof Folder) out.push(all[i]);
        return out;
    }

    // Deliveries, newest first, capped at SCAN_LAST
    function deliveries(client, anyDated) {
        var dirs = subFolders(client), out = [], i, m;
        for (i = 0; i < dirs.length; i++) {
            m = (anyDated ? DELIVERY_ANY : DELIVERY).exec(dirs[i].name);
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
                    var mod = null;
                    try { mod = f.modified; } catch (e) {}
                    out.push({ file: f, date: delivery.date, time: time || "0000", modified: mod,
                               from: folder.name });      // the unzipped folder often carries the tag
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
    function collect(client, week, part, offers, tag, anyDated, log) {
        var dels = deliveries(client, anyDated), all = [], i, j, k;

        if (!dels.length) return [];
        log.push("Deliveries scanned: " + dels.length +
                 "  (" + dels[dels.length - 1].date + " - " + dels[0].date + ")");

        for (i = 0; i < dels.length; i++) {
            var psds = psdsIn(dels[i]);
            for (j = 0; j < psds.length; j++) {
                var name = fileName(psds[j].file);
                // With no week given the offer names alone decide - that is
                // how the projects built around themes rather than weeks work
                if (week) {
                    var w = weekOf(name);
                    if (!w || w.n !== week) continue;
                    if (w.part && part && w.part !== part) continue;   // FN_W37 with no part - every part
                }

                // NABIALU must not pull in the WEDLIN cenowki, and NS must not
                // pull in the TW ones. The folder the file came unzipped into
                // counts too - it often carries the tag when the file does not.
                if (!hasTag(name, tag, psds[j].from)) continue;

                var ft = tokens(name), best = 0, hit = "", s;

                for (var o = 0; o < offers.length; o++) {
                    s = bestScore(ft, offers[o]);
                    if (s > best) { best = s; hit = offers[o]; }
                }

                // The file belongs to this week and this show, but its name is
                // not the offer name - Berlinki for Parowki, Filetzkurczaka for
                // Filet. Guessing those would mean loosening the matching until
                // it starts lying, so they are shown as "?" for a manual tick.
                all.push({ file: psds[j].file, name: name, score: best,
                           offer: best >= MIN_SCORE ? hit : "?",
                           date: psds[j].date, time: psds[j].time, modified: psds[j].modified,
                           ver: versionOf(name) });
            }
        }

        // Newest first: delivery date, then the HHMM folder, then the version
        // in the name. When none of that separates two files - and with this
        // agency it often does not, every file is called the same and carries
        // no version - the timestamp on disk decides.
        all.sort(function (a, b) {
            if (a.date !== b.date) return a.date < b.date ? 1 : -1;
            if (a.time !== b.time) return a.time < b.time ? 1 : -1;
            if (a.ver !== b.ver) return b.ver - a.ver;
            var am = a.modified ? a.modified.getTime() : 0,
                bm = b.modified ? b.modified.getTime() : 0;
            if (am !== bm) return bm - am;
            return a.name < b.name ? -1 : 1;
        });

        // One file per offer - the first one left standing after the sort.
        // The unnamed ones are kept apart: one per file name, all listed.
        var taken = {}, seen = {}, out = [], extra = [];
        for (i = 0; i < all.length; i++) {
            if (all[i].offer === "?") {
                if (seen[all[i].name]) continue;
                seen[all[i].name] = true;
                extra.push(all[i]);
                continue;
            }
            if (taken[all[i].offer]) continue;
            taken[all[i].offer] = true;
            out.push(all[i]);
        }

        for (i = 0; i < offers.length; i++)
            if (!taken[offers[i]]) log.push("No cenowka yet for: " + offers[i]);

        return out.concat(extra);
    }

    //  The same idea for the product shots: newest version per offer.
    //  W39A_Milka_v03_Alpha.png beats W39A_Milka_v01_Alpha.png.
    function collectW(root, week, part, offers, tag, log) {
        var files = wizkiIn(root, week), all = [], i, k, o;

        for (i = 0; i < files.length; i++) {
            var name = fileName(files[i]);
            if (/^thumbs\.db$/i.test(name)) continue;

            if (week) {
                var w = weekOf(name);
                if (!w || w.n !== week) continue;
                if (w.part && part && w.part !== part) continue;
            }

            // both Weekend shows have a Filet: W38C_NS_Filet and W38C_TW_Filet
            if (!hasTag(name, tag, files[i].parent ? files[i].parent.name : "")) continue;

            var ft = tokens(name), best = 0, hit = "", s;
            for (o = 0; o < offers.length; o++) {
                s = bestScore(ft, offers[o]);
                if (s > best) { best = s; hit = offers[o]; }
            }

            var mod = null;
            try { mod = files[i].modified; } catch (e) {}
            all.push({ file: files[i], name: name, score: best, kind: "wizka",
                       offer: best >= MIN_SCORE ? hit : "?",
                       ver: versionOf(name), modified: mod,
                       date: mod ? stamp(mod) : "", time: "" });
        }

        // highest version wins, and among equal versions the fresher file
        all.sort(function (a, b) {
            if (a.ver !== b.ver) return b.ver - a.ver;
            var am = a.modified ? a.modified.getTime() : 0,
                bm = b.modified ? b.modified.getTime() : 0;
            if (am !== bm) return bm - am;
            return a.name < b.name ? -1 : 1;
        });

        var taken = {}, seen = {}, out = [], extra = [];
        for (i = 0; i < all.length; i++) {
            if (all[i].offer === "?") {
                if (seen[all[i].name]) continue;
                seen[all[i].name] = true;
                extra.push(all[i]);
                continue;
            }
            if (taken[all[i].offer]) continue;
            taken[all[i].offer] = true;
            out.push(all[i]);
        }

        for (i = 0; i < offers.length; i++)
            if (!taken[offers[i]]) log.push("No wizka yet for: " + offers[i]);

        return out.concat(extra);
    }

    function two(n) { return n < 10 ? "0" + n : String(n); }

    function stamp(d) {
        return d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate()) +
               "  " + two(d.getHours()) + ":" + two(d.getMinutes());
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

    // Which file on disk a comp was built from - the layers of a PSD import
    // all point back at the same psd
    function compSourceFile(comp) {
        var j, L, src;
        for (j = 1; j <= comp.numLayers; j++) {
            L = comp.layer(j);
            try {
                src = L.source;
                if (src && (src.mainSource instanceof FileSource) && src.mainSource.file)
                    return String(src.mainSource.file.fsName);
            } catch (e) {}
        }
        return "";
    }

    // Is this project item literally the file we are looking at, and not
    // just something that happens to carry the same name? With files that
    // arrive unversioned - NSW38C_Kawa.psd three times in one day - the
    // name proves nothing.
    function isSameFile(item, file) {
        if (!item) return false;
        var want = String(file.fsName);
        try {
            if (item instanceof CompItem) return compSourceFile(item) === want;
            if ((item instanceof FootageItem) && (item.mainSource instanceof FileSource) &&
                item.mainSource.file)
                return String(item.mainSource.file.fsName) === want;
        } catch (e) {}
        return false;
    }

    // A wizka keeps its file name in the project, extension and all
    function footageNamed(name) {
        var bare = String(name).replace(/\.[^.]+$/, "");
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (!(it instanceof FootageItem)) continue;
            if (it.name === name || it.name === bare) return it;
        }
        return null;
    }

    function idSnapshot() {
        var map = {}, i;
        for (i = 1; i <= app.project.numItems; i++) map[app.project.item(i).id] = true;
        return map;
    }

    // Whichever spelling of the wizki folder the project already has
    function wizkiDest() {
        var i, f;
        for (i = 0; i < WIZKI_NAMES.length; i++) {
            f = findFolderItem(WIZKI_NAMES[i]);
            if (f) return f;
        }
        return app.project.items.addFolder(WIZKI_NAMES[0]);
    }

    function importFootage(file, dest) {
        var io = new ImportOptions(file);
        io.importAs = ImportAsType.FOOTAGE;
        var it = app.project.importFile(io);
        it.parentFolder = dest;
        return it;
    }

    // Older wizki of the same offer, newest version first. Only what sits
    // in the wizki folder counts, so nothing else in the project is touched.
    function oldWizkiFor(offer, week, part, dest) {
        var out = [], i, it, w, ft, k, best, s;
        if (!dest) return out;

        for (i = 1; i <= app.project.numItems; i++) {
            it = app.project.item(i);
            if (!(it instanceof FootageItem)) continue;
            if (!insideFolder(it, dest)) continue;
            try { if (!(it.mainSource instanceof FileSource)) continue; } catch (e) { continue; }

            w = weekOf(it.name);
            if (week && w && w.n !== week) continue;
            if (week && w && w.part && part && w.part !== part) continue;

            if (bestScore(tokens(it.name), offer) >= MIN_SCORE) out.push(it);
        }

        out.sort(function (a, b) {
            var d = versionOf(b.name) - versionOf(a.name);
            return d !== 0 ? d : (a.name < b.name ? 1 : -1);
        });
        return out;
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
    //  Replacing an older cenowka
    // ------------------------------------------------------------------
    //  Only comps that sit inside _CENOWKI are ever treated as cenowki,
    //  so the spot comp itself can never be picked up by mistake
    function insideFolder(item, folder) {
        var p = item.parentFolder, guard = 0;
        while (p && guard++ < 20) {
            if (p.id === folder.id) return true;
            p = p.parentFolder;
        }
        return false;
    }

    // Older comps of the same offer, newest version first
    function oldCompsFor(offer, week, part, dest) {
        var out = [], i, it, w, ft, k, best;
        if (!dest) return out;

        for (i = 1; i <= app.project.numItems; i++) {
            it = app.project.item(i);
            if (!(it instanceof CompItem)) continue;
            if (!insideFolder(it, dest)) continue;

            w = weekOf(it.name);
            if (!w || w.n !== week) continue;
            if (w.part && part && w.part !== part) continue;

            if (bestScore(tokens(it.name), offer) >= MIN_SCORE) out.push(it);
        }

        out.sort(function (a, b) {
            var d = versionOf(b.name) - versionOf(a.name);
            return d !== 0 ? d : (a.name < b.name ? 1 : -1);
        });
        return out;
    }

    // Every layer built on the old cenowka starts using the new one.
    // Keyframes, effects and transforms stay where they are.
    function replaceUsages(oldComp, newComp) {
        var n = 0, i, j, c, L, src;
        for (i = 1; i <= app.project.numItems; i++) {
            c = app.project.item(i);
            if (!(c instanceof CompItem)) continue;
            if (c.id === newComp.id || c.id === oldComp.id) continue;

            for (j = 1; j <= c.numLayers; j++) {
                L = c.layer(j);
                try {
                    src = L.source;
                    if (src && src.id === oldComp.id) { L.replaceSource(newComp, false); n++; }
                } catch (e) {}
            }
        }
        return n;
    }

    // The replaced comp and its Layers folder go to _CENOWKI\_OLD
    function archive(comp, dest) {
        var old = null, i, it;
        for (i = 1; i <= app.project.numItems; i++) {
            it = app.project.item(i);
            if ((it instanceof FolderItem) && it.name === OLD_FOLDER && insideFolder(it, dest)) { old = it; break; }
        }
        if (!old) { old = app.project.items.addFolder(OLD_FOLDER); old.parentFolder = dest; }

        var layersName = comp.name + " Layers";
        for (i = 1; i <= app.project.numItems; i++) {
            it = app.project.item(i);
            if ((it instanceof FolderItem) && it.name === layersName) { it.parentFolder = old; break; }
        }
        comp.parentFolder = old;
    }

    // ------------------------------------------------------------------
    //  Run
    // ------------------------------------------------------------------
    function run(rows, opts, log) {
        var dest = findFolderItem(DEST_FOLDER) || app.project.items.addFolder(DEST_FOLDER);
        var wdest = null;
        var added = [], swapped = [], failed = [], i, c, n, was;

        app.beginUndoGroup(SCRIPT_NAME);
        try {
            for (i = 0; i < rows.length; i++) {
                try {
                    // A wizka is a plain still: swapping the file under the
                    // footage item leaves every layer exactly as it was
                    if (rows[i].kind === "wizka") {
                        if (rows[i].old) {
                            was = rows[i].old.name;
                            rows[i].old.replace(rows[i].file);
                            swapped.push(was + "   ->   " + rows[i].old.name);
                        } else {
                            if (!wdest) wdest = wizkiDest();
                            importFootage(rows[i].file, wdest);
                            added.push(rows[i].offer + "   <-   " + rows[i].name);
                        }
                        continue;
                    }

                    c = importPsd(rows[i].file, dest);

                    if (rows[i].old) {
                        was = rows[i].old.name;
                        n = replaceUsages(rows[i].old, c);
                        if (opts.archive) archive(rows[i].old, dest);

                        // When the file carries no version the new comp comes
                        // in as "NSW38C_Kawa 2". The comp the project actually
                        // uses should keep the plain name.
                        var base = rows[i].name.replace(/\.[^.]+$/, "");
                        if (c.name !== base && was === base) {
                            try {
                                rows[i].old.name = base + " (replaced)";
                                c.name = base;
                            } catch (e2) {}
                        }

                        swapped.push(was + "   ->   " + c.name +
                                     "   (" + n + " layer" + (n === 1 ? "" : "s") + ")");
                    } else {
                        added.push(rows[i].offer + "   <-   " + c.name);
                    }
                } catch (e) {
                    failed.push(rows[i].name + " - " + (e.message || e));
                }
            }
        } finally {
            app.endUndoGroup();
        }

        var msg = "";
        if (added.length)   msg += "Added: " + added.length + "\n" + added.join("\n") + "\n\n";
        if (swapped.length) msg += "Replaced: " + swapped.length + "\n" + swapped.join("\n") +
                                   (opts.archive ? "\n(old ones moved to " + OLD_FOLDER + ")" : "") + "\n\n";
        if (!added.length && !swapped.length) msg += "Nothing was imported.\n\n";
        if (failed.length)  msg += "Failed:\n" + failed.join("\n") + "\n\n";
        if (log.length)     msg += log.join("\n");

        alert(SCRIPT_NAME + "\n\n" + msg);
    }

    // ------------------------------------------------------------------
    //  Window
    // ------------------------------------------------------------------
    function ui(ctx) {
        var W = [60, 110, 250, 120, 250];      // column widths

        // A floating window, not a modal dialog: After Effects stays usable
        // while it is open, so the list can be worked through a file at a time
        var w = new Window("palette", SCRIPT_NAME, undefined, { resizeable: true });
        w.orientation = "column";
        w.alignChildren = ["fill", "top"];
        w.spacing = 8;
        w.margins = 12;

        // ---- project -------------------------------------------------
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
        fWeek.helpTip = "Leave empty to ignore the week and go by the offer names alone.";
        fWeek.characters = 4;
        g1.add("statictext", undefined, "Part:");
        var fPart = g1.add("edittext", undefined, ctx.part);
        fPart.characters = 3;
        g1.add("statictext", undefined, "Spot:");
        g1.add("statictext", undefined, ctx.spot || "-");
        g1.add("statictext", undefined, "Tag:").preferredSize.width = 40;
        var fTag = g1.add("edittext", undefined, ctx.tag);
        fTag.characters = 6;
        fTag.helpTip = "FN, FW and the like. Only files carrying it are taken.\n" +
                       "Clear it to take everything of this week.";

        var g2 = head.add("group");
        g2.alignChildren = ["fill", "center"];
        g2.add("statictext", undefined, "Offers:");
        var fOffers = g2.add("edittext", undefined, ctx.offers.join(", "));
        fOffers.characters = 48;
        fOffers.helpTip = "Comma separated. Edit them if the project name does not spell them out.";

        // ---- client folder --------------------------------------------
        var g3 = head.add("group");
        g3.alignChildren = ["fill", "center"];
        g3.add("statictext", undefined, "Client:");
        var fClient = g3.add("edittext", undefined, ctx.client);
        fClient.characters = 44;
        fClient.helpTip = "The folder holding the YYYYMMDD_CENOWKI deliveries.";
        var paste = g3.add("button", undefined, "Paste");
        paste.preferredSize = [55, 22];
        paste.helpTip = "Empties the field and puts the cursor in it - then Ctrl+V and Rescan.";
        var browse = g3.add("button", undefined, "...");
        browse.preferredSize = [30, 22];
        var rescan = g3.add("button", undefined, "Rescan");
        rescan.preferredSize.width = 70;

        // ---- wizki folder ---------------------------------------------
        var g4 = head.add("group");
        g4.alignChildren = ["fill", "center"];
        g4.add("statictext", undefined, "Wizki:");
        var fWizki = g4.add("edittext", undefined, ctx.wizki);
        fWizki.characters = 44;
        fWizki.helpTip = "The vfx\\_out folder with the product shots.\n" +
                         "Empty it to skip the wizki entirely.";
        var pasteW = g4.add("button", undefined, "Paste");
        pasteW.preferredSize = [55, 22];
        var browseW = g4.add("button", undefined, "...");
        browseW.preferredSize = [30, 22];
        g4.add("statictext", undefined, "").preferredSize.width = 70;

        // ---- file list --------------------------------------------------
        var lp = w.add("panel", undefined, "Files");
        lp.orientation = "column";
        lp.alignChildren = ["left", "top"];
        lp.margins = 10;
        lp.spacing = 2;

        var hdr = lp.add("group");
        hdr.spacing = 6;
        hdr.add("statictext", undefined, "").preferredSize.width = 16;
        var titles = ["Kind", "Offer", "File", "Delivered", "What to do"];
        for (var t = 0; t < titles.length; t++)
            hdr.add("statictext", undefined, titles[t]).preferredSize.width = W[t];

        var listGrp = lp.add("group");
        listGrp.orientation = "column";
        listGrp.alignChildren = ["left", "top"];
        listGrp.spacing = 2;

        var gsel = lp.add("group");
        var bAll = gsel.add("button", undefined, "All");
        var bNone = gsel.add("button", undefined, "None");
        bAll.preferredSize = [60, 22];
        bNone.preferredSize = [60, 22];
        var cbAny = gsel.add("checkbox", undefined, "Look in every dated folder, not only _CENOWKI");
        cbAny.value = getSetting("anyDated", "false") === "true";
        cbAny.onClick = function () { setSetting("anyDated", cbAny.value); fill(); };

        var cbUnnamed = gsel.add("checkbox", undefined, "Show \"?\" files");
        cbUnnamed.value = getSetting("unnamed", "true") === "true";
        cbUnnamed.helpTip = "Right week, right show, but the file is named after a brand\n" +
                            "rather than the offer: Berlinki for Parowki, Filetzkurczaka for Filet.";
        cbUnnamed.onClick = function () { setSetting("unnamed", cbUnnamed.value); fill(); };

        var cbArch = w.add("checkbox", undefined, "Move replaced cenowki to " + DEST_FOLDER + "\\" + OLD_FOLDER);
        cbArch.value = true;

        var note = w.add("statictext", undefined, "", { multiline: true });
        note.preferredSize.height = 34;

        var bg = w.add("group");
        bg.alignment = ["fill", "bottom"];
        bg.alignChildren = ["fill", "center"];
        var ok = bg.add("button", undefined, "Import ticked");
        var close = bg.add("button", undefined, "Close");
        ok.preferredSize.height = 24;
        close.preferredSize = [90, 24];
        close.alignment = ["right", "center"];
        close.onClick = function () { w.close(); };

        var rows = [], log = [];

        function clearRows() {
            while (listGrp.children.length) listGrp.remove(listGrp.children[0]);
        }

        function fill() {
            log = [];
            clearRows();
            rows = [];

            var client = new Folder(String(fClient.text).replace(/^\s+|\s+$/g, ""));
            if (!client.exists) {
                note.text = "No such folder:\n" + fClient.text;
                w.layout.layout(true);
                return;
            }
            setSetting("client", client.fsName);

            var offers = [], raw = String(fOffers.text).split(","), i, tk;
            for (i = 0; i < raw.length; i++) {
                tk = norm(raw[i]);
                if (tk) offers.push(tk);
            }

            // an empty week means: do not filter by week at all
            var week = parseInt(fWeek.text, 10), part = String(fPart.text).toUpperCase();
            if (isNaN(week)) week = 0;
            rows = collect(client, week, part, offers, norm(fTag.text), cbAny.value, log);

            // the product shots of the same week, from vfx\_out
            var wpath = String(fWizki.text).replace(/^\s+|\s+$/g, "");
            if (wpath) {
                var wroot = new Folder(wpath);
                if (wroot.exists) {
                    setSetting("wizki" + ctx.key, wroot.fsName);
                    rows = rows.concat(collectW(wroot, week, part, offers, norm(fTag.text), log));
                } else {
                    log.push("No such wizki folder: " + wpath);
                }
            }

            if (!cbUnnamed.value) {
                var keep = [];
                for (i = 0; i < rows.length; i++) if (rows[i].offer !== "?") keep.push(rows[i]);
                rows = keep;
            }

            var dest = findFolderItem(DEST_FOLDER), wdest = null, j;
            for (j = 0; j < WIZKI_NAMES.length && !wdest; j++) wdest = findFolderItem(WIZKI_NAMES[j]);

            for (i = 0; i < rows.length; i++) {
                var r = rows[i];
                var wizka = r.kind === "wizka";
                var itemName = r.name.replace(/\.[^.]+$/, "");
                var same = wizka ? footageNamed(r.name) : compNamed(itemName);
                var already = isSameFile(same, r.file);      // the very file, not just the name
                var olds = wizka ? oldWizkiFor(r.offer, week, part, wdest)
                                 : oldCompsFor(r.offer, week, part, dest);

                // Replacing something with itself makes no sense; replacing
                // last night's file that carries the same name does.
                var choices = ["Add as new"];
                for (j = 0; j < olds.length; j++)
                    if (!already || olds[j].id !== same.id) choices.push("Replace " + olds[j].name);

                var row = listGrp.add("group");
                row.spacing = 6;
                row.alignChildren = ["left", "center"];

                var cb = row.add("checkbox", undefined, "");
                cb.preferredSize.width = 16;

                row.add("statictext", undefined, wizka ? "wizka" : "cenowka").preferredSize.width = W[0];
                row.add("statictext", undefined, r.offer).preferredSize.width = W[1];
                var ft = row.add("statictext", undefined, r.name);
                ft.preferredSize.width = W[2];
                ft.helpTip = r.file.fsName + (r.modified ? "\non disk: " + stamp(r.modified) : "");
                row.add("statictext", undefined,
                        wizka ? r.date : (r.date + "  " + r.time)).preferredSize.width = W[3];

                var dd = row.add("dropdownlist", undefined, choices);
                dd.preferredSize.width = W[4];
                dd.selection = choices.length > 1 ? 1 : 0;      // replacing wins when there is something to replace

                // "?" rows are a suggestion, never a decision - they stay unticked
                cb.value = !already && r.offer !== "?";
                if (already) {
                    cb.helpTip = itemName + " in the project is this same file.";
                    row.add("statictext", undefined, "already there").preferredSize.width = 130;
                } else if (same) {
                    cb.helpTip = "The project holds another file under the same name:\n" +
                                 (compSourceFile(same) || same.name);
                    row.add("statictext", undefined, "same name, newer file").preferredSize.width = 130;
                }

                r.cb = cb;
                r.dd = dd;
                r.olds = olds;
                r.same = same;
            }

            note.text = rows.length
                ? (rows.length + " file(s) found.   " + log.join("   "))
                : ("Nothing found for " + (week ? "week " + week + part : "these offers") +
                   ".   " + log.join("   "));

            w.layout.layout(true);
            w.layout.resize();
        }

        browse.onClick = function () {
            var f = pickFolder("Client folder with the CENOWKI deliveries",
                               String(fClient.text).replace(/^\s+|\s+$/g, ""));
            if (f) { fClient.text = f; fill(); }
        };

        paste.onClick = function () {
            fClient.text = "";
            fClient.active = true;          // ready for Ctrl+V
            note.text = "Press Ctrl+V, then Rescan.";
        };

        pasteW.onClick = function () {
            fWizki.text = "";
            fWizki.active = true;
            note.text = "Press Ctrl+V, then Rescan.";
        };

        browseW.onClick = function () {
            var f = pickFolder("Folder with the wizki (vfx\\_out)",
                               String(fWizki.text).replace(/^\s+|\s+$/g, ""));
            if (f) { fWizki.text = f; fill(); }
        };

        rescan.onClick = fill;

        bAll.onClick = function () {
            for (var i = 0; i < rows.length; i++) rows[i].cb.value = true;
        };
        bNone.onClick = function () {
            for (var i = 0; i < rows.length; i++) rows[i].cb.value = false;
        };

        ok.onClick = function () {
            var picked = [], i, sel;
            for (i = 0; i < rows.length; i++) {
                if (!rows[i].cb.value) continue;
                sel = rows[i].dd.selection ? rows[i].dd.selection.index : 0;

                // index 0 is "Add as new", the rest point into the olds list
                rows[i].old = null;
                if (sel > 0) {
                    var k = 0, j;
                    for (j = 0; j < rows[i].olds.length; j++) {
                        if (rows[i].same && rows[i].olds[j].id === rows[i].same.id) continue;
                        k++;
                        if (k === sel) { rows[i].old = rows[i].olds[j]; break; }
                    }
                }
                picked.push(rows[i]);
            }
            if (!picked.length) { alert("Nothing is ticked."); return; }

            run(picked, { archive: cbArch.value }, log);
            fill();                      // the window stays open, the list catches up
        };

        fill();
        w.center();
        w.show();
        $.global.__importCenowkiWindow = w;    // keeps the palette alive after the script ends
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
    var wk = weekOf(projName) || { n: 0, part: "" };

    var tried = [];
    var guess = clientFolder(app.project.file, tried);
    var client = guess ? guess.fsName : getSetting("client", "");
    if (!client && tried.length) client = tried[0];

    var tag = tagOf(app.project.file, projName);
    var offers = [], tk = tokens(projName), n;
    for (n = 0; n < tk.length; n++) if (tk[n] !== tag) offers.push(tk[n]);

    // Each production remembers its own wizki folder - Swiezaki takes them
    // from the PricesOnGoing project, so one shared setting would not do
    var key = String(app.project.file.fsName).split(/[\\\/]/)[1] || "";
    var wguess = wizkiFolder(app.project.file);
    var wizki = getSetting("wizki" + key, wguess ? wguess.fsName : "");

    ui({ projName: projName, week: wk.n, part: wk.part, spot: spotOf(projName),
         tag: tag, offers: offers, client: client, wizki: wizki, key: key });

})();
