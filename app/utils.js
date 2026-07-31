// ---------------------------------------------------------------------------
// Small shared helpers used across the vanilla JS app.
// ---------------------------------------------------------------------------

function uuidv4() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    try {
      return window.crypto.randomUUID();
    } catch (e) {
      /* fall through to manual implementation */
    }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function extOf(name) {
  const clean = name.split("/").pop() || name;
  const idx = clean.lastIndexOf(".");
  if (idx <= 0) return "";
  return clean.slice(idx + 1).toLowerCase();
}

function baseName(path) {
  return path.split("/").filter(Boolean).pop() || path;
}

function dirName(path) {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

function joinPath(...parts) {
  return parts
    .filter((p) => p !== undefined && p !== null && p !== "")
    .join("/")
    .replace(/\/+/g, "/")
    .replace(/^\//, "");
}

const TEXT_EXTENSIONS = new Set([
  "json",
  "js",
  "mjs",
  "cjs",
  "ts",
  "txt",
  "md",
  "lang",
  "mcfunction",
  "material",
  "css",
  "html",
  "csv",
  "xml",
  "yml",
  "yaml",
]);

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "tga"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "ogg", "wav"]);

function isTextExt(ext) {
  return TEXT_EXTENSIONS.has(ext);
}
function isImageExt(ext) {
  return IMAGE_EXTENSIONS.has(ext);
}
function isAudioExt(ext) {
  return AUDIO_EXTENSIONS.has(ext);
}

