// ---------------------------------------------------------------------------
// A tiny in-memory virtual file system for the editor, persisted to
// localStorage so work survives a page reload on a phone browser.
// ---------------------------------------------------------------------------
import { extOf, isTextExt, isImageExt, isAudioExt, bytesToB64, b64ToBytes } from "./utils.js";

const STORAGE_KEY = "pas.project.v1";

/**
 * File entry shape:
 * { type: 'file', path, ext, isText, content (string) | b64 (string), size }
 * Folder entry shape:
 * { type: 'folder', path, children: Set(paths), open: bool }
 */
export class VFS {
  constructor() {
    this.nodes = new Map(); // path -> node
    this.listeners = new Set();
    this.nodes.set("", { type: "folder", path: "", name: "", children: new Set(), open: true });
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(kind, detail) {
    this.listeners.forEach((fn) => fn(kind, detail));
  }

  get root() {
    return this.nodes.get("");
  }

  has(path) {
    return this.nodes.has(path);
  }

  get(path) {
    return this.nodes.get(path);
  }

  parentPath(path) {
    const parts = path.split("/").filter(Boolean);
    parts.pop();
    return parts.join("/");
  }

  nameOf(path) {
    const parts = path.split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  }

  ensureFolder(path) {
    if (path === "" || this.nodes.has(path)) return this.nodes.get(path);
    const parent = this.ensureFolder(this.parentPath(path));
    const node = { type: "folder", path, name: this.nameOf(path), children: new Set(), open: true };
    this.nodes.set(path, node);
    parent.children.add(path);
    return node;
  }

  uniquePath(desiredPath) {
    if (!this.nodes.has(desiredPath)) return desiredPath;
    const parent = this.parentPath(desiredPath);
    const name = this.nameOf(desiredPath);
    const dot = name.lastIndexOf(".");
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    let i = 1;
    let candidate;
    do {
      candidate = (parent ? parent + "/" : "") + `${base} (${i})${ext}`;
      i++;
    } while (this.nodes.has(candidate));
    return candidate;
  }

  createFile(path, content = "", opts = {}) {
    const p = this.uniquePath(path);
    const parent = this.ensureFolder(this.parentPath(p));
    const ext = extOf(p);
    const node = {
      type: "file",
      path: p,
      name: this.nameOf(p),
      ext,
      isText: opts.isText !== undefined ? opts.isText : isTextExt(ext) || (!isImageExt(ext) && !isAudioExt(ext)),
      content: opts.isText === false ? undefined : content,
      b64: opts.isText === false ? content : undefined,
      dirty: false,
    };
    this.nodes.set(p, node);
    parent.children.add(p);
    this.emit("create", { path: p });
    return node;
  }

  // Creates or overwrites a file at an *exact* path (used by archive import,
  // where relative paths inside the zip must be preserved as-is).
  createFileAt(path, content, opts = {}) {
    if (this.nodes.has(path)) this.delete(path);
    const parent = this.ensureFolder(this.parentPath(path));
    const ext = extOf(path);
    const isText = opts.isText !== undefined ? opts.isText : isTextExt(ext) || (!isImageExt(ext) && !isAudioExt(ext));
    const node = {
      type: "file",
      path,
      name: this.nameOf(path),
      ext,
      isText,
      content: isText ? content : undefined,
      b64: isText ? undefined : content,
      dirty: false,
    };
    this.nodes.set(path, node);
    parent.children.add(path);
    this.emit("create", { path });
    return node;
  }

  createFolder(path) {
    const p = this.uniquePath(path);
    const parent = this.ensureFolder(this.parentPath(p));
    const node = { type: "folder", path: p, name: this.nameOf(p), children: new Set(), open: true };
    this.nodes.set(p, node);
    parent.children.add(p);
    this.emit("create", { path: p });
    return node;
  }

  rename(path, newName) {
    const node = this.nodes.get(path);
    if (!node) return null;
    const parent = this.parentPath(path);
    const newPath = this.uniquePath((parent ? parent + "/" : "") + newName);
    this._movePath(path, newPath);
    this.emit("rename", { from: path, to: newPath });
    return newPath;
  }

  // Rename/move to an arbitrary full path (allows moving between folders by
  // editing the directory portion of the path in the rename dialog).
  move(path, newFullPath) {
    if (!this.nodes.has(path)) return null;
    const clean = newFullPath.replace(/^\/+/, "").replace(/\/+$/, "");
    if (!clean || clean === path) return path;
    const target = this.nodes.has(clean) ? this.uniquePath(clean) : clean;
    this._movePath(path, target);
    this.emit("rename", { from: path, to: target });
    return target;
  }

  _movePath(oldPath, newPath) {
    const node = this.nodes.get(oldPath);
    if (!node) return;
    const oldParent = this.nodes.get(this.parentPath(oldPath));
    const newParent = this.ensureFolder(this.parentPath(newPath));
    if (oldParent) oldParent.children.delete(oldPath);

    if (node.type === "folder") {
      const childPaths = Array.from(node.children);
      this.nodes.delete(oldPath);
      node.path = newPath;
      node.name = this.nameOf(newPath);
      this.nodes.set(newPath, node);
      newParent.children.add(newPath);
      childPaths.forEach((childPath) => {
        const childName = this.nameOf(childPath);
        this._movePath(childPath, newPath + "/" + childName);
      });
    } else {
      this.nodes.delete(oldPath);
      node.path = newPath;
      node.name = this.nameOf(newPath);
      node.ext = extOf(newPath);
      this.nodes.set(newPath, node);
      newParent.children.add(newPath);
    }
  }

  delete(path) {
    const node = this.nodes.get(path);
    if (!node) return;
    if (node.type === "folder") {
      Array.from(node.children).forEach((c) => this.delete(c));
    }
    const parent = this.nodes.get(this.parentPath(path));
    if (parent) parent.children.delete(path);
    this.nodes.delete(path);
    this.emit("delete", { path });
  }

  setContent(path, content) {
    const node = this.nodes.get(path);
    if (!node || node.type !== "file") return;
    node.content = content;
    this.emit("content", { path });
  }

  listChildren(path) {
    const node = this.nodes.get(path);
    if (!node || node.type !== "folder") return [];
    return Array.from(node.children)
      .map((p) => this.nodes.get(p))
      .filter(Boolean)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
  }

  isEmpty() {
    return this.root.children.size === 0;
  }

  allFiles() {
    const out = [];
    const walk = (path) => {
      const node = this.nodes.get(path);
      if (!node) return;
      if (node.type === "file") out.push(node);
      else Array.from(node.children).forEach(walk);
    };
    walk("");
    return out;
  }

  clear() {
    this.nodes.clear();
    this.nodes.set("", { type: "folder", path: "", name: "", children: new Set(), open: true });
    this.emit("clear", {});
  }

  // ---- persistence -------------------------------------------------------
  serialize() {
    const files = [];
    const folders = [];
    this.nodes.forEach((node, path) => {
      if (path === "") return;
      if (node.type === "file") {
        files.push({
          path: node.path,
          isText: node.isText,
          content: node.isText ? node.content ?? "" : undefined,
          b64: node.isText ? undefined : node.b64 ?? "",
        });
      } else {
        folders.push({ path: node.path, open: node.open });
      }
    });
    return { v: 1, files, folders };
  }

  saveToStorage(projectName) {
    try {
      const payload = { name: projectName || "MyAddon", data: this.serialize(), savedAt: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (e) {
      console.warn("Save failed", e);
      return false;
    }
  }

  static loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  static clearStorage() {
    localStorage.removeItem(STORAGE_KEY);
  }

  loadSerialized(data) {
    this.clear();
    (data.folders || []).forEach((f) => {
      const node = this.ensureFolder(f.path);
      node.open = f.open !== false;
    });
    (data.files || []).forEach((f) => {
      this.createFile(f.path, f.isText ? f.content ?? "" : f.b64 ?? "", { isText: f.isText });
    });
  }
}

export function bytesForFile(node) {
  if (node.isText) return new TextEncoder().encode(node.content ?? "");
  return b64ToBytes(node.b64 ?? "");
}

export function setBinaryContent(node, bytes) {
  node.b64 = bytesToB64(bytes);
}
