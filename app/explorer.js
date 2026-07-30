// ---------------------------------------------------------------------------
// Sidebar file-explorer tree rendering (VS Code style, touch friendly).
// ---------------------------------------------------------------------------

const BADGES = {
  json: { text: "{}", cls: "badge-json" },
  js: { text: "JS", cls: "badge-js" },
  mjs: { text: "JS", cls: "badge-js" },
  cjs: { text: "JS", cls: "badge-js" },
  ts: { text: "TS", cls: "badge-ts" },
  png: { text: "\u{1F5BC}", cls: "badge-img" },
  jpg: { text: "\u{1F5BC}", cls: "badge-img" },
  jpeg: { text: "\u{1F5BC}", cls: "badge-img" },
  gif: { text: "\u{1F5BC}", cls: "badge-img" },
  webp: { text: "\u{1F5BC}", cls: "badge-img" },
  mp3: { text: "\u266A", cls: "badge-audio" },
  ogg: { text: "\u266A", cls: "badge-audio" },
  wav: { text: "\u266A", cls: "badge-audio" },
  md: { text: "M\u2193", cls: "badge-md" },
  lang: { text: "A", cls: "badge-lang" },
  mcfunction: { text: "MC", cls: "badge-mcfunction" },
  txt: { text: "TXT", cls: "badge-txt" },
};

function badgeFor(ext) {
  return BADGES[ext] || { text: "\u2022", cls: "badge-default" };
}

function fileIcon(ext) {
  const b = badgeFor(ext);
  return el("span", { class: `pas-badge ${b.cls}` }, [b.text]);
}

function renderTree(vfs, container, state, handlers) {
  container.innerHTML = "";
  const root = el("ul", { class: "pas-tree" });
  const kids = vfs.listChildren("");
  if (kids.length === 0) {
    root.appendChild(
      el("li", { class: "pas-tree-empty" }, [
        "No files yet. Use Import below to add files, a folder, or a .zip / .mcpack / .mcaddon / .mcworld.",
      ])
    );
  } else {
    kids.forEach((child) => root.appendChild(renderNode(vfs, child, 0, state, handlers)));
  }
  container.appendChild(root);
}

function renderNode(vfs, node, depth, state, handlers) {
  const li = el("li", { class: "pas-tree-item" });
  const row = el("div", {
    class: `pas-tree-row${state.activePath === node.path ? " is-active" : ""}${state.selected && state.selected.has(node.path) ? " is-selected" : ""}`,
    style: `padding-left:${8 + depth * 16}px`,
  });

  if (node.type === "folder") {
    const chevron = el("span", { class: `pas-chevron${node.open ? " is-open" : ""}` }, ["\u25B8"]);
    row.appendChild(chevron);
    row.appendChild(el("span", { class: "pas-badge badge-folder" }, [node.open ? "\u{1F4C2}" : "\u{1F4C1}"]));
    row.appendChild(el("span", { class: "pas-tree-name" }, [node.name || "root"]));
    row.addEventListener("click", () => handlers.onToggleFolder(node.path));
  } else {
    row.appendChild(el("span", { class: "pas-chevron pas-chevron-spacer" }));
    row.appendChild(fileIcon(node.ext));
    const nameSpan = el("span", { class: "pas-tree-name" }, [node.name]);
    row.appendChild(nameSpan);
    if (node.dirty) row.appendChild(el("span", { class: "pas-dirty-dot" }));
    row.addEventListener("click", () => handlers.onOpenFile(node.path));
  }

  const moreBtn = el(
    "button",
    {
      class: "pas-tree-more",
      "aria-label": "Actions",
      onclick: (e) => {
        e.stopPropagation();
        handlers.onAction(node.path, e.currentTarget);
      },
    },
    ["\u22EE"]
  );
  row.appendChild(moreBtn);
  li.appendChild(row);

  if (node.type === "folder" && node.open) {
    const childrenWrap = el("ul", { class: "pas-tree-children" });
    const children = vfs.listChildren(node.path);
    children.forEach((child) => childrenWrap.appendChild(renderNode(vfs, child, depth + 1, state, handlers)));
    li.appendChild(childrenWrap);
  }

  return li;
}
