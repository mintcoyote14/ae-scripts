// !TASK.jsx
// =====================================================================
//   T A S K   —   універсальний слот для разових завдань
// =====================================================================
//
//   TASK:  Розкласти аудіо по композиціях за таймінгом у назві (5/8/15/20с)
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

        var SKIP = { "30": true };          // 30-секундні неактуальні

        // Тривалість із назви: комп "..._15_1080x1920" → 15, аудіо "..._15sec_..." → 15
        var COMP_SEC  = /_(\d+)_\d+x\d+$/;
        var AUDIO_SEC = /_(\d+)\s*sec/i;

        // ---- збір аудіо за таймінгом -----------------------------------
        var byTime = {}, dupes = [], i, it, m, key;

        for (i = 1; i <= app.project.numItems; i++) {
            it = app.project.item(i);
            if (!(it instanceof FootageItem) || !it.hasAudio || it.hasVideo) continue;
            m = AUDIO_SEC.exec(it.name);
            if (!m) continue;
            key = m[1];
            if (byTime[key]) dupes.push(key + "s: " + byTime[key].name + "  /  " + it.name);
            else byTime[key] = it;
        }

        var found = [];
        for (key in byTime) if (byTime.hasOwnProperty(key)) found.push(key + "s");
        if (!found.length) fail("Не знайшов аудіофайлів з таймінгом у назві (…_5sec_…).");
        log("Аудіо: " + found.join(", "));
        if (dupes.length) log("Кілька файлів на той самий таймінг:\n  " + dupes.join("\n  "));
        log("");

        // ---- розкладання по композиціях --------------------------------
        var added = [], already = [], noAudio = [], skipped = [], mismatch = [];
        var all = comps(), c, snd, L, j, has;

        for (i = 0; i < all.length; i++) {
            c = all[i];
            m = COMP_SEC.exec(c.name);
            if (!m) continue;                       // не наш шаблон назви
            key = m[1];

            if (SKIP[key]) { skipped.push(c.name); continue; }

            snd = byTime[key];
            if (!snd) { noAudio.push(c.name + "  (нема " + key + "s)"); continue; }

            has = false;
            for (j = 1; j <= c.numLayers; j++)
                if (c.layer(j).source === snd) { has = true; break; }
            if (has) { already.push(c.name); continue; }

            L = c.layers.add(snd);
            L.startTime = 0;
            L.moveToEnd();                          // аудіо — під низ стосу
            added.push(c.name + "  ←  " + snd.name);

            if (Math.abs(c.duration - Number(key)) > 0.05)
                mismatch.push(c.name + ": комп " + c.duration.toFixed(2) + "s, назва " + key + "s");
        }

        // ---- звіт -------------------------------------------------------
        log("Додано: " + added.length);
        for (i = 0; i < added.length; i++) log("  " + added[i]);
        if (already.length)  log("\nАудіо вже стояло: " + already.length);
        if (skipped.length)  log("\nПропущено 30s: " + skipped.length);
        if (noAudio.length)  log("\nБез пари:\n  " + noAudio.join("\n  "));
        if (mismatch.length) log("\nТривалість компа не збігається з назвою:\n  " + mismatch.join("\n  "));
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
