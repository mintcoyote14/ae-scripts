// save_to_new_week.jsx
// =====================================================================
//   Save the open week project into another week
// =====================================================================
//   The open project tells the script everything it needs:
//
//     ...\vfx\shots\2026\FRESH\W38\dmp\W38B_Szynka_v01.aep
//     ...\vfx\shots\W38\dmp\W38C_NS_Filet_v01.aep
//                       |   |   |  | |  |
//                      week |  week | |  offer
//                           |    part |
//                      work folder   variant
//
//   It lists every week folder of the show, opens on the newest one and
//   saves the project there, into the same work folder (dmp):
//
//     W38B_Szynka_v01.aep     ->  W39\dmp\W39B_Szynka_v01.aep
//     W38B_Szynka_v03.aep     ->  W39\dmp\W39B_Szynka_v01.aep
//     W38C_NS_Filet_v01.aep   ->  W39\dmp\W39C_NS_Filet_v01.aep
//
//   Any week of the show can be the target, not only the next one - an
//   offer coming back after ten weeks (W29 -> W39) is the same job. And
//   the "..." button takes a week folder of another show entirely, for
//   the offers that travel between them:
//
//     FRESH\W37\dmp\W37B_Filet_v01.aep
//       ->  BiedronkaWeekend2026\vfx\shots\W38\dmp\W38C_TW_Filet_v01.aep
//
//   A new week always starts at v01, whatever version the base was. The
//   part and the variant are read off the projects already lying in the
//   target week, so every show offers what it really uses:
//
//     FRESH, NISKIE CENY   A, B      no variant
//     Weekend              C         TW Tani Weekend, NS Najtansza Sobota,
//                                    NN Najtansza Niedziela
//
//   Before saving, inside the project:
//     - the comps and folders named after the old week are renamed
//       (__MASTER_edit\W38 -> W39);
//     - the finished renders are thrown out of the render queue.
//
//   An already existing project of that name is never overwritten:
//   the window says so and the Save button stays off.
//
//   A week that is not on disk yet is created with the same empty
//   folders the week before it has.
// =====================================================================

