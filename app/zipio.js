// ---------------------------------------------------------------------------
// Import/export of .zip, .mcpack, .mcaddon archives using JSZip.
// ---------------------------------------------------------------------------

async function importArchiveIntoVFS(vfs, file, targetFolder) {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files);
  let count = 0;
  for (const entry of entries) {
    if (entry.dir) continue;
    const relPath = entry.name.replace(/\\/g, "/");
    const fullPath = joinPath(targetFolder || "", relPath);
    const ext = extOf(fullPath);
    const text = isTextExt(ext) || (!isImageExt(ext) && !isAudioExt(ext));
    if (text) {
      const content = await entry.async("string");
      vfs.createFileAt(fullPath, content, { isText: true, collapsedFolders: true });
    } else {
      const b64 = await entry.async("base64");
      vfs.createFileAt(fullPath, b64, { isText: false, collapsedFolders: true });
    }
    count++;
  }
  return count;
}

async function exportVFSAsZip(vfs, filename) {
  const zip = new JSZip();
  vfs.allFiles().forEach((node) => {
    if (node.isText) zip.file(node.path, node.content ?? "");
    else zip.file(node.path, node.b64 ?? "", { base64: true });
  });
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  downloadBlob(blob, filename);
}

async function exportFolderAsPack(vfs, folderPath, filename) {
  const zip = new JSZip();
  const prefixLen = folderPath ? folderPath.length + 1 : 0;
  vfs.allFiles().forEach((node) => {
    if (folderPath && !node.path.startsWith(folderPath + "/")) return;
    const relative = folderPath ? node.path.slice(prefixLen) : node.path;
    if (node.isText) zip.file(relative, node.content ?? "");
    else zip.file(relative, node.b64 ?? "", { base64: true });
  });
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function downloadSingleFile(node) {
  let blob;
  if (node.isText) {
    blob = new Blob([node.content ?? ""], { type: "text/plain" });
  } else {
    blob = new Blob([b64ToBytes(node.b64 ?? "")]);
  }
  downloadBlob(blob, node.name);
}
