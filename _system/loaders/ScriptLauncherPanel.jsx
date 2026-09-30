/**
 * ScriptLauncherPanel — loader
 *
 * Цей файл лежить у ScriptUI Panels, щоб панель з'являлась у меню Window.
 * Сам код панелі живе тут:
 *   D:/_SCRIPTS_/_system/ScriptLauncherPanel.jsx
 * Редагуй оригінал — лоадер підхопить зміни при наступному відкритті панелі.
 */

(function scriptLauncherPanelLoader(thisObj) {
    var SOURCE_PATHS = [
        "D:/_SCRIPTS_/_system/ScriptLauncherPanel.jsx",
        "D:/_SCRIPTS_/ScriptLauncherPanel.jsx"
    ];

    function findSource() {
        for (var i = 0; i < SOURCE_PATHS.length; i++) {
            var f = new File(SOURCE_PATHS[i]);
            if (f.exists) return f;
        }
        return null;
    }

    function showError(msg) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "ScriptLauncherPanel", undefined, { resizeable: true });
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.margins = 12;
        win.spacing = 8;
        var t = win.add("statictext", undefined, msg, { multiline: true });
        t.preferredSize = [320, 80];
        if (win instanceof Window) {
            win.center();
            win.show();
        } else {
            win.layout.layout(true);
        }
    }

    var src = findSource();
    if (!src) {
        showError(
            "Не знайдено ScriptLauncherPanel.jsx.\n\nОчікуваний шлях:\n" +
            SOURCE_PATHS.join("\n") +
            "\n\nПоклади файл за цим шляхом або виправ SOURCE_PATHS у цьому файлі."
        );
        return;
    }

    var code;
    try {
        src.encoding = "UTF-8";
        src.open("r");
        code = src.read();
    } catch (e) {
        showError("Не вдалося прочитати:\n" + src.fsName + "\n\n" + e.toString());
        return;
    } finally {
        try { src.close(); } catch (e2) {}
    }

    // Прибираємо BOM, якщо є
    if (code.length && code.charCodeAt(0) === 0xFEFF) code = code.substring(1);

    try {
        // Виконуємо код оригіналу так, щоб його `this` дорівнював thisObj —
        // тоді типовий патерн `(function(thisObj){...})(this)` отримає нашу панель.
        var fn = new Function("thisObj", code);
        fn.call(thisObj, thisObj);
    } catch (e) {
        showError(
            "Помилка виконання ScriptLauncherPanel.jsx:\n\n" +
            e.toString() + (e.line ? ("\nрядок " + e.line) : "")
        );
    }
})(this);
