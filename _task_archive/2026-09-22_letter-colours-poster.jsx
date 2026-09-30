// !TASK.jsx
// =====================================================================
//   T A S K   —   універсальний слот для разових завдань
// =====================================================================
//
//   TASK:  Colour every letter of the selected text layer
//   DATE:  2026-09-22
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

        // Picked off the poster itself, letter by letter. Spaces and line
        // breaks are skipped, so MA TO SENS lands exactly like the artwork.
        var PALETTE = ["F2A0C4",   // M  pink
                       "3FB2D4",   // A  turquoise
                       "A5D116",   // T  lime
                       "F08100",   // O  orange
                       "F7C900",   // S  yellow
                       "B274D2",   // E  violet
                       "B3E2F2",   // N  pale blue
                       "F6C2D6"];  // S  pale pink

        function rgb(hex) {
            var n = parseInt(hex, 16);
            return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
        }

        // Per-character colour is a text attribute, not an effect - the same
        // thing the type tool does. It arrived in After Effects 17.1.
        if (parseFloat(app.version) < 17.1)
            fail("Per-character colour needs After Effects 17.1 or newer. This one is " + app.version + ".");

        var c = comp();
        var sel = layers(c, false);            // selected layers only
        var painted = 0, skipped = [], i, j, k, L, src, doc, text, ch, r;

        for (i = 0; i < sel.length; i++) {
            L = sel[i];

            src = null;
            try { src = L.property("ADBE Text Properties").property("ADBE Text Document"); } catch (e) {}
            if (!src) { skipped.push(L.name + " - not a text layer"); continue; }

            doc = src.value;
            text = String(doc.text);
            k = 0;

            for (j = 0; j < text.length; j++) {
                ch = text.charAt(j);
                // Spaces, and every control character - AE writes a line break
                // as , which is neither \r nor \n and must not eat a colour
                if (ch === " " || text.charCodeAt(j) < 33) continue;
                try {
                    r = doc.characterRange(j, j + 1);
                    r.applyFill = true;
                    r.fillColor = rgb(PALETTE[k % PALETTE.length]);
                    k++;
                    painted++;
                } catch (e) {
                    skipped.push(L.name + " / " + ch + " - " + (e.message || e));
                }
            }

            src.setValue(doc);      // without this the colours stay in the copy

            log(L.name + "   \"" + text.replace(/[^\x20-￿]/g, " ") + "\"   ->   " + k + " letters");
        }

        log("");
        log("Letters coloured: " + painted);
        if (skipped.length) log("\nSkipped:\n  " + skipped.join("\n  "));
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
