// ---------------------------------------------------------------------------
// Pocket Addon Studio — vanilla JS application shell.
// Wires together the virtual file system, VS Code style CodeMirror editor,
// file explorer, import/export (JSZip) and Minecraft Bedrock snippets.
// ---------------------------------------------------------------------------

function initApp(host) {
  host.innerHTML = "";
  host.appendChild(buildShell());

  // ---- state ---------------------------------------------------------------
  const vfs = new VFS();
  let projectName = "MyAddon";
  const openTabs = []; // ordered array of paths
  let activePath = null;
  let importTarget = ""; // folder path new imports/creations should land in

  // ---- element refs ----------------------------------------------------
  const $ = (sel) => host.querySelector(sel);
  const sidebar = $("#pas-sidebar");
  const scrim = $("#pas-scrim");
  const treeHost = $("#pas-tree-host");
  const tabbar = $("#pas-tabbar");
  const editorHost = $("#pas-editor-host");
  const previewHost = $("#pas-preview-host");
  const statusPath = $("#pas-status-path");
  const statusMeta = $("#pas-status-cursor");
  const statusLang = $("#pas-status-lang");
  const projectNameEl = $("#pas-project-name");
  const fileInput = $("#pas-file-input");
  const folderInput = $("#pas-folder-input");
  const archiveInput = $("#pas-archive-input");
  const wrapToggleBtn = $("#pas-wrap-toggle");
  const contentFabBtn = $("#pas-content-fab");

  const editorManager = new EditorManager(editorHost, {
    onChange: (path, doc) => {
      vfs.setContent(path, doc);
      scheduleAutosave();
    },
    onCursor: (path, info) => {
      if (path === activePath) {
        statusMeta.textContent = `Ln ${info.line}, Col ${info.col} \u00B7 ${formatBytes(info.length)}`;
      }
    },
  });

  const scheduleAutosave = debounce(() => {
    vfs.saveToStorage(projectName);
  }, 1200);

  vfs.onChange((kind) => {
    // "content" fires on every single keystroke (typing AND backspacing) --
    // it's how the editor's onChange above gets the freshly typed text into
    // the VFS. Re-rendering the whole file-explorer tree (a full
    // `innerHTML = ""` + rebuild of every row, including all the folders
    // the user isn't even looking at) on every keystroke was previously
    // happening here regardless of `kind`, entirely unconditionally. That's
    // real, unnecessary synchronous main-thread DOM work being done inside
    // the exact same tick as CodeMirror's own DOM read/diff of the edit
    // (see ContentEditableInput.pollContent/readFromDOMSoon in
    // vendor/codemirror5/lib/codemirror.js) -- on a phone this is very
    // plausibly what feels like "sticky"/non-smooth backspacing, since it's
    // extra work competing for the same main thread on every character,
    // right as Android's IME/contenteditable input handling is most timing
    // sensitive. None of that structure (file list, names, folders) can
    // possibly have changed just from editing a file's text content, so
    // only re-render the tree for the events that actually add/remove/
    // rename/move a node ("create"/"rename"/"delete"/"clear") -- "content"
    // still triggers an autosave, just not a tree rebuild.
    if (kind !== "content") renderExplorer();
    scheduleAutosave();
  });

  // ---- restore previous session -----------------------------------------
  const saved = VFS.loadFromStorage();
  if (saved && saved.data && (saved.data.files || []).length) {
    vfs.loadSerialized(saved.data);
    projectName = saved.name || projectName;
  }
  projectNameEl.textContent = projectName;
  renderExplorer();
  renderTabs();
  renderMainArea();

  // ---- keyboard-safe viewport height -------------------------------------
  function syncViewportHeight() {
    const vv = window.visualViewport;
    const h = vv ? vv.height : window.innerHeight;
    host.style.height = `${h}px`;
  }
  syncViewportHeight();
  window.addEventListener("resize", syncViewportHeight);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncViewportHeight);
    window.visualViewport.addEventListener("scroll", syncViewportHeight);
  }

  // ---- sidebar drawer -----------------------------------------------------
  function openSidebar() {
    sidebar.classList.add("is-open");
    scrim.classList.add("is-open");
  }
  function closeSidebar() {
    sidebar.classList.remove("is-open");
    scrim.classList.remove("is-open");
  }
  $("#pas-menu-btn").addEventListener("click", openSidebar);
  scrim.addEventListener("click", closeSidebar);
  $("#pas-sidebar-close").addEventListener("click", closeSidebar);

  // ---- explorer rendering --------------------------------------------------
  function renderExplorer() {
    renderTree(vfs, treeHost, { activePath }, {
      onOpenFile: (path) => {
        openFile(path);
        closeSidebar();
      },
      onToggleFolder: (path) => {
        const node = vfs.get(path);
        if (node) node.open = !node.open;
        renderExplorer();
      },
      onAction: (path, anchor) => handleTreeAction(path),
    });
  }

  async function handleTreeAction(path) {
    const node = vfs.get(path);
    if (!node) return;
    if (node.type === "folder") {
      const choice = await actionSheet({
        title: node.name || "Folder",
        items: [
          { label: "New File Here", icon: "\u2795" },
          { label: "New Folder Here", icon: "\u{1F4C1}" },
          { label: "Import Files Here", icon: "\u2B07\uFE0F" },
          { label: "Import Archive Here (.zip/.mcpack/.mcaddon/.mcworld)", icon: "\u{1F4E6}" },
          { label: "Rename / Move", icon: "\u270F\uFE0F" },
          { label: "Download Folder as .zip", icon: "\u{1F4E5}" },
          { label: "Download Folder as .mcpack", icon: "\u{1F4E5}" },
          { label: "Delete", icon: "\u{1F5D1}\uFE0F", danger: true },
        ],
      });
      if (choice === 0) return createFileFlow(path);
      if (choice === 1) return createFolderFlow(path);
      if (choice === 2) { importTarget = path; fileInput.click(); return; }
      if (choice === 3) { importTarget = path; archiveInput.click(); return; }
      if (choice === 4) return renameFlow(path);
      if (choice === 5) return exportFolderAsPack(vfs, path, `${node.name}.zip`);
      if (choice === 6) return exportFolderAsPack(vfs, path, `${node.name}.mcpack`);
      if (choice === 7) return deleteFlow(path);
    } else {
      const isJson = node.ext === "json";
      const items = [
        { label: "Open", icon: "\u{1F4C4}" },
        { label: "Rename / Move", icon: "\u270F\uFE0F" },
        { label: "Duplicate", icon: "\u{1F4CB}" },
      ];
      if (isJson) items.push({ label: "Format JSON", icon: "\u2728" });
      items.push({ label: "Download", icon: "\u{1F4E5}" }, { label: "Delete", icon: "\u{1F5D1}\uFE0F", danger: true });
      const choice = await actionSheet({ title: node.name, items });
      if (choice === 0) return openFile(path);
      if (choice === 1) return renameFlow(path);
      if (choice === 2) return duplicateFlow(path);
      if (isJson) {
        if (choice === 3) return formatJsonFlow(path);
        if (choice === 4) return downloadSingleFile(node);
        if (choice === 5) return deleteFlow(path);
      } else {
        if (choice === 3) return downloadSingleFile(node);
        if (choice === 4) return deleteFlow(path);
      }
    }
  }

  async function createFileFlow(folder) {
    const name = await promptDialog({
      title: "New File",
      label: `Inside /${folder || "root"}`,
      value: "new_file.json",
      confirmText: "Create",
    });
    if (!name) return;
    const ext = extOf(name);
    // New files always start completely empty. This used to pre-fill
    // ".json" files with "{\n\t\n}" as a starter scaffold, but that
    // pre-filled content was itself the file's very first "edit" ever
    // applied to a brand new CodeMirror Doc -- on real phones, deleting
    // pieces of that pre-existing text right as the editor/keyboard is
    // still settling in from just being created is exactly the situation
    // that could trip up the contenteditable input's DOM diffing (see the
    // composition/backspace fixes above), and it's not something the user
    // asked to be there in the first place. Starting empty sidesteps that
    // whole class of "first edit deletes pre-filled content" issues, and
    // manifest.json can still be filled in via the !mbp/!mrp magic
    // snippets from a truly empty file.
    const content = "";
    const node = vfs.createFile(joinPath(folder, name), content, { isText: !isImageExt(ext) && !isAudioExt(ext) });
    renderExplorer();
    if (node.isText) openFile(node.path);
  }

  async function createFolderFlow(folder) {
    const name = await promptDialog({ title: "New Folder", label: `Inside /${folder || "root"}`, value: "New Folder", confirmText: "Create" });
    if (!name) return;
    vfs.createFolder(joinPath(folder, name));
    renderExplorer();
  }

  async function renameFlow(path) {
    const newPath = await promptDialog({
      title: "Rename / Move",
      label: "Full path (edit folders to move the item)",
      value: path,
      confirmText: "Save",
    });
    if (!newPath) return;
    const wasActive = activePath === path;
    const finalPath = vfs.move(path, newPath);
    if (wasActive && finalPath) {
      const idx = openTabs.indexOf(path);
      if (idx >= 0) openTabs[idx] = finalPath;
      activePath = finalPath;
      editorManager.discard(path);
    }
    renderExplorer();
    renderTabs();
    renderMainArea();
  }

  async function duplicateFlow(path) {
    const node = vfs.get(path);
    if (!node) return;
    const copy = vfs.createFile(path, node.isText ? node.content : node.b64, { isText: node.isText });
    renderExplorer();
    toast(`Duplicated as ${copy.name}`);
  }

  // Re-indents a .json file's raw text into consistently tab-indented,
  // one-value-per-line JSON, without touching a single byte of its actual
  // *content* (keys/values/order are preserved exactly -- see the comment
  // above formatJSON() in utils.js for why this deliberately isn't just
  // `JSON.stringify(JSON.parse(text))`). Works whether or not the file is
  // currently open in a tab, and regardless of whether it's the *active*
  // tab: the VFS is always updated directly (mirroring what the normal
  // typing -> onChange -> vfs.setContent path does), and if a CodeMirror
  // Doc already exists for this path (i.e. it's open in some tab, active
  // or not) that Doc's text is also updated in place so the editor view
  // reflects the reformatted text immediately rather than only on next
  // open -- Doc.setValue()'s change event uses origin "setValue", which
  // editor.js's change handler deliberately ignores (same as the doc's
  // very first load), so it does NOT re-sync the VFS on its own and this
  // function must do that itself first.
  async function formatJsonFlow(path) {
    const node = vfs.get(path);
    if (!node || !node.isText) return;
    const before = node.content ?? "";
    let after;
    try {
      after = formatJSON(before);
    } catch (err) {
      const where = err.line ? ` (line ${err.line}, col ${err.col})` : "";
      return toast(`Can't format -- invalid JSON${where}: ${err.message}`, { type: "error" });
    }
    if (after === before) return toast("Already formatted.");
    vfs.setContent(path, after);
    if (editorManager.hasState(path)) editorManager.setContent(path, after);
    toast("Formatted.");
  }

  async function deleteFlow(path) {
    const node = vfs.get(path);
    if (!node) return;
    const ok = await confirmDialog({
      title: `Delete ${node.type === "folder" ? "Folder" : "File"}`,
      message: `"${node.name}" will be permanently removed. This can't be undone.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    closeTabsUnder(path);
    vfs.delete(path);
    renderExplorer();
    renderTabs();
    renderMainArea();
  }

  function closeTabsUnder(path) {
    for (let i = openTabs.length - 1; i >= 0; i--) {
      if (openTabs[i] === path || openTabs[i].startsWith(path + "/")) {
        editorManager.discard(openTabs[i]);
        if (activePath === openTabs[i]) activePath = null;
        openTabs.splice(i, 1);
      }
    }
    if (!activePath && openTabs.length) activePath = openTabs[openTabs.length - 1];
  }

  // ---- tabs & editor --------------------------------------------------------
  function openFile(path) {
    const node = vfs.get(path);
    if (!node || node.type !== "file") return;
    if (!openTabs.includes(path)) openTabs.push(path);
    editorManager.captureActive();
    activePath = path;
    renderTabs();
    renderExplorer();
    renderMainArea();
  }

  function closeTab(path, evt) {
    if (evt) evt.stopPropagation();
    const idx = openTabs.indexOf(path);
    if (idx === -1) return;
    openTabs.splice(idx, 1);
    editorManager.discard(path);
    if (activePath === path) {
      activePath = openTabs[idx] || openTabs[idx - 1] || null;
    }
    renderTabs();
    renderExplorer();
    renderMainArea();
  }

  function renderTabs() {
    tabbar.innerHTML = "";
    if (openTabs.length === 0) {
      tabbar.classList.add("is-empty");
      return;
    }
    tabbar.classList.remove("is-empty");
    openTabs.forEach((path) => {
      const node = vfs.get(path);
      if (!node) return;
      const tab = el(
        "div",
        {
          class: `pas-tab${path === activePath ? " is-active" : ""}`,
          onclick: () => openFile(path),
        },
        [
          fileIcon(node.ext),
          el("span", { class: "pas-tab-name" }, [node.name]),
          el("button", { class: "pas-tab-close", onclick: (e) => closeTab(path, e) }, ["\u00D7"]),
        ]
      );
      tabbar.appendChild(tab);
    });
    const activeTab = tabbar.querySelector(".is-active");
    if (activeTab) activeTab.scrollIntoView({ inline: "nearest", block: "nearest" });
  }

  function renderMainArea() {
    const node = activePath ? vfs.get(activePath) : null;
    if (!node) {
      editorHost.style.display = "none";
      previewHost.style.display = "flex";
      previewHost.innerHTML = "";
      previewHost.appendChild(buildEmptyState());
      statusPath.textContent = openTabs.length ? "" : "No file open";
      statusMeta.textContent = "";
      statusLang.textContent = "";
      return;
    }
    if (node.isText) {
      previewHost.style.display = "none";
      editorHost.style.display = "block";
      editorManager.openFile(node.path, node.content ?? "", node.ext);
      statusLang.textContent = languageLabel(node.ext);
      const info = editorManager.getCursorInfo();
      statusMeta.textContent = `Ln ${info.line}, Col ${info.col} \u00B7 ${formatBytes(info.length)}`;
    } else {
      editorHost.style.display = "none";
      previewHost.style.display = "flex";
      previewHost.innerHTML = "";
      previewHost.appendChild(buildBinaryPreview(node));
      statusLang.textContent = node.ext.toUpperCase();
      statusMeta.textContent = "";
    }
    statusPath.textContent = "/" + node.path;
  }

  function languageLabel(ext) {
    if (ext === "json") return "JSON";
    if (["js", "mjs", "cjs"].includes(ext)) return "JavaScript";
    if (ext === "ts") return "TypeScript";
    if (ext === "md") return "Markdown";
    return ext ? ext.toUpperCase() : "Plain Text";
  }

  function buildEmptyState() {
    return el("div", { class: "pas-empty-state" }, [
      el("img", { class: "pas-empty-logo", src: "favicon.png", alt: "Pocket Addon Studio" }),
      el("h2", {}, ["Pocket Addon Studio"]),
      el("p", {}, [
        "Build Minecraft Bedrock (MCPE/MCBE) add-ons right from your phone. Import files, a folder, or a .zip / .mcpack / .mcaddon / .mcworld to get started \u2014 or create a brand new file.",
      ]),
      el("div", { class: "pas-empty-actions" }, [
        el("button", { class: "pas-btn pas-btn-primary", onclick: () => { importTarget = ""; fileInput.click(); } }, ["Import Files"]),
        el("button", { class: "pas-btn pas-btn-ghost", onclick: () => { importTarget = ""; folderInput.click(); } }, ["Import Folder"]),
        el("button", { class: "pas-btn pas-btn-ghost", onclick: () => { importTarget = ""; archiveInput.click(); } }, ["Import .zip/.mcpack/.mcaddon/.mcworld"]),
        el("button", { class: "pas-btn pas-btn-ghost", onclick: () => createFileFlow("") }, ["New File"]),
      ]),
      el("div", { class: "pas-empty-tips" }, [
        el("p", {}, [el("strong", {}, ["Tip:"]), " type ", el("code", {}, ["!mbp"]), " in any file for a behavior pack manifest, ", el("code", {}, ["!mrp"]), " for a resource pack manifest, or ", el("code", {}, ["!uuid"]), " for a fresh UUID v4."]),
      ]),
      el("p", { class: "pas-empty-author" }, ["Author shadid234"]),
    ]);
  }

  function buildBinaryPreview(node) {
    const ext = node.ext;
    if (isImageExt(ext)) {
      return el("div", { class: "pas-preview pas-preview-image" }, [
        el("img", { src: `data:${mimeFor(ext)};base64,${node.b64}`, alt: node.name }),
        el("div", { class: "pas-preview-caption" }, [node.name]),
      ]);
    }
    if (isAudioExt(ext)) {
      return el("div", { class: "pas-preview pas-preview-audio" }, [
        el("div", { class: "pas-empty-emoji" }, ["\u266A"]),
        el("audio", { controls: "true", src: `data:${mimeFor(ext)};base64,${node.b64}` }),
        el("div", { class: "pas-preview-caption" }, [node.name]),
      ]);
    }
    return el("div", { class: "pas-preview" }, [
      el("div", { class: "pas-empty-emoji" }, ["\u{1F4C4}"]),
      el("p", {}, [`"${node.name}" can't be previewed as text.`]),
      el("button", { class: "pas-btn pas-btn-primary", onclick: () => downloadSingleFile(node) }, ["Download File"]),
    ]);
  }

  // ---- topbar actions --------------------------------------------------
  $("#pas-new-file-btn").addEventListener("click", async () => {
    const choice = await actionSheet({
      title: "Create at Root",
      items: [
        { label: "New File", icon: "\u2795" },
        { label: "New Folder", icon: "\u{1F4C1}" },
      ],
    });
    if (choice === 0) createFileFlow("");
    if (choice === 1) createFolderFlow("");
  });
  $("#pas-search-btn").addEventListener("click", () => {
    if (activePath) editorManager.openSearch();
    else toast("Open a file first to search inside it.");
  });
  $("#pas-import-btn").addEventListener("click", async () => {
    const choice = await actionSheet({
      title: "Import",
      items: [
        { label: "Import Files", icon: "\u2795" },
        { label: "Import Folder", icon: "\u{1F4C1}" },
        { label: "Import .zip / .mcpack / .mcaddon / .mcworld", icon: "\u{1F4E6}" },
      ],
    });
    importTarget = "";
    if (choice === 0) fileInput.click();
    if (choice === 1) folderInput.click();
    if (choice === 2) archiveInput.click();
  });
  $("#pas-export-btn").addEventListener("click", async () => {
    if (vfs.isEmpty()) return toast("Nothing to export yet.");
    const choice = await actionSheet({
      title: "Export Project",
      items: [
        { label: "Export as .zip", icon: "\u{1F4E5}" },
        { label: "Export as .mcaddon", icon: "\u{1F4E5}" },
        { label: "Save to this device now", icon: "\u{1F4BE}" },
      ],
    });
    if (choice === 0) exportVFSAsZip(vfs, `${projectName}.zip`);
    if (choice === 1) exportVFSAsZip(vfs, `${projectName}.mcaddon`);
    if (choice === 2) {
      vfs.saveToStorage(projectName);
      toast("Project saved to this device");
    }
  });
  $("#pas-more-btn").addEventListener("click", async () => {
    const choice = await actionSheet({
      title: "More",
      items: [
        { label: "Rename Project", icon: "\u270F\uFE0F" },
        { label: `Word Wrap: ${wrapToggleBtn.dataset.on === "1" ? "On" : "Off"}`, icon: "\u21A9" },
        { label: "New Project (clear everything)", icon: "\u{1F5D1}\uFE0F", danger: true },
        { label: "Help & Shortcuts", icon: "\u2753" },
      ],
    });
    if (choice === 0) return renameProjectFlow();
    if (choice === 1) return toggleWrap();
    if (choice === 2) return newProjectFlow();
    if (choice === 3) return showHelp();
  });
  wrapToggleBtn.addEventListener("click", toggleWrap);

  function toggleWrap() {
    const on = editorManager.toggleWrap();
    wrapToggleBtn.dataset.on = on ? "1" : "0";
    wrapToggleBtn.classList.toggle("is-on", on);
  }

  async function renameProjectFlow() {
    const name = await promptDialog({ title: "Rename Project", value: projectName, confirmText: "Save" });
    if (!name) return;
    projectName = name;
    projectNameEl.textContent = projectName;
    vfs.saveToStorage(projectName);
  }

  async function newProjectFlow() {
    const ok = await confirmDialog({
      title: "New Project",
      message: "This clears every file in the current project from this device. Export first if you want to keep a copy.",
      confirmText: "Clear Project",
    });
    if (!ok) return;
    openTabs.length = 0;
    activePath = null;
    vfs.clear();
    VFS.clearStorage();
    projectName = "MyAddon";
    projectNameEl.textContent = projectName;
    renderExplorer();
    renderTabs();
    renderMainArea();
  }

  function showHelp() {
    infoDialog({
      title: "Help & Shortcuts",
      message: buildHelpText(),
    });
  }

  function buildHelpText() {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <ul class="pas-help-list">
        <li><code>!mbp</code> \u2014 insert a Behavior Pack <b>manifest.json</b> with fresh UUIDs.</li>
        <li><code>!mrp</code> \u2014 insert a Resource Pack <b>manifest.json</b> with fresh UUIDs.</li>
        <li><code>!uuid</code> \u2014 insert a brand new UUID v4 at the cursor.</li>
        <li>Type any of the above and tap the suggestion that pops up.</li>
        <li>Start typing Minecraft component names like <code>minecraft:health</code> or JS like <code>world.after</code> for full snippet autocomplete.</li>
        <li>Tap the <b>\u22EE</b> next to any file or folder for rename, duplicate, download and delete actions.</li>
        <li>Your project auto-saves to this device. Use Export to download a real .zip/.mcaddon file.</li>
      </ul>`;
    return wrap;
  }

  // ---- import wiring --------------------------------------------------
  fileInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    await importFileList(files, importTarget);
    fileInput.value = "";
  });
  folderInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    await importFileList(files, importTarget, true);
    folderInput.value = "";
  });
  archiveInput.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    archiveInput.value = "";
    if (!file) return;
    try {
      const count = await importArchiveIntoVFS(vfs, file, importTarget);
      renderExplorer();
      toast(`Imported ${count} file${count === 1 ? "" : "s"} from ${file.name}`);
    } catch (err) {
      console.error(err);
      toast("Couldn't read that archive.", { type: "error" });
    }
  });

  async function importFileList(files, target, useRelativePath) {
    if (!files.length) return;
    let count = 0;
    // Importing a whole folder (webkitdirectory) can bring in many nested
    // subfolders at once -- start those collapsed so the tree doesn't dump
    // everything open. Plain "Import Files" doesn't create new subfolders
    // (files land directly in the current target folder), so this only
    // matters for the folder-import path.
    const collapsedFolders = !!useRelativePath;
    for (const file of files) {
      const relPath = useRelativePath ? file.webkitRelativePath || file.name : file.name;
      const ext = extOf(relPath);
      const fullPath = joinPath(target, relPath);
      try {
        if (isImageExt(ext) || isAudioExt(ext) || (!isTextExt(ext) && (await looksBinary(file)))) {
          const buf = await file.arrayBuffer();
          vfs.createFileAt(fullPath, bytesToB64(new Uint8Array(buf)), { isText: false, collapsedFolders });
        } else {
          const text = await file.text();
          vfs.createFileAt(fullPath, text, { isText: true, collapsedFolders });
        }
        count++;
      } catch (err) {
        console.error("Import failed for", file.name, err);
      }
    }
    renderExplorer();
    toast(`Imported ${count} file${count === 1 ? "" : "s"}`);
  }

  async function looksBinary() {
    return false;
  }

  // ---- "Add content" FAB: item/entity/block/sound/splash adder ----------
  // Tapping create_icon.png opens a right-side slide-over panel. Only the
  // Item adder is wired up for now (per the current task) -- entity/block/
  // sound/splash are listed so the panel's shape/menu is already right for
  // when they're added, but each shows a "coming soon" toast if tapped.
  const contentScrim = el("div", { class: "pas-content-scrim" });
  const contentPanel = el("div", { class: "pas-content-panel" });
  document.body.appendChild(contentScrim);
  document.body.appendChild(contentPanel);

  function openContentPanel() {
    renderContentTypePicker();
    contentPanel.classList.add("is-open");
    contentScrim.classList.add("is-open");
  }
  function closeContentPanel() {
    contentPanel.classList.remove("is-open");
    contentScrim.classList.remove("is-open");
  }
  contentFabBtn.addEventListener("click", openContentPanel);
  contentScrim.addEventListener("click", closeContentPanel);

  const CONTENT_TYPES = [
    { id: "item", label: "Item", icon: "\u2694\uFE0F", enabled: true, render: renderItemAdderForm },
    { id: "entity", label: "Entity", icon: "\u{1F9DF}", enabled: true, render: renderEntityAdderForm },
    { id: "block", label: "Block", icon: "\u{1F9F1}", enabled: true, render: renderBlockAdderForm },
    { id: "sound", label: "Sound", icon: "\u{1F50A}", enabled: true, render: renderSoundAdderForm },
    { id: "splash", label: "Splash", icon: "\u{1F4A6}", enabled: true, render: renderSplashAdderForm },
    { id: "function", label: "Function", icon: "\u{1F4DC}", enabled: true, render: renderFunctionAdderForm },
    { id: "trade", label: "Trade", icon: "\u{1F4B0}", enabled: true, render: renderTradeAdderForm },
  ];

  function renderContentTypePicker() {
    contentPanel.innerHTML = "";
    contentPanel.appendChild(
      el("div", { class: "pas-content-panel-header" }, [
        el("h2", {}, ["Add Content"]),
        el("button", { class: "pas-icon-btn", "aria-label": "Close", onclick: closeContentPanel }, ["\u2715"]),
      ])
    );
    const grid = el(
      "div",
      { class: "pas-content-type-grid" },
      CONTENT_TYPES.map((t) =>
        el(
          "button",
          {
            class: "pas-content-type-btn",
            onclick: () => {
              if (!t.enabled) return toast(`${t.label} adder is coming soon.`);
              t.render();
            },
          },
          [
            el("span", { class: "pas-content-type-icon" }, [t.icon]),
            el("span", {}, [t.label]),
            t.enabled ? null : el("span", { class: "pas-content-type-soon" }, ["Coming soon"]),
          ]
        )
      )
    );
    contentPanel.appendChild(el("div", { class: "pas-content-panel-body" }, [grid]));
  }

  // Builds the (indented, initially-hidden) sub-field controls for one
  // ITEM_COMPONENT_SCHEMA entry, and returns { fieldsEl, readValues() } so
  // the caller can both render them and read back whatever the user typed
  // once the form is submitted. Mirrors the small set of field "type"s the
  // schema uses: text / number / select / checkbox.
  function buildComponentSubfields(entry) {
    const inputs = {};
    const rows = (entry.fields || []).map((f) => {
      let input;
      if (f.type === "select") {
        input = el(
          "select",
          { class: "pas-input" },
          f.options.map(([value, label]) => el("option", { value }, [label]))
        );
        if (f.def) input.value = f.def;
      } else if (f.type === "checkbox") {
        input = el("input", { type: "checkbox" });
        if (f.def) input.checked = true;
      } else {
        input = el("input", {
          class: "pas-input",
          type: f.type === "number" ? "number" : "text",
          placeholder: f.placeholder || "",
          inputmode: f.type === "number" ? "decimal" : undefined,
          step: f.step,
          autocomplete: "off",
        });
        if (f.def !== undefined) input.value = f.def;
      }
      inputs[f.name] = { input, type: f.type };
      if (f.type === "checkbox") {
        return el("div", { class: "pas-form-check" }, [el("label", {}, [f.label]), input]);
      }
      return el("div", { class: "pas-form-row" }, [el("label", {}, [f.label]), input]);
    });
    const fieldsEl = el("div", { class: "pas-form-subfields" }, rows);
    return {
      fieldsEl,
      readValues() {
        const out = {};
        for (const [name, { input, type }] of Object.entries(inputs)) {
          out[name] = type === "checkbox" ? input.checked : input.value;
        }
        return out;
      },
    };
  }

  // Renders the Item adder form. Identity/Basics fields map onto
  // ContentBuilders.buildItemFileJSON()'s top-level `fields`; every entry
  // in ContentBuilders.ITEM_COMPONENT_SCHEMA gets its own on/off checkbox
  // (with sub-fields revealed once checked) so the form always covers every
  // official Bedrock item component with zero per-component UI code needed
  // here -- see app/mcContentBuilders.js for the schema itself.
  function renderItemAdderForm() {
    contentPanel.innerHTML = "";
    contentPanel.appendChild(
      el("div", { class: "pas-content-panel-header" }, [
        el("h2", {}, ["Add Item"]),
        el("button", { class: "pas-icon-btn", "aria-label": "Close", onclick: closeContentPanel }, ["\u2715"]),
      ])
    );

    const idInput = el("input", { class: "pas-input", type: "text", placeholder: "custom:magic_sword", autocapitalize: "off", autocomplete: "off", spellcheck: "false" });
    const nameInput = el("input", { class: "pas-input", type: "text", placeholder: "Magic Sword", autocomplete: "off" });
    const categorySelect = el("select", { class: "pas-input" }, [
      el("option", { value: "items" }, ["Items"]),
      el("option", { value: "equipment" }, ["Equipment"]),
      el("option", { value: "construction" }, ["Construction"]),
      el("option", { value: "nature" }, ["Nature"]),
      el("option", { value: "none" }, ["None (commands only)"]),
    ]);
    const stackInput = el("input", { class: "pas-input", type: "number", value: "64", min: "1", max: "9999", inputmode: "numeric" });

    // ---- Icon texture: upload a PNG (preferred) or type a short name ----
    // Uploading writes the actual PNG into the resource pack at
    // textures/items/<name>.png (the exact path Bedrock expects), derives
    // the texture short name from the uploaded filename automatically, and
    // still lets that name be edited afterwards. Typing a name with no
    // upload is also still supported for anyone who wants to add the PNG
    // by hand later (e.g. copy it in via Import Files).
    let uploadedIconFile = null; // { name, bytesB64 } | null
    const iconInput = el("input", { class: "pas-input", type: "text", placeholder: "magic_sword (texture short name)", autocomplete: "off", autocapitalize: "off", spellcheck: "false" });
    const iconFilePicker = el("input", { type: "file", accept: "image/png,.png", hidden: true });
    const iconUploadStatus = el("div", { class: "pas-form-hint" }, ["No texture uploaded yet -- the item will use Minecraft's default icon until one is added."]);
    const iconUploadBox = el(
      "button",
      { type: "button", class: "pas-icon-upload-box", onclick: () => iconFilePicker.click() },
      [
        el("span", { class: "pas-icon-upload-icon" }, ["\u{1F5BC}\uFE0F"]),
        el("span", {}, ["Tap to upload item_texture.png"]),
        el("span", { class: "pas-form-hint" }, ["PNG recommended, 16\u00D716 or any square size."]),
      ]
    );
    iconFilePicker.addEventListener("change", async () => {
      const file = iconFilePicker.files && iconFilePicker.files[0];
      iconFilePicker.value = "";
      if (!file) return;
      try {
        const buf = await file.arrayBuffer();
        uploadedIconFile = { name: file.name, bytesB64: bytesToB64(new Uint8Array(buf)) };
        const guessedName = ContentBuilders.slugifyIdToken(file.name.replace(/\.[^.]+$/, ""));
        if (!iconInput.value.trim() && guessedName) iconInput.value = guessedName;
        iconUploadBox.classList.add("has-file");
        iconUploadStatus.textContent = `Uploaded "${file.name}" -- will be saved as textures/items/${iconInput.value || guessedName}.png`;
      } catch (err) {
        console.error(err);
        toast("Couldn't read that image file.", { type: "error" });
      }
    });
    iconInput.addEventListener("input", () => {
      if (uploadedIconFile) {
        const shortName = ContentBuilders.slugifyIdToken(iconInput.value) || "item";
        iconUploadStatus.textContent = `Uploaded "${uploadedIconFile.name}" -- will be saved as textures/items/${shortName}.png`;
      }
    });

    // ---- Every official item component, generically -----------------
    const componentReaders = []; // [{ key, enabledCheck, readValues }]
    const componentRows = ContentBuilders.ITEM_COMPONENT_SCHEMA.map((entry) => {
      const enabledCheck = el("input", { type: "checkbox" });
      const { fieldsEl, readValues } = buildComponentSubfields(entry);
      enabledCheck.addEventListener("change", () => fieldsEl.classList.toggle("is-visible", enabledCheck.checked));
      componentReaders.push({ key: entry.key, enabledCheck, readValues });
      return el("div", { class: "pas-component-block" }, [
        el("div", { class: "pas-form-check" }, [
          el("div", { class: "pas-component-label" }, [
            el("label", {}, [entry.label]),
            el("div", { class: "pas-form-hint" }, [entry.detail]),
          ]),
          enabledCheck,
        ]),
        fieldsEl,
      ]);
    });

    const errorEl = el("div", { class: "pas-field-error" });

    const body = el("div", { class: "pas-content-panel-body" }, [
      el("div", { class: "pas-form-back-row" }, [
        el("button", { onclick: renderContentTypePicker }, ["\u2039 Content types"]),
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Identity"]),
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Item ID"]), idInput, el("div", { class: "pas-form-hint" }, ["namespace:name -- defaults to \"custom:\" if you skip the namespace."])]),
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Display name"]), nameInput]),
        el("div", { class: "pas-form-row" }, [
          el("label", {}, ["Item icon (item_texture.png)"]),
          iconUploadBox,
          iconFilePicker,
          el("div", { class: "pas-form-row", style: "margin-top:8px" }, [el("label", {}, ["Texture short name"]), iconInput]),
          iconUploadStatus,
        ]),
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Basics"]),
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Creative category"]), categorySelect]),
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Max stack size"]), stackInput]),
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Components"]),
        el("div", { class: "pas-form-hint", style: "margin-bottom:10px" }, ["Every official Bedrock item component -- tap a switch to reveal its options."]),
        ...componentRows,
      ]),
      errorEl,
      el("div", { class: "pas-form-submit-row" }, [
        el("button", { class: "pas-btn pas-btn-ghost", onclick: closeContentPanel }, ["Cancel"]),
        el("button", {
          class: "pas-btn pas-btn-primary",
          onclick: () => {
            errorEl.textContent = "";
            try {
              const components = {};
              for (const { key, enabledCheck, readValues } of componentReaders) {
                components[key] = { enabled: enabledCheck.checked, ...readValues() };
              }
              submitItemAdder({
                rawIdentifier: idInput.value,
                displayName: nameInput.value.trim(),
                iconTexture: ContentBuilders.slugifyIdToken(iconInput.value),
                iconFile: uploadedIconFile,
                category: categorySelect.value,
                maxStackSize: stackInput.value,
                components,
              });
            } catch (err) {
              errorEl.textContent = err.message || String(err);
            }
          },
        }, ["Add Item"]),
      ]),
    ]);
    contentPanel.appendChild(body);
    setTimeout(() => idInput.focus(), 60);
  }

  // Actually writes the new item's file(s) into whatever add-on project is
  // currently in the explorer -- creating a brand new BP/RP pair first if
  // the explorer is completely empty (see ensureAddonScaffold in
  // app/mcContentBuilders.js for exactly how that decision is made).
  function submitItemAdder(fields) {
    const identifier = ContentBuilders.normalizeItemIdentifier(fields.rawIdentifier);
    const shortName = identifier.split(":")[1];

    const { bpRoot, rpRoot, createdNew } = ContentBuilders.ensureAddonScaffold(vfs, projectName);

    const json = ContentBuilders.buildItemFileJSON({ ...fields, identifier });
    const desiredPath = joinPath(bpRoot, "items", `${shortName}.json`);
    // createFile() already picks a unique "name (1).json" style path on its
    // own if `desiredPath` is taken (see VFS.uniquePath in app/fs.js) --
    // so this never silently clobbers an existing item with the same name.
    const itemNode = vfs.createFile(desiredPath, json, { isText: true });

    // Resource-pack side: only touch item_texture.json / write the PNG if
    // we actually know where the resource pack lives AND the user gave us
    // a texture short name -- an item with no icon set is still perfectly
    // valid (it just uses Minecraft's default "missing texture" icon until
    // one is added later), so all of this is best-effort, not required.
    if (rpRoot && fields.iconTexture) {
      const texturePath = joinPath(rpRoot, "textures", "item_texture.json");
      const existing = vfs.get(texturePath);
      const merged = ContentBuilders.mergeItemTextureJson(existing ? existing.content : null, fields.iconTexture, projectName);
      if (existing) {
        vfs.setContent(texturePath, merged);
        if (editorManager.hasState(texturePath)) editorManager.setContent(texturePath, merged);
      } else {
        vfs.createFile(texturePath, merged, { isText: true });
      }
      if (fields.iconFile) {
        const pngPath = joinPath(rpRoot, "textures", "items", `${fields.iconTexture}.png`);
        vfs.createFile(pngPath, fields.iconFile.bytesB64, { isText: false });
      }
    }

    // vfs.createFile() above already triggered a tree re-render via
    // vfs.onChange -- openFile() below covers tabs/main-area/explorer
    // (again, cheaply) for the newly created file becoming active.
    closeContentPanel();
    openFile(itemNode.path);
    toast(createdNew ? `Created ${projectName}_BP/_RP and added "${identifier}".` : `Added item "${identifier}".`);
  }

  // ---- Block adder ---------------------------------------------------
  // See https://wiki.bedrock.dev/blocks/block-components. Same overall
  // shape as the Item adder above (schema-driven component checklist +
  // a texture upload box), except the block's texture writes into
  // terrain_texture.json / textures/blocks/ instead of item_texture.json /
  // textures/items/, and every block always gets a
  // minecraft:material_instances entry (never optional like an item's
  // icon) since a block with literally no texture renders as a solid
  // untextured/missing-texture cube -- there's no sensible "blank" default
  // the way there is for an item.
  function renderBlockAdderForm() {
    contentPanel.innerHTML = "";
    contentPanel.appendChild(
      el("div", { class: "pas-content-panel-header" }, [
        el("h2", {}, ["Add Block"]),
        el("button", { class: "pas-icon-btn", "aria-label": "Close", onclick: closeContentPanel }, ["\u2715"]),
      ])
    );

    const idInput = el("input", { class: "pas-input", type: "text", placeholder: "custom:magic_block", autocapitalize: "off", autocomplete: "off", spellcheck: "false" });
    const categorySelect = el("select", { class: "pas-input" }, [
      el("option", { value: "construction" }, ["Construction"]),
      el("option", { value: "nature" }, ["Nature"]),
      el("option", { value: "equipment" }, ["Equipment"]),
      el("option", { value: "items" }, ["Items"]),
      el("option", { value: "none" }, ["None (commands only)"]),
    ]);
    const renderMethodSelect = el("select", { class: "pas-input" }, [
      el("option", { value: "opaque" }, ["Opaque (solid, default)"]),
      el("option", { value: "alpha_test" }, ["Alpha test (cutout transparency, e.g. leaves)"]),
      el("option", { value: "blend" }, ["Blend (see-through transparency, e.g. glass)"]),
      el("option", { value: "double_sided" }, ["Double sided (visible from both sides)"]),
    ]);

    // ---- Texture: upload a PNG (preferred) or type a short name --------
    let uploadedTextureFile = null; // { name, bytesB64 } | null
    const textureInput = el("input", { class: "pas-input", type: "text", placeholder: "magic_block (texture short name)", autocomplete: "off", autocapitalize: "off", spellcheck: "false" });
    const textureFilePicker = el("input", { type: "file", accept: "image/png,.png", hidden: true });
    const textureUploadStatus = el("div", { class: "pas-form-hint" }, ["No texture uploaded yet -- the block will render as a missing-texture checkerboard until one is added."]);
    const textureUploadBox = el(
      "button",
      { type: "button", class: "pas-icon-upload-box", onclick: () => textureFilePicker.click() },
      [
        el("span", { class: "pas-icon-upload-icon" }, ["\u{1F5BC}\uFE0F"]),
        el("span", {}, ["Tap to upload a terrain texture PNG"]),
        el("span", { class: "pas-form-hint" }, ["PNG recommended -- a seamless, tileable square image works best."]),
      ]
    );
    textureFilePicker.addEventListener("change", async () => {
      const file = textureFilePicker.files && textureFilePicker.files[0];
      textureFilePicker.value = "";
      if (!file) return;
      try {
        const buf = await file.arrayBuffer();
        uploadedTextureFile = { name: file.name, bytesB64: bytesToB64(new Uint8Array(buf)) };
        const guessedName = ContentBuilders.slugifyIdToken(file.name.replace(/\.[^.]+$/, ""));
        if (!textureInput.value.trim() && guessedName) textureInput.value = guessedName;
        textureUploadBox.classList.add("has-file");
        textureUploadStatus.textContent = `Uploaded "${file.name}" -- will be saved as textures/blocks/${textureInput.value || guessedName}.png`;
      } catch (err) {
        console.error(err);
        toast("Couldn't read that image file.", { type: "error" });
      }
    });
    textureInput.addEventListener("input", () => {
      if (uploadedTextureFile) {
        const shortName = ContentBuilders.slugifyIdToken(textureInput.value) || "block";
        textureUploadStatus.textContent = `Uploaded "${uploadedTextureFile.name}" -- will be saved as textures/blocks/${shortName}.png`;
      }
    });

    // ---- Every official block component, generically -------------------
    const componentReaders = []; // [{ key, enabledCheck, readValues }]
    const componentRows = ContentBuilders.BLOCK_COMPONENT_SCHEMA.map((entry) => {
      const enabledCheck = el("input", { type: "checkbox" });
      const { fieldsEl, readValues } = buildComponentSubfields(entry);
      enabledCheck.addEventListener("change", () => fieldsEl.classList.toggle("is-visible", enabledCheck.checked));
      componentReaders.push({ key: entry.key, enabledCheck, readValues });
      return el("div", { class: "pas-component-block" }, [
        el("div", { class: "pas-form-check" }, [
          el("div", { class: "pas-component-label" }, [
            el("label", {}, [entry.label]),
            el("div", { class: "pas-form-hint" }, [entry.detail]),
          ]),
          enabledCheck,
        ]),
        fieldsEl,
      ]);
    });

    const errorEl = el("div", { class: "pas-field-error" });

    const body = el("div", { class: "pas-content-panel-body" }, [
      el("div", { class: "pas-form-back-row" }, [
        el("button", { onclick: renderContentTypePicker }, ["\u2039 Content types"]),
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Identity"]),
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Block ID"]), idInput, el("div", { class: "pas-form-hint" }, ["namespace:name -- defaults to \"custom:\" if you skip the namespace."])]),
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Appearance"]),
        el("div", { class: "pas-form-row" }, [
          el("label", {}, ["Block texture"]),
          textureUploadBox,
          textureFilePicker,
          el("div", { class: "pas-form-row", style: "margin-top:8px" }, [el("label", {}, ["Texture short name"]), textureInput]),
          textureUploadStatus,
        ]),
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Render method"]), renderMethodSelect]),
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Basics"]),
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Creative category"]), categorySelect]),
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Components"]),
        el("div", { class: "pas-form-hint", style: "margin-bottom:10px" }, ["Every official Bedrock block component -- tap a switch to reveal its options."]),
        ...componentRows,
      ]),
      errorEl,
      el("div", { class: "pas-form-submit-row" }, [
        el("button", { class: "pas-btn pas-btn-ghost", onclick: closeContentPanel }, ["Cancel"]),
        el("button", {
          class: "pas-btn pas-btn-primary",
          onclick: () => {
            errorEl.textContent = "";
            try {
              const components = {};
              for (const { key, enabledCheck, readValues } of componentReaders) {
                components[key] = { enabled: enabledCheck.checked, ...readValues() };
              }
              submitBlockAdder({
                rawIdentifier: idInput.value,
                blockTexture: ContentBuilders.slugifyIdToken(textureInput.value),
                textureFile: uploadedTextureFile,
                renderMethod: renderMethodSelect.value,
                category: categorySelect.value,
                components,
              });
            } catch (err) {
              errorEl.textContent = err.message || String(err);
            }
          },
        }, ["Add Block"]),
      ]),
    ]);
    contentPanel.appendChild(body);
    setTimeout(() => idInput.focus(), 60);
  }

  // Actually writes the new block's file(s) into whatever add-on project is
  // currently in the explorer -- creating a brand new BP/RP pair first if
  // the explorer is completely empty (see ensureAddonScaffold in
  // app/mcContentBuilders.js for exactly how that decision is made).
  function submitBlockAdder(fields) {
    const identifier = ContentBuilders.normalizeNamespacedIdentifier(fields.rawIdentifier, "Block ID");
    const shortName = identifier.split(":")[1];

    const { bpRoot, rpRoot, createdNew } = ContentBuilders.ensureAddonScaffold(vfs, projectName);

    // A block absolutely needs SOME texture reference to not render as a
    // missing-texture checkerboard -- if the user didn't type/upload one at
    // all, fall back to the block's own short name so at least the
    // reference is self-consistent and easy to find/fix later by adding a
    // textures/blocks/<name>.png file with that exact name by hand.
    const textureName = fields.blockTexture || shortName;

    const json = ContentBuilders.buildBlockFileJSON({ ...fields, identifier, blockTexture: textureName });
    const desiredPath = joinPath(bpRoot, "blocks", `${shortName}.json`);
    // createFile() already picks a unique "name (1).json" style path on its
    // own if `desiredPath` is taken (see VFS.uniquePath in app/fs.js) --
    // so this never silently clobbers an existing block with the same name.
    const blockNode = vfs.createFile(desiredPath, json, { isText: true });

    // Resource-pack side: only touch terrain_texture.json / write the PNG
    // if we actually know where the resource pack lives -- a block whose
    // texture reference doesn't (yet) resolve to a real texture_data entry
    // still parses/loads fine in Minecraft, it just shows the missing-
    // texture checkerboard until textures/blocks/<name>.png + this entry
    // both exist, so this is best-effort, not required.
    if (rpRoot) {
      const texturePath = joinPath(rpRoot, "textures", "terrain_texture.json");
      const existing = vfs.get(texturePath);
      const merged = ContentBuilders.mergeTerrainTextureJson(existing ? existing.content : null, textureName, projectName);
      if (existing) {
        vfs.setContent(texturePath, merged);
        if (editorManager.hasState(texturePath)) editorManager.setContent(texturePath, merged);
      } else {
        vfs.createFile(texturePath, merged, { isText: true });
      }
      if (fields.textureFile) {
        const pngPath = joinPath(rpRoot, "textures", "blocks", `${textureName}.png`);
        vfs.createFile(pngPath, fields.textureFile.bytesB64, { isText: false });
      }
    }

    closeContentPanel();
    openFile(blockNode.path);
    toast(createdNew ? `Created ${projectName}_BP/_RP and added "${identifier}".` : `Added block "${identifier}".`);
  }

  // ---- Entity adder --------------------------------------------------
  // See https://learn.microsoft.com/minecraft/creator/.../entityreference
  // and https://wiki.bedrock.dev/entities/entity-intro-rp. An entity is the
  // one content type that always needs files in BOTH packs to actually
  // work in game: a behavior file (BP, the mob's stats/AI/loot -- what it
  // DOES) and a client entity file (RP, its texture/geometry/spawn egg --
  // what it LOOKS like). Also offers an inline "egg editor" (the spawn egg
  // base/overlay color pickers) and an inline loot table builder (a simple
  // list of possible drops), both written as part of the same submission.
  function renderEntityAdderForm() {
    contentPanel.innerHTML = "";
    contentPanel.appendChild(
      el("div", { class: "pas-content-panel-header" }, [
        el("h2", {}, ["Add Entity"]),
        el("button", { class: "pas-icon-btn", "aria-label": "Close", onclick: closeContentPanel }, ["\u2715"]),
      ])
    );

    const idInput = el("input", { class: "pas-input", type: "text", placeholder: "custom:magic_golem", autocapitalize: "off", autocomplete: "off", spellcheck: "false" });

    // ---- Texture: upload a PNG (preferred) or type a short name --------
    let uploadedTextureFile = null; // { name, bytesB64 } | null
    const textureFilePicker = el("input", { type: "file", accept: "image/png,.png", hidden: true });
    const textureUploadStatus = el("div", { class: "pas-form-hint" }, ["No texture uploaded yet -- the entity will fall back to a placeholder texture until one is added."]);
    const textureUploadBox = el(
      "button",
      { type: "button", class: "pas-icon-upload-box", onclick: () => textureFilePicker.click() },
      [
        el("span", { class: "pas-icon-upload-icon" }, ["\u{1F5BC}\uFE0F"]),
        el("span", {}, ["Tap to upload an entity texture PNG"]),
        el("span", { class: "pas-form-hint" }, ["Saved as textures/entity/<entity name>.png."]),
      ]
    );
    textureFilePicker.addEventListener("change", async () => {
      const file = textureFilePicker.files && textureFilePicker.files[0];
      textureFilePicker.value = "";
      if (!file) return;
      try {
        const buf = await file.arrayBuffer();
        uploadedTextureFile = { name: file.name, bytesB64: bytesToB64(new Uint8Array(buf)) };
        textureUploadBox.classList.add("has-file");
        textureUploadStatus.textContent = `Uploaded "${file.name}" -- will be saved as textures/entity/<entity name>.png`;
      } catch (err) {
        console.error(err);
        toast("Couldn't read that image file.", { type: "error" });
      }
    });

    const geometryInput = el("input", { class: "pas-input", type: "text", placeholder: "geometry.humanoid.custom (leave blank for a default humanoid model)", autocomplete: "off", autocapitalize: "off", spellcheck: "false" });

    // ---- Egg editor: spawn egg base/overlay colors ----------------------
    const eggBaseColor = el("input", { type: "color", class: "pas-color-input", value: "#4a6b3a" });
    const eggOverlayColor = el("input", { type: "color", class: "pas-color-input", value: "#28331f" });
    const eggPreview = el("div", { class: "pas-egg-preview" }, [el("div", { class: "pas-egg-preview-overlay" })]);
    function syncEggPreview() {
      eggPreview.style.background = eggBaseColor.value;
      eggPreview.querySelector(".pas-egg-preview-overlay").style.background = eggOverlayColor.value;
    }
    eggBaseColor.addEventListener("input", syncEggPreview);
    eggOverlayColor.addEventListener("input", syncEggPreview);
    syncEggPreview();

    // ---- Every official entity behavior component, generically ---------
    const componentReaders = []; // [{ key, enabledCheck, readValues }]
    const componentRows = ContentBuilders.ENTITY_COMPONENT_SCHEMA.map((entry) => {
      const enabledCheck = el("input", { type: "checkbox" });
      const { fieldsEl, readValues } = buildComponentSubfields(entry);
      enabledCheck.addEventListener("change", () => fieldsEl.classList.toggle("is-visible", enabledCheck.checked));
      componentReaders.push({ key: entry.key, enabledCheck, readValues });
      return el("div", { class: "pas-component-block" }, [
        el("div", { class: "pas-form-check" }, [
          el("div", { class: "pas-component-label" }, [
            el("label", {}, [entry.label]),
            el("div", { class: "pas-form-hint" }, [entry.detail]),
          ]),
          enabledCheck,
        ]),
        fieldsEl,
      ]);
    });

    // ---- Loot table builder: a plain list of possible drops -------------
    // See buildLootTableJSON() in app/mcContentBuilders.js for exactly what
    // shape of loot_tables/entities/<name>.json this produces -- a single
    // weighted-random pool, one entry per row here.
    const lootEnabledCheck = el("input", { type: "checkbox" });
    const lootRowsEl = el("div", { class: "pas-loot-rows" });
    const lootRows = []; // [{ itemInput, weightInput, minInput, maxInput, rowEl }]
    function addLootRow() {
      const itemInput = el("input", { class: "pas-input", type: "text", placeholder: "minecraft:bone", autocapitalize: "off", autocomplete: "off", spellcheck: "false" });
      const weightInput = el("input", { class: "pas-input", type: "number", value: "1", min: "1", inputmode: "numeric" });
      const minInput = el("input", { class: "pas-input", type: "number", value: "1", min: "0", inputmode: "numeric" });
      const maxInput = el("input", { class: "pas-input", type: "number", value: "1", min: "0", inputmode: "numeric" });
      const rowEl = el("div", { class: "pas-loot-row" }, [
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Item"]), itemInput]),
        el("div", { class: "pas-form-two-col" }, [
          el("div", { class: "pas-form-row" }, [el("label", {}, ["Min count"]), minInput]),
          el("div", { class: "pas-form-row" }, [el("label", {}, ["Max count"]), maxInput]),
        ]),
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Weight (relative drop chance)"]), weightInput]),
        el("button", {
          type: "button",
          class: "pas-loot-row-remove",
          onclick: () => {
            const idx = lootRows.findIndex((r) => r.rowEl === rowEl);
            if (idx !== -1) lootRows.splice(idx, 1);
            rowEl.remove();
          },
        }, ["Remove drop"]),
      ]);
      lootRows.push({ itemInput, weightInput, minInput, maxInput, rowEl });
      lootRowsEl.appendChild(rowEl);
    }
    addLootRow();
    const addLootRowBtn = el("button", { type: "button", class: "pas-btn pas-btn-ghost", onclick: addLootRow }, ["+ Add another drop"]);
    const lootFields = el("div", { class: "pas-form-subfields" }, [lootRowsEl, addLootRowBtn]);
    lootEnabledCheck.addEventListener("change", () => lootFields.classList.toggle("is-visible", lootEnabledCheck.checked));

    const errorEl = el("div", { class: "pas-field-error" });

    const body = el("div", { class: "pas-content-panel-body" }, [
      el("div", { class: "pas-form-back-row" }, [
        el("button", { onclick: renderContentTypePicker }, ["\u2039 Content types"]),
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Identity"]),
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Entity ID"]), idInput, el("div", { class: "pas-form-hint" }, ["namespace:name -- defaults to \"custom:\" if you skip the namespace."])]),
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Appearance"]),
        el("div", { class: "pas-form-row" }, [
          el("label", {}, ["Entity texture"]),
          textureUploadBox,
          textureFilePicker,
          textureUploadStatus,
        ]),
        el("div", { class: "pas-form-row" }, [
          el("label", {}, ["Model geometry identifier (optional)"]),
          geometryInput,
          el("div", { class: "pas-form-hint" }, ["Matches the \"identifier\" of a model you made in Blockbench. Leave blank to use a default humanoid shape."]),
        ]),
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Spawn Egg"]),
        el("div", { class: "pas-egg-editor" }, [
          eggPreview,
          el("div", { class: "pas-egg-editor-fields" }, [
            el("div", { class: "pas-form-row" }, [el("label", {}, ["Base color"]), eggBaseColor]),
            el("div", { class: "pas-form-row" }, [el("label", {}, ["Overlay (spots) color"]), eggOverlayColor]),
          ]),
        ]),
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Components"]),
        el("div", { class: "pas-form-hint", style: "margin-bottom:10px" }, ["The most common entity behavior components -- tap a switch to reveal its options."]),
        ...componentRows,
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Loot Table"]),
        el("div", { class: "pas-form-check" }, [
          el("div", { class: "pas-component-label" }, [
            el("label", {}, ["Drops items on death"]),
            el("div", { class: "pas-form-hint" }, ["Builds a loot_tables/entities/<name>.json and wires it up automatically."]),
          ]),
          lootEnabledCheck,
        ]),
        lootFields,
      ]),
      errorEl,
      el("div", { class: "pas-form-submit-row" }, [
        el("button", { class: "pas-btn pas-btn-ghost", onclick: closeContentPanel }, ["Cancel"]),
        el("button", {
          class: "pas-btn pas-btn-primary",
          onclick: () => {
            errorEl.textContent = "";
            try {
              const components = {};
              for (const { key, enabledCheck, readValues } of componentReaders) {
                components[key] = { enabled: enabledCheck.checked, ...readValues() };
              }
              const drops = lootEnabledCheck.checked
                ? lootRows.map((r) => ({ item: r.itemInput.value, weight: r.weightInput.value, minCount: r.minInput.value, maxCount: r.maxInput.value }))
                : [];
              submitEntityAdder({
                rawIdentifier: idInput.value,
                textureFile: uploadedTextureFile,
                geometryId: geometryInput.value.trim(),
                spawnEggBaseColor: eggBaseColor.value,
                spawnEggOverlayColor: eggOverlayColor.value,
                components,
                lootEnabled: lootEnabledCheck.checked,
                drops,
              });
            } catch (err) {
              errorEl.textContent = err.message || String(err);
            }
          },
        }, ["Add Entity"]),
      ]),
    ]);
    contentPanel.appendChild(body);
    setTimeout(() => idInput.focus(), 60);
  }

  // Actually writes the new entity's file(s) into whatever add-on project
  // is currently in the explorer -- creating a brand new BP/RP pair first
  // if the explorer is completely empty (see ensureAddonScaffold in
  // app/mcContentBuilders.js). Unlike Item/Block/Sound/Splash, an entity
  // ALWAYS gets files in both packs (a behavior file needs a matching
  // client entity file to actually be visible in game, and vice versa).
  function submitEntityAdder(fields) {
    const identifier = ContentBuilders.normalizeNamespacedIdentifier(fields.rawIdentifier, "Entity ID");
    const shortName = identifier.split(":")[1];

    const { bpRoot, rpRoot, createdNew } = ContentBuilders.ensureAddonScaffold(vfs, projectName);

    // Loot table (BP-side) is written first, if requested, so the behavior
    // file below can reference it via minecraft:loot. Two different paths
    // are needed here: the VFS needs the FULL path (including bpRoot) to
    // actually create the file in the right place in the tree, but the
    // `minecraft:loot` component's "table" value must be relative to the
    // behavior pack's own root (e.g. "loot_tables/entities/war_hog.json",
    // never "MyAddon_BP/loot_tables/entities/war_hog.json") -- Minecraft
    // resolves that path from inside the pack itself, so including the
    // pack's own folder name in it would make the reference resolve to a
    // nonexistent nested path and silently produce no loot in game.
    let lootTableRefPath = null;
    if (fields.lootEnabled && fields.drops.some((d) => d.item && d.item.trim())) {
      lootTableRefPath = joinPath("loot_tables", "entities", `${shortName}.json`);
      const lootFullPath = joinPath(bpRoot, lootTableRefPath);
      const lootJson = ContentBuilders.buildLootTableJSON(fields.drops);
      vfs.createFile(lootFullPath, lootJson, { isText: true });
    }

    const behaviorJson = ContentBuilders.buildEntityBehaviorJSON({ ...fields, identifier, lootTablePath: lootTableRefPath });
    const behaviorPath = joinPath(bpRoot, "entities", `${shortName}.json`);
    // createFile() already picks a unique "name (1).json" style path on its
    // own if `behaviorPath` is taken (see VFS.uniquePath in app/fs.js) --
    // so this never silently clobbers an existing entity with the same
    // name.
    const behaviorNode = vfs.createFile(behaviorPath, behaviorJson, { isText: true });

    // Client entity (RP-side): only skipped entirely if we truly can't
    // find/create an RP location at all -- an entity with no client file
    // is invisible/uninteractable in game, so unlike an item's optional
    // icon this one is not "best-effort", but there's still nothing
    // sensible to do if there's genuinely no RP folder in the project.
    if (rpRoot) {
      const clientJson = ContentBuilders.buildEntityClientJSON({ ...fields, identifier });
      const clientPath = joinPath(rpRoot, "entity", `${shortName}.entity.json`);
      vfs.createFile(clientPath, clientJson, { isText: true });
      if (fields.textureFile) {
        const pngPath = joinPath(rpRoot, "textures", "entity", `${shortName}.png`);
        vfs.createFile(pngPath, fields.textureFile.bytesB64, { isText: false });
      }
    }

    closeContentPanel();
    openFile(behaviorNode.path);
    toast(createdNew ? `Created ${projectName}_BP/_RP and added "${identifier}".` : `Added entity "${identifier}".`);
  }

  // ---- Splash adder -------------------------------------------------------
  // See https://wiki.bedrock.dev/text/splashes -- a resource pack's
  // splashes.json lives directly at the RP root (not inside a subfolder)
  // and is just `{ canMerge, splashes: [...] }`. Much smaller surface than
  // the Item adder, so this is a single small form rather than a generic
  // schema -- one line per splash text, a live "§ formatting code" inserter
  // (since typing "§" by hand on a phone keyboard is awkward), and the
  // canMerge toggle.
  const SPLASH_COLOR_CODES = [
    ["\u00A70", "Black"], ["\u00A71", "Dark Blue"], ["\u00A72", "Dark Green"], ["\u00A73", "Dark Aqua"],
    ["\u00A74", "Dark Red"], ["\u00A75", "Dark Purple"], ["\u00A76", "Gold"], ["\u00A77", "Gray"],
    ["\u00A78", "Dark Gray"], ["\u00A79", "Blue"], ["\u00A7a", "Green"], ["\u00A7b", "Aqua"],
    ["\u00A7c", "Red"], ["\u00A7d", "Light Purple"], ["\u00A7e", "Yellow"], ["\u00A7f", "White"],
    ["\u00A7g", "Minecoin Gold"], ["\u00A7l", "Bold"], ["\u00A7o", "Italic"], ["\u00A7r", "Reset"],
  ];

  function renderSplashAdderForm() {
    contentPanel.innerHTML = "";
    contentPanel.appendChild(
      el("div", { class: "pas-content-panel-header" }, [
        el("h2", {}, ["Add Splash Text"]),
        el("button", { class: "pas-icon-btn", "aria-label": "Close", onclick: closeContentPanel }, ["\u2715"]),
      ])
    );

    const linesInput = el("textarea", {
      class: "pas-input pas-textarea",
      rows: "5",
      placeholder: "my custom splash text\nand another one!\n\u00A7cRed \u00A7rand \u00A7agreen \u00A7rsplash text",
      autocapitalize: "off",
      spellcheck: "false",
    });
    const mergeCheck = el("input", { type: "checkbox" });

    // Tapping a color-code chip inserts it at the textarea's current
    // cursor position (falling back to the end if nothing's focused) --
    // this is the "epic" way to type "\u00A7" codes on a phone keyboard
    // that has no dedicated key for that character at all.
    const insertAtCursor = (token) => {
      const start = linesInput.selectionStart ?? linesInput.value.length;
      const end = linesInput.selectionEnd ?? linesInput.value.length;
      linesInput.value = linesInput.value.slice(0, start) + token + linesInput.value.slice(end);
      const newPos = start + token.length;
      linesInput.focus();
      linesInput.setSelectionRange(newPos, newPos);
    };
    const colorChips = el(
      "div",
      { class: "pas-splash-chip-row" },
      SPLASH_COLOR_CODES.map(([code, label]) =>
        el("button", { type: "button", class: "pas-splash-chip", title: label, onclick: () => insertAtCursor(code) }, [label])
      )
    );

    const errorEl = el("div", { class: "pas-field-error" });

    const body = el("div", { class: "pas-content-panel-body" }, [
      el("div", { class: "pas-form-back-row" }, [
        el("button", { onclick: renderContentTypePicker }, ["\u2039 Content types"]),
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Splash Text"]),
        el("div", { class: "pas-form-row" }, [
          el("label", {}, ["One splash per line"]),
          linesInput,
          el("div", { class: "pas-form-hint" }, ["Shown next to the Minecraft logo on the title screen. Supports \u00A7 formatting codes -- tap a chip below to insert one."]),
        ]),
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Formatting codes"]), colorChips]),
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Options"]),
        el("div", { class: "pas-form-check" }, [
          el("div", { class: "pas-component-label" }, [
            el("label", {}, ["Merge with vanilla splash texts"]),
            el("div", { class: "pas-form-hint" }, ["On: your splashes show alongside Minecraft's own. Off: only yours ever show."]),
          ]),
          mergeCheck,
        ]),
      ]),
      errorEl,
      el("div", { class: "pas-form-submit-row" }, [
        el("button", { class: "pas-btn pas-btn-ghost", onclick: closeContentPanel }, ["Cancel"]),
        el("button", {
          class: "pas-btn pas-btn-primary",
          onclick: () => {
            errorEl.textContent = "";
            try {
              submitSplashAdder({
                lines: linesInput.value.split("\n").map((l) => l.trim()).filter(Boolean),
                canMerge: mergeCheck.checked,
              });
            } catch (err) {
              errorEl.textContent = err.message || String(err);
            }
          },
        }, ["Add Splash"]),
      ]),
    ]);
    contentPanel.appendChild(body);
    setTimeout(() => linesInput.focus(), 60);
  }

  // Writes/merges the new splash line(s) into the current project's
  // splashes.json -- creating a brand new BP/RP pair first if the explorer
  // is completely empty, same as the Item adder (see ensureAddonScaffold in
  // app/mcContentBuilders.js). splashes.json is resource-pack-only (it's
  // pure client-side title-screen text, nothing behavior-pack related), so
  // this never touches bpRoot at all.
  function submitSplashAdder(fields) {
    if (!fields.lines.length) throw new Error("Type at least one splash line.");

    const { rpRoot, createdNew } = ContentBuilders.ensureAddonScaffold(vfs, projectName);
    // Same "don't just silently fail" fallback as the Item adder's bpRoot:
    // if no RP folder could be found/created at all, still write the file
    // somewhere sensible (the project root) rather than losing the user's
    // typed text.
    const targetRoot = rpRoot ?? "";
    const splashesPath = joinPath(targetRoot, "splashes.json");
    const existing = vfs.get(splashesPath);
    const merged = ContentBuilders.mergeSplashesJson(existing ? existing.content : null, fields.lines, fields.canMerge);

    if (existing) {
      vfs.setContent(splashesPath, merged);
      if (editorManager.hasState(splashesPath)) editorManager.setContent(splashesPath, merged);
    } else {
      vfs.createFile(splashesPath, merged, { isText: true });
    }

    closeContentPanel();
    openFile(splashesPath);
    const count = fields.lines.length;
    toast(createdNew
      ? `Created ${projectName}_BP/_RP and added ${count} splash${count === 1 ? "" : "es"}.`
      : `Added ${count} splash${count === 1 ? "" : "es"}.`);
  }

  // ---- Function adder -------------------------------------------------
  // See https://minecraft.wiki/w/Function_(Bedrock_Edition) -- a Bedrock
  // function is the simplest content type by far: a plain-text
  // .mcfunction file (one command per line, no leading "/") living under
  // BP/functions/, referenced purely by its own relative file path (never
  // a namespace:name identifier the way every other content type here
  // uses). Optionally hooked up to run every game tick via
  // BP/functions/tick.json, the one and only function tag Bedrock
  // actually supports (there's no load.json/other tags the way Java data
  // packs have one).
  function renderFunctionAdderForm() {
    contentPanel.innerHTML = "";
    contentPanel.appendChild(
      el("div", { class: "pas-content-panel-header" }, [
        el("h2", {}, ["Add Function"]),
        el("button", { class: "pas-icon-btn", "aria-label": "Close", onclick: closeContentPanel }, ["\u2715"]),
      ])
    );

    const pathInput = el("input", { class: "pas-input", type: "text", placeholder: "combat/heal (no .mcfunction, folders allowed)", autocapitalize: "off", autocomplete: "off", spellcheck: "false" });
    const commandsInput = el("textarea", {
      class: "pas-input pas-textarea",
      rows: "8",
      placeholder: "say Hello!\ngive @p minecraft:apple 1\n# comments start with a #",
      autocapitalize: "off",
      spellcheck: "false",
    });
    const runEveryTickCheck = el("input", { type: "checkbox" });

    // Tapping a command chip inserts it as a brand new line at the
    // textarea's current cursor position -- same interaction pattern as
    // the Splash adder's "\u00A7 formatting code" chips, just inserting a
    // whole line instead of a single character sequence.
    const insertCommandLine = (command) => {
      const value = commandsInput.value;
      const start = commandsInput.selectionStart ?? value.length;
      const end = commandsInput.selectionEnd ?? value.length;
      const needsLeadingNewline = start > 0 && value[start - 1] !== "\n";
      const insertion = (needsLeadingNewline ? "\n" : "") + command + "\n";
      commandsInput.value = value.slice(0, start) + insertion + value.slice(end);
      const newPos = start + insertion.length;
      commandsInput.focus();
      commandsInput.setSelectionRange(newPos, newPos);
    };
    const commandChips = el(
      "div",
      { class: "pas-splash-chip-row" },
      ContentBuilders.FUNCTION_COMMAND_SNIPPETS.map(([command, label]) =>
        el("button", { type: "button", class: "pas-splash-chip", title: command, onclick: () => insertCommandLine(command) }, [label])
      )
    );

    const errorEl = el("div", { class: "pas-field-error" });

    const body = el("div", { class: "pas-content-panel-body" }, [
      el("div", { class: "pas-form-back-row" }, [
        el("button", { onclick: renderContentTypePicker }, ["\u2039 Content types"]),
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Identity"]),
        el("div", { class: "pas-form-row" }, [
          el("label", {}, ["Function path"]),
          pathInput,
          el("div", { class: "pas-form-hint" }, ["Saved as functions/<path>.mcfunction in the behavior pack. Run in-game with /function <path>."]),
        ]),
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Commands"]),
        el("div", { class: "pas-form-row" }, [
          el("label", {}, ["One command per line"]),
          commandsInput,
          el("div", { class: "pas-form-hint" }, ["No leading \"/\" needed (it's stripped automatically if you type one out of habit). Lines starting with # are comments."]),
        ]),
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Quick insert"]), commandChips]),
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Options"]),
        el("div", { class: "pas-form-check" }, [
          el("div", { class: "pas-component-label" }, [
            el("label", {}, ["Run automatically every game tick"]),
            el("div", { class: "pas-form-hint" }, ["Adds this function to functions/tick.json instead of only running it via /function or a command block."]),
          ]),
          runEveryTickCheck,
        ]),
      ]),
      errorEl,
      el("div", { class: "pas-form-submit-row" }, [
        el("button", { class: "pas-btn pas-btn-ghost", onclick: closeContentPanel }, ["Cancel"]),
        el("button", {
          class: "pas-btn pas-btn-primary",
          onclick: () => {
            errorEl.textContent = "";
            try {
              submitFunctionAdder({
                rawPath: pathInput.value,
                lines: commandsInput.value.split("\n"),
                runEveryTick: runEveryTickCheck.checked,
              });
            } catch (err) {
              errorEl.textContent = err.message || String(err);
            }
          },
        }, ["Add Function"]),
      ]),
    ]);
    contentPanel.appendChild(body);
    setTimeout(() => pathInput.focus(), 60);
  }

  // Writes the new .mcfunction file (and, if requested, registers it in
  // functions/tick.json) into whatever add-on project is currently in the
  // explorer -- creating a brand new BP/RP pair first if the explorer is
  // completely empty, same as every other adder (see ensureAddonScaffold
  // in app/mcContentBuilders.js). Functions are behavior-pack-only (pure
  // server-side command execution, no visual/resource-pack side at all),
  // so this never touches rpRoot.
  function submitFunctionAdder(fields) {
    const functionPath = ContentBuilders.slugifyFunctionPath(fields.rawPath);
    if (!functionPath) throw new Error("Function path can't be empty, e.g. combat/heal.");

    const { bpRoot, createdNew } = ContentBuilders.ensureAddonScaffold(vfs, projectName);

    const content = ContentBuilders.buildFunctionFileContent(fields.lines);
    const functionsFolder = joinPath(bpRoot, "functions");
    const desiredPath = joinPath(functionsFolder, `${functionPath}.mcfunction`);
    // createFile() already picks a unique "name (1).mcfunction" style path
    // on its own if `desiredPath` is taken (see VFS.uniquePath in
    // app/fs.js) -- so this never silently clobbers an existing function
    // with the same path.
    const functionNode = vfs.createFile(desiredPath, content, { isText: true });

    if (fields.runEveryTick) {
      const tickPath = joinPath(functionsFolder, "tick.json");
      const existing = vfs.get(tickPath);
      // The path registered in tick.json must match the function's ACTUAL
      // final path (functionNode.path), not necessarily the one just
      // requested -- if createFile() above had to uniquify it (a function
      // with that path already existed), tick.json needs to point at the
      // real file that now exists on disk, not a path with nothing there.
      // Deriving it by stripping the known "<functionsFolder>/" prefix and
      // ".mcfunction" suffix off the node's own real path is simpler and
      // less error-prone than trying to recompute it by hand.
      const actualFunctionPath = functionNode.path.slice(functionsFolder.length + 1).replace(/\.mcfunction$/, "");
      const merged = ContentBuilders.mergeTickJson(existing ? existing.content : null, actualFunctionPath);
      if (existing) {
        vfs.setContent(tickPath, merged);
        if (editorManager.hasState(tickPath)) editorManager.setContent(tickPath, merged);
      } else {
        vfs.createFile(tickPath, merged, { isText: true });
      }
    }


    closeContentPanel();
    openFile(functionNode.path);
    toast(createdNew ? `Created ${projectName}_BP/_RP and added "${functionPath}".` : `Added function "${functionPath}".`);
  }

  // ---- Trade adder -----------------------------------------------------
  // See https://learn.microsoft.com/minecraft/creator/documents/createtradetable
  // and https://wiki.bedrock.dev/loot/trading-behavior. A trade table
  // itself is just a JSON file of trade tiers, but making it actually DO
  // anything requires a whole trading entity wired up around it -- so this
  // adder always creates a fresh, ready-to-use trading mob (a
  // minecraft:trade_table + minecraft:behavior.trade_with_player pair,
  // correctly placed inside a component_group added via
  // minecraft:entity_spawned rather than directly in `components`, which
  // is a documented footgun that blanks out every entity's trading UI --
  // see buildTradingEntityBehaviorJSON's own comment in
  // app/mcContentBuilders.js) alongside the trade table itself, rather
  // than trying to parse/mutate an arbitrary existing entity file (too
  // risky to safely automate for a hand-authored file that could have any
  // shape).
  function renderTradeAdderForm() {
    contentPanel.innerHTML = "";
    contentPanel.appendChild(
      el("div", { class: "pas-content-panel-header" }, [
        el("h2", {}, ["Add Trade"]),
        el("button", { class: "pas-icon-btn", "aria-label": "Close", onclick: closeContentPanel }, ["\u2715"]),
      ])
    );

    const idInput = el("input", { class: "pas-input", type: "text", placeholder: "custom:merchant", autocapitalize: "off", autocomplete: "off", spellcheck: "false" });
    const nameInput = el("input", { class: "pas-input", type: "text", placeholder: "Merchant", autocomplete: "off" });

    // ---- tier list: each tier is an XP threshold + a list of trades -----
    const tiers = []; // [{ el, xpInput, trades: [{ el, wants: [...], gives: [...] }] }]

    function buildItemRow(labelText, placeholder) {
      const itemInput = el("input", { class: "pas-input", type: "text", placeholder, autocapitalize: "off", autocomplete: "off", spellcheck: "false" });
      const minInput = el("input", { class: "pas-input", type: "number", value: "1", min: "1", inputmode: "numeric" });
      const maxInput = el("input", { class: "pas-input", type: "number", value: "1", min: "1", inputmode: "numeric" });
      const priceInput = el("input", { class: "pas-input", type: "number", value: "0.05", step: "0.05", inputmode: "decimal" });
      const rowEl = el("div", { class: "pas-loot-row" }, [
        el("div", { class: "pas-form-row" }, [el("label", {}, [labelText]), itemInput]),
        el("div", { class: "pas-form-two-col" }, [
          el("div", { class: "pas-form-row" }, [el("label", {}, ["Min count"]), minInput]),
          el("div", { class: "pas-form-row" }, [el("label", {}, ["Max count"]), maxInput]),
        ]),
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Price multiplier (demand scaling)"]), priceInput]),
      ]);
      return { rowEl, itemInput, minInput, maxInput, priceInput };
    }

    function buildTradeBlock(tierTrades, onRemove) {
      const wants = [buildItemRow("Villager wants", "minecraft:wheat")];
      const gives = [buildItemRow("Villager gives", "minecraft:emerald")];
      const wantsListEl = el("div", {}, [wants[0].rowEl]);
      const givesListEl = el("div", {}, [gives[0].rowEl]);
      const maxUsesInput = el("input", { class: "pas-input", type: "number", value: "12", min: "1", inputmode: "numeric" });
      const traderExpInput = el("input", { class: "pas-input", type: "number", value: "1", min: "0", inputmode: "numeric" });
      const rewardExpCheck = el("input", { type: "checkbox" });
      rewardExpCheck.checked = true;

      const addWantBtn = el("button", { type: "button", class: "pas-btn pas-btn-ghost", onclick: () => {
        const row = buildItemRow("Villager wants (additional item)", "minecraft:book");
        wants.push(row);
        wantsListEl.appendChild(row.rowEl);
      } }, ["+ Add another \"wants\" item"]);

      const tradeBlockEl = el("div", { class: "pas-loot-row" }, [
        el("h4", { style: "margin:0 0 8px;font-size:12.5px;color:var(--text-dim);" }, ["Trade"]),
        wantsListEl,
        addWantBtn,
        givesListEl,
        el("div", { class: "pas-form-two-col" }, [
          el("div", { class: "pas-form-row" }, [el("label", {}, ["Max uses before restock"]), maxUsesInput]),
          el("div", { class: "pas-form-row" }, [el("label", {}, ["Trader XP gained"]), traderExpInput]),
        ]),
        el("div", { class: "pas-form-check" }, [el("label", {}, ["Player gets XP orbs from this trade"]), rewardExpCheck]),
        el("button", { type: "button", class: "pas-loot-row-remove", onclick: onRemove }, ["Remove trade"]),
      ]);
      return { el: tradeBlockEl, wants, gives, maxUsesInput, traderExpInput, rewardExpCheck };
    }

    function buildTierBlock(index) {
      const trades = [];
      const tradesListEl = el("div", {});
      const xpInput = el("input", { class: "pas-input", type: "number", value: index === 0 ? "0" : String(index * 10), min: "0", inputmode: "numeric" });
      function addTrade() {
        const trade = buildTradeBlock(trades, () => {
          const idx = trades.indexOf(trade);
          if (idx !== -1) trades.splice(idx, 1);
          trade.el.remove();
        });
        trades.push(trade);
        tradesListEl.appendChild(trade.el);
      }
      addTrade();
      const addTradeBtn = el("button", { type: "button", class: "pas-btn pas-btn-ghost", onclick: addTrade }, ["+ Add another trade to this tier"]);
      const tierEl = el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, [index === 0 ? "Tier 1 (always unlocked)" : `Tier ${index + 1}`]),
        index === 0
          ? null
          : el("div", { class: "pas-form-row" }, [el("label", {}, ["Villager XP required to unlock this tier"]), xpInput]),
        tradesListEl,
        addTradeBtn,
      ]);
      return { el: tierEl, xpInput, trades };
    }

    const tiersListEl = el("div", {});
    function addTier() {
      const tier = buildTierBlock(tiers.length);
      tiers.push(tier);
      tiersListEl.appendChild(tier.el);
    }
    addTier();
    const addTierBtn = el("button", { type: "button", class: "pas-btn pas-btn-ghost", onclick: addTier }, ["+ Add another tier (unlocks with XP)"]);

    const errorEl = el("div", { class: "pas-field-error" });

    const body = el("div", { class: "pas-content-panel-body" }, [
      el("div", { class: "pas-form-back-row" }, [
        el("button", { onclick: renderContentTypePicker }, ["\u2039 Content types"]),
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Trading Entity"]),
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Entity ID"]), idInput, el("div", { class: "pas-form-hint" }, ["namespace:name -- defaults to \"custom:\" if you skip the namespace. If this matches an entity already in your addon, trading is added to it; otherwise a whole new trading mob is created."])]),
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Display name shown while trading"]), nameInput]),
      ]),
      tiersListEl,
      addTierBtn,
      errorEl,
      el("div", { class: "pas-form-submit-row" }, [
        el("button", { class: "pas-btn pas-btn-ghost", onclick: closeContentPanel }, ["Cancel"]),
        el("button", {
          class: "pas-btn pas-btn-primary",
          onclick: () => {
            errorEl.textContent = "";
            try {
              const tierFields = tiers.map((tier) => ({
                xpRequired: tier.xpInput.value,
                trades: tier.trades.map((trade) => ({
                  wants: trade.wants.map((w) => ({ item: w.itemInput.value, minCount: w.minInput.value, maxCount: w.maxInput.value, priceMultiplier: w.priceInput.value })),
                  gives: trade.gives.map((g) => ({ item: g.itemInput.value, minCount: g.minInput.value, maxCount: g.maxInput.value })),
                  maxUses: trade.maxUsesInput.value,
                  traderExp: trade.traderExpInput.value,
                  rewardExp: trade.rewardExpCheck.checked,
                })),
              }));
              submitTradeAdder({
                rawIdentifier: idInput.value,
                displayName: nameInput.value.trim(),
                tiers: tierFields,
              });
            } catch (err) {
              errorEl.textContent = err.message || String(err);
            }
          },
        }, ["Add Trade"]),
      ]),
    ]);
    contentPanel.appendChild(body);
    setTimeout(() => idInput.focus(), 60);
  }

  // Writes the trade table (BP) and wires it up to a trading entity --
  // EITHER by attaching trading behavior to an entity that ALREADY exists
  // in the project with the typed identifier (if one is found), OR by
  // creating a brand new trading mob from scratch (behavior file + a
  // minimal client entity file, RP, same default-humanoid fallback as the
  // Entity adder) if nothing with that identifier exists yet.
  //
  // This two-path behavior fixes a real bug from this feature's first
  // version: it used to ALWAYS create a new entity file regardless of
  // whether the typed ID already belonged to something in the project --
  // so typing the identifier of an entity you'd already added (e.g. via
  // the Entity adder) silently produced a second, disconnected
  // "name (1).json" file instead of actually making your existing entity
  // able to trade, which is what "already in the addon" so clearly implies
  // should happen instead.
  function submitTradeAdder(fields) {
    const identifier = ContentBuilders.normalizeNamespacedIdentifier(fields.rawIdentifier, "Entity ID");
    const shortName = identifier.split(":")[1];

    const hasAnyRealTrade = fields.tiers.some((tier) =>
      tier.trades.some((t) => t.wants.some((w) => w.item && w.item.trim()) && t.gives.some((g) => g.item && g.item.trim()))
    );
    if (!hasAnyRealTrade) throw new Error("Add at least one complete trade (an item it wants and an item it gives).");

    const existingEntityNode = ContentBuilders.findEntityFileByIdentifier(vfs, identifier);

    if (existingEntityNode) {
      // ---- Path A: attach trading to the entity that's already there ----
      const bpRoot = ContentBuilders.bpRootFromEntityFilePath(existingEntityNode.path) ?? "";
      const tradeTableRefPath = joinPath("trading", `${shortName}.json`);
      const tradeTableFullPath = joinPath(bpRoot, tradeTableRefPath);
      const tradeTableJson = ContentBuilders.buildTradeTableJSON(fields.tiers);
      // The trade table itself can safely just be (re)written outright --
      // unlike the entity's own behavior file, there's no pre-existing
      // content of a *different* trade table to lose here for this exact
      // identifier/path combination the first time this runs; a second run
      // against the same entity intentionally replaces its old trade table
      // with the newly-edited one rather than merging two separate tables
      // together, which wouldn't have a sensible combined meaning anyway.
      const existingTable = vfs.get(tradeTableFullPath);
      if (existingTable) {
        vfs.setContent(tradeTableFullPath, tradeTableJson);
        if (editorManager.hasState(tradeTableFullPath)) editorManager.setContent(tradeTableFullPath, tradeTableJson);
      } else {
        vfs.createFile(tradeTableFullPath, tradeTableJson, { isText: true });
      }

      let mergeResult;
      try {
        mergeResult = ContentBuilders.mergeTradeIntoEntityBehaviorJSON(existingEntityNode.content ?? "", { identifier, displayName: fields.displayName, tradeTablePath: tradeTableRefPath });
      } catch (err) {
        throw new Error(`Found an existing "${identifier}" entity, but couldn't safely add trading to it: ${err.message}`);
      }
      vfs.setContent(existingEntityNode.path, mergeResult.content);
      if (editorManager.hasState(existingEntityNode.path)) editorManager.setContent(existingEntityNode.path, mergeResult.content);

      closeContentPanel();
      openFile(existingEntityNode.path);
      toast(
        mergeResult.needsManualEventWiring
          ? `Added trading to existing "${identifier}" -- it already has custom spawn-event logic, so add "${mergeResult.groupName}" to its minecraft:entity_spawned event by hand.`
          : `Added trading to your existing "${identifier}" entity.`
      );
      return;
    }

    // ---- Path B: nothing with that identifier exists -- make a new trader ----
    const { bpRoot, rpRoot, createdNew } = ContentBuilders.ensureAddonScaffold(vfs, projectName);

    const tradeTableRefPath = joinPath("trading", `${shortName}.json`);
    const tradeTableFullPath = joinPath(bpRoot, tradeTableRefPath);
    const tradeTableJson = ContentBuilders.buildTradeTableJSON(fields.tiers);
    vfs.createFile(tradeTableFullPath, tradeTableJson, { isText: true });

    const behaviorJson = ContentBuilders.buildTradingEntityBehaviorJSON({ identifier, displayName: fields.displayName, tradeTablePath: tradeTableRefPath });
    const behaviorPath = joinPath(bpRoot, "entities", `${shortName}.json`);
    // createFile() already picks a unique "name (1).json" style path on its
    // own if `behaviorPath` is taken (see VFS.uniquePath in app/fs.js) --
    // so this never silently clobbers an existing entity FILE with the
    // same name (a rare edge case: same short filename, but its actual
    // identifier field doesn't match, so findEntityFileByIdentifier()
    // above correctly didn't treat it as "the same entity").
    const behaviorNode = vfs.createFile(behaviorPath, behaviorJson, { isText: true });

    if (rpRoot) {
      const clientJson = ContentBuilders.buildEntityClientJSON({ identifier, displayName: fields.displayName });
      const clientPath = joinPath(rpRoot, "entity", `${shortName}.entity.json`);
      vfs.createFile(clientPath, clientJson, { isText: true });
    }

    closeContentPanel();
    openFile(tradeTableFullPath);
    toast(createdNew
      ? `Created ${projectName}_BP/_RP and a "${identifier}" trader with its trade table. Use the Entity adder's texture upload for a custom look.`
      : `Added trader "${identifier}" and its trade table. Use the Entity adder's texture upload for a custom look.`);
  }

  // ---- Sound / Music adder --------------------------------------------
  // See https://wiki.bedrock.dev/concepts/sounds. Every custom sound (a
  // one-shot "effect" or a looping "music track") is added to
  // sound_definitions.json under a short event-name id; a music track
  // additionally gets a matching entry in music_definitions.json that maps
  // a trigger name (which biome/menu/game state plays it) to that event.
  // Only .mp3/.ogg/.wav uploads are ever accepted here -- see
  // AUDIO_EXTENSIONS/isAudioExt in app/utils.js, the same set already used
  // everywhere else in this app (import, binary-file preview player, ...).
  function renderSoundAdderForm() {
    contentPanel.innerHTML = "";
    contentPanel.appendChild(
      el("div", { class: "pas-content-panel-header" }, [
        el("h2", {}, ["Add Sound / Music"]),
        el("button", { class: "pas-icon-btn", "aria-label": "Close", onclick: closeContentPanel }, ["\u2715"]),
      ])
    );

    // ---- kind toggle: Sound Effect <-> Music Track ---------------------
    let kind = "effect";
    const kindEffectBtn = el("button", { type: "button", class: "pas-toggle-btn is-active" }, ["Sound Effect"]);
    const kindMusicBtn = el("button", { type: "button", class: "pas-toggle-btn" }, ["Music Track"]);
    const kindRow = el("div", { class: "pas-toggle-row" }, [kindEffectBtn, kindMusicBtn]);

    // ---- shared fields --------------------------------------------------
    const eventNameInput = el("input", { class: "pas-input", type: "text", placeholder: "myaddon.magic_chime", autocapitalize: "off", autocomplete: "off", spellcheck: "false" });
    const categorySelect = el(
      "select",
      { class: "pas-input" },
      ["ambient", "block", "bottle", "bucket", "hostile", "music", "neutral", "player", "record", "ui", "weather"].map((c) => el("option", { value: c }, [c]))
    );
    categorySelect.value = "neutral";

    // ---- audio upload: mp3/ogg/wav only ---------------------------------
    const uploadedFiles = []; // [{ name, ext, bytesB64 }]
    const filePicker = el("input", { type: "file", class: "pas-sound-file-picker", accept: ".mp3,.ogg,.wav,audio/mpeg,audio/ogg,audio/wav", multiple: true, hidden: true });
    const fileListEl = el("div", { class: "pas-upload-file-list" });
    const uploadBox = el(
      "button",
      { type: "button", class: "pas-icon-upload-box", onclick: () => filePicker.click() },
      [
        el("span", { class: "pas-icon-upload-icon" }, ["\u{1F3B5}"]),
        el("span", {}, ["Tap to upload sound file(s)"]),
        el("span", { class: "pas-form-hint" }, ["Only .mp3, .ogg and .wav are supported."]),
      ]
    );
    function renderFileList() {
      fileListEl.innerHTML = "";
      uploadedFiles.forEach((f, i) => {
        fileListEl.appendChild(
          el("div", { class: "pas-upload-file-row" }, [
            el("span", { class: "pas-upload-file-name" }, [f.name]),
            el("button", {
              type: "button",
              class: "pas-upload-file-remove",
              "aria-label": "Remove",
              onclick: () => { uploadedFiles.splice(i, 1); renderFileList(); },
            }, ["\u2715"]),
          ])
        );
      });
    }
    filePicker.addEventListener("change", () => {
      const files = Array.from(filePicker.files || []);
      filePicker.value = "";
      for (const file of files) {
        const ext = extOf(file.name);
        if (!isAudioExt(ext)) {
          toast(`"${file.name}" isn't a supported audio format -- only .mp3, .ogg and .wav work.`, { type: "error" });
          continue;
        }
        file.arrayBuffer().then((buf) => {
          uploadedFiles.push({ name: file.name, ext, bytesB64: bytesToB64(new Uint8Array(buf)) });
          uploadBox.classList.add("has-file");
          renderFileList();
          if (!eventNameInput.value.trim()) {
            const guessed = ContentBuilders.slugifyIdToken(file.name.replace(/\.[^.]+$/, ""));
            if (guessed) eventNameInput.value = `${kind === "music" ? "music" : "custom"}.${guessed}`;
          }
        }).catch((err) => {
          console.error(err);
          toast("Couldn't read that audio file.", { type: "error" });
        });
      }
    });

    // ---- music-only fields (hidden unless kind === "music") -----------
    const triggerInput = el("input", { class: "pas-input", type: "text", placeholder: "e.g. desert, nether, menu, creative, or a custom biome name", autocomplete: "off", autocapitalize: "off" });
    const minDelayInput = el("input", { class: "pas-input", type: "number", value: "60", min: "0", inputmode: "numeric" });
    const maxDelayInput = el("input", { class: "pas-input", type: "number", value: "180", min: "0", inputmode: "numeric" });
    const musicFields = el("div", { class: "pas-form-section" }, [
      el("h3", { class: "pas-form-section-title" }, ["Music Trigger"]),
      el("div", { class: "pas-form-row" }, [
        el("label", {}, ["Trigger name"]),
        triggerInput,
        el("div", { class: "pas-form-hint" }, ["Which biome/menu/game state plays this track -- matches a music_definitions.json key."]),
      ]),
      el("div", { class: "pas-form-two-col" }, [
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Min delay before replay (seconds)"]), minDelayInput]),
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Max delay before replay (seconds)"]), maxDelayInput]),
      ]),
    ]);
    musicFields.style.display = "none";

    function setKind(newKind) {
      kind = newKind;
      kindEffectBtn.classList.toggle("is-active", kind === "effect");
      kindMusicBtn.classList.toggle("is-active", kind === "music");
      musicFields.style.display = kind === "music" ? "" : "none";
      // Music events conventionally live under the "music.xxx" namespace
      // and use the "music" category -- nudge (but don't force) both when
      // switching modes so the common case needs zero manual editing,
      // without clobbering something the user already typed by hand.
      if (kind === "music") {
        categorySelect.value = "music";
        if (eventNameInput.value && !eventNameInput.value.startsWith("music.")) {
          eventNameInput.value = `music.${eventNameInput.value.replace(/^custom\./, "")}`;
        }
      }
    }
    kindEffectBtn.addEventListener("click", () => setKind("effect"));
    kindMusicBtn.addEventListener("click", () => setKind("music"));

    const errorEl = el("div", { class: "pas-field-error" });

    const body = el("div", { class: "pas-content-panel-body" }, [
      el("div", { class: "pas-form-back-row" }, [
        el("button", { onclick: renderContentTypePicker }, ["\u2039 Content types"]),
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Type"]),
        kindRow,
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Sound Files"]),
        el("div", { class: "pas-form-row" }, [
          el("label", {}, ["Audio file(s)"]),
          uploadBox,
          filePicker,
          fileListEl,
          el("div", { class: "pas-form-hint" }, ["Add more than one file to have Minecraft pick one at random each time this sound plays."]),
        ]),
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Identity"]),
        el("div", { class: "pas-form-row" }, [
          el("label", {}, ["Sound event name"]),
          eventNameInput,
          el("div", { class: "pas-form-hint" }, ["The short id used to reference this sound elsewhere (entities, particles, /playsound, ...)."]),
        ]),
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Category"]), categorySelect]),
      ]),
      musicFields,
      errorEl,
      el("div", { class: "pas-form-submit-row" }, [
        el("button", { class: "pas-btn pas-btn-ghost", onclick: closeContentPanel }, ["Cancel"]),
        el("button", {
          class: "pas-btn pas-btn-primary",
          onclick: () => {
            errorEl.textContent = "";
            try {
              submitSoundAdder({
                kind,
                rawEventName: eventNameInput.value,
                category: categorySelect.value,
                files: uploadedFiles.slice(),
                triggerName: triggerInput.value,
                minDelay: minDelayInput.value,
                maxDelay: maxDelayInput.value,
              });
            } catch (err) {
              errorEl.textContent = err.message || String(err);
            }
          },
        }, ["Add Sound"]),
      ]),
    ]);
    contentPanel.appendChild(body);
    setTimeout(() => eventNameInput.focus(), 60);
  }

  // Writes the new sound file(s) + sound_definitions.json entry (and, for a
  // music track, the matching music_definitions.json entry) into the
  // current project -- creating a brand new BP/RP pair first if the
  // explorer is completely empty, same as every other adder (see
  // ensureAddonScaffold in app/mcContentBuilders.js). Sounds are entirely
  // resource-pack content (playback, not behavior), so this never touches
  // bpRoot at all, same as the Splash adder.
  function submitSoundAdder(fields) {
    if (!fields.files.length) throw new Error("Upload at least one .mp3, .ogg or .wav file.");
    const eventName = ContentBuilders.slugifyEventName(fields.rawEventName);
    if (!eventName) throw new Error("Sound event name can't be empty.");
    if (fields.kind === "music" && !fields.triggerName.trim()) throw new Error("Music tracks need a trigger name (e.g. \"nether\", \"menu\", \"creative\").");

    const { rpRoot, createdNew } = ContentBuilders.ensureAddonScaffold(vfs, projectName);
    const targetRoot = rpRoot ?? "";

    // Write every uploaded audio file into sounds/<event/path>, keeping
    // each file's own extension -- Bedrock is told the path *without* an
    // extension in sound_definitions.json and tries whatever's actually
    // there at runtime, so multiple uploads for the same event (e.g. 3
    // different .ogg variations to randomize between) each need their own
    // unique file name to not collide on disk.
    const soundPaths = fields.files.map((file, i) => {
      const suffix = fields.files.length > 1 ? `_${i + 1}` : "";
      const relPath = `sounds/${eventName.replace(/\./g, "/")}${suffix}`;
      const fullPath = joinPath(targetRoot, `${relPath}.${file.ext}`);
      vfs.createFile(fullPath, file.bytesB64, { isText: false });
      return relPath;
    });

    const soundDefsPath = joinPath(targetRoot, "sounds", "sound_definitions.json");
    const existingDefs = vfs.get(soundDefsPath);
    const mergedDefs = ContentBuilders.mergeSoundDefinitionsJson(existingDefs ? existingDefs.content : null, eventName, fields.category, soundPaths);
    if (existingDefs) {
      vfs.setContent(soundDefsPath, mergedDefs);
      if (editorManager.hasState(soundDefsPath)) editorManager.setContent(soundDefsPath, mergedDefs);
    } else {
      vfs.createFile(soundDefsPath, mergedDefs, { isText: true });
    }

    let openPath = soundDefsPath;
    if (fields.kind === "music") {
      const musicDefsPath = joinPath(targetRoot, "sounds", "music_definitions.json");
      const existingMusic = vfs.get(musicDefsPath);
      const triggerName = ContentBuilders.slugifyIdToken(fields.triggerName);
      const mergedMusic = ContentBuilders.mergeMusicDefinitionsJson(existingMusic ? existingMusic.content : null, triggerName, eventName, fields.minDelay, fields.maxDelay);
      if (existingMusic) {
        vfs.setContent(musicDefsPath, mergedMusic);
        if (editorManager.hasState(musicDefsPath)) editorManager.setContent(musicDefsPath, mergedMusic);
      } else {
        vfs.createFile(musicDefsPath, mergedMusic, { isText: true });
      }
      openPath = musicDefsPath;
    }

    closeContentPanel();
    openFile(openPath);
    toast(createdNew ? `Created ${projectName}_BP/_RP and added "${eventName}".` : `Added ${fields.kind === "music" ? "music track" : "sound"} "${eventName}".`);
  }

  return () => {
    window.removeEventListener("resize", syncViewportHeight);
    editorManager.destroy();
  };
}

