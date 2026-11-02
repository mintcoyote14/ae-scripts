// MakingOf_Premiere_Lay.jsx
// Run in Adobe PREMIERE PRO (File > Scripts > Run Script File...), NOT in After Effects.
// Imports selected making-of shot renders (AE renders + ready making-of movs) into a bin and lays them one after another
// on the first EMPTY video track of the ACTIVE sequence, in the order listed below.
// Music/audio already in the sequence is not touched.

(function () {
    // ---- SETTINGS ----------------------------------------------------------
    var ROOT      = "X:/FFDroneland_231652/vfx/making_of/";   // paths in ORDER are relative to this
    var BIN_NAME  = "MAKING OF - shots";
    var START_AT  = 0;      // seconds on the timeline where the first shot starts
    var GAP       = 0;      // seconds of gap between shots
    var ADD_MARKERS = true; // one sequence marker per shot (named after the shot)

    // Shot order. Edit freely: reorder lines, delete a line to skip a shot.
    // Latest version of each shot; "DO_MONTAZU/" = ready making-of renders, "AP/out/" = AE project renders.
    var ORDER = [
        // intro: hero assets
        "DO_MONTAZU/DW_Drone_Eagle_makingof_v001.mov",
        "DO_MONTAZU/DW_Checkpoint_makingof_v001b.mov",
        // 101
        "AP/out/dro_101_city_0010_1.mp4",
        "DO_MONTAZU/DW_dro_101_tun_0080_makingof_v001.mov",
        // 102
        "AP/out/dro_102_city_0070_1.mp4",
        "AP/out/dro_102_raid_0670_1.mp4",
        // 103
        "AP/out/fdro_103_gyard_0010_reel_1.mp4",
        "DO_MONTAZU/dro_103_wcastle_0010_MakingOf_render_001.mov",
        "AP/out/dro_wcastle_0020_1.mp4",
        "AP/out/dro_103_guard_0100_1.mp4",
        // 105
        "DO_MONTAZU/dro_105_city_0020_MakingOf_render_001.mov",
        "AP/out/dro_105_nomad_0010_1.mp4",
        "DO_MONTAZU/dro_105_marsh3_0330_MakingOf_render_001.mov",
        // 106
        "AP/out/dro_106_aartcastle_0010_1.mp4",
        "AP/out/dro_106_aartcastle_0040_1.mp4",
        "AP/out/dro_106_city_0050_1.mp4",
        "DO_MONTAZU/DW_dro_106_swarm_0300_makingof_v001b.mov",
        "AP/out/dro_106_escape_0090_1_v02.mp4",
        "DO_MONTAZU/dro_106_escape_0180_MakingOf_render_001.mov"
    ];
    // ------------------------------------------------------------------------

    if (!app.project) { alert("Open a Premiere project first."); return; }
    var seq = app.project.activeSequence;
    if (!seq) { alert("Open the sequence (with your music) and make it active, then run again."); return; }

    // Collect existing files / report missing ones
    var paths = [], names = [], missing = [];
    for (var i = 0; i < ORDER.length; i++) {
        var f = new File(ROOT + ORDER[i]);
        if (f.exists) { paths.push(f.fsName); names.push(f.name); }
        else missing.push(ORDER[i]);
    }
    if (!paths.length) { alert("No files found under:\n" + ROOT); return; }

    // First empty video track
    var track = null;
    for (var t = 0; t < seq.videoTracks.numTracks; t++) {
        if (seq.videoTracks[t].clips.numItems === 0) { track = seq.videoTracks[t]; break; }
    }
    if (!track) { alert("No empty video track in the active sequence. Add one and run again."); return; }

    if (!confirm("Import " + paths.length + " shots and lay them on an empty video track of '" +
                 seq.name + "' starting at " + START_AT + " s?" +
                 (missing.length ? "\n\nMissing (skipped): " + missing.length : ""))) return;

    // Bin: reuse if it exists
    var root = app.project.rootItem, bin = null;
    for (var c = 0; c < root.children.numItems; c++) {
        var ch = root.children[c];
        if (ch.type === ProjectItemType.BIN && ch.name === BIN_NAME) { bin = ch; break; }
    }
    if (!bin) bin = root.createBin(BIN_NAME);

    app.project.importFiles(paths, true, bin, false);

    function findInBin(name) {
        for (var k = 0; k < bin.children.numItems; k++) {
            if (bin.children[k].name === name) return bin.children[k];
        }
        return null;
    }

    var pos = START_AT, placed = 0, failed = [];
    for (var n = 0; n < names.length; n++) {
        var item = findInBin(names[n]);
        if (!item) { failed.push(names[n]); continue; }
        var tm = new Time();
        tm.seconds = pos;
        try {
            track.overwriteClip(item, tm);
        } catch (e) { failed.push(names[n] + " (" + e + ")"); continue; }

        // The clip just placed is the last one on this track
        var last = track.clips[track.clips.numItems - 1];
        if (ADD_MARKERS) {
            try {
                var mk = seq.markers.createMarker(pos);
                mk.name = names[n].replace(/\.(mp4|mov)$/i, "");
            } catch (e2) { }
        }
        pos = last.end.seconds + GAP;
        placed++;
    }

    var msg = "Placed " + placed + " of " + names.length + " shots.\nTotal length: " + (pos - START_AT).toFixed(1) + " s";
    if (missing.length) msg += "\n\nFile not found:\n" + missing.join("\n");
    if (failed.length) msg += "\n\nFailed:\n" + failed.join("\n");
    msg += "\n\nCheck the audio tracks: shot audio (if any) may have landed next to your music.";
    alert(msg);
})();
