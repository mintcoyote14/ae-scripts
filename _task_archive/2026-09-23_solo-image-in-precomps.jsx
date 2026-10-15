// !TASK.jsx
// =====================================================================
//   T A S K   —   універсальний слот для разових завдань
// =====================================================================
//
//   TASK:  Solo the image in every precomp / show everything again
//   DATE:  2026-09-23
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

        // One button for both directions: if anything is soloed in these
        // precomps, everything goes back to normal; otherwise the bottom
        // layer of each precomp - the image - goes solo.
        var c = comp();

        // The precomps of the open comp. With layers selected, only those.
        var src = layers(c, true), targets = [], seen = {}, i, j, L, it;
        for (i = 0; i < src.length; i++) {
            L = src[i];
            it = null;
            try { it = L.source; } catch (e) {}
            if (!(it && it instanceof CompItem)) continue;      // footage, audio, adjustment
            if (seen[it.id]) continue;                          // the same precomp used twice
            seen[it.id] = true;
            targets.push(it);
        }

        if (!targets.length) fail("No precomps here - open the comp that holds them.");

        // Which way are we going?
        var soloed = false;
        for (i = 0; i < targets.length && !soloed; i++)
            for (j = 1; j <= targets[i].numLayers; j++)
                if (targets[i].layer(j).solo) { soloed = true; break; }

        var touched = 0, empty = [], k, n, layer, want;

        for (i = 0; i < targets.length; i++) {
            k = targets[i];
            n = k.numLayers;
            if (!n) { empty.push(k.name + " - empty"); continue; }

            for (j = 1; j <= n; j++) {
                layer = k.layer(j);
                want = soloed ? false : (j === n);              // the bottom layer is the image
                if (layer.solo !== want) { layer.solo = want; touched++; }
            }

            log(k.name + "   ->   " + (soloed ? "all layers back" : "solo: " + k.layer(n).name));
        }

        log("");
        log(soloed ? "Solo cleared in " + targets.length + " precomp(s)."
                   : "Image soloed in " + targets.length + " precomp(s).");
        log("Layers switched: " + touched);
        if (empty.length) log("\nSkipped:\n  " + empty.join("\n  "));
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
