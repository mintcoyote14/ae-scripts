// flatten_comps_to_root_folders.jsx
// Moves every comp out of nested subfolders
// into its top-level parent folder.
// Empty subfolders are deleted.

(function () {
    var proj = app.project;

    if (!proj) {
        alert("No project is open.");
        return;
    }

    // --- Collect top-level folders (direct children of root) ---
    var topFolders = [];
    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (item instanceof FolderItem && item.parentFolder === proj.rootFolder) {
            topFolders.push(item);
        }
    }

    if (topFolders.length === 0) {
        alert("No top-level folders found.");
        return;
    }

    app.beginUndoGroup("Flatten comps to root folders");

    var totalMoved   = 0;
    var totalDeleted = 0;

    for (var f = 0; f < topFolders.length; f++) {
        var topFolder = topFolders[f];

        // 1. Collect every comp inside this folder (recursively)
        var comps = [];
        collectComps(topFolder, comps);

        // 2. Move each comp straight into the top folder
        for (var c = 0; c < comps.length; c++) {
            if (comps[c].parentFolder !== topFolder) {
                comps[c].parentFolder = topFolder;
                totalMoved++;
            }
        }

        // 3. Delete subfolders that became empty
        totalDeleted += deleteEmptySubfolders(topFolder);
    }

    app.endUndoGroup();

    alert(
        "Done!\n" +
        "Comps moved: " + totalMoved + "\n" +
        "Empty folders removed: " + totalDeleted
    );

    // -------------------------------------------------------
    // Recursively collects every CompItem into an array
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

    // Recursively deletes empty subfolders; returns how many were removed
    function deleteEmptySubfolders(folder) {
        var deleted = 0;

        // Collect subfolders first - do not touch the collection while iterating
        var subfolders = [];
        for (var i = 1; i <= folder.numItems; i++) {
            var item = folder.item(i);
            if (item instanceof FolderItem) {
                subfolders.push(item);
            }
        }

        for (var s = 0; s < subfolders.length; s++) {
            // Recurse deeper first
            deleted += deleteEmptySubfolders(subfolders[s]);

            // If the subfolder is empty after cleanup - delete it
            if (subfolders[s].numItems === 0) {
                subfolders[s].remove();
                deleted++;
            }
        }

        return deleted;
    }

})();
