// DuplicateUnqueuedToPNGAlpha.jsx
//
// Бере перші N елементів Render Queue зі статусом "Unqueued",
// дублює кожен ("Duplicate" — копія RQ-елемента разом з output-модулями
// та іменем файлу), ставить дублікат у чергу (render = true) і застосовує
// до нього Output Module Template "png + a" (PNG-послідовність з альфа-каналом).
//
// Запуск: File > Scripts > Run Script File...  (виберіть цей файл)

(function () {

    // Замінює розширення файлу в повному шляху, зберігаючи решту шляху як є
    // (включно з плейсхолдерами AE на кшталт [dateYear][dateMonth][dateDay]).
    function replaceExtension(fsPath, newExt) {
        var dot = fsPath.lastIndexOf(".");
        var slash = Math.max(fsPath.lastIndexOf("/"), fsPath.lastIndexOf("\\"));
        if (dot > slash) {
            return fsPath.substring(0, dot) + "." + newExt;
        }
        return fsPath + "." + newExt;
    }

    // Якщо папка призначення фізично не існує, AE показує попередження
    // "The directory originally specified... no longer exists" і скидає
    // ім'я файлу на дефолтне. Тому створюємо папку заздалегідь.
    function ensureFolderExists(fsPath) {
        var folder = new File(fsPath).parent;
        if (folder && !folder.exists) {
            folder.create();
        }
    }

    // Присвоює output-модулю шлях, попередньо створивши папку призначення.
    function setOutputFile(om, fsPath) {
        ensureFolderExists(fsPath);
        om.file = new File(fsPath);
    }

    // ======================= НАЛАШТУВАННЯ =======================
    var DUPLICATE_COUNT = 4;            // скільки перших Unqueued елементів дублювати (3 або 4)
    var OM_TEMPLATE_NAME = "png + a";   // точна назва темплейту Output Module
    // ==============================================================

    var rq = app.project.renderQueue;

    if (rq.numItems === 0) {
        alert("Render Queue порожня.");
        return;
    }

    // Збираємо перші N елементів зі статусом Unqueued, у порядку списку
    var targets = [];
    for (var i = 1; i <= rq.numItems && targets.length < DUPLICATE_COUNT; i++) {
        var it = rq.item(i);
        if (it.status === RQItemStatus.UNQUEUED) {
            targets.push(it);
        }
    }

    if (targets.length === 0) {
        alert("Не знайдено жодного елемента Render Queue зі статусом Unqueued.");
        return;
    }

    app.beginUndoGroup("Duplicate Unqueued RQ Items -> png+a");
    try {
        var done = 0;
        var errors = [];

        for (var t = 0; t < targets.length; t++) {
            var srcItem = targets[t];
            var compName = srcItem.comp ? srcItem.comp.name : ("item" + t);

            // КРОК 1: запам'ятовуємо оригінальні шляхи output-модулів ДЖЕРЕЛА
            // ще ДО дублювання — .duplicate() сам по собі не гарантує, що
            // збереже кастомний шлях/ім'я файлу.
            var originalPaths = [];
            for (var os = 1; os <= srcItem.numOutputModules; os++) {
                var srcOm = srcItem.outputModule(os);
                originalPaths.push(srcOm.file ? srcOm.file.fsName : null);
            }

            var newItem;
            try {
                newItem = srcItem.duplicate(); // Duplicate with File Name
            } catch (eDup) {
                errors.push(compName + ": не вдалося дублювати — " + eDup.toString());
                continue;
            }

            newItem.render = true; // ставимо копію в чергу на рендер

            // КРОК 1 (продовження): примусово повертаємо оригінальний шлях/ім'я
            // файлу на дублікаті — саме це і є "duplicate with file name".
            for (var o1 = 1; o1 <= newItem.numOutputModules; o1++) {
                if (originalPaths[o1 - 1]) {
                    setOutputFile(newItem.outputModule(o1), originalPaths[o1 - 1]);
                }
            }

            // КРОК 2: змінюємо формат на дублікаті. applyTemplate() скидає
            // Output To на дефолтне ім'я, тому одразу після цього повертаємо
            // збережений шлях назад, замінивши лише розширення на .png.
            for (var o2 = 1; o2 <= newItem.numOutputModules; o2++) {
                var om = newItem.outputModule(o2);

                try {
                    om.applyTemplate(OM_TEMPLATE_NAME);
                } catch (eTpl) {
                    errors.push(compName + ": темплейт \"" + OM_TEMPLATE_NAME + "\" не застосувався — " + eTpl.toString());
                    continue;
                }

                var originalPath = originalPaths[o2 - 1];
                if (originalPath) {
                    setOutputFile(om, replaceExtension(originalPath, "png"));
                }
            }

            done++;
        }

        var msg = "Дубльовано і оновлено елементів: " + done + " з " + targets.length + ".";
        if (errors.length > 0) {
            msg += "\n\nПомилки:\n" + errors.join("\n");
        }
        alert(msg);

    } catch (e) {
        alert("Помилка: " + e.toString() + (e.line ? (" (рядок " + e.line + ")") : ""));
    } finally {
        app.endUndoGroup();
    }

})();
