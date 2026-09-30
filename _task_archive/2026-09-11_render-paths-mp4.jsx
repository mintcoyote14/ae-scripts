// !TASK.jsx
// =====================================================================
//   T A S K   —   універсальний слот для разових завдань
// =====================================================================
//
//   TASK:  Шляхи рендеру → finals/PLAKATY/<таймінг>s (кодек не чіпати)
//   DATE:  2026-09-11
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
        log("TASK · шляхи рендеру · збірка 2026-09-11");

        var BASE     = "X:\\WarszawskiFestiwalFilmowy2026_232446\\finals\\PLAKATY";
        var MP4_FROM = 1, MP4_TO = 9;        // ці номери черги — у H.264 25 Mbps
        var USE_TEMPLATE = false;            // кодек виставлений руками — шаблон не чіпаємо
        var COMP_SEC = /_(\d+)_\d+x\d+$/;    // таймінг із назви: "..._15_1080x1920" → 15

        var base = new Folder(BASE);
        if (!base.exists) {
            base = Folder.selectDialog("Тека finals\\PLAKATY");
            if (!base) fail("__CANCEL__");
        }
        var root = base.fsName.replace(/[\\\/]+$/, "");

        var rq = app.project.renderQueue;
        if (rq.numItems === 0) fail("Черга рендера порожня.");

        // ---- шаблон Output Module з потрібним кодеком --------------------
        // Бітрейт H.264 в AE не задається скриптом — його несе шаблон,
        // тож шукаємо серед наявних той, де є і "H.264", і "25".
        var tpl = null, allTpl = [], i, j;
        try { allTpl = rq.item(1).outputModule(1).templates; } catch (e) { allTpl = []; }
        for (i = 0; i < allTpl.length; i++)
            if (/h\.?\s*264/i.test(allTpl[i]) && /(^|\D)25(\D|$)/.test(allTpl[i])) {
                tpl = allTpl[i];
                break;
            }

        log(root);
        log("Кодек не чіпаємо — міняємо лише шляхи виводу.");
        log("");

        // ---- розкладання -------------------------------------------------
        var moved = [], recoded = [], locked = [], noName = [], created = [], errors = [];
        var it, om, m, key, dir, name, ext, wantMp4;

        for (i = 1; i <= rq.numItems; i++) {
            it = rq.item(i);

            if (it.status === RQItemStatus.RENDERING || it.status === RQItemStatus.DONE) {
                locked.push("#" + i + " " + (it.comp ? it.comp.name : "?"));
                continue;
            }

            m = it.comp ? COMP_SEC.exec(it.comp.name) : null;
            if (!m) { noName.push("#" + i + " " + (it.comp ? it.comp.name : "?")); continue; }
            key = m[1];

            dir = new Folder(root + "\\" + key + "s");
            if (!dir.exists) {
                if (!dir.create()) { errors.push("не створив " + dir.fsName); continue; }
                created.push(key + "s");
            }

            wantMp4 = (USE_TEMPLATE && i >= MP4_FROM && i <= MP4_TO && tpl !== null);

            for (j = 1; j <= it.numOutputModules; j++) {
                om = it.outputModule(j);

                // Спершу кодек: шаблон скидає шлях, тож файл ставимо після нього
                if (wantMp4) {
                    try {
                        om.applyTemplate(tpl);
                        recoded.push("#" + i + " " + it.comp.name);
                    } catch (e) {
                        errors.push(it.comp.name + " — шаблон: " + (e.message || e));
                    }
                }

                ext = wantMp4 ? ".mp4"
                    : (om.file ? String(om.file.fsName).replace(/^.*(\.[^.\\\/]+)$/, "$1") : ".mov");
                name = it.comp.name + ext;

                try {
                    om.file = new File(dir.fsName + "\\" + name);
                    moved.push(key + "s  ←  " + name);
                } catch (e) {
                    errors.push(it.comp.name + " — шлях: " + (e.message || e));
                }
            }
        }

        // ---- звіт ----------------------------------------------------------
        log("Перенаправлено виводів: " + moved.length);
        for (i = 0; i < moved.length; i++) log("  " + moved[i]);
        if (recoded.length) log("\nПереведено на " + tpl + ":\n  " + recoded.join("\n  "));
        if (created.length) log("\nСтворено теки: " + created.join(", "));
        if (locked.length)  log("\nDone / Rendering — не чіпав:\n  " + locked.join("\n  "));
        if (noName.length)  log("\nТаймінг у назві не розпізнано:\n  " + noName.join("\n  "));
        if (errors.length)  log("\nПомилки:\n  " + errors.join("\n  "));

        if (USE_TEMPLATE && !tpl) {
            log("\n— — —\nЩоб зробити шаблон: у будь-якому Output Module постав");
            log("H.264, More Options → Bitrate 25 Mbps, далі в списку Output Module");
            log("вибери Make Template… і назви його так, щоб у назві були");
            log("\"H.264\" і \"25\" (напр. \"H.264 25 Mbps\"). Тоді перезапусти TASK.");
            log("\nНаявні шаблони (" + allTpl.length + "):");
            for (i = 0; i < allTpl.length; i++) log("  " + allTpl[i]);
        }
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
    } else if (!SILENT) {
        alert(TASK_NAME + "\n\n" + (_log.length ? _log.join("\n") : "Звіт порожній — task() нічого не повернув."));
    }

})();
