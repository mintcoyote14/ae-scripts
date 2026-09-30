/*
  AE ExtendScript
  Транслітерація польських літер у НАЗВАХ ЛИШЕ ВИДІЛЕНИХ АЙТЕМІВ (Project panel).
  Шари в композиціях НЕ змінюються.
  Приклад: "Łódź – ścieżka" → "Lodz – sciezka"
*/

(function () {
    app.beginUndoGroup("Normalize Polish letters (selected items only)");

    // польські -> ASCII (з урахуванням регістру)
    var map = {
        "ą":"a","ć":"c","ę":"e","ł":"l","ń":"n","ó":"o","ś":"s","ź":"z","ż":"z",
        "Ą":"A","Ć":"C","Ę":"E","Ł":"L","Ń":"N","Ó":"O","Ś":"S","Ź":"Z","Ż":"Z"
    };

    function normalizePolish(str) {
        if (!str || typeof str !== "string") return str;
        var out = "";
        for (var i = 0; i < str.length; i++) {
            var ch = str.charAt(i);
            out += map.hasOwnProperty(ch) ? map[ch] : ch;
        }
        return out;
    }

    var proj = app.project;
    if (!proj) { app.endUndoGroup(); return; }

    var sel = proj.selection;
    if (!sel || sel.length === 0) { app.endUndoGroup(); return; }

    for (var i = 0; i < sel.length; i++) {
        var it = sel[i];
        try {
            var newName = normalizePolish(it.name);
            if (newName !== it.name) it.name = newName;
        } catch (e) {}
    }

    app.endUndoGroup();
})();