(function () {

    var SCRIPT_NAME = "Save to new week";
    var SETTINGS    = "SaveToNewWeek";

    //  W38, T38, NSW37 - the week folder as the Biedronka projects spell it
    var WEEK_DIR  = /^([A-Za-z]{0,3}[WT])(\d{1,2})$/;
    //  the same token inside a file or item name, with its A/B/C part
    var WEEK_NAME = /([A-Za-z]{0,3}[WT])\s*_?(\d{1,2})\s*_?([A-D])?(?![A-Za-z0-9])/;
    //  the variant right after the week: W38C_NS_Filet_v01 -> NS
    var TAG_NAME  = /^([_\-])([A-Z]{2,3})(?=[_\-])/;
    //  how far back to look when the target week is still empty
    var LOOK_BACK = 5;

    //  What the weekend variants are called. Anything else a show uses is
    //  picked up from the file names on its own.
    var TAGS = [
        { tag: "TW", label: "TW - Tani Weekend" },
        { tag: "NS", label: "NS - Najtansza Sobota" },
        { tag: "NN", label: "NN - Najtansza Niedziela" }
    ];

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
    function fileName(f) {
        return String(f.fsName).replace(/^.*[\\\/]/, "");
    }

    function baseName(f) {
        return fileName(f).replace(/\.[^.]+$/, "");
    }

    function trim(s) {
        return String(s).replace(/^\s+|\s+$/g, "");
    }

    function pad(n, len) {
        var s = String(n);
        while (s.length < len) s = "0" + s;
        return s;
    }

    function has(arr, v) {
        for (var i = 0; i < arr.length; i++) if (arr[i] === v) return true;
        return false;
    }

    function labelOf(tag) {
        for (var i = 0; i < TAGS.length; i++) if (TAGS[i].tag === tag) return TAGS[i].label;
        return tag;
    }

    //  The name of the show a week folder belongs to, for the window:
    //  ...\FRESH\W39 -> FRESH,  ...\BiedronkaWeekend2026_231673\vfx\shots\W38
    //  -> BiedronkaWeekend2026_231673
    function showOf(weekFolder) {
        var p = weekFolder.parent;
        if (!p) return "";
        if (!/^(shots|compo|assets)$/i.test(p.name) && !/^\d{4}$/.test(p.name)) return p.name;

        var parts = String(weekFolder.fsName).split(/[\\\/]/), i;
        for (i = 0; i < parts.length; i++)
            if (parts[i].toLowerCase() === "vfx" && i > 0) return parts[i - 1];
        return p.name;
    }

    //  W38C_NS_Filet_v01 -> { week: "W38C", part: "C", tag: "NS", rest: "_Filet_v01" }
    //  Only a variant the show really uses is read as one, so an offer
    //  written in capitals (W38C_BIO_Jogurt) stays part of the name.
    function split(base, tags) {
        var m = WEEK_NAME.exec(base);
        if (!m) return { head: "", week: "", part: "", tag: "", rest: base, found: false };

        var rest = base.substring(m.index + m[0].length), tag = "";
        var tm = TAG_NAME.exec(rest);
        if (tm && has(tags, tm[2].toUpperCase())) {
            tag = tm[2].toUpperCase();
            rest = rest.substring(tm[0].length);
        }
        return {
            head:  base.substring(0, m.index),
            week:  m[0],
            part:  m[3] ? m[3].toUpperCase() : "",
            tag:   tag,
            rest:  rest,
            found: true
        };
    }

    //  W38C_NS_Filet_v03  ->  W39C_TW_Filet_v01
    //  A week that is not spelled out in the name is put in front of it,
    //  so nothing is ever saved without the week it belongs to.
    function newProjectName(base, newTok, part, tag, tags) {
        var s = split(base, tags), out;
        var head = newTok + (part || "") + (tag ? "_" + tag : "");

        if (s.found) out = s.head + head + s.rest;
        else         out = head + "_" + base;

        // a new week starts from the first version
        out = out.replace(/([_\-])v\d+$/i, "$1v01");
        return out;
    }

    // ------------------------------------------------------------------
    //  Weeks on disk
    // ------------------------------------------------------------------
    //  Every week folder of the show, W02..W52, sorted
    function weekFolders(subFolder, prefix) {
        var fs = subFolder.getFiles(function (f) { return f instanceof Folder; });
        var out = [], m, i;
        for (i = 0; i < fs.length; i++) {
            m = WEEK_DIR.exec(fs[i].name);
            if (!m) continue;
            if (prefix && m[1].toUpperCase() !== prefix.toUpperCase()) continue;
            out.push({ n: parseInt(m[2], 10), name: fs[i].name, tok: fs[i].name, folder: fs[i] });
        }
        out.sort(function (a, b) { return a.n - b.n; });
        return out;
    }

    //  A week that is not on disk yet is opened with the empty folders
    //  the week before it has - dmp, render, renderoutput and the rest -
    //  so the renders of the new project have somewhere to land.
    //  Only the folder names are taken, nothing inside them.
    function makeWeek(weekFolder, model) {
        if (!weekFolder.create()) return false;
        if (!model || !model.exists) return true;

        var fs = model.getFiles(function (f) { return f instanceof Folder; });
        for (var i = 0; i < fs.length; i++)
            new Folder(weekFolder.fsName + "\\" + fs[i].name).create();
        return true;
    }

    //  What the projects in a week folder are called: which parts (A, B, C)
    //  and which variants (TW, NS, NN) the show works with
    function scan(weekFolder, workName, parts, tags) {
        var f = new Folder(weekFolder.fsName + "\\" + workName);
        if (!f.exists) return;

        var fs = f.getFiles(function (x) { return (x instanceof File) && /\.aep$/i.test(x.name); });
        var i, m, tm, rest, base;
        for (i = 0; i < fs.length; i++) {
            base = baseName(fs[i]);
            m = WEEK_NAME.exec(base);
            if (!m) continue;
            if (m[3] && !has(parts, m[3].toUpperCase())) parts.push(m[3].toUpperCase());

            rest = base.substring(m.index + m[0].length);
            tm = TAG_NAME.exec(rest);
            if (tm && !has(tags, tm[2].toUpperCase())) tags.push(tm[2].toUpperCase());
        }
    }

    //  The same, but a week nobody has started yet says nothing - then the
    //  weeks before it in the same show are asked instead
    function optionsFrom(weekFolder, workName) {
        var parts = [], tags = [];
        scan(weekFolder, workName, parts, tags);
        if (parts.length || tags.length) return { parts: parts, tags: tags };

        var m = WEEK_DIR.exec(weekFolder.name), sub = weekFolder.parent;
        if (!m || !sub) return { parts: parts, tags: tags };

        var sibs = weekFolders(sub, m[1]), i, seen = 0;
        for (i = sibs.length - 1; i >= 0 && seen < LOOK_BACK; i--) {
            if (sibs[i].folder.fsName === weekFolder.fsName) continue;
            scan(sibs[i].folder, workName, parts, tags);
            seen++;
            if (parts.length) break;
        }
        return { parts: parts, tags: tags };
    }

    //  A show that uses one of the known weekend variants is offered all
    //  three of them - NN weeks are rare and would not be found otherwise
    function tagList(found) {
        var known = false, out = [], i;
        for (i = 0; i < found.length; i++) if (labelOf(found[i]) !== found[i]) known = true;
        if (!known) return found;

        for (i = 0; i < TAGS.length; i++) out.push(TAGS[i].tag);
        for (i = 0; i < found.length; i++) if (!has(out, found[i])) out.push(found[i]);
        return out;
    }

    // ------------------------------------------------------------------
    //  What the project carries over
    // ------------------------------------------------------------------
    //  The comps and folders named after the old week: W38, W38B,
    //  TLA W38 - anything where the week stands as a word of its own
    function weekItems(oldPrefix, oldNum, newTok, part) {
        var re = new RegExp("(^|[^A-Za-z0-9])" + oldPrefix + "\\s*_?0*" + oldNum +
                            "\\s*_?([A-D])?(?![A-Za-z0-9])", "i");
        var out = [], it, m, i;
        for (i = 1; i <= app.project.numItems; i++) {
            it = app.project.item(i);
            if (!(it instanceof CompItem) && !(it instanceof FolderItem)) continue;
            m = re.exec(it.name);
            if (!m) continue;
            out.push({
                item: it,
                from: it.name,
                to: it.name.replace(m[0], m[1] + newTok + (m[2] ? (part || m[2]) : ""))
            });
        }
        return out;
    }

    function doneRenders() {
        var rq = app.project.renderQueue, out = [], i;
        for (i = 1; i <= rq.numItems; i++)
            if (rq.item(i).status === RQItemStatus.DONE) out.push(i);
        return out;
    }

    // ------------------------------------------------------------------
    //  Save
    // ------------------------------------------------------------------
    function run(ctx, w) {
        var weekFolder = ctx.week.folder;
        var destFolder = new Folder(weekFolder.fsName + "\\" + ctx.workName);
        var destFile   = new File(destFolder.fsName + "\\" + ctx.name + ".aep");
        var madeWeek   = false;

        if (destFile.exists) {
            alert(SCRIPT_NAME + "\n\n" + fileName(destFile) + " already exists in\n" +
                  destFolder.fsName + "\n\nNothing was saved.");
            return;
        }
        if (!weekFolder.exists) {
            if (!makeWeek(weekFolder, ctx.model)) {
                alert(SCRIPT_NAME + "\n\nCould not create\n" + weekFolder.fsName);
                return;
            }
            madeWeek = true;
        }
        if (!destFolder.exists && !destFolder.create()) {
            alert(SCRIPT_NAME + "\n\nCould not create\n" + destFolder.fsName);
            return;
        }

        var renamed = [], removed = 0, i;

        app.beginUndoGroup(SCRIPT_NAME);
        try {
            if (ctx.doRename) {
                for (i = 0; i < ctx.items.length; i++) {
                    ctx.items[i].item.name = ctx.items[i].to;
                    renamed.push(ctx.items[i].from + "  ->  " + ctx.items[i].to);
                }
            }
            if (ctx.doClean) {
                // from the end: removing an item renumbers the queue
                var rq = app.project.renderQueue;
                for (i = rq.numItems; i >= 1; i--) {
                    if (rq.item(i).status !== RQItemStatus.DONE) continue;
                    rq.item(i).remove();
                    removed++;
                }
            }
        } catch (e) {
            app.endUndoGroup();
            alert(SCRIPT_NAME + "\n\n" + e.toString() + "\n\nNothing was saved.");
            return;
        }
        app.endUndoGroup();

        try {
            app.project.save(destFile);
        } catch (e2) {
            alert(SCRIPT_NAME + "\n\nCould not save\n" + destFile.fsName + "\n\n" + e2.toString());
            return;
        }

        setSetting("part", ctx.part);
        setSetting("tag", ctx.tag);
        if (w) w.close();

        var msg = "Saved as\n" + destFile.fsName + "\n\n";
        if (madeWeek)       msg += "The week folder " + ctx.week.name + " was created.\n\n";
        if (renamed.length) msg += "Renamed:\n" + renamed.join("\n") + "\n\n";
        if (ctx.doClean)    msg += "Finished renders removed: " + removed + "\n";

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

        var i;

        // ---- where it comes from --------------------------------------
        var head = w.add("panel", undefined, "Base project");
        head.orientation = "column";
        head.alignChildren = ["left", "top"];
        head.margins = 10;
        head.spacing = 6;

        var ttl = head.add("statictext", undefined, ctx.baseName + ".aep");
        try {
            ttl.graphics.font = ScriptUI.newFont(ttl.graphics.font.name, ScriptUI.FontStyle.BOLD,
                                                 ttl.graphics.font.size);
        } catch (e) {}
        head.add("statictext", undefined, ctx.srcWork.fsName);

        // ---- where it goes --------------------------------------------
        var dst = w.add("panel", undefined, "Save into");
        dst.orientation = "column";
        dst.alignChildren = ["left", "top"];
        dst.margins = 10;
        dst.spacing = 6;

        var g1 = dst.add("group");
        g1.add("statictext", undefined, "Week:");
        var dd = g1.add("dropdownlist", undefined, []);
        dd.preferredSize.width = 150;
        var sel = 0;
        for (i = 0; i < ctx.weeks.length; i++) {
            dd.add("item", ctx.weeks[i].name);
            if (ctx.weeks[i] === ctx.week) sel = i;
        }
        dd.selection = sel;

        var browse = g1.add("button", undefined, "...");
        browse.preferredSize = [30, 22];
        browse.helpTip = "A week folder of another show - the offers that travel\n" +
                         "between FRESH and Weekend are saved that way.";

        g1.add("statictext", undefined, "   Part:");
        var partGrp = g1.add("group");
        partGrp.spacing = 4;

        var g2 = dst.add("group");
        g2.add("statictext", undefined, "Variant:");
        var ddTag = g2.add("dropdownlist", undefined, []);
        ddTag.preferredSize.width = 190;

        // Only the middle of the name is typed. The week part in front and
        // the version behind follow the week / part / variant above.
        var g3 = dst.add("group");
        g3.spacing = 2;
        g3.add("statictext", undefined, "Save as:").preferredSize.width = 55;
        var preTxt = g3.add("statictext", undefined, "", { truncate: "end" });
        preTxt.preferredSize.width = 80;      // fits W41B_ and W41B_FN_ alike
        var fName = g3.add("edittext", undefined, "");
        fName.characters = 22;
        fName.helpTip = "The name of the offer - Dallmayer, Kawa, Wedliny";
        var sufTxt = g3.add("statictext", undefined, "");
        sufTxt.preferredSize.width = 34;
        g3.add("statictext", undefined, ".aep");

        // W41B_Dallmayer_v01  ->  "W41B_" + "Dallmayer" + "_v01"
        function splitName(full, head) {
            var pre = "", rest = String(full), m;
            var at = head ? rest.indexOf(head) : -1;
            if (at >= 0) {
                pre = rest.substring(0, at + head.length);
                rest = rest.substring(pre.length);
                m = /^[_\-]/.exec(rest);
                if (m) { pre += m[0]; rest = rest.substring(1); }
            }
            m = /([_\-]v\d+)$/i.exec(rest);
            var suf = m ? m[1] : "";
            return { pre: pre, mid: suf ? rest.substring(0, rest.length - suf.length) : rest, suf: suf };
        }

        function fullName() {
            return preTxt.text + trim(fName.text) + sufTxt.text;
        }

        var pathTxt = dst.add("statictext", undefined, "", { truncate: "middle" });
        pathTxt.preferredSize.width = 440;

        // ---- what happens inside the project --------------------------
        var act = w.add("panel", undefined, "In the project");
        act.orientation = "column";
        act.alignChildren = ["left", "top"];
        act.margins = 10;
        act.spacing = 6;

        var cbRename = act.add("checkbox", undefined, "Rename what carries the old week");
        cbRename.value = true;
        var renTxt = act.add("statictext", undefined, "", { multiline: true });
        renTxt.preferredSize = [440, 42];

        var cbClean = act.add("checkbox", undefined,
                              "Remove finished renders from the queue (" + ctx.done.length + ")");
        cbClean.value = ctx.done.length > 0;
        cbClean.enabled = ctx.done.length > 0;

        var note = w.add("statictext", undefined, "", { multiline: true });
        note.preferredSize = [440, 30];

        var bg = w.add("group");
        bg.alignment = ["fill", "bottom"];
        var ok = bg.add("button", undefined, "Save");
        var cancel = bg.add("button", undefined, "Cancel", { name: "cancel" });
        ok.preferredSize = [110, 24];
        cancel.preferredSize = [90, 24];

        var nameEdited = false, filling = false;
        var parts = [], tags = [], rbs = [], cache = {}, lastKey = "";

        function week() { return ctx.weeks[dd.selection.index]; }

        function part() {
            for (var k = 0; k < rbs.length; k++) if (rbs[k].value) return parts[k];
            return "";
        }

        function tag() {
            if (!ddTag.enabled || !ddTag.selection) return "";
            var idx = ddTag.selection.index;
            return idx === 0 ? "" : tags[idx - 1];
        }

        // What the target week works with - read once per folder, the
        // projects sit on a network drive
        function optionsFor(wk) {
            var key = wk.folder.fsName;
            if (cache[key]) return cache[key];

            var o = optionsFrom(wk.folder, ctx.workName);
            if (!wk.foreign) scan(ctx.srcWeek, ctx.workName, o.parts, o.tags);
            o.tags = tagList(o.tags);
            if (!wk.foreign && ctx.srcPart && !has(o.parts, ctx.srcPart)) o.parts.push(ctx.srcPart);
            if (!o.parts.length) o.parts = ["A", "B"];
            o.parts.sort();

            cache[key] = o;
            return o;
        }

        function buildParts(list, prefer) {
            while (partGrp.children.length) partGrp.remove(partGrp.children[0]);
            parts = list;
            rbs = [];

            var chosen = -1, k;
            for (k = 0; k < list.length; k++) {
                rbs[k] = partGrp.add("radiobutton", undefined, list[k]);
                rbs[k].onClick = function () { refresh(); };
                if (list[k] === prefer) chosen = k;
            }
            if (chosen < 0) chosen = 0;
            if (rbs.length) rbs[chosen].value = true;
        }

        function buildTags(list, prefer) {
            tags = list;
            ddTag.removeAll();
            ddTag.add("item", "(none)");
            for (var k = 0; k < list.length; k++) ddTag.add("item", labelOf(list[k]));
            ddTag.selection = 0;
            for (k = 0; k < list.length; k++) if (list[k] === prefer) ddTag.selection = k + 1;
            ddTag.enabled = list.length > 0;
        }

        function refresh(typing) {
            var wk = week(), tok = wk.tok, o;

            // the show can change under the target week - rebuild what it offers
            if (wk.folder.fsName !== lastKey) {
                lastKey = wk.folder.fsName;
                o = optionsFor(wk);
                buildParts(o.parts, part() || ctx.srcPart);
                buildTags(o.tags, tag() || ctx.srcTag);
                typing = false;
            }

            // The head and the version are always rebuilt from the week, the
            // part and the variant - a typed name keeps only its middle.
            var whole = newProjectName(ctx.baseName, tok, part(), tag(), tags);
            var bits  = splitName(whole, tok + (part() || "") + (tag() ? "_" + tag() : ""));
            preTxt.text = bits.pre;
            sufTxt.text = bits.suf;

            if (!nameEdited) {
                // writing the field fires onChanging - it must not read as a hand edit
                filling = true;
                fName.text = bits.mid;
                filling = false;
            }

            var destFolder = new Folder(wk.folder.fsName + "\\" + ctx.workName);
            var destFile   = new File(destFolder.fsName + "\\" + fullName() + ".aep");
            pathTxt.text   = destFolder.fsName;

            ctx.items = weekItems(ctx.prefix, ctx.num, tok, part());
            var lines = [], k;
            for (k = 0; k < ctx.items.length && k < 3; k++)
                lines.push(ctx.items[k].from + "  ->  " + ctx.items[k].to);
            if (ctx.items.length > 3) lines.push("and " + (ctx.items.length - 3) + " more");
            renTxt.text = ctx.items.length ? lines.join("\n")
                                           : "Nothing in the project carries " + ctx.oldTok + ".";
            cbRename.enabled = ctx.items.length > 0;

            var bad = "";
            if (!trim(fName.text)) bad = "The project needs a name.";
            else if (destFile.exists) bad = fullName() + ".aep already exists in " +
                                            wk.name + "\\" + ctx.workName + ".";
            else if (!wk.foreign && wk.n === ctx.num) bad = "This is the week the project is already in.";

            if (!bad && !wk.folder.exists)
                note.text = wk.name + " does not exist yet - the week will be created\n" +
                            "with the same folders " + ctx.model.name + " has.";
            else if (!bad && wk.foreign)
                note.text = "Another show: " + showOf(wk.folder);
            else
                note.text = bad;

            try {
                note.graphics.foregroundColor = note.graphics.newPen(
                    note.graphics.PenType.SOLID_COLOR,
                    bad ? [0.92, 0.36, 0.30, 1] : [0.62, 0.62, 0.62, 1], 1);
            } catch (e3) {}

            ok.enabled = !bad;
            // a relayout in the middle of typing moves the caret about
            if (!typing) w.layout.layout(true);
        }

        dd.onChange = function () { refresh(); };
        ddTag.onChange = function () { refresh(); };
        fName.onChanging = function () {
            if (filling) return;
            nameEdited = true;
            refresh(true);
        };

        //  Any week folder on disk, in any show
        browse.onClick = function () {
            var f = Folder.selectDialog("Pick the week folder to save into");
            if (!f) return;

            if (!WEEK_DIR.test(f.name)) {
                alert(SCRIPT_NAME + "\n\n" + f.name + " is not a week folder.\n" +
                      "Pick the week itself - W39, T39 - not what is inside it.");
                return;
            }
            var m = WEEK_DIR.exec(f.name), k;
            for (k = 0; k < ctx.weeks.length; k++) {
                if (ctx.weeks[k].folder.fsName !== f.fsName) continue;
                dd.selection = k; refresh();
                return;                        // onChange does the rest
            }

            ctx.weeks.push({ n: parseInt(m[2], 10), name: f.name, tok: f.name,
                             folder: f, foreign: true });
            dd.add("item", f.name + "   -   " + showOf(f));
            dd.selection = dd.items.length - 1; refresh();
        };

        ok.onClick = function () {
            run({
                week:     week(),
                part:     part(),
                tag:      tag(),
                name:     fullName(),
                workName: ctx.workName,
                model:    ctx.model,
                items:    ctx.items,
                doRename: cbRename.value && cbRename.enabled,
                doClean:  cbClean.value && cbClean.enabled
            }, w);
        };

        refresh();
        w.center();
        w.show();
    }

    // ------------------------------------------------------------------
    //  Go
    // ------------------------------------------------------------------
    if (!app.project || !app.project.file) {
        alert(SCRIPT_NAME + "\n\nSave the project first - the script reads the week\n" +
              "from the folder it sits in.");
        return;
    }

    var projFile   = app.project.file;
    var workFolder = projFile.parent;                         // dmp
    var weekFolder = workFolder ? workFolder.parent : null;   // W38
    var subFolder  = weekFolder ? weekFolder.parent : null;   // FRESH, shots

    var m = weekFolder ? WEEK_DIR.exec(weekFolder.name) : null;
    if (!m) {
        alert(SCRIPT_NAME + "\n\nThe project does not sit in a week folder:\n" +
              projFile.fsName + "\n\nExpected  ...\\<week>\\" +
              (workFolder ? workFolder.name : "dmp") + "\\project.aep");
        return;
    }

    var prefix = m[1], digits = m[2].length, num = parseInt(m[2], 10);
    var weeks = weekFolders(subFolder, prefix);
    if (!weeks.length) {
        alert(SCRIPT_NAME + "\n\nNo week folders next to\n" + weekFolder.fsName);
        return;
    }

    // the newest week on disk, and if there is none - the one after this
    var newest = weeks[weeks.length - 1];
    if (newest.n <= num) {
        newest = { n: num + 1, name: prefix + pad(num + 1, digits),
                   tok: prefix + pad(num + 1, digits),
                   folder: new Folder(subFolder.fsName + "\\" + prefix + pad(num + 1, digits)) };
        weeks.push(newest);
    }

    // what the base project is called, read with the variants of its own show
    var own = { parts: [], tags: [] };
    scan(weekFolder, workFolder.name, own.parts, own.tags);
    var base = baseName(projFile);
    var s = split(base, tagList(own.tags));

    ui({
        baseName:  base,
        srcWork:   workFolder,
        srcWeek:   weekFolder,
        oldTok:    weekFolder.name,
        srcPart:   s.part || getSetting("part", ""),
        srcTag:    s.tag  || getSetting("tag", ""),
        prefix:    prefix,
        digits:    digits,
        num:       num,
        workName:  workFolder.name,
        model:     weekFolder,
        weeks:     weeks,
        week:      newest,
        name:      base,
        items:     [],
        done:      doneRenders()
    });

})();