function buildShell() {
  const wrap = el("div", { id: "pas-app" });
  wrap.innerHTML = `
    <header class="pas-topbar">
      <button id="pas-menu-btn" class="pas-icon-btn" aria-label="Menu">\u2630</button>
      <div class="pas-title-wrap">
        <span class="pas-logo">\u26CF\uFE0F</span>
        <span id="pas-project-name" class="pas-title">MyAddon</span>
      </div>
      <div class="pas-topbar-actions">
        <button id="pas-new-file-btn" class="pas-icon-btn" aria-label="New file">\u2795</button>
        <button id="pas-search-btn" class="pas-icon-btn" aria-label="Search">\u{1F50D}</button>
        <button id="pas-import-btn" class="pas-icon-btn" aria-label="Import">\u2B07\uFE0F</button>
        <button id="pas-export-btn" class="pas-icon-btn" aria-label="Export">\u2B06\uFE0F</button>
        <button id="pas-more-btn" class="pas-icon-btn" aria-label="More">\u22EF</button>
      </div>
    </header>

    <div id="pas-tabbar" class="pas-tabbar"></div>

    <main class="pas-editor-area">
      <div id="pas-editor-host" class="pas-editor-host"></div>
      <div id="pas-preview-host" class="pas-preview-host"></div>
    </main>

    <footer class="pas-statusbar">
      <span id="pas-status-path" class="pas-status-path"></span>
      <span class="pas-status-spacer"></span>
      <span id="pas-status-lang" class="pas-status-chip"></span>
      <button id="pas-wrap-toggle" class="pas-status-chip pas-status-btn is-on" data-on="1" title="Toggle word wrap">Wrap</button>
      <span id="pas-status-cursor" class="pas-status-chip"></span>
    </footer>

    <aside id="pas-sidebar" class="pas-sidebar">
      <div class="pas-sidebar-header">
        <span>EXPLORER</span>
        <button id="pas-sidebar-close" class="pas-icon-btn" aria-label="Close">\u2715</button>
      </div>
      <div id="pas-tree-host" class="pas-tree-host"></div>
    </aside>
    <div id="pas-scrim" class="pas-scrim"></div>

    <input id="pas-file-input" type="file" multiple hidden
      accept=".js,.mjs,.cjs,.ts,.json,.png,.jpg,.jpeg,.gif,.webp,.bmp,.tga,.mp3,.ogg,.wav,.md,.txt,.lang,.mcfunction,.material,.csv,.xml,.yml,.yaml" />
    <input id="pas-folder-input" type="file" multiple hidden webkitdirectory directory mozdirectory />
    <input id="pas-archive-input" type="file" hidden accept=".zip,.mcpack,.mcaddon,.mcworld,application/zip" />

    <button id="pas-content-fab" class="pas-content-fab" aria-label="Add content">
      <img src="create_icon.png" alt="" />
    </button>

    <div id="pas-toast-host" class="pas-toast-host"></div>
  `;
  return wrap;
}
