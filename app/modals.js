// ---------------------------------------------------------------------------
// Small reusable modal / bottom-sheet helpers (no external UI framework).
// ---------------------------------------------------------------------------

function overlayHost() {
  let host = document.getElementById("pas-modal-host");
  if (!host) {
    host = el("div", { id: "pas-modal-host" });
    document.body.appendChild(host);
  }
  return host;
}

function openOverlay(contentNode, opts = {}) {
  const host = overlayHost();
  const backdrop = el("div", { class: "pas-overlay" });
  const sheet = el("div", { class: `pas-sheet ${opts.className || ""}` }, [contentNode]);
  backdrop.appendChild(sheet);
  host.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add("is-visible"));

  function close() {
    backdrop.classList.remove("is-visible");
    setTimeout(() => backdrop.remove(), 180);
  }
  if (!opts.persistent) {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });
  }
  return { backdrop, sheet, close };
}

function promptDialog({ title, label, value = "", placeholder = "", confirmText = "Create", validate }) {
  return new Promise((resolve) => {
    const input = el("input", { class: "pas-input", type: "text", value, placeholder, autocomplete: "off", autocapitalize: "off", spellcheck: "false" });
    const errorEl = el("div", { class: "pas-field-error" });
    const body = el("div", { class: "pas-sheet-body" }, [
      el("h3", { class: "pas-sheet-title" }, [title]),
      label ? el("label", { class: "pas-field-label" }, [label]) : null,
      input,
      errorEl,
      el("div", { class: "pas-sheet-actions" }, [
        el("button", { class: "pas-btn pas-btn-ghost", onclick: () => { ov.close(); resolve(null); } }, ["Cancel"]),
        el("button", {
          class: "pas-btn pas-btn-primary",
          onclick: () => {
            const val = input.value.trim();
            if (validate) {
              const err = validate(val);
              if (err) {
                errorEl.textContent = err;
                return;
              }
            }
            if (!val) {
              errorEl.textContent = "This field can't be empty.";
              return;
            }
            ov.close();
            resolve(val);
          },
        }, [confirmText]),
      ]),
    ]);
    const ov = openOverlay(body, { className: "pas-sheet-compact" });
    setTimeout(() => {
      input.focus();
      // Select the ENTIRE default value (not just the part before the
      // extension). We used to only select up to the last "." so a user
      // could type a new name while keeping the ".json"/".js" extension,
      // but partial selection set via setSelectionRange() is unreliable on
      // real phone keyboards -- the OS keyboard's own selection/composition
      // state frequently doesn't stay in sync with a JS-driven partial
      // selection, especially right as the keyboard is opening. That could
      // leave stray leftover characters from the old extension after
      // backspacing (e.g. typing over "new_file" but leaving ".js" behind
      // from ".json"), producing a file with the wrong extension. A full
      // select() is the same simple, reliable behavior already used for
      // the "New Folder" prompt below and has none of that ambiguity: the
      // whole suggested name is selected, and typing anything fully
      // replaces it -- so whatever the user types (including the
      // extension) is exactly what they get.
      input.select();
    }, 60);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        body.querySelector(".pas-btn-primary").click();
      }
    });
  });
}

function confirmDialog({ title, message, confirmText = "Delete", danger = true }) {
  return new Promise((resolve) => {
    const body = el("div", { class: "pas-sheet-body" }, [
      el("h3", { class: "pas-sheet-title" }, [title]),
      el("p", { class: "pas-sheet-message" }, [message]),
      el("div", { class: "pas-sheet-actions" }, [
        el("button", { class: "pas-btn pas-btn-ghost", onclick: () => { ov.close(); resolve(false); } }, ["Cancel"]),
        el("button", {
          class: `pas-btn ${danger ? "pas-btn-danger" : "pas-btn-primary"}`,
          onclick: () => { ov.close(); resolve(true); },
        }, [confirmText]),
      ]),
    ]);
    const ov = openOverlay(body, { className: "pas-sheet-compact" });
  });
}

// items: [{ label, icon, danger }] -> resolves index of chosen item or -1
function actionSheet({ title, items }) {
  return new Promise((resolve) => {
    const list = el(
      "div",
      { class: "pas-action-list" },
      items.map((item, i) =>
        el(
          "button",
          {
            class: `pas-action-item${item.danger ? " is-danger" : ""}`,
            onclick: () => { ov.close(); resolve(i); },
          },
          [el("span", { class: "pas-action-icon" }, [item.icon || ""]), el("span", {}, [item.label])]
        )
      )
    );
    const body = el("div", { class: "pas-sheet-body" }, [
      title ? el("h3", { class: "pas-sheet-title" }, [title]) : null,
      list,
    ]);
    const ov = openOverlay(body, { className: "pas-sheet-compact pas-sheet-actions-sheet" });
    body.__close = ov.close;
  });
}

function infoDialog({ title, message, okText = "Got it" }) {
  return new Promise((resolve) => {
    const body = el("div", { class: "pas-sheet-body" }, [
      el("h3", { class: "pas-sheet-title" }, [title]),
      el("p", { class: "pas-sheet-message" }, [message]),
      el("div", { class: "pas-sheet-actions" }, [
        el("button", { class: "pas-btn pas-btn-primary", onclick: () => { ov.close(); resolve(true); } }, [okText]),
      ]),
    ]);
    const ov = openOverlay(body, { className: "pas-sheet-compact" });
  });
}
