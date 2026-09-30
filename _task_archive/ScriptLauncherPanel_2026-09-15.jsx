// ScriptLauncherPanel.jsx
// Dockable After Effects panel: lists .jsx scripts from a chosen folder,
// auto-refreshes when files are added/changed, and can re-run the last script.
//
// INSTALL:
//   Put this file (or a loader that evals it) in:
//   Windows:  C:\Program Files\Adobe\Adobe After Effects <ver>\Support Files\Scripts\ScriptUI Panels\
//             or  %APPDATA%\Adobe\After Effects\<ver>\Scripts\ScriptUI Panels\
//   macOS:    /Applications/Adobe After Effects <ver>/Scripts/ScriptUI Panels/
//   Restart After Effects -> Window > ScriptLauncherPanel.jsx

(function (thisObj) {

    var SCRIPT_NAME = "Script Launcher";
    var SETTINGS_SECTION = "ScriptLauncherPanel";
    var POLL_INTERVAL = 1500; // ms - how often to re-scan the folder
    var VALID_EXT = /\.(jsx|jsxbin)$/i;

    // Pinned universal task slot - always the top button, never in the list
    var TASK_FILE = "!TASK.jsx";
    var TASK_TAG = /^\s*\/\/\s*TASK:\s*(.+?)\s*$/;   // header line shown as the tip

    // --- compact metrics -----------------------------------------------------
    var BTN_H = 20;      // button height
    var TASK_BTN_H = 26; // pinned task button - a bit taller
    var ROW_H = 20;      // folder field height
    var PAD = 4;         // panel margins
    var GAP = 3;         // spacing between rows
    var LIST_MIN_H = 120;

    var scriptFolder = null;
    var fileCache = "";
    var panelClosed = false;

    var listBox, folderText, chooseBtn, refreshBtn, runBtn, runLastBtn, statusText, taskBtn;

    // --- settings ------------------------------------------------------------
    function loadFolderPath() {
        if (app.settings.haveSetting(SETTINGS_SECTION, "folderPath")) {
            var p = app.settings.getSetting(SETTINGS_SECTION, "folderPath");
            if (p && Folder(p).exists) return Folder(p);
        }
        return null;
    }

    function saveFolderPath(folder) {
        app.settings.saveSetting(SETTINGS_SECTION, "folderPath", folder.fsName);
    }

    function loadLastScript() {
        if (app.settings.haveSetting(SETTINGS_SECTION, "lastScript")) {
            return app.settings.getSetting(SETTINGS_SECTION, "lastScript");
        }
        return "";
    }

    function saveLastScript(path) {
        app.settings.saveSetting(SETTINGS_SECTION, "lastScript", path);
    }

    // --- folder scanning -----------------------------------------------------
    function getScriptFiles(folder) {
        if (!folder || !folder.exists) return [];
        var files = folder.getFiles(function (f) {
            return (f instanceof File) && VALID_EXT.test(f.name) && f.name !== TASK_FILE;
        });
        files.sort(function (a, b) {
            return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
        });
        return files;
    }

    function buildCacheKey(files) {
        var parts = [];
        for (var i = 0; i < files.length; i++) {
            parts.push(files[i].name + ":" + files[i].modified.getTime());
        }
        return parts.join(",");
    }

    function refreshList(force) {
        if (!scriptFolder || !scriptFolder.exists) {
            listBox.removeAll();
            statusText.text = "No folder selected";
            refreshTaskBtn(force);
            return;
        }
        refreshTaskBtn(force);
        var files = getScriptFiles(scriptFolder);
        var key = buildCacheKey(files);
        if (!force && key === fileCache) return;

        fileCache = key;
        var selectedName = (listBox.selection) ? listBox.selection.text : null;
        listBox.removeAll();
        for (var i = 0; i < files.length; i++) {
            var item = listBox.add("item", files[i].name);
            item.scriptFile = files[i].fsName;
            item.helpTip = files[i].name;   // full name on hover when truncated
            if (selectedName === files[i].name) item.selected = true;
        }
        updateStatus(files.length);
    }

    // --- pinned task slot ----------------------------------------------------
    function taskFile() {
        if (!scriptFolder || !scriptFolder.exists) return null;
        var f = File(scriptFolder.fsName + "/" + TASK_FILE);
        return f.exists ? f : null;
    }

    // Read the "// TASK: ..." header line so the button says what is loaded
    function readTaskTag(f) {
        var tag = "";
        try {
            f.encoding = "UTF-8";
            if (f.open("r")) {
                for (var i = 0; i < 40 && !f.eof; i++) {
                    var m = TASK_TAG.exec(f.readln());
                    if (m) { tag = m[1]; break; }
                }
                f.close();
            }
        } catch (e) { /* unreadable - fall back to the plain label */ }
        return tag;
    }

    var taskStamp = "";
    function refreshTaskBtn(force) {
        if (!taskBtn) return;
        var f = taskFile();
        if (!f) {
            if (taskStamp === "none" && !force) return;
            taskStamp = "none";
            taskBtn.enabled = false;
            taskBtn.text = "TASK - not found";
            taskBtn.helpTip = TASK_FILE + " is missing from this folder";
            return;
        }
        var stamp = String(f.modified.getTime());
        if (stamp === taskStamp && !force) return;
        taskStamp = stamp;
        var tag = readTaskTag(f);
        taskBtn.enabled = true;
        taskBtn.text = "TASK";
        taskBtn.helpTip = tag ? (TASK_FILE + "\n" + tag) : TASK_FILE;
    }

    function updateStatus(count) {
        if (listBox.selection) {
            statusText.text = listBox.selection.text;   // full name of selection
        } else {
            statusText.text = count + " script" + (count === 1 ? "" : "s");
        }
    }

    function runScriptFile(path) {
        if (!path) return;
        var f = File(path);
        if (!f.exists) {
            alert("File not found:\n" + path);
            return;
        }
        try {
            $.evalFile(f);
            saveLastScript(path);
        } catch (e) {
            alert("Script error:\n" + f.name + "\n\n" + e.toString());
        }
    }

    // No background timer on purpose.
    // app.scheduleTask() keeps firing while a launched script holds a dialog
    // open, and AE then throws "Cannot run a script while a modal dialog is
    // waiting for response", which breaks the script that is running.
    // The folder is re-scanned when the pointer enters the panel instead.
    var lastScan = 0;

    function refreshOnHover() {
        var now = (new Date()).getTime();
        if (now - lastScan < POLL_INTERVAL) return;
        lastScan = now;
        try { refreshList(false); } catch (e) {}
    }

    // --- UI ------------------------------------------------------------------
    function buildUI(thisObj) {
        var panel = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", SCRIPT_NAME, undefined, { resizeable: true });

        panel.orientation = "column";
        panel.alignChildren = ["fill", "fill"];
        panel.spacing = GAP;
        panel.margins = PAD;

        // Row 0: pinned universal task slot
        taskBtn = panel.add("button", undefined, "TASK");
        taskBtn.alignment = ["fill", "top"];
        taskBtn.preferredSize.height = TASK_BTN_H;

        // Row 1: folder path + browse
        var folderGroup = panel.add("group");
        folderGroup.orientation = "row";
        folderGroup.alignment = ["fill", "top"];
        folderGroup.alignChildren = ["fill", "center"];
        folderGroup.spacing = GAP;
        folderGroup.margins = 0;

        folderText = folderGroup.add("edittext", undefined, "");
        folderText.enabled = false;
        folderText.alignment = ["fill", "center"];
        folderText.preferredSize.height = ROW_H;
        folderText.helpTip = "Current script folder";

        chooseBtn = folderGroup.add("button", undefined, "...");
        chooseBtn.preferredSize = [24, ROW_H];
        chooseBtn.alignment = ["right", "center"];
        chooseBtn.helpTip = "Choose script folder";

        // Row 2: the list - takes all remaining height
        listBox = panel.add("listbox", undefined, [], { multiselect: false });
        listBox.alignment = ["fill", "fill"];
        listBox.minimumSize.height = LIST_MIN_H;
        listBox.preferredSize.height = 400;   // grows with the panel

        // Row 3: buttons, one compact row
        var btnGroup = panel.add("group");
        btnGroup.orientation = "row";
        btnGroup.alignment = ["fill", "bottom"];
        btnGroup.alignChildren = ["fill", "center"];
        btnGroup.spacing = GAP;
        btnGroup.margins = 0;

        runBtn = btnGroup.add("button", undefined, "Run");
        runBtn.preferredSize.height = BTN_H;
        runBtn.helpTip = "Run selected script (or double-click it)";

        runLastBtn = btnGroup.add("button", undefined, "Last");
        runLastBtn.preferredSize.height = BTN_H;
        runLastBtn.helpTip = "Re-run the last script";

        refreshBtn = btnGroup.add("button", undefined, "\u21BB");
        refreshBtn.preferredSize = [26, BTN_H];
        refreshBtn.alignment = ["right", "center"];
        refreshBtn.helpTip = "Refresh list";

        // Row 4: status - full name of selection / script count
        statusText = panel.add("statictext", undefined, "", { truncate: "middle" });
        statusText.alignment = ["fill", "bottom"];
        statusText.preferredSize.height = 14;

        // --- handlers --------------------------------------------------------
        taskBtn.onClick = function () {
            var f = taskFile();
            if (!f) {
                alert(TASK_FILE + " not found in:\n" + (scriptFolder ? scriptFolder.fsName : "-"));
                return;
            }
            runScriptFile(f.fsName);
        };

        chooseBtn.onClick = function () {
            var f = Folder.selectDialog("Choose script folder");
            if (f) {
                scriptFolder = f;
                saveFolderPath(f);
                folderText.text = f.fsName;
                fileCache = "";
                refreshList(true);
            }
        };

        refreshBtn.onClick = function () {
            refreshList(true);
        };

        listBox.onChange = function () {
            updateStatus(listBox.items.length);
        };

        listBox.onDoubleClick = function () {
            if (listBox.selection) runScriptFile(listBox.selection.scriptFile);
        };

        runBtn.onClick = function () {
            if (!listBox.selection) {
                alert("Select a script from the list");
                return;
            }
            runScriptFile(listBox.selection.scriptFile);
        };

        runLastBtn.onClick = function () {
            var last = loadLastScript();
            if (!last) {
                alert("No script has been run yet");
                return;
            }
            runScriptFile(last);
        };

        if (panel instanceof Window) {
            panel.onClose = function () { panelClosed = true; };
        }

        // --- init ------------------------------------------------------------
        // A failure here must not leave the panel half-built with dead buttons
        try {
            scriptFolder = loadFolderPath();
            if (scriptFolder) folderText.text = scriptFolder.fsName;
            refreshList(true);
        } catch (e) {
            statusText.text = "init: " + e.toString();
        }

        try {
            panel.addEventListener("mouseover", refreshOnHover);
        } catch (e2) {
            statusText.text = "auto-refresh off - use the refresh button";
        }

        panel.onResizing = panel.onResize = function () {
            this.layout.resize();
        };

        return panel;
    }

    var myScriptLauncherPanel = buildUI(thisObj);

    if (myScriptLauncherPanel instanceof Window) {
        myScriptLauncherPanel.center();
        myScriptLauncherPanel.show();
    } else {
        myScriptLauncherPanel.layout.layout(true);
        myScriptLauncherPanel.layout.resize();
    }

})(this);
