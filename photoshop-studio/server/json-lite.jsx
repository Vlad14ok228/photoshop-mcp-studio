// Minimal JSON.stringify for ExtendScript (ES3), which has no built-in JSON object.
if (typeof JSON === "undefined") { JSON = {}; }
if (!JSON.stringify) {
  JSON.stringify = function (v) {
    var t = typeof v;
    if (v === null || t === "undefined") { return "null"; }
    if (t === "number") { return isFinite(v) ? String(v) : "null"; }
    if (t === "boolean") { return String(v); }
    if (t === "string") {
      var s = "";
      for (var i = 0; i < v.length; i++) {
        var c = v.charAt(i), n = v.charCodeAt(i);
        if (c === "\\") { s += "\\\\"; }
        else if (c === "\"") { s += "\\\""; }
        else if (c === "\n") { s += "\\n"; }
        else if (c === "\r") { s += "\\r"; }
        else if (c === "\t") { s += "\\t"; }
        else if (n < 32 || n > 126) { s += "\\u" + ("0000" + n.toString(16)).slice(-4); }
        else { s += c; }
      }
      return "\"" + s + "\"";
    }
    if (v instanceof Array) {
      var a = [];
      for (var j = 0; j < v.length; j++) { a.push(JSON.stringify(v[j])); }
      return "[" + a.join(",") + "]";
    }
    var o = [];
    for (var k in v) { if (v.hasOwnProperty(k)) { o.push(JSON.stringify(k) + ":" + JSON.stringify(v[k])); } }
    return "{" + o.join(",") + "}";
  };
}