function mimeFor(ext) {
  const map = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    tga: "image/tga",
    mp3: "audio/mpeg",
    ogg: "audio/ogg",
    wav: "audio/wav",
    json: "application/json",
  };
  return map[ext] || "application/octet-stream";
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let val = bytes / 1024;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val < 10 ? 1 : 0)} ${units[i]}`;
}

function debounce(fn, wait) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToB64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k === "text") node.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") {
        node.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === "dataset") {
        for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = dv;
      } else {
        node.setAttribute(k, v);
      }
    }
  }
  (children || []).forEach((c) => {
    if (c === undefined || c === null || c === false) return;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
}

function toast(message, opts) {
  const options = opts || {};
  const host = document.getElementById("pas-toast-host");
  if (!host) return;
  const node = el("div", { class: `pas-toast pas-toast--${options.type || "info"}` }, [message]);
  host.appendChild(node);
  requestAnimationFrame(() => node.classList.add("is-visible"));
  setTimeout(() => {
    node.classList.remove("is-visible");
    setTimeout(() => node.remove(), 220);
  }, options.duration || 2200);
}

// ---------------------------------------------------------------------------
// A small hand-rolled, loose-mode JSON parser shared by formatJSON() (the
// file explorer's "Format JSON" action) and the JSON half of the editor's
// live syntax-error highlighting (app/lint.js). "Loose" here just means it
// keeps every string/number/keyword's *original source text* verbatim in a
// lightweight AST instead of converting to real JS values -- see the
// comment on formatJSON() below for why that matters. Throws an Error with
// `.pos`/`.line`/`.col` (1-based) pointing at the first parse failure.
// ---------------------------------------------------------------------------
function parseJsonLoose(text) {
  // Strip a leading UTF-8 BOM, if present (common in files saved/edited by
  // some Windows tools), so it doesn't get mistaken for a stray token.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const n = src.length;
  let i = 0;

  function fail(message) {
    const upTo = src.slice(0, i);
    const line = (upTo.match(/\n/g) || []).length + 1;
    const col = i - upTo.lastIndexOf("\n");
    const err = new Error(message);
    err.pos = i;
    err.line = line;
    err.col = col;
    throw err;
  }

  function isWs(ch) {
    return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
  }

  function skipWs() {
    while (i < n && isWs(src[i])) i++;
  }

  function parseString() {
    const start = i;
    i++; // opening quote
    while (i < n) {
      const ch = src[i];
      if (ch === "\\") {
        if (i + 1 >= n) fail("Unterminated string literal");
        i += 2;
        continue;
      }
      if (ch === '"') {
        i++;
        return src.slice(start, i);
      }
      if (ch === "\n") fail("Unterminated string literal (newline inside string)");
      i++;
    }
    fail("Unterminated string literal");
  }

  function parseNumber() {
    const start = i;
    if (src[i] === "-") i++;
    if (src[i] === undefined || src[i] < "0" || src[i] > "9") fail("Invalid number");
    while (i < n && src[i] >= "0" && src[i] <= "9") i++;
    if (src[i] === ".") {
      i++;
      if (src[i] === undefined || src[i] < "0" || src[i] > "9") fail("Invalid number");
      while (i < n && src[i] >= "0" && src[i] <= "9") i++;
    }
    if (src[i] === "e" || src[i] === "E") {
      i++;
      if (src[i] === "+" || src[i] === "-") i++;
      if (src[i] === undefined || src[i] < "0" || src[i] > "9") fail("Invalid number");
      while (i < n && src[i] >= "0" && src[i] <= "9") i++;
    }
    return src.slice(start, i);
  }

  function parseKeyword(word) {
    if (src.slice(i, i + word.length) !== word) fail(`Unexpected token (expected '${word}')`);
    i += word.length;
    return word;
  }

  function parseValue() {
    skipWs();
    const ch = src[i];
    if (ch === undefined) fail("Unexpected end of input");
    if (ch === '"') return { type: "raw", text: parseString() };
    if (ch === "{") return parseObject();
    if (ch === "[") return parseArray();
    if (ch === "-" || (ch >= "0" && ch <= "9")) return { type: "raw", text: parseNumber() };
    if (ch === "t") return { type: "raw", text: parseKeyword("true") };
    if (ch === "f") return { type: "raw", text: parseKeyword("false") };
    if (ch === "n") return { type: "raw", text: parseKeyword("null") };
    fail(`Unexpected token '${ch}'`);
  }

  function parseObject() {
    i++; // {
    const members = [];
    skipWs();
    if (src[i] === "}") {
      i++;
      return { type: "object", members };
    }
    for (;;) {
      skipWs();
      if (src[i] !== '"') fail("Expected a property name in double quotes");
      const key = parseString();
      skipWs();
      if (src[i] !== ":") fail("Expected ':' after property name");
      i++;
      const value = parseValue();
      members.push({ key, value });
      skipWs();
      if (src[i] === ",") {
        i++;
        continue;
      }
      if (src[i] === "}") {
        i++;
        break;
      }
      fail("Expected ',' or '}'");
    }
    return { type: "object", members };
  }

  function parseArray() {
    i++; // [
    const items = [];
    skipWs();
    if (src[i] === "]") {
      i++;
      return { type: "array", items };
    }
    for (;;) {
      items.push(parseValue());
      skipWs();
      if (src[i] === ",") {
        i++;
        continue;
      }
      if (src[i] === "]") {
        i++;
        break;
      }
      fail("Expected ',' or ']'");
    }
    return { type: "array", items };
  }

  const root = parseValue();
  skipWs();
  if (i < n) fail("Unexpected trailing content after the JSON value");
  return root;
}

// ---------------------------------------------------------------------------
// A small hand-rolled JSON pretty-printer used by the file explorer's
// per-file "..." menu -> "Format JSON" action. Deliberately NOT implemented
// as `JSON.stringify(JSON.parse(text))` -- that round-trip is lossy for
// things creators actually rely on in Minecraft add-on JSON:
//   - Parsing to a plain JS object silently reorders any purely-numeric
//     string keys (e.g. a block-state/trading tier keyed "1", "2", ...)
//     ahead of every other key, per the JS property-ordering spec.
//   - Duplicate keys inside the same object (rare, but not unheard of after
//     copy/pasting snippets) get silently collapsed to just the last one.
//   - Every number gets re-rendered through JS's float-to-string
//     formatting, so `1.0` becomes `1`, `5e2` becomes `500`, and very
//     large/high-precision numbers can silently lose precision.
// Any of those would quietly rewrite the *meaning* of the file, not just
// its whitespace. Instead this walks the raw character stream once (via
// parseJsonLoose(), shared with the editor's live JSON error-highlighting),
// building a lightweight AST that keeps every string/number/keyword's
// original source text verbatim, and re-emits it re-indented.
// ---------------------------------------------------------------------------
function formatJSON(text, indent) {
  const unit = indent || "\t";
  const root = parseJsonLoose(text);

  function print(node, depth) {
    if (node.type === "raw") return node.text;
    const pad = unit.repeat(depth);
    const padIn = unit.repeat(depth + 1);
    if (node.type === "object") {
      if (!node.members.length) return "{}";
      const lines = node.members.map((m) => `${padIn}${m.key}: ${print(m.value, depth + 1)}`);
      return `{\n${lines.join(",\n")}\n${pad}}`;
    }
    // array
    if (!node.items.length) return "[]";
    const lines = node.items.map((v) => `${padIn}${print(v, depth + 1)}`);
    return `[\n${lines.join(",\n")}\n${pad}]`;
  }

  return print(root, 0);
}


