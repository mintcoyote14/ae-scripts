// create_select_smart_object_placeholder.jsx
// Вирізає виділену частину (з усіх видимих шарів, як Copy Merged),
// кладе її на місце окремим шаром і робить смарт-об'єкт з маскою по виділенню.
// Двічі клікнути на смарт-об'єкт -> всередині лежить оригінальний кроп,
// нову генерацію кладеш зверху і вмиканням/вимиканням шару бачиш порівняння.
// Уся дія — один крок в History.
//
// Увага: скрипт використовує буфер обміну (те, що було скопійовано, перезапишеться).

#target photoshop

function addRevealSelectionMask() {
    var desc = new ActionDescriptor();
    desc.putClass(stringIDToTypeID("new"), stringIDToTypeID("channel"));
    var ref = new ActionReference();
    ref.putEnumerated(stringIDToTypeID("channel"), stringIDToTypeID("channel"), stringIDToTypeID("mask"));
    desc.putReference(stringIDToTypeID("at"), ref);
    desc.putEnumerated(stringIDToTypeID("using"), stringIDToTypeID("userMaskEnabled"), stringIDToTypeID("revealSelection"));
    executeAction(stringIDToTypeID("make"), desc, DialogModes.NO);
}

function pasteInPlace() {
    var desc = new ActionDescriptor();
    desc.putBoolean(stringIDToTypeID("inPlace"), true);
    desc.putEnumerated(charIDToTypeID("AntA"), charIDToTypeID("Annt"), charIDToTypeID("Anno"));
    executeAction(charIDToTypeID("past"), desc, DialogModes.NO);
}

function CSOP_main() {
    var doc = app.activeDocument;

    var selBounds = null;
    try { selBounds = doc.selection.bounds; } catch (e) { selBounds = null; }
    if (!selBounds) {
        alert("Спочатку зроби виділення.");
        return;
    }

    // Обмежуємо прямокутник межами документа
    var w = doc.width.as("px"), h = doc.height.as("px");
    var selLeft   = Math.max(0, selBounds[0].as("px"));
    var selTop    = Math.max(0, selBounds[1].as("px"));
    var selRight  = Math.min(w, selBounds[2].as("px"));
    var selBottom = Math.min(h, selBounds[3].as("px"));

    var rect = [[selLeft, selTop], [selRight, selTop], [selRight, selBottom], [selLeft, selBottom]];
    doc.selection.select(rect);

    // Новий шар ставимо на самий верх
    try { doc.activeLayer = doc.layers[0]; } catch (e) {}

    var copied = true;
    try {
        doc.selection.copy(true); // Copy Merged — все видиме в межах виділення
    } catch (e) {
        copied = false;
    }

    if (copied) {
        pasteInPlace();
    } else {
        // Запасний варіант: у виділенні немає пікселів — сірий квадрат, як раніше
        doc.artLayers.add();
        var fillColor = new SolidColor();
        fillColor.rgb.red = 128; fillColor.rgb.green = 128; fillColor.rgb.blue = 128;
        doc.selection.select(rect);
        doc.selection.fill(fillColor);
    }
    doc.selection.deselect();

    doc.activeLayer.name = "original";
    executeAction(stringIDToTypeID("newPlacedLayer"), undefined, DialogModes.NO);
    doc.activeLayer.name = "Placeholder - double-click, paste new on top";

    doc.selection.select(rect);
    addRevealSelectionMask();
    doc.selection.deselect();

    doc.activeChannels = doc.componentChannels;
}

if (app.documents.length === 0) {
    alert("Немає відкритого документа.");
} else {
    var CSOP_units = app.preferences.rulerUnits;
    var CSOP_dialogs = app.displayDialogs;
    app.preferences.rulerUnits = Units.PIXELS;
    app.displayDialogs = DialogModes.NO;
    try {
        app.activeDocument.suspendHistory("Placeholder from selection", "CSOP_main()");
    } catch (e) {
        alert("Не вдалося: " + e.message);
    }
    app.preferences.rulerUnits = CSOP_units;
    app.displayDialogs = CSOP_dialogs;
}
