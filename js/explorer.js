/*
 * EITT OS — Explorateur de fichiers (+ Corbeille) et glisser-déposer.
 * Toute la logique de fichiers est dans DT.FS (filesystem.js) : l'explorateur ne fait que l'afficher et l'appeler.
 */
(function () {
  "use strict";
  const DT = window.DT;
  const FS = DT.FS;
  const { h, $, formatDate, formatSize, plural } = DT.u;

  const SORT_LABELS = { name: "Nom", type: "Type", size: "Taille", modified: "Date de modification" };

  /* =============================================================== Aides communes */
  function notifyErrors(title, errors) {
    if (!errors || !errors.length) return;
    const unique = Array.from(new Set(errors));
    DT.Notify.push({ title: title, message: unique.slice(0, 2).join(" "), type: "error" });
  }

  /** Ouvre un nœud dans l'application adaptée (utilisé par l'explorateur et par le bureau). */
  function openNode(node) {
    if (!node) return;
    if (FS.isInTrash(node)) {
      DT.UI.alert({ title: "Cet élément est dans la corbeille", message: "Vous ne pouvez pas ouvrir « " + node.name + " » depuis la corbeille. Faites un clic droit puis « Restaurer » pour le récupérer." });
      return;
    }
    if (node.type === "file" && node.sim && DT.Ransom) { DT.Ransom.openLocked(node); return; }
    if (node.type === "folder") DT.WM.open("explorer", { folderId: node.id });
    else if (FS.isText(node)) DT.Notepad.open(node.id);
    else DT.WM.open("viewer", { fileId: node.id });
  }

  DT.Files = {
    open: (id) => openNode(FS.get(id)),
    openFolder: (id) => DT.WM.open("explorer", { folderId: id }),
    openTrash: () => DT.WM.open("explorer", { loc: "trash" })
  };

  /* =============================================================== Glisser-déposer (souris) */
  let justDragged = false;

  function dropTargetAt(x, y, ids) {
    const hit = document.elementFromPoint(x, y);
    const el = hit ? hit.closest("[data-drop-folder],[data-drop-trash]") : null;
    if (!el) return null;
    if (el.hasAttribute("data-drop-trash")) return { el: el, trash: true, ok: true };
    const folderId = el.getAttribute("data-drop-folder");
    const folder = FS.get(folderId);
    if (!folder || folderId === FS.ROOT) return { el: el, ok: false, reason: "Impossible de déposer des éléments à la racine « Ce PC »." };
    if (ids.some((id) => id === folderId || FS.isDescendant(folderId, id))) return { el: el, ok: false, reason: "Un dossier ne peut pas être déplacé dans lui-même.", silent: true };
    if (ids.every((id) => (FS.get(id) || {}).parent === folderId)) return { el: el, ok: false, same: true, silent: true };
    return { el: el, folderId: folderId, ok: true };
  }

  function track(down, options) {
    if (down.button !== 0 || down.pointerType === "touch") return;
    const ids = options.ids.slice();
    if (!ids.length) return;
    const start = { x: down.clientX, y: down.clientY };
    let active = false;
    let ghost = null;
    let current = null;

    function mark(target) {
      if (current && current.el !== (target && target.el)) current.el.classList.remove("drop-target", "drop-invalid");
      current = target;
      if (target) {
        target.el.classList.toggle("drop-target", Boolean(target.ok));
        target.el.classList.toggle("drop-invalid", !target.ok && !target.same);
      }
    }

    function onMove(event) {
      if (!active) {
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 6) return;
        active = true;
        ghost = h("div", { class: "dnd-ghost", "aria-hidden": "true" }, options.icon ? options.icon() : null, h("span", { text: ids.length > 1 ? ids.length + " éléments" : options.label || "" }));
        document.body.append(ghost);
        document.body.classList.add("is-dragging");
        if (options.onStart) options.onStart();
      }
      ghost.style.transform = "translate(" + (event.clientX + 14) + "px," + (event.clientY + 14) + "px)";
      ghost.classList.toggle("is-copy", event.ctrlKey);
      mark(dropTargetAt(event.clientX, event.clientY, ids));
      if (options.onMove) options.onMove(event);
    }

    function finish(event, cancelled) {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onCancel, true);
      window.removeEventListener("keydown", onKey, true);
      if (!active) return;
      const target = cancelled ? null : current;
      mark(null);
      if (ghost) ghost.remove();
      document.body.classList.remove("is-dragging");
      justDragged = true;
      window.setTimeout(() => {
        justDragged = false;
      }, 60);
      let handled = false;
      if (target && target.ok) {
        handled = true;
        performDrop(ids, target, event && event.ctrlKey);
      } else if (target && !target.ok && !target.silent && !target.same) {
        handled = true;
        DT.Notify.push({ title: "Dépôt impossible", message: target.reason || "Cet endroit n'accepte pas ces éléments.", type: "error" });
      } else if (target && target.same) {
        handled = true;
      }
      if (options.onEnd) options.onEnd({ handled: handled, event: event });
    }

    const onUp = (event) => finish(event, false);
    const onCancel = (event) => finish(event, true);
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        finish(event, true);
      }
    };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onCancel, true);
    window.addEventListener("keydown", onKey, true);
  }

  function performDrop(ids, target, copy) {
    if (target.trash) {
      const result = FS.trash(ids);
      notifyErrors("Suppression impossible", result.errors);
      return;
    }
    if (copy) {
      const result = FS.copy(ids, target.folderId);
      notifyErrors("Copie impossible", result.errors);
    } else {
      const result = FS.move(ids, target.folderId);
      notifyErrors("Déplacement impossible", result.errors);
    }
  }

  /** Dépose des éléments à l'endroit (x, y) s'il s'y trouve une cible valide. Retourne true si la cible a traité le dépôt. */
  function dropAt(x, y, ids, copy) {
    const target = dropTargetAt(x, y, ids);
    if (!target) return false;
    if (target.ok) {
      performDrop(ids, target, copy);
      return true;
    }
    if (target.same) return false;
    if (!target.silent) DT.Notify.push({ title: "Dépôt impossible", message: target.reason || "Cet endroit n'accepte pas ces éléments.", type: "error" });
    return true;
  }

  DT.Dnd = { track: track, wasDrag: () => justDragged, dropAt: dropAt };

  /* =============================================================== Application Explorateur */
  function comparator(sort) {
    const dir = sort.dir === "desc" ? -1 : 1;
    return (a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      let r;
      if (sort.key === "type") r = FS.typeLabel(a).localeCompare(FS.typeLabel(b), "fr") || FS.byName(a, b);
      else if (sort.key === "size") r = FS.sizeOf(a) - FS.sizeOf(b) || FS.byName(a, b);
      else if (sort.key === "modified") r = (a.modified || 0) - (b.modified || 0) || FS.byName(a, b);
      else r = FS.byName(a, b);
      return r * dir;
    };
  }

  function kindIcon(node, px) {
    return DT.Icons.file(FS.kindOf(node), px);
  }

  function createExplorer(ctx) {
    ctx.body.classList.add("fx-app");
    const params = ctx.params || {};
    const state = {
      loc: { kind: "folder", id: FS.ROOT },
      back: [],
      fwd: [],
      selection: new Set(),
      anchor: null,
      cursor: null,
      renaming: null,
      origin: null
    };
    if (params.loc === "trash") state.loc = { kind: "trash" };
    else if (params.folderId && FS.alive(params.folderId)) state.loc = { kind: "folder", id: params.folderId };

    const prefs = () => DT.Store.state.settings;
    let ordered = [];
    let rendering = false;
    const itemEls = new Map();

    /* ------------------------------ Squelette ------------------------------ */
    const btnBack = h("button", { type: "button", class: "fx-nav", "data-nav": "back", "aria-label": "Précédent", title: "Précédent (Alt+Gauche)", onClick: () => goBack() }, DT.Icons.el("arrow-left", 17));
    const btnFwd = h("button", { type: "button", class: "fx-nav", "data-nav": "forward", "aria-label": "Suivant", title: "Suivant (Alt+Droite)", onClick: () => goForward() }, DT.Icons.el("arrow-right", 17));
    const btnUp = h("button", { type: "button", class: "fx-nav", "data-nav": "up", "aria-label": "Dossier parent", title: "Dossier parent (Retour arrière)", onClick: () => goUp() }, DT.Icons.el("arrow-up", 17));
    const btnRefresh = h("button", { type: "button", class: "fx-nav", "data-nav": "refresh", "aria-label": "Actualiser", title: "Actualiser", onClick: () => render() }, DT.Icons.el("refresh", 16));
    const address = h("nav", { class: "fx-address", "aria-label": "Chemin du dossier" });
    const search = h("input", { type: "search", class: "field fx-search", placeholder: "Rechercher", "aria-label": "Rechercher dans ce dossier", autocomplete: "off", spellcheck: "false" });
    const toolbar = h("div", { class: "fx-toolbar" }, btnBack, btnFwd, btnUp, address, btnRefresh, search);
    const commands = h("div", { class: "fx-commands", role: "toolbar", "aria-label": "Actions sur les fichiers" });
    const sidebar = h("nav", { class: "fx-side", "aria-label": "Accès rapide" });
    const drive = h("div", { class: "fx-drive" });
    const listHead = h("div", { class: "fx-head", role: "row" });
    const items = h("div", { class: "fx-items", role: "listbox", "aria-label": "Contenu du dossier", "aria-multiselectable": "true", tabindex: "0" });
    const empty = h("div", { class: "fx-empty" });
    const scroller = h("div", { class: "fx-scroll" }, drive, listHead, items, empty);
    const status = h("div", { class: "fx-status", role: "status" });
    const main = h("div", { class: "fx-main" }, scroller);
    ctx.body.append(toolbar, commands, h("div", { class: "fx-body" }, sidebar, main), status);

    /* ------------------------------ Données ------------------------------ */
    function listItems() {
      const loc = state.loc;
      let list;
      if (loc.kind === "trash") list = FS.trashed();
      else if (loc.kind === "search") list = FS.search(loc.q, loc.scope);
      else list = FS.children(loc.id);
      return list.slice().sort(comparator(prefs().explorerSort || { key: "name", dir: "asc" }));
    }

    const isTrash = () => state.loc.kind === "trash";
    const isFolderLoc = () => state.loc.kind === "folder";
    const currentFolderId = () => (isFolderLoc() ? state.loc.id : null);
    const canCreateHere = () => isFolderLoc() && state.loc.id !== FS.ROOT;
    const selectedIds = () => ordered.filter((n) => state.selection.has(n.id)).map((n) => n.id);

    function locTitle() {
      if (isTrash()) return "Corbeille";
      if (state.loc.kind === "search") return "Résultats de recherche";
      const node = FS.get(state.loc.id);
      return node ? node.name : "Ce PC";
    }

    function validLoc(loc) {
      if (loc.kind === "folder") return FS.alive(loc.id);
      return true;
    }

    /* ------------------------------ Navigation ------------------------------ */
    function navigate(loc, options) {
      if (!(options && options.noHistory)) {
        state.back.push(state.loc);
        state.fwd = [];
      }
      state.loc = loc;
      state.selection.clear();
      state.cursor = null;
      state.anchor = null;
      state.renaming = null;
      state.origin = null;
      if (loc.kind !== "search") search.value = "";
      render();
      items.focus({ preventScroll: true });
    }

    function goBack() {
      while (state.back.length) {
        const loc = state.back.pop();
        if (!validLoc(loc)) continue;
        state.fwd.push(state.loc);
        navigate(loc, { noHistory: true });
        return;
      }
    }

    function goForward() {
      while (state.fwd.length) {
        const loc = state.fwd.pop();
        if (!validLoc(loc)) continue;
        state.back.push(state.loc);
        navigate(loc, { noHistory: true });
        return;
      }
    }

    function goUp() {
      if (state.loc.kind === "folder" && state.loc.id !== FS.ROOT) {
        const node = FS.get(state.loc.id);
        navigate({ kind: "folder", id: node && node.parent && FS.alive(node.parent) ? node.parent : FS.ROOT });
      } else if (state.loc.kind !== "folder") {
        navigate({ kind: "folder", id: FS.ROOT });
      }
    }

    function openItem(node) {
      if (!node) return;
      if (node.type === "folder" && !isTrash()) {
        navigate({ kind: "folder", id: node.id });
        return;
      }
      openNode(node);
    }

    let searchTimer = null;
    search.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(applySearch, 180);
    });
    search.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && search.value) {
        search.value = "";
        applySearch();
        event.stopPropagation();
      }
    });
    function applySearch() {
      const q = search.value.trim();
      if (isTrash()) return;
      if (!q) {
        if (state.loc.kind === "search") {
          state.loc = state.origin || { kind: "folder", id: FS.ROOT };
          state.back.pop();
          state.origin = null;
          state.selection.clear();
          render();
        }
        return;
      }
      if (state.loc.kind !== "search") {
        state.origin = state.loc;
        state.back.push(state.loc);
        state.fwd = [];
        state.loc = { kind: "search", q: q, scope: state.origin.kind === "folder" ? state.origin.id : FS.ROOT };
      } else {
        state.loc.q = q;
      }
      state.selection.clear();
      render();
    }

    /* ------------------------------ Sélection ------------------------------ */
    function setCursor(id) {
      state.cursor = id;
      itemEls.forEach((el, key) => el.classList.toggle("is-cursor", key === id));
      const el = itemEls.get(id);
      if (el) {
        items.setAttribute("aria-activedescendant", el.id);
        el.scrollIntoView({ block: "nearest" });
      }
    }

    function refreshSelectionView() {
      itemEls.forEach((el, key) => {
        const on = state.selection.has(key);
        el.classList.toggle("is-selected", on);
        el.setAttribute("aria-selected", String(on));
      });
      renderCommands();
      renderStatus();
    }

    function selectOnly(id) {
      state.selection = new Set(id ? [id] : []);
      state.anchor = id;
      if (id) setCursor(id);
      refreshSelectionView();
    }

    function toggleSelect(id) {
      if (state.selection.has(id)) state.selection.delete(id);
      else state.selection.add(id);
      state.anchor = id;
      setCursor(id);
      refreshSelectionView();
    }

    function rangeSelect(id) {
      const from = ordered.findIndex((n) => n.id === (state.anchor || state.cursor));
      const to = ordered.findIndex((n) => n.id === id);
      if (from < 0 || to < 0) return selectOnly(id);
      const [a, b] = from < to ? [from, to] : [to, from];
      state.selection = new Set(ordered.slice(a, b + 1).map((n) => n.id));
      setCursor(id);
      refreshSelectionView();
    }

    /* ------------------------------ Actions sur les fichiers ------------------------------ */
    function alertCannotCreate() {
      DT.UI.alert({ title: "Impossible de créer ici", message: "Ouvrez d'abord un dossier (Bureau, Documents…) pour y créer un élément. « Ce PC » ne contient que les dossiers système de la simulation." });
    }

    function createItem(type) {
      const folderId = currentFolderId();
      if (!folderId || folderId === FS.ROOT) {
        alertCannotCreate();
        return;
      }
      const result = FS.createUnique(folderId, type, type === "folder" ? "Nouveau dossier" : "Nouveau document texte.txt", type === "file" ? { content: "" } : undefined);
      if (!result.ok) {
        DT.UI.alert({ title: "Création impossible", message: result.error });
        return;
      }
      state.selection = new Set([result.node.id]);
      state.anchor = result.node.id;
      render();
      setCursor(result.node.id);
      startRename(result.node.id);
    }

    function startRename(id) {
      const node = FS.get(id);
      const el = itemEls.get(id);
      if (!node || !el || isTrash()) return;
      if (node.protected) {
        DT.Notify.push({ title: "Renommage impossible", message: "« " + node.name + " » est un dossier système : il ne peut pas être renommé.", type: "warning" });
        return;
      }
      state.renaming = id;
      const nameEl = $(".fx-name", el);
      const input = h("input", { type: "text", class: "rename-input", value: node.name, "aria-label": "Nouveau nom de « " + node.name + " »", maxlength: "100", spellcheck: "false", autocomplete: "off" });
      const errorEl = h("div", { class: "rename-error", role: "alert" });
      nameEl.replaceChildren(input);
      nameEl.append(errorEl);
      input.focus();
      const dot = node.type === "file" ? node.name.lastIndexOf(".") : -1;
      input.setSelectionRange(0, dot > 0 ? dot : node.name.length);
      let finished = false;

      const finish = (commit, viaBlur) => {
        if (finished) return;
        if (!commit) {
          finished = true;
          state.renaming = null;
          render();
          items.focus({ preventScroll: true });
          return;
        }
        const value = input.value;
        if (value.trim() === node.name) {
          finished = true;
          state.renaming = null;
          render();
          items.focus({ preventScroll: true });
          return;
        }
        // « finished » est levé AVANT de modifier le système de fichiers : le rendu déclenché par l'événement
        // fs:change retire le champ de saisie du DOM, ce qui émet un « blur » ré-entrant qu'il faut ignorer.
        finished = true;
        state.renaming = null;
        const result = FS.rename(id, value);
        if (!result.ok) {
          if (viaBlur) {
            render();
            DT.Notify.push({ title: "Renommage annulé", message: result.error, type: "error" });
          } else {
            finished = false;
            state.renaming = id;
            errorEl.textContent = result.error;
            input.setAttribute("aria-invalid", "true");
            input.focus();
          }
          return;
        }
        // Si fs:change n'a pas déclenché de rendu (nom identique après normalisation), on force un rendu propre.
        if (input.isConnected) render();
        items.focus({ preventScroll: true });
      };

      input.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          finish(true, false);
        } else if (event.key === "Escape") {
          event.preventDefault();
          finish(false);
        }
      });
      input.addEventListener("input", () => {
        errorEl.textContent = "";
        input.removeAttribute("aria-invalid");
      });
      input.addEventListener("blur", () => {
        if (!finished && !rendering) finish(true, true);
      });
      ["pointerdown", "click", "dblclick"].forEach((name) => input.addEventListener(name, (event) => event.stopPropagation()));
    }

    function doCut() {
      const ids = selectedIds();
      if (!ids.length || isTrash()) return;
      FS.setClipboard("cut", ids);
      DT.Notify.push({ title: ids.length > 1 ? ids.length + " éléments coupés" : "Élément coupé", message: "Ouvrez le dossier de destination puis choisissez « Coller ».", type: "info", silent: true });
    }

    function doCopy() {
      const ids = selectedIds();
      if (!ids.length || isTrash()) return;
      FS.setClipboard("copy", ids);
      DT.Notify.push({ title: ids.length > 1 ? ids.length + " éléments copiés" : "Élément copié", message: "Ouvrez le dossier de destination puis choisissez « Coller ».", type: "info", silent: true });
    }

    function canPaste() {
      return canCreateHere() && Boolean(FS.clipboard.mode) && FS.clipboard.ids.some(FS.alive);
    }

    function doPaste(targetId) {
      const folderId = targetId || currentFolderId();
      if (!folderId || folderId === FS.ROOT) {
        alertCannotCreate();
        return;
      }
      const result = FS.paste(folderId);
      notifyErrors(result.mode === "cut" ? "Déplacement impossible" : "Copie impossible", result.errors);
    }

    function doTrash() {
      const ids = selectedIds();
      if (!ids.length || isTrash()) return;
      const result = FS.trash(ids);
      notifyErrors("Suppression impossible", result.errors);
    }

    function doRestore(ids) {
      const list = ids && ids.length ? ids : selectedIds();
      if (!list.length) return;
      FS.restore(list);
    }

    async function doDeleteForever(ids) {
      const list = ids && ids.length ? ids : selectedIds();
      if (!list.length) return;
      const ok = await DT.UI.confirm({
        title: "Supprimer définitivement ?",
        message: list.length > 1 ? "Ces " + list.length + " éléments seront supprimés définitivement de la simulation. Cette action est irréversible." : "« " + (FS.get(list[0]) || {}).name + " » sera supprimé définitivement de la simulation. Cette action est irréversible.",
        okLabel: "Supprimer définitivement",
        danger: true
      });
      if (ok) FS.deletePermanently(list);
    }

    async function doEmptyTrash() {
      const count = FS.trashed().length;
      if (!count) return;
      const ok = await DT.UI.confirm({
        title: "Vider la corbeille ?",
        message: "Les " + count + " " + plural(count, "élément", "éléments") + " de la corbeille seront supprimés définitivement de la simulation. Cette action est irréversible.",
        okLabel: "Vider la corbeille",
        danger: true
      });
      if (ok) FS.emptyTrash();
    }

    function showProperties(node) {
      if (node) DT.UI.properties(node);
    }

    function setView(view) {
      DT.Settings.set("explorerView", view);
      render();
    }

    function setSort(key, dir) {
      const current = prefs().explorerSort || { key: "name", dir: "asc" };
      DT.Settings.set("explorerSort", { key: key || current.key, dir: dir || current.dir });
      render();
    }

    /* ------------------------------ Menus contextuels ------------------------------ */
    function newMenuItems() {
      return [
        { label: "Dossier", icon: "folder-plus", action: () => createItem("folder"), disabled: !canCreateHere() },
        { label: "Document texte", icon: "file-plus", action: () => createItem("file"), disabled: !canCreateHere() }
      ];
    }

    function viewMenuItems() {
      const view = prefs().explorerView;
      const sort = prefs().explorerSort || { key: "name", dir: "asc" };
      return [
        { label: "Affichage en grille", icon: "grid", checked: view === "grid", action: () => setView("grid") },
        { label: "Affichage en liste", icon: "list", checked: view === "list", action: () => setView("list") },
        { separator: true },
        ...Object.keys(SORT_LABELS).map((key) => ({ label: "Trier par " + SORT_LABELS[key].toLowerCase(), checked: sort.key === key, action: () => setSort(key) })),
        { separator: true },
        { label: "Ordre croissant", checked: sort.dir === "asc", action: () => setSort(null, "asc") },
        { label: "Ordre décroissant", checked: sort.dir === "desc", action: () => setSort(null, "desc") }
      ];
    }

    function itemMenu(node, x, y) {
      if (!state.selection.has(node.id)) selectOnly(node.id);
      const ids = selectedIds();
      const single = ids.length === 1;
      if (isTrash()) {
        DT.UI.contextMenu(x, y, [
          { label: "Restaurer", icon: "rotate-ccw", action: () => doRestore(ids) },
          { label: "Supprimer définitivement", icon: "trash", danger: true, action: () => doDeleteForever(ids) },
          { separator: true },
          { label: "Propriétés", icon: "info", disabled: !single, action: () => showProperties(node) }
        ]);
        return;
      }
      const entries = [
        { label: node.type === "folder" ? "Ouvrir" : "Ouvrir", icon: node.type === "folder" ? "folder" : "eye", disabled: !single, action: () => openItem(node) }
      ];
      if (single && node.type === "folder") entries.push({ label: "Ouvrir dans une nouvelle fenêtre", icon: "external", action: () => DT.WM.open("explorer", { folderId: node.id }) });
      if (single && FS.isText(node)) entries.push({ label: "Modifier dans le Bloc-notes", icon: "edit", action: () => DT.Notepad.open(node.id) });
      if (state.loc.kind === "search") entries.push({ label: "Ouvrir l'emplacement du fichier", icon: "folder-move", disabled: !single, action: () => navigate({ kind: "folder", id: node.parent }) });
      entries.push(
        { separator: true },
        { label: "Couper", icon: "cut", shortcut: "Ctrl+X", action: doCut },
        { label: "Copier", icon: "copy", shortcut: "Ctrl+C", action: doCopy },
        { label: "Coller dans ce dossier", icon: "paste", shortcut: "Ctrl+V", disabled: !single || node.type !== "folder" || !FS.clipboard.mode, action: () => doPaste(node.id) },
        { separator: true },
        { label: "Renommer", icon: "edit", shortcut: "F2", disabled: !single, action: () => startRename(node.id) },
        { label: "Supprimer", icon: "trash", shortcut: "Suppr", danger: true, action: doTrash },
        { separator: true },
        { label: "Propriétés", icon: "info", disabled: !single, action: () => showProperties(node) }
      );
      DT.UI.contextMenu(x, y, entries);
    }

    function backgroundMenu(x, y) {
      if (isTrash()) {
        const any = FS.trashed().length > 0;
        DT.UI.contextMenu(x, y, [
          { label: "Vider la corbeille", icon: "trash", danger: true, disabled: !any, action: doEmptyTrash },
          { label: "Restaurer tous les éléments", icon: "rotate-ccw", disabled: !any, action: () => doRestore(FS.trashed().map((n) => n.id)) },
          { separator: true },
          { label: "Actualiser", icon: "refresh", action: () => render() }
        ]);
        return;
      }
      const entries = [
        { label: "Nouveau", icon: "plus", submenu: newMenuItems() },
        { label: "Coller", icon: "paste", shortcut: "Ctrl+V", disabled: !canPaste(), action: () => doPaste() },
        { separator: true },
        { label: "Affichage et tri", icon: "sort", submenu: viewMenuItems() },
        { label: "Actualiser", icon: "refresh", action: () => render() }
      ];
      if (isFolderLoc() && state.loc.id !== FS.ROOT) entries.push({ separator: true }, { label: "Propriétés du dossier", icon: "info", action: () => showProperties(FS.get(state.loc.id)) });
      DT.UI.contextMenu(x, y, entries);
    }

    /* ------------------------------ Rendu ------------------------------ */
    function cmd(id, icon, label, action, options) {
      const opts = options || {};
      return h("button", {
        type: "button",
        class: "fx-cmd" + (opts.danger ? " is-danger" : "") + (opts.on ? " is-on" : ""),
        "data-cmd": id,
        title: label + (opts.shortcut ? " (" + opts.shortcut + ")" : ""),
        "aria-label": label,
        "aria-pressed": opts.pressed === undefined ? null : String(opts.pressed),
        disabled: opts.disabled ? true : null,
        onClick: (event) => action(event)
      }, DT.Icons.el(icon, 17), opts.noLabel ? null : h("span", { class: "fx-cmd-label", text: label }));
    }

    function renderCommands() {
      const ids = selectedIds();
      const has = ids.length > 0;
      const one = ids.length === 1;
      const view = prefs().explorerView;
      const sep = () => h("span", { class: "fx-sep", role: "separator" });
      let buttons;
      if (isTrash()) {
        const any = FS.trashed().length > 0;
        buttons = [
          cmd("restore", "rotate-ccw", "Restaurer", () => doRestore(), { disabled: !has }),
          cmd("restore-all", "folder-move", "Tout restaurer", () => doRestore(FS.trashed().map((n) => n.id)), { disabled: !any }),
          sep(),
          cmd("delete-forever", "trash", "Supprimer définitivement", () => doDeleteForever(), { disabled: !has, danger: true }),
          cmd("empty-trash", "trash-full", "Vider la corbeille", doEmptyTrash, { disabled: !any, danger: true }),
          h("span", { class: "fx-grow" }),
          cmd("props", "info", "Propriétés", () => showProperties(FS.get(ids[0])), { disabled: !one, noLabel: true })
        ];
      } else {
        buttons = [
          cmd("new", "plus", "Nouveau", (event) => {
            const r = event.currentTarget.getBoundingClientRect();
            DT.UI.contextMenu(r.left, r.bottom + 2, newMenuItems());
          }, { disabled: !canCreateHere() }),
          sep(),
          cmd("cut", "cut", "Couper", doCut, { disabled: !has, shortcut: "Ctrl+X", noLabel: true }),
          cmd("copy", "copy", "Copier", doCopy, { disabled: !has, shortcut: "Ctrl+C", noLabel: true }),
          cmd("paste", "paste", "Coller", () => doPaste(), { disabled: !canPaste(), shortcut: "Ctrl+V" }),
          sep(),
          cmd("rename", "edit", "Renommer", () => startRename(ids[0]), { disabled: !one, shortcut: "F2" }),
          cmd("delete", "trash", "Supprimer", doTrash, { disabled: !has, shortcut: "Suppr", danger: true }),
          cmd("props", "info", "Propriétés", () => showProperties(one ? FS.get(ids[0]) : isFolderLoc() && state.loc.id !== FS.ROOT ? FS.get(state.loc.id) : null), { disabled: !one && !(isFolderLoc() && state.loc.id !== FS.ROOT), noLabel: true }),
          h("span", { class: "fx-grow" }),
          cmd("sort", "sort", "Trier", (event) => {
            const r = event.currentTarget.getBoundingClientRect();
            DT.UI.contextMenu(r.left, r.bottom + 2, viewMenuItems());
          }, { noLabel: true }),
          cmd("view-grid", "grid", "Affichage en grille", () => setView("grid"), { noLabel: true, pressed: view === "grid", on: view === "grid" }),
          cmd("view-list", "list", "Affichage en liste", () => setView("list"), { noLabel: true, pressed: view === "list", on: view === "list" })
        ];
      }
      commands.replaceChildren(...buttons);
    }

    function crumbList() {
      const root = { label: "Ce PC", loc: { kind: "folder", id: FS.ROOT } };
      if (isTrash()) return [root, { label: "Corbeille", current: true }];
      if (state.loc.kind === "search") return [root, { label: "Recherche : « " + state.loc.q + " »", current: true }];
      const chain = [];
      let cur = FS.get(state.loc.id);
      while (cur && cur.id !== FS.ROOT) {
        chain.unshift(cur);
        cur = FS.get(cur.parent);
      }
      const list = [root].concat(chain.map((n) => ({ label: n.name, loc: { kind: "folder", id: n.id }, dropId: n.id })));
      list[list.length - 1].current = true;
      return list;
    }

    function renderAddress() {
      const nodes = [];
      crumbList().forEach((crumb, index) => {
        if (index) nodes.push(DT.Icons.el("chevron-right", 12));
        const button = h("button", {
          type: "button",
          class: "fx-crumb" + (crumb.current ? " is-current" : ""),
          "aria-current": crumb.current ? "page" : null,
          "data-drop-folder": crumb.dropId || null,
          onClick: () => {
            if (!crumb.current && crumb.loc) navigate(crumb.loc);
          }
        }, crumb.label);
        nodes.push(button);
      });
      address.replaceChildren(...nodes);
    }

    function sideButton(label, tile, loc, extra) {
      const active = loc.kind === state.loc.kind && (loc.kind !== "folder" || loc.id === state.loc.id);
      const attrs = {
        type: "button",
        class: "fx-side-item" + (active ? " is-on" : ""),
        "aria-current": active ? "page" : null,
        "data-side": loc.kind === "folder" ? label : "Corbeille",
        onClick: () => navigate(loc)
      };
      if (extra && extra.dropFolder) attrs["data-drop-folder"] = extra.dropFolder;
      if (extra && extra.dropTrash) attrs["data-drop-trash"] = "1";
      return h("button", attrs, tile, h("span", { class: "fx-side-label", text: label }), extra && extra.badge ? h("span", { class: "fx-badge", text: String(extra.badge) }) : null);
    }

    function renderSidebar() {
      const entries = [sideButton("Ce PC", DT.Icons.tile("explorer", 20), { kind: "folder", id: FS.ROOT })];
      ["Bureau", "Documents", "Téléchargements", "Images", "Musique", "Vidéos"].forEach((name) => {
        const folder = FS.systemFolder(name);
        if (folder) entries.push(sideButton(name, DT.Icons.file("folder", 20), { kind: "folder", id: folder.id }, { dropFolder: folder.id }));
      });
      const count = FS.trashed().length;
      entries.push(h("span", { class: "fx-side-sep", role: "separator" }));
      entries.push(sideButton("Corbeille", DT.Icons.tile(count ? "trash-full" : "trash", 20), { kind: "trash" }, { dropTrash: true, badge: count || null }));
      sidebar.replaceChildren(...entries);
    }

    function renderDrive() {
      const show = isFolderLoc() && state.loc.id === FS.ROOT;
      drive.hidden = !show;
      if (!show) return;
      const stats = FS.stats();
      const percent = Math.min(100, (stats.bytes / stats.capacity) * 100);
      drive.replaceChildren(
        h("div", { class: "fx-drive-card" },
          DT.Icons.el("monitor", 30),
          h("div", { class: "fx-drive-info" },
            h("strong", { text: "Disque virtuel EITT (fictif)" }),
            h("div", { class: "bar", role: "progressbar", "aria-label": "Espace utilisé sur le disque virtuel", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round(percent)) }, h("div", { class: "bar-fill", style: { width: Math.max(1, percent) + "%" } })),
            h("span", { class: "muted", text: formatSize(stats.capacity - stats.bytes) + " disponibles sur " + formatSize(stats.capacity) })))
      );
    }

    function dateOrPlace(node) {
      if (isTrash()) return node.trashed ? node.trashed.fromPath || "—" : "—";
      if (state.loc.kind === "search") return FS.displayPath(node.parent);
      return formatDate(node.modified);
    }

    function buildItem(node, view) {
      const isFolder = node.type === "folder";
      const dropFolder = isFolder && !isTrash() ? node.id : null;
      const common = {
        id: "fx-" + ctx.win.id + "-" + node.id,
        role: "option",
        "aria-selected": String(state.selection.has(node.id)),
        "data-id": node.id,
        "data-name": node.name,
        "data-kind": isFolder ? "folder" : FS.kindOf(node),
        "data-drop-folder": dropFolder
      };
      const cut = FS.clipboard.mode === "cut" && FS.clipboard.ids.includes(node.id);
      const cls = (view === "list" ? "fx-row" : "fx-item") + (state.selection.has(node.id) ? " is-selected" : "") + (cut ? " is-cut" : "") + (state.cursor === node.id ? " is-cursor" : "");
      if (view === "list") {
        return h("div", Object.assign({ class: cls }, common),
          h("span", { class: "fx-cell fx-c-name" }, kindIcon(node, 20), h("span", { class: "fx-name", text: node.name })),
          h("span", { class: "fx-cell fx-c-date", text: dateOrPlace(node) }),
          h("span", { class: "fx-cell fx-c-type", text: FS.typeLabel(node) }),
          h("span", { class: "fx-cell fx-c-size", text: isFolder ? "" : formatSize(node.size || 0) }));
      }
      let thumb = null;
      if (!isFolder && FS.kindOf(node) === "image" && DT.Art && DT.Art.thumb) thumb = DT.Art.thumb(node);
      return h("div", Object.assign({ class: cls }, common),
        h("span", { class: "fx-icon" }, thumb || kindIcon(node, 48)),
        h("span", { class: "fx-name", text: node.name }),
        state.loc.kind === "search" ? h("span", { class: "fx-sub muted", text: FS.displayPath(node.parent) }) : null);
    }

    function renderHead(view) {
      if (view !== "list") {
        listHead.hidden = true;
        listHead.replaceChildren();
        return;
      }
      listHead.hidden = false;
      const sort = prefs().explorerSort || { key: "name", dir: "asc" };
      const col = (key, label, cls) => h("button", {
        type: "button",
        class: "fx-hcell " + cls,
        "aria-sort": sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none",
        onClick: () => setSort(key, sort.key === key ? (sort.dir === "asc" ? "desc" : "asc") : "asc")
      }, label, sort.key === key ? DT.Icons.el(sort.dir === "asc" ? "chevron-up" : "chevron-down", 12) : null);
      const place = isTrash() ? "Emplacement d'origine" : state.loc.kind === "search" ? "Emplacement" : "Modifié le";
      listHead.replaceChildren(col("name", "Nom", "fx-c-name"), h("span", { class: "fx-hcell fx-c-date", text: place }), col("type", "Type", "fx-c-type"), col("size", "Taille", "fx-c-size"));
    }

    function emptyMessage() {
      if (isTrash()) return ["La corbeille est vide.", "Les éléments supprimés apparaissent ici : vous pouvez les restaurer ou les supprimer définitivement."];
      if (state.loc.kind === "search") return ["Aucun résultat pour « " + state.loc.q + " ».", "Essayez un autre mot ou une autre orthographe."];
      if (state.loc.id === FS.ROOT) return ["Aucun dossier.", ""];
      return ["Ce dossier est vide.", "Faites un clic droit puis « Nouveau » pour créer un dossier ou un document."];
    }

    function renderStatus() {
      const total = ordered.length;
      const ids = selectedIds();
      const parts = [total + " " + plural(total, "élément", "éléments")];
      if (ids.length) {
        const bytes = ids.reduce((sum, id) => sum + FS.sizeOf(FS.get(id)), 0);
        parts.push(ids.length + " " + plural(ids.length, "sélectionné", "sélectionnés") + (bytes ? " — " + formatSize(bytes) : ""));
      }
      if (FS.clipboard.mode && FS.clipboard.ids.length) {
        const n = FS.clipboard.ids.filter(FS.alive).length;
        if (n) parts.push(n + " " + plural(n, "élément", "éléments") + (FS.clipboard.mode === "cut" ? " à déplacer" : " copié" + (n > 1 ? "s" : "")));
      }
      if (isFolderLoc() && state.loc.id !== FS.ROOT) parts.push(FS.displayPath(state.loc.id));
      status.textContent = parts.join("  •  ");
    }

    function render() {
      if (!validLoc(state.loc)) state.loc = { kind: "folder", id: FS.ROOT };
      if (state.loc.kind === "folder" && !FS.alive(state.loc.id)) state.loc = { kind: "folder", id: FS.ROOT };
      ordered = listItems();
      const ids = new Set(ordered.map((n) => n.id));
      state.selection = new Set(Array.from(state.selection).filter((id) => ids.has(id)));
      if (state.cursor && !ids.has(state.cursor)) state.cursor = null;
      const view = state.loc.kind === "search" ? "list" : prefs().explorerView === "list" ? "list" : "grid";
      ctx.setTitle(locTitle());
      items.className = "fx-items " + (view === "list" ? "is-list" : "is-grid");
      items.toggleAttribute("data-drop-folder", false);
      if (isFolderLoc() && state.loc.id !== FS.ROOT) items.setAttribute("data-drop-folder", state.loc.id);
      else items.removeAttribute("data-drop-folder");
      itemEls.clear();
      const nodes = ordered.map((node) => {
        const el = buildItem(node, view);
        itemEls.set(node.id, el);
        return el;
      });
      rendering = true; // le retrait d'un champ de renommage focalisé émet un « blur » qu'il faut ignorer
      try {
        items.replaceChildren(...nodes);
      } finally {
        rendering = false;
      }
      if (state.cursor && itemEls.has(state.cursor)) items.setAttribute("aria-activedescendant", itemEls.get(state.cursor).id);
      else items.removeAttribute("aria-activedescendant");
      renderHead(view);
      renderDrive();
      const [title, hint] = emptyMessage();
      empty.hidden = ordered.length > 0;
      empty.replaceChildren(h("p", { class: "fx-empty-title", text: title }), hint ? h("p", { class: "muted", text: hint }) : null);
      btnBack.disabled = !state.back.some(validLoc);
      btnFwd.disabled = !state.fwd.some(validLoc);
      btnUp.disabled = isFolderLoc() && state.loc.id === FS.ROOT;
      search.disabled = isTrash();
      search.placeholder = isTrash() ? "Recherche indisponible" : "Rechercher dans " + (isFolderLoc() ? locTitle() : "Ce PC");
      renderAddress();
      renderSidebar();
      renderCommands();
      renderStatus();
      if (state.renaming && itemEls.has(state.renaming)) {
        const id = state.renaming;
        state.renaming = null;
        startRename(id);
      }
    }

    /* ------------------------------ Événements ------------------------------ */
    function itemFromEvent(event) {
      const el = event.target.closest("[data-id]");
      return el && items.contains(el) ? FS.get(el.getAttribute("data-id")) : null;
    }

    items.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const node = itemFromEvent(event);
      if (!node) return;
      if (event.target.closest(".rename-input")) return;
      if (event.shiftKey) rangeSelect(node.id);
      else if (event.ctrlKey || event.metaKey) toggleSelect(node.id);
      else if (!state.selection.has(node.id)) selectOnly(node.id);
      else setCursor(node.id);
      if (!isTrash() && !state.renaming && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
        const ids = selectedIds();
        track(event, {
          ids: ids,
          label: node.name,
          icon: () => kindIcon(node, 24)
        });
      }
    });

    items.addEventListener("click", (event) => {
      if (DT.Dnd.wasDrag()) return;
      const node = itemFromEvent(event);
      if (!node) {
        if (event.target === items || event.target === scroller) selectOnly(null);
        return;
      }
      if (event.shiftKey || event.ctrlKey || event.metaKey) return;
      if (state.selection.size > 1 && !event.target.closest(".rename-input")) selectOnly(node.id);
    });

    items.addEventListener("dblclick", (event) => {
      const node = itemFromEvent(event);
      if (node && !event.target.closest(".rename-input")) openItem(node);
    });

    function onContext(event) {
      if (event.target.closest(".rename-input")) return;
      event.preventDefault();
      const node = itemFromEvent(event);
      if (node) itemMenu(node, event.clientX, event.clientY);
      else {
        selectOnly(null);
        backgroundMenu(event.clientX, event.clientY);
      }
    }
    scroller.addEventListener("contextmenu", onContext);
    DT.u.onLongPress(scroller, (point) => onContext({ clientX: point.clientX, clientY: point.clientY, target: point.target, preventDefault() {} }));
    scroller.addEventListener("pointerdown", (event) => {
      if (event.button === 0 && (event.target === scroller || event.target === empty || event.target.closest(".fx-empty"))) selectOnly(null);
    });

    function gridColumns() {
      const first = ordered.length ? itemEls.get(ordered[0].id) : null;
      if (!first) return 1;
      let columns = 0;
      for (const node of ordered) {
        const el = itemEls.get(node.id);
        if (el.offsetTop === first.offsetTop) columns += 1;
        else break;
      }
      return Math.max(1, columns);
    }

    function moveCursor(delta, event) {
      if (!ordered.length) return;
      const current = ordered.findIndex((n) => n.id === state.cursor);
      const next = current < 0 ? (delta > 0 ? 0 : ordered.length - 1) : Math.min(ordered.length - 1, Math.max(0, current + delta));
      const id = ordered[next].id;
      if (event.shiftKey) rangeSelect(id);
      else if (event.ctrlKey) setCursor(id);
      else selectOnly(id);
    }

    items.addEventListener("keydown", (event) => {
      if (state.renaming) return;
      const view = items.classList.contains("is-list") ? "list" : "grid";
      const mod = event.ctrlKey || event.metaKey;
      const cursorNode = FS.get(state.cursor) || (selectedIds().length === 1 ? FS.get(selectedIds()[0]) : null);
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          moveCursor(view === "grid" ? gridColumns() : 1, event);
          break;
        case "ArrowUp":
          event.preventDefault();
          moveCursor(view === "grid" ? -gridColumns() : -1, event);
          break;
        case "ArrowRight":
          if (event.altKey) {
            event.preventDefault();
            goForward();
          } else if (view === "grid") {
            event.preventDefault();
            moveCursor(1, event);
          }
          break;
        case "ArrowLeft":
          if (event.altKey) {
            event.preventDefault();
            goBack();
          } else if (view === "grid") {
            event.preventDefault();
            moveCursor(-1, event);
          }
          break;
        case "Home":
          event.preventDefault();
          if (ordered.length) selectOnly(ordered[0].id);
          break;
        case "End":
          event.preventDefault();
          if (ordered.length) selectOnly(ordered[ordered.length - 1].id);
          break;
        case "Enter":
          event.preventDefault();
          if (cursorNode) openItem(cursorNode);
          break;
        case " ":
          event.preventDefault();
          if (state.cursor) (mod ? toggleSelect : selectOnly)(state.cursor);
          break;
        case "F2":
          event.preventDefault();
          if (selectedIds().length === 1) startRename(selectedIds()[0]);
          break;
        case "Delete":
          event.preventDefault();
          if (isTrash()) doDeleteForever();
          else doTrash();
          break;
        case "Backspace":
          event.preventDefault();
          goUp();
          break;
        case "Escape":
          selectOnly(null);
          break;
        case "ContextMenu": {
          event.preventDefault();
          const el = itemEls.get(state.cursor);
          const r = (el || items).getBoundingClientRect();
          if (cursorNode) itemMenu(cursorNode, r.left + 24, r.top + 24);
          else backgroundMenu(r.left + 24, r.top + 24);
          break;
        }
        default:
          if (mod && event.key.toLowerCase() === "a") {
            event.preventDefault();
            state.selection = new Set(ordered.map((n) => n.id));
            refreshSelectionView();
          } else if (mod && event.key.toLowerCase() === "c") {
            event.preventDefault();
            doCopy();
          } else if (mod && event.key.toLowerCase() === "x") {
            event.preventDefault();
            doCut();
          } else if (mod && event.key.toLowerCase() === "v") {
            event.preventDefault();
            doPaste();
          } else if (event.shiftKey && event.key === "F10") {
            event.preventDefault();
            const r = items.getBoundingClientRect();
            backgroundMenu(r.left + 24, r.top + 24);
          }
      }
    });

    ctx.body.addEventListener("keydown", (event) => {
      if (event.target.closest("input")) return;
      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        goBack();
      } else if (event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        goForward();
      } else if (event.key === "Backspace" && event.target === ctx.body) {
        goUp();
      }
    });

    const offs = [
      DT.bus.on("fs:change", () => render()),
      DT.bus.on("fs:clipboard", () => render())
    ];
    ctx.onClose(() => {
      offs.forEach((off) => off());
      window.clearTimeout(searchTimer);
    });
    ctx.onParams((p) => {
      if (p && p.loc === "trash") navigate({ kind: "trash" });
      else if (p && p.folderId && FS.alive(p.folderId)) navigate({ kind: "folder", id: p.folderId });
    });

    render();
    items.focus({ preventScroll: true });
  }

  DT.WM.registerApp({
    id: "explorer",
    title: "Ce PC",
    tile: "explorer",
    size: { w: 860, h: 540 },
    minSize: { w: 360, h: 300 },
    singleton: false,
    keywords: ["fichiers", "dossiers", "explorateur", "documents", "corbeille"],
    create: createExplorer
  });
}());
