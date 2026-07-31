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
    { id: "item", label: "Item", icon: "\u2694\uFE0F", enabled: true },
    { id: "entity", label: "Entity", icon: "\u{1F9DF}", enabled: false },
    { id: "block", label: "Block", icon: "\u{1F9F1}", enabled: false },
    { id: "sound", label: "Sound", icon: "\u{1F50A}", enabled: false },
    { id: "splash", label: "Splash", icon: "\u{1F4A6}", enabled: false },
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
              renderItemAdderForm();
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

  // Renders the Item adder form. Every field maps 1:1 onto
  // ContentBuilders.buildItemFileJSON()'s `fields` argument -- see
  // app/mcContentBuilders.js for exactly what each one produces.
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
    const iconInput = el("input", { class: "pas-input", type: "text", placeholder: "magic_sword (texture short name)", autocomplete: "off", autocapitalize: "off", spellcheck: "false" });
    const categorySelect = el("select", { class: "pas-input" }, [
      el("option", { value: "items" }, ["Items"]),
      el("option", { value: "equipment" }, ["Equipment"]),
      el("option", { value: "construction" }, ["Construction"]),
      el("option", { value: "nature" }, ["Nature"]),
      el("option", { value: "none" }, ["None (commands only)"]),
    ]);
    const stackInput = el("input", { class: "pas-input", type: "number", value: "64", min: "1", max: "9999", inputmode: "numeric" });

    const handEquippedCheck = el("input", { type: "checkbox" });
    const glintCheck = el("input", { type: "checkbox" });

    const foodCheck = el("input", { type: "checkbox" });
    const foodNutritionInput = el("input", { class: "pas-input", type: "number", value: "4", inputmode: "numeric" });
    const foodSaturationInput = el("input", { class: "pas-input", type: "number", value: "0.3", step: "0.1", inputmode: "decimal" });
    const foodAlwaysEatCheck = el("input", { type: "checkbox" });
    const foodFields = el("div", { class: "pas-form-subfields" }, [
      el("div", { class: "pas-form-two-col" }, [
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Nutrition"]), foodNutritionInput]),
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Saturation modifier"]), foodSaturationInput]),
      ]),
      el("div", { class: "pas-form-check" }, [el("label", {}, ["Can always eat (even when full)"]), foodAlwaysEatCheck]),
    ]);
    foodCheck.addEventListener("change", () => foodFields.classList.toggle("is-visible", foodCheck.checked));

    const durabilityCheck = el("input", { type: "checkbox" });
    const maxDurabilityInput = el("input", { class: "pas-input", type: "number", value: "250", min: "1", inputmode: "numeric" });
    const durabilityFields = el("div", { class: "pas-form-subfields" }, [
      el("div", { class: "pas-form-row" }, [el("label", {}, ["Max durability"]), maxDurabilityInput]),
    ]);
    durabilityCheck.addEventListener("change", () => durabilityFields.classList.toggle("is-visible", durabilityCheck.checked));

    const errorEl = el("div", { class: "pas-field-error" });

    const body = el("div", { class: "pas-content-panel-body" }, [
      el("div", { class: "pas-form-back-row" }, [
        el("button", { onclick: renderContentTypePicker }, ["\u2039 Content types"]),
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Identity"]),
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Item ID"]), idInput, el("div", { class: "pas-form-hint" }, ["namespace:name -- defaults to \"custom:\" if you skip the namespace."])]),
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Display name"]), nameInput]),
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Icon texture name"]), iconInput, el("div", { class: "pas-form-hint" }, ["Matches a PNG you'll place at textures/items/<name>.png in the resource pack."])]),
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Basics"]),
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Creative category"]), categorySelect]),
        el("div", { class: "pas-form-row" }, [el("label", {}, ["Max stack size"]), stackInput]),
      ]),
      el("div", { class: "pas-form-section" }, [
        el("h3", { class: "pas-form-section-title" }, ["Components"]),
        el("div", { class: "pas-form-check" }, [el("label", {}, ["Hand equipped (shows as a held model, not flat)"]), handEquippedCheck]),
        el("div", { class: "pas-form-check" }, [el("label", {}, ["Enchanted glint"]), glintCheck]),
        el("div", { class: "pas-form-check" }, [el("label", {}, ["Edible (food)"]), foodCheck]),
        foodFields,
        el("div", { class: "pas-form-check" }, [el("label", {}, ["Has durability (can be damaged)"]), durabilityCheck]),
        durabilityFields,
      ]),
      errorEl,
      el("div", { class: "pas-form-submit-row" }, [
        el("button", { class: "pas-btn pas-btn-ghost", onclick: closeContentPanel }, ["Cancel"]),
        el("button", {
          class: "pas-btn pas-btn-primary",
          onclick: () => {
            errorEl.textContent = "";
            try {
              submitItemAdder({
                rawIdentifier: idInput.value,
                displayName: nameInput.value.trim(),
                iconTexture: ContentBuilders.slugifyIdToken(iconInput.value),
                category: categorySelect.value,
                maxStackSize: stackInput.value,
                handEquipped: handEquippedCheck.checked,
                glint: glintCheck.checked,
                food: foodCheck.checked,
                foodNutrition: foodNutritionInput.value,
                foodSaturation: foodSaturationInput.value,
                foodCanAlwaysEat: foodAlwaysEatCheck.checked,
                durability: durabilityCheck.checked,
                maxDurability: maxDurabilityInput.value,
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

    // Resource-pack side: only touch item_texture.json if we actually know
    // where the resource pack lives AND the user gave us a texture short
    // name to register -- an item with no icon set is still perfectly
    // valid (it just uses Minecraft's default "missing texture" icon until
    // one is added later), so this is best-effort, not required.
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
    }

    // vfs.createFile() above already triggered a tree re-render via
    // vfs.onChange -- openFile() below covers tabs/main-area/explorer
    // (again, cheaply) for the newly created file becoming active.
    closeContentPanel();
    openFile(itemNode.path);
    toast(createdNew ? `Created ${projectName}_BP/_RP and added "${identifier}".` : `Added item "${identifier}".`);
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
