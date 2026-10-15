/*
 * EITT OS — système de fichiers virtuel CENTRALISÉ.
 *
 * Toutes les applications (Explorateur, Bloc-notes, Terminal, Bureau, Navigateur…) passent par ce module :
 * la logique de fichiers n'est jamais dupliquée. Les données vivent dans DT.Store.state.fs.nodes.
 *
 * Chaque élément a un identifiant unique (« id ») ; les chemins ne servent qu'à l'affichage.
 * Un élément supprimé reste dans la table avec un attribut « trashed » (corbeille virtuelle).
 *
 * Événements émis sur DT.bus :  "fs:change" { type, ids, names, target }   et  "fs:clipboard".
 */
(function () {
  "use strict";
  const DT = window.DT;
  const { uid } = DT.u;

  const ROOT = "root";
  const CAPACITY = 512 * 1024 * 1024; // disque virtuel fictif : 512 Mo
  const MAX_TEXT_CHARS = 400000;
  const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f]/;

  const TEXT_EXT = ["txt", "md", "csv", "json", "log", "html", "css", "js", "xml", "ini"];
  const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "svg", "webp"];
  const AUDIO_EXT = ["mp3", "wav", "ogg", "flac"];
  const VIDEO_EXT = ["mp4", "webm", "mov", "mkv"];

  let version = 0;
  let indexVersion = -1;
  let childIndex = new Map();

  const nodes = () => DT.Store.state.fs.nodes;
  const bump = () => {
    version += 1;
  };

  const encoder = typeof TextEncoder === "function" ? new TextEncoder() : null;
  const byteLength = (text) => (encoder ? encoder.encode(text).length : text.length);

  /* ------------------------------ Construction ------------------------------ */
  function buildInitial() {
    const table = {};
    const now = Date.now();
    let counter = 0;
    table[ROOT] = { id: ROOT, type: "folder", name: "Ce PC", parent: null, protected: true, created: now, modified: now };

    function addNode(def, parentId, isSystem) {
      counter += 1;
      const id = uid("n");
      const stamp = now - counter * 5.5 * 36e5;
      const node = { id: id, type: def.type, name: def.name, parent: parentId, created: stamp, modified: stamp };
      if (isSystem) node.protected = true;
      if (def.type === "file") {
        if (typeof def.content === "string") {
          node.content = def.content;
          node.size = byteLength(def.content);
        } else {
          node.art = def.art;
          node.artKind = def.artKind;
          node.size = def.size || 0;
        }
      }
      table[id] = node;
      (def.children || []).forEach((child) => addNode(child, id, false));
    }
    DT.Data.initialFiles.folders.forEach((folder) => addNode(folder, ROOT, true));
    return { nodes: table };
  }

  /** Vérifie qu'un état chargé est cohérent (racine, dossiers système, parents existants). */
  function validate(fsState) {
    try {
      const table = fsState && fsState.nodes;
      if (!table || !table[ROOT]) return false;
      const systemNames = DT.Data.initialFiles.folders.map((f) => f.name);
      const rootChildren = Object.values(table).filter((n) => n.parent === ROOT).map((n) => n.name);
      if (!systemNames.every((name) => rootChildren.includes(name))) return false;
      return Object.values(table).every((n) => {
        if (!n || typeof n.id !== "string" || table[n.id] !== n || (n.type !== "file" && n.type !== "folder")) return false;
        if (n.id === ROOT) return true;
        if (typeof n.name !== "string" || !table[n.parent]) return false;
        // pas de boucle : on remonte jusqu'à la racine
        let guard = 0;
        let cur = n;
        while (cur && cur.id !== ROOT && guard < 200) {
          cur = table[cur.parent];
          guard += 1;
        }
        return cur && cur.id === ROOT;
      });
    } catch (error) {
      return false;
    }
  }

  /* --------------------------------- Lecture -------------------------------- */
  const get = (id) => (id ? nodes()[id] || null : null);

  function isInTrash(node) {
    let cur = node;
    let guard = 0;
    while (cur && guard < 200) {
      if (cur.trashed) return true;
      cur = nodes()[cur.parent];
      guard += 1;
    }
    return false;
  }

  /** Un élément « vivant » existe et n'est pas dans la corbeille. */
  function alive(id) {
    const node = get(id);
    return Boolean(node) && !isInTrash(node);
  }

  function children(id) {
    if (indexVersion !== version) {
      childIndex = new Map();
      for (const node of Object.values(nodes())) {
        if (!node.parent || node.trashed) continue;
        if (!childIndex.has(node.parent)) childIndex.set(node.parent, []);
        childIndex.get(node.parent).push(node);
      }
      indexVersion = version;
    }
    return (childIndex.get(id) || []).slice();
  }

  function isDescendant(id, ancestorId) {
    let cur = get(id);
    let guard = 0;
    while (cur && guard < 200) {
      if (cur.id === ancestorId) return true;
      cur = get(cur.parent);
      guard += 1;
    }
    return false;
  }

  function pathNames(id) {
    const names = [];
    let cur = get(id);
    let guard = 0;
    while (cur && cur.id !== ROOT && guard < 200) {
      names.unshift(cur.name);
      cur = get(cur.parent);
      guard += 1;
    }
    return names;
  }

  const path = (id) => "/" + pathNames(id).join("/");
  const displayPath = (id) => (id === ROOT ? "Ce PC" : "Ce PC › " + pathNames(id).join(" › "));

  function systemFolder(name) {
    return children(ROOT).find((n) => n.name === name) || null;
  }

  function ext(name) {
    const i = String(name).lastIndexOf(".");
    return i > 0 ? name.slice(i + 1).toLowerCase() : "";
  }

  function kindOf(node) {
    if (!node) return "other";
    if (node.type === "folder") return "folder";
    if (node.artKind) return node.artKind;
    const e = ext(node.name);
    if (TEXT_EXT.includes(e)) return "text";
    if (IMAGE_EXT.includes(e)) return "image";
    if (AUDIO_EXT.includes(e)) return "audio";
    if (VIDEO_EXT.includes(e)) return "video";
    if (!e && typeof node.content === "string") return "text";
    return typeof node.content === "string" ? "text" : "other";
  }

  const isText = (node) => Boolean(node) && node.type === "file" && kindOf(node) === "text" && typeof node.content === "string";

  function typeLabel(node) {
    if (!node) return "";
    if (node.type === "folder") return node.id === ROOT ? "Ordinateur" : "Dossier de fichiers";
    const e = ext(node.name);
    const kind = kindOf(node);
    if (kind === "text") {
      if (e === "txt" || !e) return "Document texte";
      if (e === "csv") return "Fichier CSV";
      if (e === "md") return "Document Markdown";
      return "Fichier " + e.toUpperCase();
    }
    if (kind === "image") return "Image " + (e ? e.toUpperCase() : "");
    if (kind === "audio") return "Fichier audio " + (e ? e.toUpperCase() : "");
    if (kind === "video") return "Vidéo " + (e ? e.toUpperCase() : "");
    return e ? "Fichier " + e.toUpperCase() : "Fichier";
  }

  function sizeOf(node) {
    if (!node) return 0;
    if (node.type === "file") return node.size || 0;
    let total = 0;
    for (const child of children(node.id)) total += sizeOf(child);
    return total;
  }

  function counts(node) {
    let files = 0;
    let folders = 0;
    (function walk(id) {
      for (const child of children(id)) {
        if (child.type === "folder") {
          folders += 1;
          walk(child.id);
        } else {
          files += 1;
        }
      }
    }(node.id));
    return { files: files, folders: folders };
  }

  function stats() {
    let files = 0;
    let folders = 0;
    let bytes = 0;
    let trashItems = 0;
    let trashBytes = 0;
    for (const node of Object.values(nodes())) {
      if (node.id === ROOT) continue;
      if (node.trashed) {
        trashItems += 1;
        trashBytes += sizeOf(node);
        continue;
      }
      if (isInTrash(node)) continue;
      if (node.type === "folder") folders += 1;
      else {
        files += 1;
        bytes += node.size || 0;
      }
    }
    return { files: files, folders: folders, bytes: bytes, trashItems: trashItems, trashBytes: trashBytes, capacity: CAPACITY };
  }

  /** Tous les dossiers vivants avec leur chemin (sélecteurs de dossier). */
  function allFolders() {
    const list = [];
    (function walk(id, depth) {
      const node = get(id);
      list.push({ node: node, depth: depth, path: id === ROOT ? "Ce PC" : path(id) });
      children(id)
        .filter((c) => c.type === "folder")
        .sort(byName)
        .forEach((c) => walk(c.id, depth + 1));
    }(ROOT, 0));
    return list;
  }

  function allFiles(filterKind) {
    return Object.values(nodes())
      .filter((n) => n.type === "file" && !isInTrash(n) && (!filterKind || kindOf(n) === filterKind))
      .sort((a, b) => path(a.id).localeCompare(path(b.id), "fr", { numeric: true, sensitivity: "base" }));
  }

  const byName = (a, b) => a.name.localeCompare(b.name, "fr", { numeric: true, sensitivity: "base" });

  function search(query, scopeId) {
    const q = DT.u.normalize(query.trim());
    if (!q) return [];
    const found = [];
    (function walk(id) {
      for (const child of children(id)) {
        if (DT.u.normalize(child.name).includes(q)) found.push(child);
        if (child.type === "folder") walk(child.id);
      }
    }(scopeId || ROOT));
    return found;
  }

  function findChild(parentId, name) {
    const wanted = String(name).toLowerCase();
    return children(parentId).find((c) => c.name.toLowerCase() === wanted) || null;
  }

  /** Résout un chemin (absolu « /Documents », relatif « ../Images », « ~ ») à partir d'un dossier courant. */
  function resolve(cwdId, text) {
    let value = String(text || "").trim().replace(/\\/g, "/");
    if (!value) return get(cwdId);
    let current = get(cwdId) || get(ROOT);
    if (value.startsWith("/") || value === "~" || value.startsWith("~/")) {
      current = get(ROOT);
      value = value.replace(/^~?\//, "").replace(/^~$/, "");
    }
    for (const part of value.split("/").filter(Boolean)) {
      if (part === ".") continue;
      if (part === "..") {
        current = get(current.parent) || current;
        continue;
      }
      if (current.type !== "folder") return null;
      const next = findChild(current.id, part);
      if (!next) return null;
      current = next;
    }
    return current;
  }

  /* ------------------------------ Validation noms ----------------------------- */
  function validateName(name) {
    const value = String(name === null || name === undefined ? "" : name).trim();
    if (!value) return "Le nom ne peut pas être vide.";
    if (value.length > 100) return "Le nom est trop long (100 caractères maximum).";
    if (value === "." || value === "..") return "Ce nom n'est pas autorisé.";
    if (FORBIDDEN.test(value)) return "Un nom ne peut pas contenir les caractères suivants : \\ / : * ? \" < > |";
    if (/[. ]$/.test(value)) return "Un nom ne peut pas se terminer par un point ou un espace.";
    return null;
  }

  function nameTaken(parentId, name, exceptId) {
    const wanted = name.trim().toLowerCase();
    return children(parentId).some((c) => c.id !== exceptId && c.name.toLowerCase() === wanted);
  }

  /** Propose un nom libre dans le dossier : « Nouveau dossier », « Nouveau dossier (2) »… */
  function uniqueName(parentId, base, exceptId) {
    if (!nameTaken(parentId, base, exceptId)) return base;
    const e = ext(base);
    const stem = e ? base.slice(0, -(e.length + 1)) : base;
    for (let n = 2; n < 1000; n += 1) {
      const candidate = stem + " (" + n + ")" + (e ? "." + e : "");
      if (!nameTaken(parentId, candidate, exceptId)) return candidate;
    }
    return base + " " + Date.now();
  }

  /* --------------------------------- Écriture -------------------------------- */
  function changed(type, items, extra) {
    bump();
    DT.Store.touch();
    DT.bus.emit("fs:change", Object.assign({ type: type, ids: items.map((n) => n.id), names: items.map((n) => n.name) }, extra || {}));
  }

  function checkParent(parentId) {
    const parent = get(parentId);
    if (!parent || parent.type !== "folder" || isInTrash(parent)) return "Le dossier de destination n'existe plus.";
    if (parent.id === ROOT) return "Impossible de créer ou déposer des éléments à la racine : ouvrez d'abord un dossier.";
    return null;
  }

  function create(parentId, type, name, options) {
    const opts = options || {};
    const parentError = checkParent(parentId);
    if (parentError) return { ok: false, error: parentError };
    const nameError = validateName(name);
    if (nameError) return { ok: false, error: nameError };
    if (nameTaken(parentId, name)) return { ok: false, error: "Un élément portant ce nom existe déjà dans ce dossier." };
    const now = Date.now();
    const node = { id: uid("n"), type: type, name: name.trim(), parent: parentId, created: now, modified: now };
    if (type === "file") {
      const content = typeof opts.content === "string" ? opts.content : "";
      if (content.length > MAX_TEXT_CHARS) return { ok: false, error: "Le contenu est trop volumineux pour la simulation." };
      node.content = content;
      node.size = byteLength(content);
    }
    nodes()[node.id] = node;
    changed("create", [node], { target: parentId, nodeType: type });
    return { ok: true, node: node };
  }

  function createUnique(parentId, type, baseName, options) {
    const parentError = checkParent(parentId);
    if (parentError) return { ok: false, error: parentError };
    return create(parentId, type, uniqueName(parentId, baseName), options);
  }

  function rename(id, newName) {
    const node = get(id);
    if (!node) return { ok: false, error: "Cet élément n'existe plus." };
    if (node.protected) return { ok: false, error: "Ce dossier système ne peut pas être renommé." };
    const nameError = validateName(newName);
    if (nameError) return { ok: false, error: nameError };
    const value = newName.trim();
    if (value === node.name) return { ok: true, node: node, unchanged: true };
    if (nameTaken(node.parent, value, node.id)) return { ok: false, error: "Un élément portant ce nom existe déjà dans ce dossier." };
    const previous = node.name;
    node.name = value;
    node.modified = Date.now();
    changed("rename", [node], { previous: previous });
    return { ok: true, node: node };
  }

  function readText(id) {
    const node = get(id);
    return node && typeof node.content === "string" ? node.content : null;
  }

  function writeText(id, text) {
    const node = get(id);
    if (!node || node.type !== "file") return { ok: false, error: "Ce fichier n'existe plus." };
    if (isInTrash(node)) return { ok: false, error: "Ce fichier est dans la corbeille : restaurez-le avant de l'enregistrer." };
    if (text.length > MAX_TEXT_CHARS) return { ok: false, error: "Le document est trop volumineux pour la simulation (400 000 caractères maximum)." };
    node.content = text;
    node.size = byteLength(text);
    node.modified = Date.now();
    changed("write", [node]);
    return { ok: true, node: node };
  }

  /** Déplace des éléments vers un dossier. Refuse les opérations incohérentes (boucles, dossiers système…). */
  function move(ids, targetId) {
    const result = { moved: [], errors: [] };
    const target = get(targetId);
    const parentError = checkParent(targetId);
    if (parentError) {
      result.errors.push(parentError);
      return result;
    }
    for (const id of ids) {
      const node = get(id);
      if (!node || isInTrash(node)) {
        result.errors.push("Un élément à déplacer n'existe plus.");
        continue;
      }
      if (node.protected) {
        result.errors.push("« " + node.name + " » est un dossier système : il ne peut pas être déplacé.");
        continue;
      }
      if (node.type === "folder" && (node.id === targetId || isDescendant(targetId, node.id))) {
        result.errors.push("Impossible de déplacer le dossier « " + node.name + " » dans lui-même ou dans l'un de ses sous-dossiers.");
        continue;
      }
      if (node.parent === targetId) continue;
      if (nameTaken(targetId, node.name)) node.name = uniqueName(targetId, node.name);
      node.parent = targetId;
      node.modified = Date.now();
      result.moved.push(node);
    }
    if (result.moved.length) changed("move", result.moved, { target: targetId, targetName: target.name });
    return result;
  }

  function cloneTree(node, newParentId, items) {
    const copyNode = Object.assign({}, node, { id: uid("n"), parent: newParentId, created: Date.now(), modified: Date.now() });
    delete copyNode.trashed;
    delete copyNode.protected;
    nodes()[copyNode.id] = copyNode;
    items.push(copyNode);
    if (node.type === "folder") {
      for (const child of children(node.id)) cloneTree(child, copyNode.id, items);
    }
    return copyNode;
  }

  function copy(ids, targetId) {
    const result = { copies: [], errors: [] };
    const parentError = checkParent(targetId);
    if (parentError) {
      result.errors.push(parentError);
      return result;
    }
    for (const id of ids) {
      const node = get(id);
      if (!node || isInTrash(node)) {
        result.errors.push("Un élément à copier n'existe plus.");
        continue;
      }
      if (node.type === "folder" && (node.id === targetId || isDescendant(targetId, node.id))) {
        result.errors.push("Impossible de copier le dossier « " + node.name + " » dans lui-même ou dans l'un de ses sous-dossiers.");
        continue;
      }
      const collides = nameTaken(targetId, node.name);
      const all = [];
      const top = cloneTree(node, targetId, all);
      if (collides) {
        // le nom existe déjà dans le dossier de destination : on ajoute « - Copie »
        const e = node.type === "file" ? ext(node.name) : "";
        const stem = e ? node.name.slice(0, -(e.length + 1)) : node.name;
        let n = 1;
        let candidate;
        do {
          candidate = stem + " - Copie" + (n > 1 ? " (" + n + ")" : "") + (e ? "." + e : "");
          n += 1;
        } while (nameTaken(targetId, candidate, top.id));
        top.name = candidate;
      }
      bump();
      result.copies.push(top);
    }
    if (result.copies.length) {
      bump();
      DT.Store.touch();
      DT.bus.emit("fs:change", { type: "copy", ids: result.copies.map((n) => n.id), names: result.copies.map((n) => n.name), target: targetId });
    }
    return result;
  }

  /** Corbeille virtuelle : l'élément reste en mémoire, marqué « trashed ». */
  function trash(ids) {
    const result = { trashed: [], errors: [] };
    for (const id of ids) {
      const node = get(id);
      if (!node || isInTrash(node)) continue;
      if (node.protected) {
        result.errors.push("« " + node.name + " » est un dossier système : il ne peut pas être supprimé.");
        continue;
      }
      node.trashed = { at: Date.now(), from: node.parent, fromPath: displayPath(node.parent) };
      result.trashed.push(node);
    }
    if (result.trashed.length) changed("trash", result.trashed);
    return result;
  }

  const trashed = () => Object.values(nodes()).filter((n) => n.trashed).sort((a, b) => b.trashed.at - a.trashed.at);

  function restore(ids) {
    const result = { restored: [], errors: [] };
    for (const id of ids) {
      const node = get(id);
      if (!node || !node.trashed) continue;
      let parentId = node.trashed.from;
      if (!alive(parentId) || parentId === ROOT) parentId = (systemFolder("Documents") || systemFolder("Bureau")).id;
      if (nameTaken(parentId, node.name)) node.name = uniqueName(parentId, node.name);
      node.parent = parentId;
      delete node.trashed;
      node.modified = Date.now();
      result.restored.push(node);
    }
    if (result.restored.length) changed("restore", result.restored);
    return result;
  }

  function removeTree(id) {
    for (const child of Object.values(nodes()).filter((n) => n.parent === id)) removeTree(child.id);
    delete nodes()[id];
  }

  function deletePermanently(ids, silent) {
    const removed = [];
    for (const id of ids) {
      const node = get(id);
      if (!node || !node.trashed) continue;
      removed.push({ id: node.id, name: node.name });
      removeTree(node.id);
    }
    if (removed.length) {
      bump();
      DT.Store.touch();
      DT.bus.emit("fs:change", { type: silent ? "delete-silent" : "delete", ids: removed.map((r) => r.id), names: removed.map((r) => r.name) });
    }
    return { removed: removed };
  }

  function emptyTrash() {
    const items = trashed();
    if (!items.length) return { removed: [] };
    const result = deletePermanently(items.map((n) => n.id), true);
    DT.bus.emit("fs:change", { type: "empty-trash", ids: result.removed.map((r) => r.id), names: result.removed.map((r) => r.name) });
    return result;
  }

  /* -------------------------------- Presse-papiers ---------------------------- */
  const clipboard = { mode: null, ids: [] };

  function setClipboard(mode, ids) {
    clipboard.mode = mode;
    clipboard.ids = ids.slice();
    DT.bus.emit("fs:clipboard", { mode: mode, ids: clipboard.ids });
  }

  function clearClipboard() {
    setClipboard(null, []);
  }

  function paste(targetId) {
    if (!clipboard.mode || !clipboard.ids.length) return { ok: false, errors: ["Le presse-papiers est vide."] };
    const live = clipboard.ids.filter(alive);
    if (!live.length) {
      clearClipboard();
      return { ok: false, errors: ["Les éléments copiés n'existent plus."] };
    }
    if (clipboard.mode === "cut") {
      const result = move(live, targetId);
      if (!result.errors.length) clearClipboard();
      return { ok: result.moved.length > 0 || !result.errors.length, mode: "cut", count: result.moved.length, errors: result.errors };
    }
    const result = copy(live, targetId);
    return { ok: result.copies.length > 0, mode: "copy", count: result.copies.length, errors: result.errors };
  }

  DT.FS = {
    ROOT: ROOT,
    CAPACITY: CAPACITY,
    clipboard: clipboard,
    buildInitial: buildInitial,
    validate: validate,
    get: get,
    alive: alive,
    isInTrash: isInTrash,
    children: children,
    isDescendant: isDescendant,
    path: path,
    pathNames: pathNames,
    displayPath: displayPath,
    systemFolder: systemFolder,
    ext: ext,
    kindOf: kindOf,
    isText: isText,
    typeLabel: typeLabel,
    sizeOf: sizeOf,
    counts: counts,
    stats: stats,
    allFolders: allFolders,
    allFiles: allFiles,
    search: search,
    findChild: findChild,
    resolve: resolve,
    validateName: validateName,
    nameTaken: nameTaken,
    uniqueName: uniqueName,
    create: create,
    createUnique: createUnique,
    rename: rename,
    readText: readText,
    writeText: writeText,
    move: move,
    copy: copy,
    trash: trash,
    trashed: trashed,
    restore: restore,
    deletePermanently: deletePermanently,
    emptyTrash: emptyTrash,
    setClipboard: setClipboard,
    clearClipboard: clearClipboard,
    paste: paste,
    byName: byName,
    /** À appeler après avoir remplacé tout l'arbre (DT.Store.state.fs.nodes) : invalide l'index des enfants. */
    refresh: bump
  };
}());
