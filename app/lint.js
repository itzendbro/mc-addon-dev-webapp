// ---------------------------------------------------------------------------
// Lightweight, dependency-free-ish (one small vendored parser) syntax-error
// highlighting for the editor -- the "red squiggly under the broken bit,
// with the message available on tap" feature modeled after VS Code's
// built-in diagnostics + the Error Lens extension's philosophy of surfacing
// the message without needing a mouse hover (which doesn't exist on a
// phone). See EditorManager's `_relint()`/`_updateLintTooltip()` in
// editor.js for how this plugs into the live editor.
//
// Deliberately scoped to *syntax* errors only (not full semantic linting/
// type-checking/ESLint-style style rules) -- that's the same scope as
// what a hand-rolled recursive-descent parser can realistically catch, and
// it's also exactly what "the file won't even parse" catches for creators
// hand-editing Minecraft add-on JSON/JS on a phone, which is the failure
// mode this is actually meant to prevent (a stray missing comma/brace
// silently breaking the whole pack). Both the JSON and JS parsers used here
// stop at the *first* syntax error (standard behavior for a non-error-
// recovering parser) rather than trying to keep going and report every
// subsequent error -- which in practice matches the common "fix one, see
// the next" workflow and avoids the complexity/fragility of writing a
// custom error-recovering parser from scratch.
// ---------------------------------------------------------------------------

// Converts a 0-based character offset into `text` to a { line, ch } position
// (both 0-based, matching CodeMirror's convention).
function _lintPosFromOffset(text, offset) {
  let line = 0;
  let lastNL = -1;
  const max = Math.min(offset, text.length);
  for (let idx = 0; idx < max; idx++) {
    if (text.charCodeAt(idx) === 10 /* \n */) {
      line++;
      lastNL = idx;
    }
  }
  return { line, ch: offset - lastNL - 1 };
}

// Widens a single-character error position into a more legible underline
// span -- e.g. the whole offending identifier/number/string instead of just
// its first character -- by looking at the actual line text. Falls back to
// a single character (or the last character of the line, if the error
// position is exactly at/past the end of the line, as "unexpected end of
// input"/"unexpected end of line" errors usually report).
function _lintWidenSpan(lineText, ch) {
  if (ch < lineText.length) {
    const c = lineText[ch];
    if (/[A-Za-z0-9_$]/.test(c)) {
      let end = ch;
      while (end < lineText.length && /[A-Za-z0-9_$]/.test(lineText[end])) end++;
      return { from: ch, to: end };
    }
    if (c === '"' || c === "'" || c === "`") {
      let end = ch + 1;
      while (end < lineText.length && lineText[end] !== c) {
        if (lineText[end] === "\\") end++;
        end++;
      }
      return { from: ch, to: Math.min(end + 1, lineText.length) };
    }
    return { from: ch, to: ch + 1 };
  }
  // Position is at/past the end of the line (including an empty line) --
  // fall back to underlining the last real character on the line, if any.
  if (lineText.length > 0) return { from: lineText.length - 1, to: lineText.length };
  return null; // nothing to underline on a genuinely empty line
}

function _lintIssueFromOffset(text, offset, message, severity) {
  const pos = _lintPosFromOffset(text, offset);
  const lines = text.split("\n");
  let line = pos.line;
  let ch = pos.ch;
  let lineText = lines[line] || "";
  let span = _lintWidenSpan(lineText, ch);
  // The error position can land on a genuinely empty line -- most commonly
  // "end of file" pointing just past a trailing newline after an unclosed
  // brace/paren/bracket (e.g. a function whose closing `}` was never
  // typed). There's nothing on that line to underline, but the error is
  // very real, so walk backwards to the nearest non-empty line and
  // underline its last character instead of silently dropping the issue.
  while (!span && line > 0) {
    line--;
    lineText = lines[line] || "";
    ch = lineText.length;
    span = _lintWidenSpan(lineText, ch);
  }
  if (!span) return null;
  return {
    from: { line, ch: span.from },
    to: { line, ch: span.to },
    message,
    severity: severity || "error",
  };
}

// Strips acorn's own "(line:column)" location suffix from its error
// messages -- we already show the location via the squiggly's position, so
// repeating it as text in the tap-tooltip is just noise.
function _lintCleanAcornMessage(message) {
  return message.replace(/\s*\(\d+:\d+\)\s*$/, "");
}

function lintJSON(text) {
  if (!text || !text.trim()) return [];
  try {
    parseJsonLoose(text);
    return [];
  } catch (e) {
    if (typeof e.pos !== "number") return [];
    const issue = _lintIssueFromOffset(text, e.pos, e.message, "error");
    return issue ? [issue] : [];
  }
}

function lintJavaScript(text) {
  if (!text || !text.trim()) return [];
  if (typeof acorn === "undefined" || !acorn || typeof acorn.parse !== "function") return [];
  try {
    acorn.parse(text, {
      ecmaVersion: "latest",
      sourceType: "module",
      allowReturnOutsideFunction: true,
      allowImportExportEverywhere: true,
      allowAwaitOutsideFunction: true,
      allowHashBang: true,
      locations: false,
    });
    return [];
  } catch (e) {
    if (typeof e.pos !== "number") return [];
    const issue = _lintIssueFromOffset(text, e.pos, _lintCleanAcornMessage(e.message), "error");
    return issue ? [issue] : [];
  }
}

// Picks the right (syntax-only) linter for a file extension, or returns
// null for extensions we deliberately don't attempt to parse:
//   - .ts is skipped on purpose: acorn is a plain-JavaScript parser and
//     would misfire constantly on ordinary TypeScript-only syntax (type
//     annotations, interfaces, generics, ...), producing false-positive
//     squigglies on perfectly valid TS. A real TS parser is a much heavier
//     dependency than this app's "no build tooling, everything vendored
//     and tiny" constraint can justify for a feature that's explicitly
//     scoped to syntax-error highlighting.
//   - Every other non-JSON/JS extension (.txt, .lang, .mcfunction, images,
//     audio, ...) has no well-defined "syntax" for a parser to check.
function lintForExt(ext) {
  if (ext === "json") return lintJSON;
  if (ext === "js" || ext === "mjs" || ext === "cjs") return lintJavaScript;
  return null;
}
