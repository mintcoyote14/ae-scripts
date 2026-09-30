/*
  AE ExtendScript
  Замінює пробіли на "_" лише у назвах ВИДІЛЕНИХ айтемів у Project panel.
  Шари в композиціях НЕ змінюються.
*/

(function () {
    app.beginUndoGroup("Replace spaces with underscores (selected items only)");

    function replaceSpaces(str) {
        if (!str || typeof str !== "string") return str;
        return str.replace(/ /g, "_");
    }

    var proj = app.project;
    if (!proj) { app.endUndoGroup(); return; }

    var sel = proj.selection;
    if (!sel || sel.length === 0) { app.endUndoGroup(); return; }

    for (var i = 0; i < sel.length; i++) {
        var it = sel[i];
        try {
            var newName = replaceSpaces(it.name);
            if (newName !== it.name) it.name = newName;
        } catch (e) {}
    }

    app.endUndoGroup();
})();
