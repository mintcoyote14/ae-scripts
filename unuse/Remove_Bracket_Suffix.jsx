// Remove Bracket Suffix.jsx
// Прибирає з назв обраних композицій фрагмент виду "_[#####]" (підкреслення + вміст у квадратних дужках).
// Приклад: "HANTEL_HENRYK_[####]_436x264"  ->  "HANTEL_HENRYK_436x264"
//
// Працює з будь-яким вмістом усередині дужок (не лише "####"), і видаляє
// всі такі входження в назві, якщо їх декілька.

(function removeBracketSuffix() {

    if (app.project.selection.length === 0) {
        alert("Виберіть одну або кілька композицій у панелі Project.");
        return;
    }

    var selectedComps = [];
    for (var i = 0; i < app.project.selection.length; i++) {
        var item = app.project.selection[i];
        if (item instanceof CompItem) selectedComps.push(item);
    }

    if (selectedComps.length === 0) {
        alert("Серед обраного немає жодної композиції.\nВиберіть хоча б одну композицію у панелі Project.");
        return;
    }

    // Патерн: підкреслення, за ним квадратні дужки з будь-яким вмістом (крім "]")
    var pattern = /_\[[^\]]*\]/g;

    app.beginUndoGroup("Remove Bracket Suffix from Comp Names");

    var renamedCount = 0;
    var skippedCount = 0;

    for (var c = 0; c < selectedComps.length; c++) {
        var comp = selectedComps[c];
        var oldName = comp.name;
        var newName = oldName.replace(pattern, "");

        if (newName !== oldName) {
            comp.name = newName;
            renamedCount++;
        } else {
            skippedCount++;
        }
    }

    app.endUndoGroup();

    alert(
        "Готово!\n" +
        "Перейменовано: " + renamedCount + "\n" +
        "Без змін (патерн не знайдено): " + skippedCount
    );

})();
