# Pocket Addon Studio

A VS Code style editor for building Minecraft Bedrock (MCPE/MCBE) add-ons
right from your phone or desktop browser.

## Running it

There is **no build step and no install step**. Just open:

https://itzendbro.github.io/mc-addon-dev-webapp/


## Tech stack

Plain **HTML, CSS and JavaScript** only — no React, no JSX, no TypeScript, no
bundler/build tooling of any kind. Two small libraries are vendored locally
(no CDN, no `npm install` required):

- [`vendor/jszip`](vendor/jszip) — reading/writing `.zip`, `.mcpack` and
  `.mcaddon` archives.
  - [`vendor/codemirror5`](vendor/codemirror5) — the in-browser code editor
    (syntax highlighting, search, bracket matching, autocomplete).

    ## Project layout

    ```
    index.html          Entry point — open this in a browser
    app/                 All application source (plain JS + one CSS file)
      main.js            App shell, wiring, import/export UI, tabs, toolbar
        fs.js              In-memory virtual file system + localStorage autosave
          editor.js          CodeMirror 5 wrapper + Minecraft Bedrock autocomplete
            explorer.js        Sidebar file tree rendering
              modals.js          Bottom-sheet dialogs (prompt/confirm/action sheet)
                zipio.js           Import/export archives via JSZip
                  mcTemplates.js     manifest.json templates (!mbp / !mrp snippets)
                    mcCompletions.js   Minecraft Bedrock JSON/JS snippet dictionaries
                      utils.js           Small shared helpers
                        styles.css         All app styling (VS Code inspired, phone-first)
                        vendor/              Vendored third-party libraries (JSZip, CodeMirror 5)
                        ```

                        All files in `app/` are loaded as plain `<script>` tags (in dependency
                        order) from `index.html`, sharing the same global scope — no module system
                        required.

