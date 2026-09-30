// approve_wip.jsx
// =====================================================================
//   Approve the _wip project - write it over the versioned original
// =====================================================================
//   W41A_Makarony_v04_wip.aep  ->  W41A_Makarony_v04.aep
//
//   Saves the open _wip project, then replaces the original of the same
//   version with a copy of it. The _wip project stays open, so the work
//   goes on in the copy.
//
//   The original is replaced only after the copy has been written next
//   to it, so a failed copy never leaves the version without a file.
//   A confirmation names both files before anything is touched.
// =====================================================================

(function () {

    var SCRIPT_NAME = "Approve _wip";
    var SUFFIX      = "_wip";

    function fileName(f) {
        return String(f.fsName).replace(/^.*[\\\/]/, "");
    }

    function stamp(d) {
        function p(n) { return n < 10 ? "0" + n : String(n); }
        return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " +
               p(d.getHours()) + ":" + p(d.getMinutes());
    }

    if (!app.project || !app.project.file) {
        alert(SCRIPT_NAME + "\n\nNo saved project is open.");
        return;
    }

    var wip  = app.project.file;
    var name = fileName(wip);

    if (!/_wip\.aep$/i.test(name)) {
        alert(SCRIPT_NAME + "\n\n" + name + " is not a " + SUFFIX + " project.\n" +
              "Open the " + SUFFIX + " copy first (Save _wip copy).");
        return;
    }

    var origName = name.replace(/_wip\.aep$/i, ".aep");
    var orig     = new File(wip.parent.fsName + "\\" + origName);

    var msg = "Write " + name + "\nover " + origName + "\n\nin " + wip.parent.fsName + "\n\n";
    if (orig.exists) msg += "The current " + origName + " (saved " + stamp(orig.modified) +
                            ") will be replaced.\n";
    else             msg += origName + " does not exist yet - it will be created.\n";
    msg += "The " + SUFFIX + " project stays open.";

    if (!confirm(msg)) return;

    try {
        app.project.save();
    } catch (e) {
        alert(SCRIPT_NAME + "\n\nCould not save " + name + "\n\n" + e.toString() +
              "\n\nNothing was approved.");
        return;
    }

    // the copy lands under a temporary name first
    var tmp = new File(wip.parent.fsName + "\\~approve_tmp.aep");
    if (tmp.exists) tmp.remove();

    if (!wip.copy(tmp)) {
        alert(SCRIPT_NAME + "\n\nCould not copy " + name + ".\n\n" +
              origName + " was not touched.");
        return;
    }

    if (orig.exists && !orig.remove()) {
        tmp.remove();
        alert(SCRIPT_NAME + "\n\nCould not replace " + origName + " - is it open or locked?\n\n" +
              "It was not touched.");
        return;
    }

    if (!tmp.rename(origName)) {
        alert(SCRIPT_NAME + "\n\n" + origName + " was removed, but the copy could not be renamed.\n" +
              "The approved copy is\n" + tmp.fsName);
        return;
    }

    alert(SCRIPT_NAME + "\n\nApproved:\n" + orig.fsName + "\n\nStill working in " + name + ".");

})();
