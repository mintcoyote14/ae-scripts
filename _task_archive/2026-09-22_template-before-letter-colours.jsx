// !TASK.jsx
// =====================================================================
//   T A S K   —   універсальний слот для разових завдань
// =====================================================================
//
//   TASK:  (порожньо — шаблон готовий до роботи)
//   DATE:  2026-09-15
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

        var c = comp(false);

        log("Проєкт: " + (app.project.file ? app.project.file.name : "не збережений"));
        log("Композицій у проєкті: " + comps().length);

        if (c) {
            log("Активний комп: " + c.name);
            log("  " + c.width + "x" + c.height + "  " + c.duration.toFixed(2) + "s  " +
                c.frameRate.toFixed(3) + " fps");
            log("  шарів: " + c.numLayers + ", виділено: " + c.selectedLayers.length);
        } else {
            log("Активної композиції немає.");
        }

        log("");
        log("Шаблон порожній — опиши завдання, і блок task() буде замінено.");
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
