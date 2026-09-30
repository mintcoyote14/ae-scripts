// GuideLayerToggle.jsx
// Вмикає/вимикає Guide Layer на шарах mp4, mov, exr, dpx у виділених композиціях

(function GuideLayerToggle(thisObj) {

    var ALLOWED_EXT = {
        // Відео
        "mp4": true, "mov": true, "avi": true, "mkv": true, "mxf": true,
        "r3d": true, "braw": true, "mts": true, "m2t": true, "m2ts": true,
        "wmv": true, "flv": true, "webm": true, "mpg": true, "mpeg": true,
        "m4v": true,
        // Секвенції / зображення
        "exr": true, "dpx": true, "tiff": true, "tif": true, "png": true,
        "jpg": true, "jpeg": true, "tga": true, "hdr": true, "cin": true,
        "psd": true,
        // Аудіо
        "wav": true, "mp3": true, "aac": true, "aiff": true, "aif": true,
        "flac": true, "ogg": true, "m4a": true
    };

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function getFileExt(layer) {
        try {
            // Джерело шару — FootageItem
            var src = layer.source;
            if (!src) return "";
            if (!(src instanceof FootageItem)) return "";
            var file = src.file;
            if (!file) return ""; // solid, placeholder без файлу
            var name = file.name.toLowerCase();
            var dot = name.lastIndexOf(".");
            if (dot < 0) return "";
            return name.substring(dot + 1);
        } catch (e) {
            return "";
        }
    }

    function isTargetLayer(layer) {
        var ext = getFileExt(layer);
        return !!ALLOWED_EXT[ext];
    }

    function getSelectedComps() {
        var sel = app.project.selection;
        var comps = [];
        for (var i = 0; i < sel.length; i++) {
            if (sel[i] instanceof CompItem) comps.push(sel[i]);
        }
        return comps;
    }

    function setGuideOnComp(comp, state) {
        var changed = 0;
        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layer(i);
            if (isTargetLayer(layer)) {
                layer.guideLayer = state;
                changed++;
            }
        }
        return changed;
    }

    function toggleGuide(forceState) {
        var comps = getSelectedComps();
        if (comps.length === 0) {
            alert("Виділіть одну або кілька композицій у панелі Project.");
            return;
        }

        app.beginUndoGroup("Toggle Guide Layers");

        var targetState;

        if (forceState === undefined) {
            // Авто: якщо хоч один цільовий шар вимкнений — вмикаємо всі
            var anyOff = false;
            outer:
            for (var c = 0; c < comps.length; c++) {
                for (var i = 1; i <= comps[c].numLayers; i++) {
                    var l = comps[c].layer(i);
                    if (isTargetLayer(l) && !l.guideLayer) {
                        anyOff = true;
                        break outer;
                    }
                }
            }
            targetState = anyOff;
        } else {
            targetState = forceState;
        }

        var totalLayers = 0;
        for (var c = 0; c < comps.length; c++) {
            totalLayers += setGuideOnComp(comps[c], targetState);
        }

        app.endUndoGroup();

        var stateLabel = targetState ? "ON" : "OFF";
        if (totalLayers === 0) {
            statusText.text = "mp4/mov/exr/dpx шарів не знайдено";
        } else {
            statusText.text = "Guide " + stateLabel + ": " + totalLayers
                            + " шар(ів) у " + comps.length + " комп.";
        }
        updateButtonStates(targetState);
    }

    function updateButtonStates(state) {
        // кнопки завжди активні
    }

    // ─── UI ───────────────────────────────────────────────────────────────────

    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "Guide Layer Toggle", undefined, { resizeable: true });

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 0;
        win.margins = 0;

        // Header
        var header = win.add("group");
        header.orientation = "row";
        header.alignChildren = ["fill", "center"];
        header.margins = [12, 10, 12, 6];

        var titleText = header.add("statictext", undefined, "GUIDE LAYER TOGGLE");
        titleText.graphics.font = ScriptUI.newFont("dialog", "BOLD", 11);
        titleText.alignment = ["fill", "center"];

        // Subtitle

        // Divider
        win.add("panel").alignment = ["fill", "top"];

        // Toggle button
        var toggleGroup = win.add("group");
        toggleGroup.orientation = "column";
        toggleGroup.alignChildren = ["fill", "top"];
        toggleGroup.margins = [10, 8, 10, 4];
        toggleGroup.spacing = 6;

        var btnToggle = toggleGroup.add("button", undefined, "TOGGLE  (авто)");
        btnToggle.preferredSize.height = 34;

        // ON / OFF
        var rowOnOff = win.add("group");
        rowOnOff.orientation = "row";
        rowOnOff.alignChildren = ["fill", "center"];
        rowOnOff.margins = [10, 0, 10, 8];
        rowOnOff.spacing = 6;

        var btnOn  = rowOnOff.add("button", undefined, "Guide ON");
        var btnOff = rowOnOff.add("button", undefined, "Guide OFF");
        btnOn.preferredSize.height  = 26;
        btnOff.preferredSize.height = 26;

        // Divider
        win.add("panel").alignment = ["fill", "top"];

        // Status
        var statusGroup = win.add("group");
        statusGroup.margins = [10, 4, 10, 8];
        statusGroup.alignment = ["fill", "top"];

        var statusText = statusGroup.add("statictext", undefined,
            "Виділіть композиції у Project", { multiline: false });
        statusText.alignment = ["fill", "center"];
        statusText.graphics.font = ScriptUI.newFont("dialog", "REGULAR", 9);

        // Callbacks
        btnToggle.onClick = function () { toggleGuide(undefined); };
        btnOn.onClick     = function () { toggleGuide(true);  };
        btnOff.onClick    = function () { toggleGuide(false); };

        win.layout.layout(true);
        win.layout.resize();

        if (win instanceof Window) {
            win.center();
            win.show();
        } else {
            // Dockable panel — перемальовуємо при зміні розміру
            win.onResizing = win.onResize = function () {
                this.layout.resize();
            };
        }

        win._btnOn      = btnOn;
        win._btnOff     = btnOff;
        win._statusText = statusText;

        return win;
    }

    // ─── Run ──────────────────────────────────────────────────────────────────

    var panel = buildUI(thisObj);

    var btnOn      = panel._btnOn;
    var btnOff     = panel._btnOff;
    var statusText = panel._statusText;

}(this));
