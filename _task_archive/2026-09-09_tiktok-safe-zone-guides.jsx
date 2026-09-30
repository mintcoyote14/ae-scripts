// !TASK.jsx
// =====================================================================
//   T A S K   —   універсальний слот для разових завдань
// =====================================================================
//
//   TASK:  Гайд-лінії TikTok safe zone в активному компі
//   DATE:  2026-09-09
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

        // Еталон розмітки TikTok — 540x960, масштабується під розмір компа
        var REF_W = 540, REF_H = 960;

        var VERTICAL = [               // X від лівого краю
            60,                        // ліве безпечне поле
            REF_W - 120,               // 420 — ліва межа колонки іконок
            REF_W - 60                 // 480 — праве безпечне поле
        ];
        var HORIZONTAL = [             // Y від верхнього краю
            126,                       // низ панелі Following / For You
            REF_H - 780,               // 180 — верх колонки іконок
            REF_H - 320                // 640 — верх нижнього блоку
        ];

        var HORIZ = 0, VERT = 1;       // orientationType в AE

        var c = comp();
        if (typeof c.addGuide !== "function")
            fail("AE " + app.version + " не вміє comp.addGuide() — потрібен 22.6+.");

        var i;
        for (i = c.guides.length - 1; i >= 0; i--) c.removeGuide(i);

        var sx = c.width / REF_W, sy = c.height / REF_H;
        for (i = 0; i < VERTICAL.length; i++)
            c.addGuide(VERT, Math.round(VERTICAL[i] * sx));
        for (i = 0; i < HORIZONTAL.length; i++)
            c.addGuide(HORIZ, Math.round(HORIZONTAL[i] * sy));

        var got = [];
        for (i = 0; i < c.guides.length; i++)
            got.push((c.guides[i].orientationType === VERT ? "V " : "H ") + c.guides[i].position);

        log(c.name + "  " + c.width + "x" + c.height);
        log("Гайдів: " + c.guides.length + "  →  " + got.join(", "));
        log("");
        log("Не видно ліній — View > Show Guides (Ctrl+;).");
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
