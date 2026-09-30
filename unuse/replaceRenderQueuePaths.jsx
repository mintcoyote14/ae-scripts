// Replace output path strings in After Effects Render Queue
// BiedronkaWeekend2026_231673 → BiedronkaZawszeNiskieCeny2026_232084

(function replaceRenderQueuePaths() {
    var OLD_STR = "BiedronkaWeekend2026_231673";
    var NEW_STR = "BiedronkaZawszeNiskieCeny2026_232084";

    var rq = app.project.renderQueue;
    var count = 0;

    for (var i = 1; i <= rq.numItems; i++) {
        var item = rq.item(i);

        // Skip items that are already rendering or done
        if (item.status === RQItemStatus.RENDERING ||
            item.status === RQItemStatus.DONE) continue;

        for (var j = 1; j <= item.numOutputModules; j++) {
            var om = item.outputModule(j);
            var file = om.file;

            if (file !== null) {
                var oldPath = file.fsName;
                if (oldPath.indexOf(OLD_STR) !== -1) {
                    var newPath = oldPath.split(OLD_STR).join(NEW_STR);
                    om.file = new File(newPath);
                    count++;
                }
            }
        }
    }

    alert("Done! Replaced " + count + " output path(s).");
})();
