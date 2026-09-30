/*
  AE ExtendScript
  Processes the names of SELECTED items in the Project panel only:
    1. Transliterates Polish letters to ASCII (a-ogonek -> a, l-stroke -> l, z-dot -> z etc.)
    2. Replaces spaces with "_"
    3. Removes anything that is not an English letter, digit or "_"
       (commas, apostrophes, asterisks, dots, brackets, dashes etc.)

  Layer names inside comps are NOT touched - only selected Project items.

  Example: "Lodz - sciezka* (v2), 'final'.mp4" -> "Lodz_sciezka_v2_finalmp4"
*/

(function () {
    app.beginUndoGroup("Clean item names (Polish letters, spaces, special chars)");

    // Polish -> ASCII (case preserved)
    var polishMap = {
        "ą":"a","ć":"c","ę":"e","ł":"l","ń":"n","ó":"o","ś":"s","ź":"z","ż":"z",
        "Ą":"A","Ć":"C","Ę":"E","Ł":"L","Ń":"N","Ó":"O","Ś":"S","Ź":"Z","Ż":"Z"
    };

    function normalizePolish(str) {
        var out = "";
        for (var i = 0; i < str.length; i++) {
            var ch = str.charAt(i);
            out += polishMap.hasOwnProperty(ch) ? polishMap[ch] : ch;
        }
        return out;
    }

    function cleanName(str) {
        if (!str || typeof str !== "string") return str;

        // 1. transliterate Polish letters
        var result = normalizePolish(str);

        // 2. spaces -> "_"
        result = result.replace(/ /g, "_");

        // 3. strip everything except English letters, digits and "_"
        result = result.replace(/[^A-Za-z0-9_]/g, "");

        return result;
    }

    var proj = app.project;
    if (!proj) { app.endUndoGroup(); return; }

    var sel = proj.selection;
    if (!sel || sel.length === 0) { app.endUndoGroup(); return; }

    for (var i = 0; i < sel.length; i++) {
        var it = sel[i];
        try {
            var newName = cleanName(it.name);
            if (newName !== it.name) it.name = newName;
        } catch (e) {}
    }

    app.endUndoGroup();
})();
