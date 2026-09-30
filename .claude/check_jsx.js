// Parse-check an ExtendScript .jsx without running it.
// JScript (ES3-level, like ExtendScript) compiles the source via new Function.
// Usage: cscript //Nologo check_jsx.js <path-to-jsx>
var fso = new ActiveXObject("Scripting.FileSystemObject");
var path = WScript.Arguments(0);
var f = fso.OpenTextFile(path, 1, false, 0);
var src = f.AtEndOfStream ? "" : f.ReadAll();
f.Close();

// прибрати препроцесорні директиви (#targetengine, #include) — new Function їх не знає
var lines = src.split("\n");
while (lines.length && /^\s*#/.test(lines[0])) lines.shift();
src = lines.join("\n");

try {
    new Function(src);
    WScript.Echo("SYNTAX OK  " + path);
} catch (e) {
    WScript.Echo("SYNTAX ERROR  " + path + "\n  " + e.description);
    WScript.Quit(1);
}
