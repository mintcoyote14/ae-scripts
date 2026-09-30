// ToggleProxy.jsx
// Для докування: кинь у .../Scripts/ScriptUI Panels/ та відкрий через Window меню

var scriptName = "Toggle Proxy";

function buildUI(thisObj) {

    var myPanel = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", scriptName, undefined, { resizeable: true });

    myPanel.orientation    = "column";
    myPanel.alignChildren  = ["fill", "top"];
    myPanel.spacing        = 8;
    myPanel.margins        = 12;

    // --- Заголовок ---
    var title = myPanel.add("statictext", undefined, "PROXY TOGGLE");
    title.alignment = ["center", "top"];
    title.graphics.font = ScriptUI.newFont("dialog", "BOLD", 11);

    // --- Розділювач ---
    var div = myPanel.add("panel");
    div.alignment = ["fill", "top"];
    div.minimumSize.height = div.maximumSize.height = 2;

    // --- Статус ---
    var statusBox = myPanel.add("edittext", undefined, "Виберіть шар на таймлайні", {
        multiline: true,
        readonly:  true
    });
    statusBox.alignment        = ["fill", "top"];
    statusBox.preferredSize.height = 50;

    // --- Кнопка Toggle ---
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
    var btnRefresh = myPanel.add("button", undefined, "Оновити статус");
    btnRefresh.alignment = ["fill", "top"];

    // ==========================================
    //  Допоміжні функції
    // ==========================================

    function getSelectedAVItems() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return null;

        var layers = comp.selectedLayers;
        if (!layers || layers.length === 0) return null;

        var items = [];
        for (var i = 0; i < layers.length; i++) {
            var src = layers[i].source;
            // AVItem як глобальний тип ExtendScript не віддає — перевіряємо конкретні
            if (src && (src instanceof FootageItem || src instanceof CompItem)) {
                items.push({ name: layers[i].name, src: src });
            }
        }
        return items.length > 0 ? items : null;
    }

    function updateStatus() {
        var items = getSelectedAVItems();
        if (!items) {
            statusBox.text = "Немає вибраних шарів";
            return;
        }

        var lines = [];
        for (var i = 0; i < items.length; i++) {
            var src      = items[i].src;
            var name     = items[i].name;
            var hasProxy = (src.proxySource !== null);

            if (!hasProxy) {
                lines.push(name + ": проксі не призначено");
            } else {
                lines.push(name + ": " + (src.useProxy ? "ON" : "OFF"));
            }
        }
        statusBox.text = lines.join("\n");
    }

    function applyProxy(forceState) {
        // forceState: true = увімкнути, false = вимкнути, null = toggle
        var items = getSelectedAVItems();
        if (!items) {
            alert("Виберіть шар(и) на таймлайні.");
            return;
        }

        app.beginUndoGroup("Toggle Proxy");

        for (var i = 0; i < items.length; i++) {
            var src      = items[i].src;
            var name     = items[i].name;
            var hasProxy = (src.proxySource !== null);

            if (!hasProxy) {
                alert("\"" + name + "\" не має призначеного проксі.\nСпочатку призначте його через Project панель.");
                continue;
            }

            src.useProxy = (forceState === null) ? !src.useProxy : forceState;
        }

        app.endUndoGroup();
        updateStatus();
    }

    // ==========================================
    //  Обробники кнопок
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
//  Запуск
// ==========================================
var myScriptPal = buildUI(this);

if (myScriptPal instanceof Window) {
    myScriptPal.center();
    myScriptPal.show();
}
