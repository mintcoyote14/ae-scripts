// ============================================================
// Find & Relink Missing Files
// ============================================================

(function findAndRelinkMissingFiles() {

    if (!app.project) {
        alert("Please open an After Effects project first.");
        return;
    }

    var missingItems = [];
    var project = app.project;

    for (var i = 1; i <= project.numItems; i++) {
        var item = project.item(i);
        if (item instanceof FootageItem) {
            var source = item.mainSource;
            if (source instanceof FileSource) {
                var file = source.file;
                if (file !== null && !file.exists) {
                    missingItems.push({
                        item:       item,
                        name:       item.name,
                        path:       file.fsName,
                        fileName:   file.displayName,
                        usedIn:     getUsedInComps(item),
                        found:      null,
                        candidates: []
                    });
                }
            }
        }
    }

    function getUsedInComps(footageItem) {
        var comps = [];
        for (var c = 1; c <= project.numItems; c++) {
            var compItem = project.item(c);
            if (compItem instanceof CompItem) {
                for (var l = 1; l <= compItem.numLayers; l++) {
                    try {
                        var layer = compItem.layer(l);
                        if (layer.source && layer.source.id === footageItem.id) {
                            comps.push(compItem.name);
                            break;
                        }
                    } catch(e) {}
                }
            }
        }
        return comps.length > 0 ? comps.join(", ") : "not used";
    }

    function collectAllFiles(folder, allFiles) {
        var contents = folder.getFiles();
        for (var i = 0; i < contents.length; i++) {
            var entry = contents[i];
            if (entry instanceof Folder) {
                collectAllFiles(entry, allFiles);
            } else if (entry instanceof File) {
                allFiles.push(entry);
            }
        }
    }

    function searchForMissing(missingList, searchFiles) {
        for (var m = 0; m < missingList.length; m++) {
            var mi = missingList[m];
            mi.found = null;
            mi.candidates = [];
            var missingName = mi.fileName.toLowerCase();
            for (var f = 0; f < searchFiles.length; f++) {
                var sf = searchFiles[f];
                if (sf.displayName.toLowerCase() === missingName) {
                    mi.candidates.push(sf);
                    if (mi.found === null) mi.found = sf;
                }
            }
        }
    }

    function normalizePath(rawPath) {
        var p = rawPath;
        p = p.replace(/^["']+|["']+$/g, "");
        p = p.replace(/^\s+|\s+$/g, "");
        return p;
    }

    // ── UI ───────────────────────────────────────────────────
    var win = new Window("dialog", "Find & Relink Missing Files", undefined, {resizeable: true});
    win.orientation  = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 10;
    win.margins = 16;

    // — Status —
    var statusPanel = win.add("panel", undefined, "Project Status");
    statusPanel.orientation  = "column";
    statusPanel.alignChildren = ["fill", "top"];
    statusPanel.margins = 12;

    var statusLabel = statusPanel.add("statictext", undefined,
        "Missing files found in project: " + missingItems.length);
    statusLabel.graphics.font = ScriptUI.newFont("dialog", "BOLD", 12);

    if (missingItems.length === 0) {
        statusLabel.text = "No missing files found — everything is OK!";
        var okBtn = win.add("button", undefined, "Close");
        okBtn.onClick = function() { win.close(); };
        win.center();
        win.show();
        return;
    }

    // — Folder path input —
    var folderPanel = win.add("panel", undefined, "Search Folder (includes all subfolders)");
    folderPanel.orientation  = "column";
    folderPanel.alignChildren = ["fill", "top"];
    folderPanel.margins = 12;
    folderPanel.spacing = 8;

    var hintText = folderPanel.add("statictext", undefined,
        "Copy the path from Explorer's address bar and paste it here:");
    hintText.graphics.foregroundColor = hintText.graphics.newPen(
        hintText.graphics.PenType.SOLID_COLOR, [0.6, 0.6, 0.6], 1);

    var inputRow = folderPanel.add("group");
    inputRow.orientation  = "row";
    inputRow.alignChildren = ["left", "center"];
    inputRow.spacing = 8;

    var folderInput = inputRow.add("edittext", [0, 0, 530, 26], "");
    folderInput.helpTip = "Example: C:\\Projects\\MyVideo\\Assets";

    var searchBtn = inputRow.add("button", undefined, "  Search  ");

    var exampleText = folderPanel.add("statictext", undefined,
        "How to copy the path: open folder in Explorer \u2192 click the address bar \u2192 Ctrl+C \u2192 paste here with Ctrl+V");
    exampleText.graphics.foregroundColor = exampleText.graphics.newPen(
        exampleText.graphics.PenType.SOLID_COLOR, [0.5, 0.6, 0.8], 1);

    // — Results —
    var resultsPanel = win.add("panel", undefined, "Results");
    resultsPanel.orientation  = "column";
    resultsPanel.alignChildren = ["fill", "top"];
    resultsPanel.margins = 12;

    var resultsLabel = resultsPanel.add("statictext", undefined,
        "Paste a folder path above and click \u00abSearch\u00bb...");

    var listBox = resultsPanel.add("listbox", [0, 0, 730, 240], [], {
        numberOfColumns: 4,
        showHeaders:     true,
        columnTitles:    ["Status", "File Name", "Found At", "Used In"],
        columnWidths:    [90, 155, 295, 190]
    });

    // — Details —
    var detailPanel = win.add("panel", undefined, "Selected File Details");
    detailPanel.orientation  = "column";
    detailPanel.alignChildren = ["fill", "top"];
    detailPanel.margins = 12;

    var detailText = detailPanel.add("edittext", [0, 0, 730, 85],
        "Select a row to see details...", {multiline: true, readonly: true, scrollable: true});

    // — Buttons —
    var btnGroup = win.add("group");
    btnGroup.orientation   = "row";
    btnGroup.alignChildren = ["center", "center"];
    btnGroup.spacing = 8;

    var btnRelinkAll = btnGroup.add("button", undefined, "Relink All Found");
    var btnRelinkOne = btnGroup.add("button", undefined, "Relink Selected");
    var btnReport    = btnGroup.add("button", undefined, "Save Report .txt");
    var btnClose     = btnGroup.add("button", undefined, "Close");

    btnRelinkAll.enabled = false;
    btnRelinkOne.enabled = false;

    // ── Logic ────────────────────────────────────────────────

    function clearTable() {
        while (listBox.items.length > 0) listBox.remove(0);
        detailText.text = "Select a row to see details...";
        btnRelinkAll.enabled = false;
        btnRelinkOne.enabled = false;
    }

    searchBtn.onClick = function() {
        var rawPath = folderInput.text;
        if (!rawPath || rawPath.replace(/\s/g, "") === "") {
            alert("Please paste a folder path first!");
            return;
        }

        var cleanPath = normalizePath(rawPath);
        var targetFolder = new Folder(cleanPath);

        if (!targetFolder.exists) {
            alert("Folder not found:\n" + cleanPath + "\n\nPlease check the path and try again.");
            return;
        }

        clearTable();
        resultsLabel.text = "Scanning files...";
        win.update();

        var allFiles = [];
        collectAllFiles(targetFolder, allFiles);

        resultsLabel.text = "Files found on disk: " + allFiles.length + ". Matching...";
        win.update();

        searchForMissing(missingItems, allFiles);

        var foundCount = 0;
        for (var m = 0; m < missingItems.length; m++) {
            var mi     = missingItems[m];
            var status = mi.found ? "[FOUND]" : "[NOT FOUND]";
            if (mi.found) foundCount++;
            var row = listBox.add("item", status);
            row.subItems[0].text = mi.fileName;
            row.subItems[1].text = mi.found ? mi.found.fsName : "---";
            row.subItems[2].text = mi.usedIn;
        }

        resultsLabel.text =
            "Files scanned: " + allFiles.length +
            "   |   Matched: " + foundCount +
            "   |   Not found: " + (missingItems.length - foundCount);

        btnRelinkAll.enabled = foundCount > 0;
    };

    listBox.onChange = function() {
        if (listBox.selection === null) return;
        var idx = listBox.selection.index;
        var mi  = missingItems[idx];

        var candidatesStr = "";
        if (mi.candidates && mi.candidates.length > 1) {
            candidatesStr = "\n\n" + mi.candidates.length + " files with this name were found:";
            for (var c = 0; c < mi.candidates.length; c++) {
                candidatesStr += "\n  " + (c + 1) + ". " + mi.candidates[c].fsName;
            }
            candidatesStr += "\n(you can choose which one to use when relinking individually)";
        }

        detailText.text =
            "Project name   : " + mi.name     + "\n" +
            "File name      : " + mi.fileName + "\n" +
            "Original path  : " + mi.path     + "\n" +
            "Found at       : " + (mi.found ? mi.found.fsName : "not found") + "\n" +
            "Used in        : " + mi.usedIn   +
            candidatesStr;

        btnRelinkOne.enabled = (mi.found !== null);
    };

    btnRelinkOne.onClick = function() {
        if (listBox.selection === null) return;
        var idx = listBox.selection.index;
        var mi  = missingItems[idx];
        if (!mi.found) { alert("File not found."); return; }

        var fileToUse = mi.found;

        if (mi.candidates.length > 1) {
            var pickWin = new Window("dialog", "Choose File");
            pickWin.orientation  = "column";
            pickWin.alignChildren = ["fill", "top"];
            pickWin.margins = 14;
            pickWin.add("statictext", undefined,
                mi.candidates.length + " files named \"" + mi.fileName + "\" were found. Choose one:");
            var choices = [];
            for (var c = 0; c < mi.candidates.length; c++) choices.push(mi.candidates[c].fsName);
            var pickList = pickWin.add("listbox", [0, 0, 620, 140], choices);
            pickList.selection = 0;
            var pickBtns = pickWin.add("group");
            var confirmed = false;
            pickBtns.add("button", undefined, "OK").onClick = function() {
                fileToUse = mi.candidates[pickList.selection ? pickList.selection.index : 0];
                confirmed = true;
                pickWin.close();
            };
            pickBtns.add("button", undefined, "Cancel").onClick = function() { pickWin.close(); };
            pickWin.center();
            pickWin.show();
            if (!confirmed) return;
        }

        try {
            mi.item.replace(fileToUse);
            mi.found = fileToUse;
            listBox.items[idx].text            = "[FOUND]";
            listBox.items[idx].subItems[1].text = fileToUse.fsName;
            alert("Relinked successfully:\n" + mi.fileName + "\n->\n" + fileToUse.fsName);
        } catch(e) {
            alert("Relink error:\n" + e.toString());
        }
    };

    btnRelinkAll.onClick = function() {
        var count = 0;
        var errors = [];
        app.beginUndoGroup("Relink All Missing Files");
        for (var m = 0; m < missingItems.length; m++) {
            var mi = missingItems[m];
            if (!mi.found) continue;
            try {
                mi.item.replace(mi.found);
                listBox.items[m].text            = "[FOUND]";
                listBox.items[m].subItems[1].text = mi.found.fsName;
                count++;
            } catch(e) {
                errors.push(mi.fileName + ": " + e.toString());
            }
        }
        app.endUndoGroup();
        var msg = "Relinked: " + count + " file(s).";
        if (errors.length > 0) msg += "\n\nErrors:\n" + errors.join("\n");
        alert(msg);
        btnRelinkAll.enabled = false;
    };

    btnReport.onClick = function() {
        var report = "=== MISSING FILES REPORT ===\n";
        report += "Project      : " + (app.project.file ? app.project.file.fsName : "unsaved") + "\n";
        report += "Search folder: " + normalizePath(folderInput.text) + "\n";
        report += "Date         : " + new Date().toString() + "\n";
        report += "Total missing: " + missingItems.length + "\n";
        report += "=".repeat(70) + "\n\n";

        var found = 0, notFound = 0;
        for (var m = 0; m < missingItems.length; m++) {
            var mi = missingItems[m];
            var statusStr = mi.found ? "[FOUND]     " : "[NOT FOUND] ";
            if (mi.found) found++; else notFound++;
            report += (m + 1) + ". " + statusStr + mi.fileName + "\n";
            report += "   Original path : " + mi.path + "\n";
            report += "   Found at      : " + (mi.found ? mi.found.fsName : "---") + "\n";
            report += "   Project name  : " + mi.name + "\n";
            report += "   Used in       : " + mi.usedIn + "\n";
            if (mi.candidates && mi.candidates.length > 1) {
                report += "   All matches:\n";
                for (var c = 0; c < mi.candidates.length; c++) {
                    report += "     " + (c+1) + ". " + mi.candidates[c].fsName + "\n";
                }
            }
            report += "\n";
        }
        report += "=".repeat(70) + "\n";
        report += "Found: " + found + "   |   Not found: " + notFound + "\n";

        var saveFile = File.saveDialog("Save Report", "*.txt");
        if (!saveFile) return;
        if (saveFile.fsName.indexOf(".txt") === -1) saveFile = new File(saveFile.fsName + ".txt");
        saveFile.encoding = "UTF-8";
        saveFile.open("w");
        saveFile.write(report);
        saveFile.close();
        saveFile.execute();
        alert("Report saved:\n" + saveFile.fsName);
    };

    btnClose.onClick = function() { win.close(); };

    win.center();
    win.show();

})();
