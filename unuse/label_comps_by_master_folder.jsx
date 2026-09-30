// label_comps_by_master_folder.jsx
//
// FPFF / After Effects
//
// Використання:
// 1. У панелі Project виберіть одну головну папку (наприклад: _MASTER).
// 2. Запустіть File > Scripts > Run Script File...
// 3. Підтвердьте операцію.
//
// Every direct subfolder of the selected folder receives its own label colour.
// All compositions inside that subfolder (also inside its nested subfolders)
// receive exactly the same label colour. Nested folders are labelled too, so
// the grouping stays visible while browsing the project.

(function labelCompsByMasterFolder() {
    // These are After Effects label indices. The order is intentionally varied
    // to make adjacent categories easier to distinguish. Label colours can be
    // customised in Edit > Preferences > Labels, but the indices still work.
    var LABEL_ORDER = [8, 10, 11, 2, 9, 5, 13, 14, 16, 4, 6, 7, 3, 15, 1, 12];

    function getSelectedFolder() {
        var selection = app.project.selection;
        var folders = [];
        var i;

        for (i = 0; i < selection.length; i++) {
            if (selection[i] instanceof FolderItem) {
                folders.push(selection[i]);
            }
        }

        if (folders.length !== 1) {
            alert(
                "Спочатку виберіть рівно одну головну папку в панелі Project.\n\n" +
                "Наприклад: виберіть _MASTER, а тоді запустіть скрипт."
            );
            return null;
        }

        return folders[0];
    }

    function getDirectSubfolders(parentFolder) {
        var result = [];
        var i;
        var item;

        for (i = 1; i <= parentFolder.numItems; i++) {
            item = parentFolder.item(i);
            if (item instanceof FolderItem) {
                result.push(item);
            }
        }

        return result;
    }

    function applyLabelRecursively(folder, labelIndex, stats) {
        var i;
        var item;

        // The category folder itself is labelled by the caller. All its
        // descendant folders are labelled here as well.
        for (i = 1; i <= folder.numItems; i++) {
            item = folder.item(i);

            if (item instanceof CompItem) {
                item.label = labelIndex;
                stats.comps += 1;
            } else if (item instanceof FolderItem) {
                item.label = labelIndex;
                stats.folders += 1;
                applyLabelRecursively(item, labelIndex, stats);
            }
        }
    }

    if (!app.project) {
        alert("Спочатку відкрийте проєкт After Effects.");
        return;
    }

    var masterFolder = getSelectedFolder();
    if (masterFolder === null) {
        return;
    }

    var categories = getDirectSubfolders(masterFolder);
    if (categories.length === 0) {
        alert("У вибраній папці немає підпапок для фарбування.");
        return;
    }

    var confirmation =
        "Головна папка: " + masterFolder.name + "\n" +
        "Категорій (прямих підпапок): " + categories.length + "\n\n" +
        "Кожна категорія отримає окремий колір label. Усі композиції\n" +
        "всередині неї, включно з вкладеними папками, отримають той самий колір.\n\n" +
        "Продовжити?";

    if (!confirm(confirmation)) {
        return;
    }

    var stats = { comps: 0, folders: 0 };
    var i;
    var labelIndex;

    app.beginUndoGroup("Label compositions by parent folder");
    try {
        for (i = 0; i < categories.length; i++) {
            labelIndex = LABEL_ORDER[i % LABEL_ORDER.length];

            // Colour the direct category folder as well.
            categories[i].label = labelIndex;
            stats.folders += 1;

            applyLabelRecursively(categories[i], labelIndex, stats);
        }
    } catch (error) {
        alert("Скрипт зупинився через помилку: " + error.toString());
    } finally {
        app.endUndoGroup();
    }

    var repeatedNote = "";
    if (categories.length > LABEL_ORDER.length) {
        repeatedNote =
            "\n\nКатегорій більше ніж " + LABEL_ORDER.length +
            ", тому кольори label повторилися з початку списку.";
    }

    alert(
        "Готово.\n\n" +
        "Пофарбовано папок: " + stats.folders + "\n" +
        "Пофарбовано композицій: " + stats.comps +
        repeatedNote
    );
}());
