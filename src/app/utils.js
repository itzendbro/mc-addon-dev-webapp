// ---------------------------------------------------------------------------
// Small shared helpers used across the vanilla JS app.
// ---------------------------------------------------------------------------

export function uuidv4() {
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

export function extOf(name) {
  const clean = name.split("/").pop() || name;
  const idx = clean.lastIndexOf(".");
  if (idx <= 0) return "";
  return clean.slice(idx + 1).toLowerCase();
}

export function baseName(path) {
  return path.split("/").filter(Boolean).pop() || path;
}

export function dirName(path) {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

export function joinPath(...parts) {
  return parts
    .filter((p) => p !== undefined && p !== null && p !== "")
    .join("/")
    .replace(/\/+/g, "/")
    .replace(/^\//, "");
}

export const TEXT_EXTENSIONS = new Set([
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

export const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "tga"]);
export const AUDIO_EXTENSIONS = new Set(["mp3", "ogg", "wav"]);

export function isTextExt(ext) {
  return TEXT_EXTENSIONS.has(ext);
}
export function isImageExt(ext) {
  return IMAGE_EXTENSIONS.has(ext);
}
export function isAudioExt(ext) {
  return AUDIO_EXTENSIONS.has(ext);
}

export function mimeFor(ext) {
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

export function formatBytes(bytes) {
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

export function debounce(fn, wait) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function bytesToB64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function el(tag, attrs, children) {
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

export function toast(message, opts) {
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
