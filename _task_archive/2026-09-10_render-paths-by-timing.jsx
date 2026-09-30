// !TASK.jsx
// =====================================================================
//   T A S K   —   універсальний слот для разових завдань
// =====================================================================
//
//   TASK:  Розкласти рендери по папках 5s / 8s / 15s / 20s за назвою компа
//   DATE:  2026-09-10
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

        var BASE = "X:\\WarszawskiFestiwalFilmowy2026_232446\\output\\20260910";

        // Таймінг із назви компа: "..._15_1080x1920" → 15
        var COMP_SEC = /_(\d+)_\d+x\d+$/;

        var base = new Folder(BASE);
        if (!base.exists) {
            base = Folder.selectDialog("Тека виводу (та, де лежать 5s / 8s / …)");
            if (!base) fail("__CANCEL__");
        }
        var root = base.fsName.replace(/[\\\/]+$/, "");
        log(root);
        log("");

        var rq = app.project.renderQueue;
        if (rq.numItems === 0) fail("Черга рендера порожня.");

        var moved = [], locked = [], noName = [], created = [], errors = [];
        var i, j, it, om, m, key, dir, name, target;

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

            for (j = 1; j <= it.numOutputModules; j++) {
                om = it.outputModule(j);
                if (!om.file) continue;
                name = String(om.file.fsName).replace(/^.*[\\\/]/, "");
                target = dir.fsName + "\\" + name;
                try {
                    om.file = new File(target);
                    moved.push(key + "s  ←  " + name);
                } catch (e) {
                    errors.push(it.comp.name + " — " + (e.message || e));
                }
            }
        }

        // ---- звіт -------------------------------------------------------
        log("Перенаправлено виводів: " + moved.length);
        for (i = 0; i < moved.length; i++) log("  " + moved[i]);
        if (created.length) log("\nСтворено теки: " + created.join(", "));
        if (locked.length)  log("\nDone / Rendering — не чіпав:\n  " + locked.join("\n  "));
        if (noName.length)  log("\nТаймінг у назві не розпізнано:\n  " + noName.join("\n  "));
        if (errors.length)  log("\nПомилки:\n  " + errors.join("\n  "));
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
    } else if (_log.length && !SILENT) {
        alert(TASK_NAME + "\n\n" + _log.join("\n"));
    }

})();
