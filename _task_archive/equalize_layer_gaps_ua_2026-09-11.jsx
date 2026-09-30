/*
  Equalize Layer Gaps  —  AE ExtendScript

  Бере ВИДІЛЕНІ шари в таймлайні, збирає їх у "блоки" і переставляє блоки цілком
  через layer.startTime — in/out, трим і кейфрейми їдуть разом із шаром.
  Всередині блоку взаємне положення шарів не змінюється.
  Невиділені шари не рухаються ніколи.

  ГРУПУВАННЯ (як шари збираються в блоки і в якому порядку йдуть у часі):
    "За стеком, по N шарів"  — блоки беруться з порядку шарів у таймлайні, ігноруючи час.
                               Це для випадку, коли пари лежать одна НАД одною в один
                               і той самий час і їх треба розкласти драбинкою.
                               Напрямок задає, хто буде першим у часі:
                                 нижній шар — драбинка вгору-вправо,
                                 верхній шар — навпаки.
    "Авто, за часом"         — шари, що перекриваються або мають між собою паузу
                               <= "Пауза в блоці", вважаються одним блоком.
                               Постав -1, якщо блоки стоять встик і їх зливає в один.
    "За часом, по N шарів"   — шари сортуються за inPoint і ріжуться по N.

  ДІЇ:
    "Один за одним"  — блоки щільно послідовно, з паузою N кадрів (0 = впритул).
                       На місці стоїть тільки ПЕРШИЙ блок, решта підтягується до нього.
                       Це те, що робить драбинку зі стопки.
    "Рівні паузи"    — однакова пауза між кінцем блоку і початком наступного.
                       Перший і останній блок стоять на місці.
    "Рівні старти"   — однакова відстань між ПОЧАТКАМИ блоків.
                       Перший і останній блок стоять на місці.
    Два останні працюють тільки якщо блоки вже розкладені по часу зростаюче.

  Без #targetengine — інакше не запускається через $.evalFile із ScriptLauncherPanel.
*/

