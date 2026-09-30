// Scale Multiple Compositions.jsx
// Дозволяє вибрати кілька композицій у панелі Project, ввести нові
// розміри та режим масштабування, і застосовує їх до всіх обраних композицій.
//
// Режими:
//  - Scale to Fit    : масштабує весь контент так, щоб він повністю влазив у новий кадр
//                       (можуть з'явитися порожні поля з боків/зверху-знизу)
//  - Scale to Fill    : масштабує так, щоб контент повністю заповнив кадр (частина обрізається)
//  - Stretch          : масштабує по X і Y окремо (може спотворити пропорції)
//  - Scale by Width    : як стандартний "Scale Composition" в AE — масштаб по ширині
//  - Crop/Extend only  : лише змінює розмір полотна, без масштабування шарів (класичний кроп)

(function scaleMultipleComps() {

    if (app.project.selection.length === 0) {
        alert("Виберіть одну або кілька композицій у панелі Project.");
        return;
    }

    var selectedComps = [];
    for (var i = 0; i < app.project.selection.length; i++) {
        var item = app.project.selection[i];
        if (item instanceof CompItem) selectedComps.push(item);
    }

    if (selectedComps.length === 0) {
        alert("Серед обраного немає жодної композиції.\nВиберіть хоча б одну композицію у панелі Project.");
        return;
    }

    var firstComp = selectedComps[0];
    var origRatio = firstComp.width / firstComp.height;

    // ---------------- UI ----------------
    var win = new Window("dialog", "Масштабування композицій (" + selectedComps.length + ")");
    win.orientation = "column";
    win.alignChildren = "fill";
    win.spacing = 10;
    win.margins = 16;

    var namesPanel = win.add("panel", undefined, "Обрані композиції");
    namesPanel.margins = 10;
    var names = [];
    for (var n = 0; n < selectedComps.length; n++) names.push(selectedComps[n].name);
    var namesST = namesPanel.add("statictext", undefined, names.join(", "), {multiline: true});
    namesST.preferredSize = [380, 40];

    var sizePanel = win.add("panel", undefined, "Новий розмір");
    sizePanel.orientation = "column";
    sizePanel.alignChildren = "left";
    sizePanel.margins = 10;

    var wGroup = sizePanel.add("group");
    var wLabel = wGroup.add("statictext", undefined, "Ширина:");
    wLabel.preferredSize.width = 80;
    var widthInput = wGroup.add("edittext", undefined, String(firstComp.width));
    widthInput.characters = 8;
    wGroup.add("statictext", undefined, "px");

    var hGroup = sizePanel.add("group");
    var hLabel = hGroup.add("statictext", undefined, "Висота:");
    hLabel.preferredSize.width = 80;
    var heightInput = hGroup.add("edittext", undefined, String(firstComp.height));
    heightInput.characters = 8;
    hGroup.add("statictext", undefined, "px");

    var lockAspect = sizePanel.add("checkbox", undefined, "Зберігати пропорції (за першою обраною композицією)");
    lockAspect.value = true;

    var updating = false;
    widthInput.onChanging = function () {
        if (lockAspect.value && !updating) {
            updating = true;
            var w = parseFloat(widthInput.text);
            if (!isNaN(w) && w > 0) heightInput.text = String(Math.round(w / origRatio));
            updating = false;
        }
    };
    heightInput.onChanging = function () {
        if (lockAspect.value && !updating) {
            updating = true;
            var h = parseFloat(heightInput.text);
            if (!isNaN(h) && h > 0) widthInput.text = String(Math.round(h * origRatio));
            updating = false;
        }
    };

    var modePanel = win.add("panel", undefined, "Режим");
    modePanel.orientation = "column";
    modePanel.alignChildren = "left";
    modePanel.margins = 10;

    var modeWidth = modePanel.add("radiobutton", undefined, "Scale by Width — як стандартний Scale Composition");
    var modeFit = modePanel.add("radiobutton", undefined, "Scale to Fit — весь контент видно повністю (можуть бути порожні поля)");
    var modeFill = modePanel.add("radiobutton", undefined, "Scale to Fill — кадр заповнений повністю (частина обрізається)");
    var modeStretch = modePanel.add("radiobutton", undefined, "Stretch — розтягнути по X/Y окремо (можливе спотворення)");
    var modeCropOnly = modePanel.add("radiobutton", undefined, "Crop/Extend Only — лише змінити полотно, без масштабування контенту");
    modeWidth.value = true;

    var btnGroup = win.add("group");
    btnGroup.alignment = "right";
    var cancelBtn = btnGroup.add("button", undefined, "Скасувати", {name: "cancel"});
    var okBtn = btnGroup.add("button", undefined, "OK", {name: "ok"});

    var result = null;

    okBtn.onClick = function () {
        var w = parseFloat(widthInput.text);
        var h = parseFloat(heightInput.text);
        if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
            alert("Введіть коректні додатні значення ширини та висоти.");
            return;
        }
        if (w > 30000 || h > 30000) {
            alert("Ширина/висота не повинні перевищувати 30000px (обмеження After Effects).");
            return;
        }
        var mode = "width";
        if (modeFit.value) mode = "fit";
        else if (modeFill.value) mode = "fill";
        else if (modeStretch.value) mode = "stretch";
        else if (modeCropOnly.value) mode = "crop";
        else if (modeWidth.value) mode = "width";

        result = {width: Math.round(w), height: Math.round(h), mode: mode};
        win.close();
    };

    cancelBtn.onClick = function () {
        result = null;
        win.close();
    };

    win.center();
    win.show();

    if (!result) return; // скасовано

    // ---------------- Обробка ----------------
    app.beginUndoGroup("Scale/Resize Multiple Compositions");

    var processedCount = 0;
    for (var c = 0; c < selectedComps.length; c++) {
        try {
            processComp(selectedComps[c], result.width, result.height, result.mode);
            renameComp(selectedComps[c], result.width, result.height);
            processedCount++;
        } catch (err) {
            alert("Помилка при обробці композиції \"" + selectedComps[c].name + "\":\n" + err.toString());
        }
    }

    app.endUndoGroup();
    alert("Готово! Оброблено композицій: " + processedCount + " з " + selectedComps.length + ".");

    // ---------------- Функції ----------------

    function renameComp(comp, newW, newH) {
        // прибираємо існуючий запис виду "_ШИРИНАxВИСОТА" (в будь-якому місці назви,
        // не тільки в кінці — напр. "COMP_436x264_v2" теж коректно обробиться)
        // і дописуємо новий розмір в кінець назви.
        var baseName = comp.name.replace(/_\d+x\d+/gi, "");
        comp.name = baseName + "_" + newW + "x" + newH;
    }

    function processComp(comp, newW, newH, mode) {
        var oldW = comp.width;
        var oldH = comp.height;

        var scaleX = newW / oldW;
        var scaleY = newH / oldH;

        if (mode === "fit") {
            var sFit = Math.min(scaleX, scaleY);
            scaleX = scaleY = sFit;
        } else if (mode === "fill") {
            var sFill = Math.max(scaleX, scaleY);
            scaleX = scaleY = sFill;
        } else if (mode === "width") {
            scaleX = scaleY = newW / oldW;
        } else if (mode === "crop") {
            scaleX = scaleY = 1;
        }
        // "stretch" — scaleX і scaleY лишаються різними, як обчислено вище

        if (mode !== "crop") {
            var offsetX = (newW - oldW * scaleX) / 2;
            var offsetY = (newH - oldH * scaleY) / 2;

            for (var li = 1; li <= comp.numLayers; li++) {
                scaleLayer(comp.layer(li), scaleX, scaleY, offsetX, offsetY);
            }
        }

        comp.width = newW;
        comp.height = newH;
    }

    function scaleLayer(layer, scaleX, scaleY, offsetX, offsetY) {
        try {
            var transformGroup = layer.property("ADBE Transform Group");
            if (!transformGroup) return;

            var scaleProp = transformGroup.property("ADBE Scale");
            multiplyProperty(scaleProp, scaleX, scaleY, false, 0, 0);

            var posProp = transformGroup.property("ADBE Position");
            multiplyProperty(posProp, scaleX, scaleY, true, offsetX, offsetY);
        } catch (e) {
            // пропускаємо шари без стандартних transform-властивостей (напр. деякі guide layers)
        }
    }

    function multiplyProperty(prop, fx, fy, isPosition, offsetX, offsetY) {
        if (!prop) return;
        if (prop.expressionEnabled) return; // не чіпаємо властивості з виразами

        var sample = prop.value;
        if (sample === undefined || sample.length === undefined) return;
        var isThreeD = sample.length === 3;

        if (prop.numKeys > 0) {
            for (var k = 1; k <= prop.numKeys; k++) {
                var t = prop.keyTime(k);
                var val = prop.keyValue(k);
                prop.setValueAtTime(t, transformValue(val, fx, fy, isPosition, offsetX, offsetY, isThreeD));
            }
        } else {
            prop.setValue(transformValue(sample, fx, fy, isPosition, offsetX, offsetY, isThreeD));
        }
    }

    function transformValue(val, fx, fy, isPosition, offsetX, offsetY, isThreeD) {
        var out = [];
        if (isPosition) {
            out[0] = val[0] * fx + offsetX;
            out[1] = val[1] * fy + offsetY;
            if (isThreeD) out[2] = val[2];
        } else {
            out[0] = val[0] * fx;
            out[1] = val[1] * fy;
            if (isThreeD) out[2] = val[2];
        }
        return out;
    }

})();
