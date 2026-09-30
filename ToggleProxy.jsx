// ToggleProxy.jsx
// To dock it: drop into .../Scripts/ScriptUI Panels/ and open from the Window menu

var scriptName = "Toggle Proxy";

function buildUI(thisObj) {

    var myPanel = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", scriptName, undefined, { resizeable: true });

    myPanel.orientation    = "column";
    myPanel.alignChildren  = ["fill", "top"];
    myPanel.spacing        = 8;
    myPanel.margins        = 12;

    // --- Header ---
    var title = myPanel.add("statictext", undefined, "PROXY TOGGLE");
    title.alignment = ["center", "top"];
    title.graphics.font = ScriptUI.newFont("dialog", "BOLD", 11);

    // --- Separator ---
    var div = myPanel.add("panel");
    div.alignment = ["fill", "top"];
    div.minimumSize.height = div.maximumSize.height = 2;

    // --- Status ---
    var statusBox = myPanel.add("edittext", undefined, "Select a layer in the timeline", {
        multiline: true,
        readonly:  true
    });
    statusBox.alignment        = ["fill", "top"];
    statusBox.preferredSize.height = 50;

    // --- Toggle button ---
    var btnToggle = myPanel.add("button", undefined, "Toggle Proxy");
    btnToggle.alignment = ["fill", "top"];
    btnToggle.preferredSize.height = 32;

    // --- Enable / Disable ---
    var btnGroup = myPanel.add("group");
    btnGroup.alignment = ["fill", "top"];
    btnGroup.spacing   = 6;

    var btnEnable  = btnGroup.add("button", undefined, "Enable");
    var btnDisable = btnGroup.add("button", undefined, "Disable");
    btnEnable.alignment  = ["fill", "fill"];
    btnDisable.alignment = ["fill", "fill"];

    // --- Refresh ---
    var btnRefresh = myPanel.add("button", undefined, "Refresh status");
    btnRefresh.alignment = ["fill", "top"];

    // ==========================================
    //  Helpers
    // ==========================================

    function getSelectedAVItems() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return null;

        var layers = comp.selectedLayers;
        if (!layers || layers.length === 0) return null;

        var items = [];
        for (var i = 0; i < layers.length; i++) {
            var src = layers[i].source;
            // ExtendScript exposes no global AVItem - check the concrete types
            if (src && (src instanceof FootageItem || src instanceof CompItem)) {
                items.push({ name: layers[i].name, src: src });
            }
        }
        return items.length > 0 ? items : null;
    }

    function updateStatus() {
        var items = getSelectedAVItems();
        if (!items) {
            statusBox.text = "No layers selected";
            return;
        }

        var lines = [];
        for (var i = 0; i < items.length; i++) {
            var src      = items[i].src;
            var name     = items[i].name;
            var hasProxy = (src.proxySource !== null);

            if (!hasProxy) {
                lines.push(name + ": no proxy assigned");
            } else {
                lines.push(name + ": " + (src.useProxy ? "ON" : "OFF"));
            }
        }
        statusBox.text = lines.join("\n");
    }

    function applyProxy(forceState) {
        // forceState: true = on, false = off, null = toggle
        var items = getSelectedAVItems();
        if (!items) {
            alert("Select layer(s) in the timeline.");
            return;
        }

        app.beginUndoGroup("Toggle Proxy");

        for (var i = 0; i < items.length; i++) {
            var src      = items[i].src;
            var name     = items[i].name;
            var hasProxy = (src.proxySource !== null);

            if (!hasProxy) {
                alert("\"" + name + "\" has no proxy assigned.\nAssign one in the Project panel first.");
                continue;
            }

            src.useProxy = (forceState === null) ? !src.useProxy : forceState;
        }

        app.endUndoGroup();
        updateStatus();
    }

    // ==========================================
    //  Button handlers
    // ==========================================
    btnToggle.onClick  = function () { applyProxy(null);  };
    btnEnable.onClick  = function () { applyProxy(true);  };
    btnDisable.onClick = function () { applyProxy(false); };
    btnRefresh.onClick = function () { updateStatus();    };

    updateStatus();

    myPanel.layout.layout(true);
    return myPanel;
}

// ==========================================
//  Run
// ==========================================
var myScriptPal = buildUI(this);

if (myScriptPal instanceof Window) {
    myScriptPal.center();
    myScriptPal.show();
}
