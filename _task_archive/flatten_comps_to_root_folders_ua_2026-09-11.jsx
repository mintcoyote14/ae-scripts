// flatten_comps_to_root_folders.jsx
// Переміщує всі композиції з вкладених підпапок
// до батьківської папки верхнього рівня.
// Порожні підпапки видаляються.

(function () {
    var proj = app.project;

    if (!proj) {
        alert("Немає відкритого проекту.");
        return;
    }

    // --- Збираємо папки верхнього рівня (прямі діти root) ---
    var topFolders = [];
    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (item instanceof FolderItem && item.parentFolder === proj.rootFolder) {
            topFolders.push(item);
        }
    }

    if (topFolders.length === 0) {
        alert("Папок верхнього рівня не знайдено.");
        return;
    }

    app.beginUndoGroup("Flatten comps to root folders");

    var totalMoved   = 0;
    var totalDeleted = 0;

    for (var f = 0; f < topFolders.length; f++) {
        var topFolder = topFolders[f];

        // 1. Збираємо всі композиції всередині цієї папки (рекурсивно)
        var comps = [];
        collectComps(topFolder, comps);

        // 2. Переміщуємо кожну композицію прямо у топ-папку
        for (var c = 0; c < comps.length; c++) {
            if (comps[c].parentFolder !== topFolder) {
                comps[c].parentFolder = topFolder;
                totalMoved++;
            }
        }

        // 3. Видаляємо підпапки, що стали порожніми
        totalDeleted += deleteEmptySubfolders(topFolder);
    }

    app.endUndoGroup();

    alert(
        "Готово!\n" +
        "Переміщено композицій: " + totalMoved + "\n" +
        "Видалено порожніх папок: " + totalDeleted
    );

    // -------------------------------------------------------
    // Рекурсивно збирає всі CompItem у масив
    function collectComps(folder, result) {
        for (var i = 1; i <= folder.numItems; i++) {
            var item = folder.item(i);
            if (item instanceof CompItem) {
                result.push(item);
            } else if (item instanceof FolderItem) {
                collectComps(item, result);
            }
        }
    }

    // Рекурсивно видаляє порожні підпапки; повертає кількість видалених
    function deleteEmptySubfolders(folder) {
        var deleted = 0;

        // Спочатку збираємо підпапки (не чіпаємо колекцію під час ітерації)
        var subfolders = [];
        for (var i = 1; i <= folder.numItems; i++) {
            var item = folder.item(i);
            if (item instanceof FolderItem) {
                subfolders.push(item);
            }
        }

        for (var s = 0; s < subfolders.length; s++) {
            // Спочатку — рекурсія вглиб
            deleted += deleteEmptySubfolders(subfolders[s]);

            // Якщо після очищення підпапка порожня — видаляємо
            if (subfolders[s].numItems === 0) {
                subfolders[s].remove();
                deleted++;
            }
        }

        return deleted;
    }

})();
