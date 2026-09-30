// ToggleEffects.jsx
// Вмикає / вимикає Match Grain та Quick Chromatic Aberration
// на вибраних шарах. Підтримує назви з цифрами (напр. "Quick Chromatic Aberration 4").

(function () {

    // ─── Які ефекти шукати (часткове співпадіння на початку рядка) ───────────
    var TARGET_EFFECTS = [
        "Match Grain",
        "Quick Chromatic Aberration"
    ];

    // ─── Перевірка назви ефекту ───────────────────────────────────────────────
    function isTargetEffect(name) {
        for (var i = 0; i < TARGET_EFFECTS.length; i++) {
            // Назва починається з потрібного рядка (далі може бути цифра / пусто)
            if (name.indexOf(TARGET_EFFECTS[i]) === 0) return true;
        }
        return false;
    }

    // ─── Збір ефектів з вибраних шарів ───────────────────────────────────────
    function getTargetFXFromSelection() {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) return null;

        var selectedLayers = comp.selectedLayers;
        if (!selectedLayers || selectedLayers.length === 0) return null;

        var list = []; // { fx, layerName }
        for (var li = 0; li < selectedLayers.length; li++) {
            var layer = selectedLayers[li];
            if (!layer.Effects) continue;
            var fxGroup = layer.Effects;
            for (var fi = 1; fi <= fxGroup.numProperties; fi++) {
                var fx = fxGroup.property(fi);
                if (isTargetEffect(fx.name)) {
                    list.push({ fx: fx, layerName: layer.name });
                }
            }
        }
        return list;
    }

    // ─── Встановлення стану ───────────────────────────────────────────────────
    function setEffectsEnabled(state) {
        var list = getTargetFXFromSelection();
        if (!list) {
            alert("Виберіть шари у активній композиції.");
            return;
        }
        if (list.length === 0) {
            alert("На вибраних шарах не знайдено ефектів\nMatch Grain або Quick Chromatic Aberration.");
            return;
        }

        app.beginUndoGroup(state ? "Увімкнути ефекти" : "Вимкнути ефекти");
        for (var i = 0; i < list.length; i++) {
            list[i].fx.enabled = state;
        }
        app.endUndoGroup();

        updateStatus(list.length, state);
    }

    // ─── Перемикання (toggle) ─────────────────────────────────────────────────
    function toggleEffects() {
        var list = getTargetFXFromSelection();
        if (!list) {
            alert("Виберіть шари у активній композиції.");
            return;
        }
        if (list.length === 0) {
            alert("На вибраних шарах не знайдено ефектів\nMatch Grain або Quick Chromatic Aberration.");
            return;
        }

        // Якщо хоч один вимкнений — вмикаємо всі; якщо всі увімкнені — вимикаємо
        var anyDisabled = false;
        for (var i = 0; i < list.length; i++) {
            if (!list[i].fx.enabled) { anyDisabled = true; break; }
        }
        var newState = anyDisabled;

        app.beginUndoGroup(newState ? "Увімкнути ефекти" : "Вимкнути ефекти");
        for (var i = 0; i < list.length; i++) {
            list[i].fx.enabled = newState;
        }
        app.endUndoGroup();

        updateStatus(list.length, newState);
    }

    // ─── Оновлення рядка статусу ──────────────────────────────────────────────
    var statusText; // буде присвоєно після побудови UI

    function updateStatus(count, state) {
        if (!statusText) return;
        var word = state ? "увімкнено" : "вимкнено";
        statusText.text = "✓  " + count + " ефект(ів) " + word;
    }

    // ─── Побудова UI ──────────────────────────────────────────────────────────
    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "Toggle Effects", undefined, { resizeable: true });

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 10;
        win.margins = 16;

        // ── Заголовок ──
        var titleGroup = win.add("group");
        titleGroup.alignment = ["fill", "top"];
        titleGroup.orientation = "column";
        titleGroup.alignChildren = ["fill", "top"];
        titleGroup.spacing = 2;

        var title = titleGroup.add("statictext", undefined, "Toggle Effects");
        title.graphics.font = ScriptUI.newFont("dialog", "BOLD", 13);

        var subtitle = titleGroup.add("statictext", undefined,
            "Match Grain  ·  Quick Chromatic Aberration");
        subtitle.graphics.font = ScriptUI.newFont("dialog", "REGULAR", 10);
        subtitle.graphics.foregroundColor =
            subtitle.graphics.newPen(subtitle.graphics.PenType.SOLID_COLOR, [0.55, 0.55, 0.55, 1], 1);

        // ── Роздільник ──
        var sep = win.add("panel");
        sep.alignment = ["fill", "top"];
        sep.preferredSize.height = 1;

        // ── Кнопки ──
        var btnGroup = win.add("group");
        btnGroup.orientation = "row";
        btnGroup.alignChildren = ["fill", "center"];
        btnGroup.spacing = 8;
        btnGroup.alignment = ["fill", "top"];

        var btnON  = btnGroup.add("button", undefined, "⏺  Увімкнути");
        var btnOFF = btnGroup.add("button", undefined, "⏸  Вимкнути");
        btnON.preferredSize.height  = 34;
        btnOFF.preferredSize.height = 34;

        // ── Головна кнопка Toggle ──
        var btnToggle = win.add("button", undefined, "⇄  Toggle (вибрані шари)");
        btnToggle.preferredSize.height = 36;
        btnToggle.alignment = ["fill", "top"];

        // ── Рядок статусу ──
        statusText = win.add("statictext", undefined, "Вибери шари та натисни кнопку");
        statusText.graphics.font = ScriptUI.newFont("dialog", "ITALIC", 10);
        statusText.graphics.foregroundColor =
            statusText.graphics.newPen(statusText.graphics.PenType.SOLID_COLOR, [0.5, 0.75, 0.5, 1], 1);

        // ── Обробники ──
        btnON.onClick    = function () { setEffectsEnabled(true);  };
        btnOFF.onClick   = function () { setEffectsEnabled(false); };
        btnToggle.onClick = toggleEffects;

        win.layout.layout(true);

        if (win instanceof Window) {
            win.center();
            win.show();
        }

        return win;
    }

    // ─── Точка входу ─────────────────────────────────────────────────────────
    buildUI(this);

}());
