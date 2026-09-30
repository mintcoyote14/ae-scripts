(function (thisObj) {
    function getSelectedComp() {
        var comp = null;

        if (app.project && app.project.activeItem && (app.project.activeItem instanceof CompItem)) {
            comp = app.project.activeItem;
        } else if (app.project && app.project.selection && app.project.selection.length > 0) {
            for (var i = 0; i < app.project.selection.length; i++) {
                if (app.project.selection[i] instanceof CompItem) {
                    comp = app.project.selection[i];
                    break;
                }
            }
        }
        return comp;
    }

    function keyForItem(item) {
        try {
            if (item && item.id !== undefined) return String(item.id);
        } catch (e) {}
        return "NAME:" + (item ? item.name : "null");
    }

    function safeSetOutPoint(layer, t) {
        try {
            layer.outPoint = t;
            return;
        } catch (e) {}
        try {
            if (layer.outPoint > t) layer.outPoint = t;
        } catch (e2) {}
    }

    function safeSetInPoint(layer, t) {
        try {
            layer.inPoint = t;
        } catch (e) {}
    }

    function resizeCompRecursive(comp, frames, visited) {
        if (!comp || !(comp instanceof CompItem)) return;

        var k = keyForItem(comp);
        if (visited[k]) return;
        visited[k] = true;

        var fps = comp.frameRate;
        if (!fps || fps <= 0) fps = 25;

        var newDur = frames / fps;
        var oneFrame = 1 / fps;

        comp.duration = newDur;
        try { comp.workAreaStart = 0; } catch (e) {}
        try { comp.workAreaDuration = newDur; } catch (e2) {}

        for (var i = 1; i <= comp.numLayers; i++) {
            var lyr = comp.layer(i);

            // Якщо layer починається після кінця — зсуваємо inPoint в межі композиції
            try {
                if (lyr.inPoint >= newDur) {
                    safeSetInPoint(lyr, Math.max(0, newDur - oneFrame));
                }
            } catch (e3) {}

            // Допасувати тривалість шару до кінця композиції (або обрізати)
            safeSetOutPoint(lyr, newDur);

            // Якщо це прекомп — змінюємо і його теж
            try {
                if (lyr.source && (lyr.source instanceof CompItem)) {
                    resizeCompRecursive(lyr.source, frames, visited);
                }
            } catch (e4) {}
        }
    }

    function buildUI(thisObj) {
        var pal = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "Змінити тривалість (фрейми)", undefined, { resizeable: true });

        pal.orientation = "column";
        pal.alignChildren = ["fill", "top"];

        var g = pal.add("group");
        g.orientation = "row";
        g.alignChildren = ["left", "center"];

        g.add("statictext", undefined, "Кількість фреймів:");
        var et = g.add("edittext", undefined, "250");
        et.characters = 10;

        var btns = pal.add("group");
        btns.orientation = "row";
        btns.alignChildren = ["fill", "center"];

        var applyBtn = btns.add("button", undefined, "Застосувати");
        var closeBtn = btns.add("button", undefined, "Закрити");

        applyBtn.onClick = function () {
            var frames = parseInt(et.text, 10);
            if (isNaN(frames) || frames < 1) {
                alert("Введи коректну кількість фреймів (ціле число > 0).");
                return;
            }

            var comp = getSelectedComp();
            if (!comp) {
                alert("Виділи композицію в Project або відкрий її як Active.");
                return;
            }

            app.beginUndoGroup("Set Comp Duration By Frames");
            var visited = {};
            resizeCompRecursive(comp, frames, visited);
            app.endUndoGroup();
        };

        closeBtn.onClick = function () {
            try { pal.close(); } catch (e) {}
        };

        pal.onResizing = pal.onResize = function () { this.layout.resize(); };

        try { et.active = true; } catch (e) {}

        return pal;
    }

    var pal = buildUI(thisObj);
    if (pal instanceof Window) {
        pal.center();
        pal.show();
    } else {
        pal.layout.layout(true);
        pal.layout.resize();
    }
})(this);
