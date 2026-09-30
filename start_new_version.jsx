// start_new_version.jsx
// =====================================================================
//   Start the next version and its _wip copy - the files the MCP works on
// =====================================================================
//   The open project is a version, e.g. W41A_Makarony_v03.aep. It is
//   saved twice, next to itself:
//
//     W41A_Makarony_v03.aep  ->  W41A_Makarony_v04.aep       (the version)
//                            ->  W41A_Makarony_v04_wip.aep   (stays open)
//
//   v03 is never touched - Save As leaves it as it was last saved.
//   Work happens in v04_wip; "Approve _wip" writes it over v04.
//
//   The number keeps its width (v003 -> v004). A project without a
//   version number gets only the _wip copy, named after itself.
//   Existing files are never overwritten.
// =====================================================================

(function () {

    var SCRIPT_NAME = "Start new version";
    var SUFFIX      = "_wip";

    function fileName(f) {
        return String(f.fsName).replace(/^.*[\\\/]/, "");
    }

    function baseName(f) {
        return fileName(f).replace(/\.[^.]+$/, "");
    }

    function pad(n, len) {
        var s = String(n);
        while (s.length < len) s = "0" + s;
        return s;
    }

    if (!app.project || !app.project.file) {
        alert(SCRIPT_NAME + "\n\nSave the project first - the new files are named after it.");
        return;
    }

    var src    = app.project.file;
    var base   = baseName(src);
    var folder = src.parent.fsName;

    if (/_wip$/i.test(base)) {
        alert(SCRIPT_NAME + "\n\n" + fileName(src) + " is already a " + SUFFIX + " project.\n" +
              "Open the version you want to continue from.");
        return;
    }

    var m = /^(.*[_\-]v)(\d+)$/i.exec(base);
    var verBase = m ? m[1] + pad(parseInt(m[2], 10) + 1, m[2].length) : "";
    var version = m ? new File(folder + "\\" + verBase + ".aep") : null;
    var wip     = new File(folder + "\\" + (m ? verBase : base) + SUFFIX + ".aep");

    if ((version && version.exists) || wip.exists) {
        var which = (version && version.exists) ? fileName(version) : fileName(wip);
        if (wip.exists && confirm(SCRIPT_NAME + "\n\n" + which + " already exists in\n" + folder +
                                  "\n\nOpen " + fileName(wip) + " instead?\n" +
                                  "(the current project is closed - AE asks about unsaved changes)")) {
            try {
                app.open(wip);
            } catch (e) {
                alert(SCRIPT_NAME + "\n\nCould not open\n" + wip.fsName + "\n\n" + e.toString());
            }
            return;
        }
        if (!wip.exists) alert(SCRIPT_NAME + "\n\n" + which + " already exists in\n" + folder +
                               "\n\nNothing was saved.");
        return;
    }

    try {
        if (version) app.project.save(version);
        app.project.save(wip);
    } catch (e2) {
        alert(SCRIPT_NAME + "\n\nCould not save\n" + (version && version.exists ? wip.fsName : (version || wip).fsName) +
              "\n\n" + e2.toString());
        return;
    }

    alert(SCRIPT_NAME + "\n\n" + (version ? "Saved  " + fileName(version) + "\n" : "") +
          "Saved and opened  " + fileName(wip) + "\n\nin " + folder);

})();