(function (thisObj) {

    var TOOL_NAME = "Equalize Layer Gaps";
    var SETTINGS_SECTION = "EqualizeLayerGaps";

    // ---------------------------------------------------------------- утиліти

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

    // ------------------------------------------------------------ групування

    /*
       Повертає { blocks: [...] } або { error: "..." }
       blocks[i] = { items: [{layer, inP, outP, idx}, ...], start, end, dur }
       Порядок blocks — це порядок, у якому вони стануть у часі.
    */
    function collectBlocks(comp, layers, opts) {
        var arr = [], i, j, k, cur;
        for (i = 0; i < layers.length; i++) {
            var L = layers[i];
            arr.push({ layer: L, inP: L.inPoint, outP: L.outPoint, idx: L.index });
        }

        if (opts.group === "stack") {
            // за порядком шарів у таймлайні; index 1 = найвищий шар
            arr.sort(function (a, b) {
                return (opts.bottomFirst) ? (b.idx - a.idx) : (a.idx - b.idx);
            });
        } else {
            // за часом; при однаковому старті — за порядком у таймлайні
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
                if (gapFr <= opts.innerGap) {       // перекриття або мала пауза -> той самий блок
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
            if (n < 1) return { error: "Шарів у блоці мусить бути >= 1." };
            if (arr.length % n !== 0) {
                return { error: "Виділено " + arr.length + " шарів — не діляться на блоки по "
                              + n + ".\nЗмін виділення або переключись на \"Авто, за часом\"." };
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

    // блоки мусять іти по часу строго зростаюче (для "рівні паузи" / "рівні старти")
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
            lines.push("  #" + (i + 1) + ": кадри " + toFrames(comp, b.start) + "–"
                       + toFrames(comp, b.end) + "  [" + names.join(", ") + "]");
        }
        return lines.join("\n");
    }

    // ------------------------------------------------------------ основна дія

    function run(action, opts, statusFn) {
        var comp = getComp();
        if (!comp) { alert("Спочатку відкрий/виділи композицію."); return; }

        var sel = comp.selectedLayers;
        if (!sel || sel.length < 2) { alert("Виділи шари в таймлайні."); return; }

        var res = collectBlocks(comp, sel, opts);
        if (res.error) { alert(res.error); return; }

        var blocks = res.blocks;
        var n = blocks.length;
        var i, k;

        if (action === "analyze") {
            statusFn("Блоків: " + n + " | паузи (кадри): " + gapsReport(comp, blocks));
            alert("Знайдено блоків: " + n + " (у порядку, в якому стануть у часі)\n\n"
                  + describe(comp, blocks)
                  + "\n\nПаузи між блоками (кадри): " + gapsReport(comp, blocks));
            return;
        }

        var minBlocks = (action === "sequence") ? 2 : 3;
        if (n < minBlocks) {
            alert("Знайдено блоків: " + n + ".\nДля цього режиму потрібно щонайменше "
                  + minBlocks + ".");
            return;
        }

        if (action !== "sequence" && !isAscending(comp, blocks)) {
            alert("Блоки не розкладені по часу зростаюче (стоять один над одним або в іншому "
                  + "порядку).\nДля цього спочатку натисни \"Один за одним\".");
            return;
        }

        // ---- цільові позиції початків блоків
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
            targets[n - 1] = blocks[n - 1].start;       // крайні — точно на місці
        } else { // "starts"
            var pitch = (blocks[n - 1].start - blocks[0].start) / (n - 1);
            for (i = 0; i < n; i++) targets[i] = blocks[0].start + i * pitch;
            targets[0] = blocks[0].start;
            targets[n - 1] = blocks[n - 1].start;
        }

        // ---- дельти по блоках
        var eps = comp.frameDuration * 0.25;
        var deltas = [];
        for (i = 0; i < n; i++) {
            var want = opts.snap ? snapToFrame(comp, targets[i]) : targets[i];
            var d = want - blocks[i].start;
            deltas[i] = (Math.abs(d) < eps) ? 0 : d;
        }

        // ---- застосування
        var moved = 0, failed = [];

        app.beginUndoGroup(TOOL_NAME + " — " + (action === "sequence" ? "один за одним"
                                             : action === "gaps" ? "рівні паузи"
                                             : "рівні старти"));
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
            alert("Помилка (рядок " + e.line + "): " + e.toString());
        } finally {
            app.endUndoGroup();
        }

        statusFn("Блоків: " + n + " | зсунуто шарів: " + moved
                 + " | паузи (кадри): " + gapsReport(comp, blocks));

        if (failed.length) alert("Не вдалося зсунути:\n" + failed.join("\n"));
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

        // --- групування
        var gp = pal.add("panel", undefined, "Як збирати блоки");
        gp.orientation = "column";
        gp.alignChildren = ["left", "top"];
        gp.spacing = 5;
        gp.margins = [12, 14, 12, 10];

        var rStack = gp.add("radiobutton", undefined, "За стеком — по N шарів, ігноруючи час");
        var rowStack = gp.add("group");
        rowStack.margins = [18, 0, 0, 0];
        rowStack.add("statictext", undefined, "Шарів у блоці:");
        var etSize = rowStack.add("edittext", undefined, "2");
        etSize.characters = 3;
        rowStack.add("statictext", undefined, "  Першим у часі:");
        var ddDir = rowStack.add("dropdownlist", undefined, ["нижній шар", "верхній шар"]);
        ddDir.selection = 0;

        var rAuto = gp.add("radiobutton", undefined, "Авто, за часом — що стоїть разом, те й блок");
        var rowAuto = gp.add("group");
        rowAuto.margins = [18, 0, 0, 0];
        rowAuto.add("statictext", undefined, "Пауза в блоці, кадрів:");
        var etInner = rowAuto.add("edittext", undefined, "0");
        etInner.characters = 4;

        var rTime = gp.add("radiobutton", undefined, "За часом — по N шарів (сортує за inPoint)");

        // --- дії
        var ap = pal.add("panel", undefined, "Розкласти блоки");
        ap.orientation = "column";
        ap.alignChildren = ["fill", "top"];
        ap.spacing = 6;
        ap.margins = [12, 14, 12, 10];

        var bSeq = ap.add("button", undefined, "Один за одним");
        var rowSeq = ap.add("group");
        rowSeq.margins = [4, 0, 0, 0];
        rowSeq.add("statictext", undefined, "Пауза між блоками, кадрів:");
        var etPack = rowSeq.add("edittext", undefined, "0");
        etPack.characters = 4;

        var bGaps   = ap.add("button", undefined, "Рівні паузи між блоками");
        var bStarts = ap.add("button", undefined, "Рівні відстані між початками");

        var cbSnap = pal.add("checkbox", undefined, "Прив'язка до кадрів");
        cbSnap.value = true;

        var bInfo = pal.add("button", undefined, "Аналіз (нічого не рухати)");

        var st = pal.add("statictext", undefined, "Виділи шари і натисни кнопку.",
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

    // прибрати палетку з попереднього запуску, щоб не плодилися копії
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
