// !TASK.jsx
// =====================================================================
//   T A S K   —   універсальний слот для разових завдань
// =====================================================================
//
//   TASK:  Шар "sprawdź program na wiff.pl" — перевести шрифт на Light
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

        // Шар шукаємо за текстом, а не за назвою — назву могли правити руками
        var MATCH  = /wiff\.pl/i;
        var WEIGHT = "Light";

        // WorkSansRoman-Medium → WorkSansRoman-Light; працює і для статичного набору
        function toWeight(ps) {
            return (ps.indexOf("-") !== -1)
                ? ps.replace(/-[^-]*$/, "-" + WEIGHT)
                : ps + "-" + WEIGHT;
        }

        function setFont(p, target) {
            var td, k;
            if (p.numKeys === 0) {
                td = p.value;
                td.font = target;
                p.setValue(td);
            } else {
                for (k = 1; k <= p.numKeys; k++) {      // текст із ключами — кожен окремо
                    td = p.keyValue(k);
                    td.font = target;
                    p.setValueAtTime(p.keyTime(k), td);
                }
            }
        }

        var all = comps(), hits = [], failed = [], i, j, c, L, p, td, from, to;

        for (i = 0; i < all.length; i++) {
            c = all[i];
            for (j = 1; j <= c.numLayers; j++) {
                L = c.layer(j);
                if (!(L instanceof TextLayer)) continue;

                p = L.property("ADBE Text Properties").property("ADBE Text Document");
                td = p.value;
                if (!MATCH.test(td.text) && !MATCH.test(L.name)) continue;

                from = td.font;
                to   = toWeight(from);

                if (from === to) { hits.push(c.name + " / " + L.name + " — вже " + WEIGHT); continue; }

                try {
                    setFont(p, to);
                } catch (e) {
                    failed.push(c.name + " / " + L.name + " — " + (e.message || e));
                    continue;
                }

                // AE мовчки лишає старий шрифт, якщо такого накреслення нема
                if (p.value.font === to) hits.push(c.name + " / " + L.name + "   " + from + " → " + to);
                else failed.push(c.name + " / " + L.name + " — AE не прийняв " + to + ", лишився " + p.value.font);
            }
        }

        log("Шарів зі згадкою wiff.pl: " + (hits.length + failed.length));
        log("");
        for (i = 0; i < hits.length; i++) log("  " + hits[i]);
        if (failed.length) log("\nНе вдалося:\n  " + failed.join("\n  "));
        if (!hits.length && !failed.length) log("Жодного текстового шару з таким текстом не знайшов.");
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
