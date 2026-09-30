// Replace Render Queue items for the selected compositions.
//
// Workflow:
//   1. Select one or more compositions in the Project panel.
//   2. Run this script (File > Scripts > Run Script File...).
//
// If a selected composition already has an inactive Done/Unqueued item in
// Render Queue, the script duplicates it, explicitly restores the old output
// file paths, then removes only that inactive item. Thus it becomes Queued
// while keeping its output file, settings, and label colour. The replacement
// is appended to the end of the Render Queue.
// Existing checked Queued items are left untouched.
// If it is not in Render Queue, it is simply added at the bottom.
//
// The composition itself is NOT duplicated.  Its changes are already in the
// project, so the duplicated Render Queue item renders the updated comp to the
// same output file when Render Queue is started.

(function () {
    function getSelectedComps() {
        var selected = app.project.selection;
        var comps = [];
        var i;

        for (i = 0; i < selected.length; i++) {
            if (selected[i] instanceof CompItem) comps.push(selected[i]);
        }
        return comps;
    }

    function isActiveQueued(item) {
        return item.status === RQItemStatus.QUEUED && item.render;
    }

    function isReplaceable(item) {
        return item.status === RQItemStatus.DONE || item.status === RQItemStatus.UNQUEUED;
    }

    function findExistingItem(comp) {
        var rq = app.project.renderQueue;
        var item, i, exactMatches = [], nameMatches = [];
        var matches, replaceableItem = null, foundOtherStatus = false;

        // Do not compare AE objects with ===.  AE can expose different script
        // wrappers for the same project item, so their object references can
        // differ. Item.id is the stable project-item identifier.
        for (i = 1; i <= rq.numItems; i++) {
            item = rq.item(i);
            if (!item.comp) continue;
            if (item.comp.id === comp.id) exactMatches.push(item);
            if (item.comp.name === comp.name) nameMatches.push(item);
        }

        // Prefer the exact project-item match; if that is unavailable, use
        // the same composition name.  Either way, never touch an item that
        // is already checked and Queued.
        matches = exactMatches.length ? exactMatches : nameMatches;
        for (i = 0; i < matches.length; i++) {
            item = matches[i];
            if (isActiveQueued(item)) return { item: item, action: "alreadyQueued" };
            if (!replaceableItem && isReplaceable(item)) replaceableItem = item;
            if (!isReplaceable(item)) foundOtherStatus = true;
        }

        if (replaceableItem) {
            return { item: replaceableItem, action: "replace", match: exactMatches.length ? "ID" : "name" };
        }
        if (matches.length || foundOtherStatus) {
            return { item: null, action: "keep" };
        }
        return { item: null, action: "add" };
    }

    function replaceItem(oldItem) {
        var i, oldOutput, oldFile;
        var oldPaths = [];

        // API duplicate can give the output module a generated filename.
        // Save every old output path first, then assign it to the duplicate.
        for (i = 1; i <= oldItem.numOutputModules; i++) {
            oldOutput = oldItem.outputModule(i);
            oldFile = oldOutput.file;
            oldPaths.push(oldFile ? new File(oldFile.fsName) : null);
        }

        var newItem = oldItem.duplicate();

        // Free the old Output To entries first.  If the path is assigned while
        // the old item is still in Render Queue, AE creates a "_1" filename.
        oldItem.remove();
        for (i = 1; i <= newItem.numOutputModules && i <= oldPaths.length; i++) {
            if (oldPaths[i - 1]) newItem.outputModule(i).file = oldPaths[i - 1];
        }

        newItem.render = true;
    }

    function removeAutoOutputSuffix(rqItem) {
        var i, outputModule, file, fileName, dot, baseName, extension, match;

        // When AE adds a fresh item and the file already exists on disk, it
        // appends _1, _2, ... . Keep the current folder and extension, but
        // restore the base filename so the render overwrites that file.
        for (i = 1; i <= rqItem.numOutputModules; i++) {
            outputModule = rqItem.outputModule(i);
            file = outputModule.file;
            if (!file) continue;

            fileName = file.name;
            dot = fileName.lastIndexOf(".");
            baseName = dot >= 0 ? fileName.substring(0, dot) : fileName;
            extension = dot >= 0 ? fileName.substring(dot) : "";
            match = baseName.match(/^(.*)_\d+$/);

            if (match && match[1]) {
                outputModule.file = new File(file.parent.fsName + "\\" + match[1] + extension);
            }
        }
    }

    function main() {
        var comps = getSelectedComps();
        var i, comp, found;
        var replaced = [], added = [], alreadyQueued = [], kept = [], errors = [];

        if (!comps.length) {
            alert("Виділіть одну або кілька композицій у панелі Project.");
            return;
        }

        app.beginUndoGroup("Replace selected Render Queue items");
        try {
            // Each selected CompItem is processed independently.
            for (i = 0; i < comps.length; i++) {
                comp = comps[i];
                try {
                    found = findExistingItem(comp);

                    if (found.action === "alreadyQueued") {
                        alreadyQueued.push(comp.name);
                    } else if (found.action === "replace") {
                        replaceItem(found.item);
                        replaced.push(comp.name + (found.match === "name" ? " (збіг за назвою)" : ""));
                    } else if (found.action === "add") {
                        var addedItem = app.project.renderQueue.items.add(comp);
                        removeAutoOutputSuffix(addedItem);
                        added.push(comp.name);
                    } else {
                        kept.push(comp.name);
                    }
                } catch (itemError) {
                    errors.push(comp.name + ": " + itemError.toString());
                }
            }
        } finally {
            app.endUndoGroup();
        }

        alert("ГОТОВО.\n\n" +
            "Замінено в черзі (" + replaced.length + "): " +
            (replaced.length ? replaced.join(", ") : "—") + "\n\n" +
            "Додано внизу (" + added.length + "): " +
            (added.length ? added.join(", ") : "—") + "\n\n" +
            "Вже Queued — без змін (" + alreadyQueued.length + "): " +
            (alreadyQueued.length ? alreadyQueued.join(", ") : "—") +
            (kept.length ? "\n\nБез змін (інший статус): " + kept.join(", ") : "") +
            (errors.length ? "\n\nПОМИЛКИ:\n" + errors.join("\n") : ""));
    }

    main();
})();
