/*
 * EITT OS — bureau : icônes (déplaçables, enregistrées), barre des tâches, menu Démarrer,
 * horloge à la seconde, zone de notification, menus contextuels du bureau.
 */
(function () {
  "use strict";
  const DT = window.DT;
  const FS = DT.FS;
  const { h, $, clockStrings, normalize } = DT.u;

  const PAD = 8;
  const MENU_TITLES = { explorer: "Explorateur de fichiers", settings: "Paramètres", dashboard: "État du PC", downloads: "Téléchargements", taskmanager: "Gestionnaire des tâches" };
  const START_ORDER = ["explorer", "browser", "taskmanager", "notepad", "settings", "terminal", "downloads", "dashboard"];
  const HIDDEN_FROM_MENU = ["viewer"];

  const settings = () => DT.Store.state.settings;
  const appTitle = (id) => MENU_TITLES[id] || (DT.WM.getApp(id) || {}).title || id;

  let desktopEl;
  let layer;
  let taskbar;
  let startMenu;
  let startBtn;
  let clockEl;
  let dateEl;
  let bellBtn;
  let bellBadge;
  let netBtn;
  let selectedKey = null;
  let startOpen = false;
  let renderPending = false;

  /* ============================================================ Ouverture d'applications */
  function openApp(appId, params) {
    closeStart();
    if (appId === "trash") return DT.Files.openTrash();
    return DT.WM.open(appId, params);
  }

  function launchables() {
    const apps = DT.WM.apps().filter((a) => !HIDDEN_FROM_MENU.includes(a.id));
    const list = apps.map((a) => ({ id: a.id, title: appTitle(a.id), tile: a.tile || a.id, keywords: a.keywords || [] }));
    list.push({ id: "trash", title: "Corbeille", tile: FS.trashed().length ? "trash-full" : "trash", keywords: ["supprimés", "restaurer", "poubelle"] });
    list.sort((a, b) => {
      const ia = START_ORDER.indexOf(a.id);
      const ib = START_ORDER.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.title.localeCompare(b.title, "fr");
    });
    return list;
  }

  /* ============================================================ Icônes du bureau */
  function entries() {
    const s = settings();
    const list = [];
    DT.Settings.systemIcons.forEach((def) => {
      if (s.shownIcons.includes(def.id)) list.push({ key: "app:" + def.id, kind: "app", def: def, label: def.label });
    });
    if (s.showDesktopFiles) {
      const bureau = FS.systemFolder("Bureau");
      if (bureau) {
        FS.children(bureau.id)
          .sort((a, b) => (a.type === b.type ? FS.byName(a, b) : a.type === "folder" ? -1 : 1))
          .forEach((node) => list.push({ key: "node:" + node.id, kind: "node", node: node, label: node.name }));
      }
    }
    return list;
  }

  function gridSize() {
    const cell = DT.Settings.cell();
    const rect = layer.getBoundingClientRect();
    return {
      cellW: cell.w,
      cellH: cell.h,
      cols: Math.max(1, Math.floor((rect.width - PAD * 2) / cell.w)),
      rows: Math.max(1, Math.floor((rect.height - PAD * 2) / cell.h))
    };
  }

  /** Attribue une cellule libre aux icônes qui n'ont pas encore de position enregistrée. */
  function layoutPositions(list, grid) {
    const s = settings();
    const positions = s.iconPositions || (s.iconPositions = {});
    const keys = new Set(list.map((e) => e.key));
    let changed = false;
    Object.keys(positions).forEach((key) => {
      if (key.startsWith("node:") && !FS.get(key.slice(5))) {
        delete positions[key];
        changed = true;
      }
    });
    const taken = new Set();
    const valid = (p) => p && Number.isInteger(p.c) && Number.isInteger(p.r) && p.c >= 0 && p.r >= 0 && p.c < grid.cols && p.r < grid.rows;
    list.forEach((e) => {
      const p = positions[e.key];
      if (valid(p) && !taken.has(p.c + ":" + p.r)) taken.add(p.c + ":" + p.r);
      else e.needsSlot = true;
    });
    const result = new Map();
    list.forEach((e) => {
      if (!e.needsSlot) result.set(e.key, positions[e.key]);
    });
    let c = 0;
    let r = 0;
    list.forEach((e) => {
      if (!e.needsSlot) return;
      while (taken.has(c + ":" + r) && c < grid.cols) {
        r += 1;
        if (r >= grid.rows) {
          r = 0;
          c += 1;
        }
      }
      const pos = { c: Math.min(c, grid.cols - 1), r: Math.min(r, grid.rows - 1) };
      taken.add(pos.c + ":" + pos.r);
      result.set(e.key, pos);
      if (!positions[e.key] || positions[e.key].c !== pos.c || positions[e.key].r !== pos.r) {
        positions[e.key] = pos;
        changed = true;
      }
    });
    if (changed) DT.Store.touch();
    void keys;
    return result;
  }

  function iconTile(entry) {
    if (entry.kind === "app") {
      const tileId = entry.def.id === "trash" && FS.trashed().length ? "trash-full" : entry.def.tile;
      return DT.Icons.tile(tileId, DT.Settings.cell().icon);
    }
    return DT.Icons.file(FS.kindOf(entry.node), DT.Settings.cell().icon);
  }

  function renderIcons() {
    renderPending = false;
    if (!layer) return;
    const list = entries();
    const grid = gridSize();
    const positions = layoutPositions(list, grid);
    const nodes = list.map((entry) => {
      const pos = positions.get(entry.key);
      const attrs = {
        type: "button",
        class: "dicon" + (selectedKey === entry.key ? " is-selected" : ""),
        "data-key": entry.key,
        "data-label": entry.label,
        "aria-label": entry.label,
        style: { left: PAD + pos.c * grid.cellW + "px", top: PAD + pos.r * grid.cellH + "px", width: grid.cellW + "px", height: grid.cellH + "px" }
      };
      if (entry.kind === "app" && entry.def.id === "trash") attrs["data-drop-trash"] = "1";
      if (entry.kind === "node" && entry.node.type === "folder") attrs["data-drop-folder"] = entry.node.id;
      const unread = entry.kind === "app" && DT.badges ? DT.badges[entry.def.id] || 0 : 0;
      if (unread > 0) attrs.class += " has-badge";
      const el = h("button", attrs, h("span", { class: "dicon-art" }, iconTile(entry), unread > 0 ? h("span", { class: "dicon-badge", "data-badge": entry.def.id, "aria-hidden": "true", text: String(unread) }) : null), h("span", { class: "dicon-label", text: entry.label }));
      if (unread > 0) el.setAttribute("aria-label", entry.label + " — " + unread + " message" + (unread > 1 ? "s" : "") + " non lu" + (unread > 1 ? "s" : ""));
      wireIcon(el, entry, grid);
      return el;
    });
    layer.replaceChildren(...nodes);
  }

  function scheduleIcons() {
    if (renderPending) return;
    renderPending = true;
    window.requestAnimationFrame(renderIcons);
  }

  function select(key) {
    selectedKey = key;
    layer.querySelectorAll(".dicon").forEach((el) => el.classList.toggle("is-selected", el.dataset.key === key));
  }

  function openEntry(entry) {
    if (entry.kind === "app") openApp(entry.def.appId, entry.def.params);
    else DT.Files.open(entry.node.id);
  }

  async function renameNode(node) {
    const value = await DT.UI.prompt({
      title: "Renommer",
      message: "Nouveau nom de « " + node.name + " » :",
      value: node.name,
      selectName: true,
      validate: (text) => FS.validateName(text) || (text.trim() !== node.name && FS.nameTaken(node.parent, text, node.id) ? "Un élément portant ce nom existe déjà dans ce dossier." : null)
    });
    if (value !== null && value.trim() !== node.name) {
      const result = FS.rename(node.id, value);
      if (!result.ok) DT.Notify.push({ title: "Renommage impossible", message: result.error, type: "error" });
    }
  }

  function iconMenu(entry, x, y) {
    select(entry.key);
    if (entry.kind === "app") {
      DT.UI.contextMenu(x, y, [
        { label: "Ouvrir", icon: "eye", action: () => openEntry(entry) },
        { separator: true },
        { label: "Masquer cette icône du bureau", icon: "x", action: () => DT.Settings.set("shownIcons", settings().shownIcons.filter((id) => id !== entry.def.id)) },
        { label: "Personnaliser les icônes…", icon: "settings", action: () => openApp("settings", { panel: "appearance" }) }
      ]);
      return;
    }
    const node = entry.node;
    DT.UI.contextMenu(x, y, [
      { label: "Ouvrir", icon: "eye", action: () => openEntry(entry) },
      { separator: true },
      { label: "Couper", icon: "cut", action: () => FS.setClipboard("cut", [node.id]) },
      { label: "Copier", icon: "copy", action: () => FS.setClipboard("copy", [node.id]) },
      { label: "Renommer", icon: "edit", action: () => renameNode(node) },
      { label: "Supprimer", icon: "trash", danger: true, action: () => {
        const result = FS.trash([node.id]);
        if (result.errors.length) DT.Notify.push({ title: "Suppression impossible", message: result.errors[0], type: "error" });
      } },
      { separator: true },
      { label: "Propriétés", icon: "info", action: () => DT.UI.properties(node) }
    ]);
  }

  function wireIcon(el, entry, grid) {
    let dragged = false;
    el.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      select(entry.key);
      const start = { x: event.clientX, y: event.clientY };
      const origin = { left: el.offsetLeft, top: el.offsetTop };
      dragged = false;
      const move = (ev) => {
        if (!dragged && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6) return;
        if (!dragged) {
          dragged = true;
          el.classList.add("is-dragging");
          document.body.classList.add("is-dragging");
        }
        el.style.left = origin.left + ev.clientX - start.x + "px";
        el.style.top = origin.top + ev.clientY - start.y + "px";
      };
      const end = (ev) => {
        window.removeEventListener("pointermove", move, true);
        window.removeEventListener("pointerup", end, true);
        window.removeEventListener("pointercancel", end, true);
        if (!dragged) return;
        el.classList.remove("is-dragging");
        document.body.classList.remove("is-dragging");
        let handled = false;
        if (ev.type === "pointerup" && entry.kind === "node") handled = DT.Dnd.dropAt(ev.clientX, ev.clientY, [entry.node.id], ev.ctrlKey);
        if (!handled && ev.type === "pointerup") {
          const left = el.offsetLeft - PAD;
          const top = el.offsetTop - PAD;
          const target = nearestFreeCell(entry.key, Math.round(left / grid.cellW), Math.round(top / grid.cellH), grid);
          settings().iconPositions[entry.key] = target;
          DT.Store.touch();
        }
        window.setTimeout(() => {
          dragged = false;
        }, 60);
        renderIcons();
      };
      window.addEventListener("pointermove", move, true);
      window.addEventListener("pointerup", end, true);
      window.addEventListener("pointercancel", end, true);
    });

    el.addEventListener("click", (event) => {
      if (dragged) return;
      event.stopPropagation();
      const touch = DT.u.isCoarsePointer();
      if (touch && selectedKey === entry.key && el.dataset.tapped) {
        delete el.dataset.tapped;
        openEntry(entry);
        return;
      }
      el.dataset.tapped = "1";
      window.setTimeout(() => delete el.dataset.tapped, 700);
      select(entry.key);
      closeStart();
    });
    el.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      if (!dragged) openEntry(entry);
    });
    el.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      iconMenu(entry, event.clientX, event.clientY);
    });
    DT.u.onLongPress(el, (point) => iconMenu(entry, point.clientX, point.clientY));
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        openEntry(entry);
      } else if (event.key === "F2" && entry.kind === "node") {
        event.preventDefault();
        renameNode(entry.node);
      } else if (event.key === "Delete" && entry.kind === "node") {
        event.preventDefault();
        FS.trash([entry.node.id]);
      } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
        event.preventDefault();
        const r = el.getBoundingClientRect();
        iconMenu(entry, r.left + r.width / 2, r.top + r.height / 2);
      } else if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) {
        event.preventDefault();
        const all = Array.from(layer.querySelectorAll(".dicon"));
        const index = all.indexOf(el);
        const next = all[index + (event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1)];
        if (next) {
          next.focus();
          select(next.dataset.key);
        }
      }
    });
  }

  function nearestFreeCell(key, c, r, grid) {
    c = Math.max(0, Math.min(grid.cols - 1, c));
    r = Math.max(0, Math.min(grid.rows - 1, r));
    const positions = settings().iconPositions;
    const taken = new Set(Object.keys(positions).filter((k) => k !== key && layer.querySelector('[data-key="' + k + '"]')).map((k) => positions[k].c + ":" + positions[k].r));
    if (!taken.has(c + ":" + r)) return { c: c, r: r };
    for (let radius = 1; radius < Math.max(grid.cols, grid.rows) + 1; radius += 1) {
      for (let dc = -radius; dc <= radius; dc += 1) {
        for (let dr = -radius; dr <= radius; dr += 1) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue;
          const nc = c + dc;
          const nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= grid.cols || nr >= grid.rows) continue;
          if (!taken.has(nc + ":" + nr)) return { c: nc, r: nr };
        }
      }
    }
    return { c: c, r: r };
  }

  /* ---------- Menu contextuel du fond de bureau ---------- */
  async function createOnDesktop(type) {
    const bureau = FS.systemFolder("Bureau");
    if (!bureau) return;
    const created = FS.createUnique(bureau.id, type, type === "folder" ? "Nouveau dossier" : "Nouveau document texte.txt", type === "file" ? { content: "" } : undefined);
    if (!created.ok) {
      DT.UI.alert({ title: "Création impossible", message: created.error });
      return;
    }
    selectedKey = "node:" + created.node.id;
    renderIcons();
    await renameNode(created.node);
  }

  function desktopMenu(x, y) {
    const bureau = FS.systemFolder("Bureau");
    const size = settings().iconSize;
    DT.UI.contextMenu(x, y, [
      { label: "Nouveau", icon: "plus", submenu: [
        { label: "Dossier", icon: "folder-plus", action: () => createOnDesktop("folder") },
        { label: "Document texte", icon: "file-plus", action: () => createOnDesktop("file") }
      ] },
      { label: "Coller", icon: "paste", disabled: !FS.clipboard.mode || !bureau, action: () => {
        const result = FS.paste(bureau.id);
        if (result.errors && result.errors.length) DT.Notify.push({ title: "Collage impossible", message: result.errors[0], type: "error" });
      } },
      { separator: true },
      { label: "Affichage", icon: "layout", submenu: [
        { label: "Petites icônes", checked: size === "small", action: () => DT.Settings.set("iconSize", "small") },
        { label: "Icônes moyennes", checked: size === "medium", action: () => DT.Settings.set("iconSize", "medium") },
        { label: "Grandes icônes", checked: size === "large", action: () => DT.Settings.set("iconSize", "large") },
        { separator: true },
        { label: "Afficher les fichiers du Bureau", checked: settings().showDesktopFiles, action: () => DT.Settings.set("showDesktopFiles", !settings().showDesktopFiles) }
      ] },
      { label: "Réorganiser les icônes", icon: "grid", action: () => {
        settings().iconPositions = {};
        DT.Store.touch();
        renderIcons();
      } },
      { label: "Actualiser", icon: "refresh", action: () => renderIcons() },
      { separator: true },
      { label: "Personnaliser le fond d'écran", icon: "image", action: () => openApp("settings", { panel: "wallpaper" }) },
      { label: "Paramètres d'affichage", icon: "settings", action: () => openApp("settings", { panel: "appearance" }) }
    ]);
  }

  /* ============================================================ Barre des tâches */
  function appButtonModel() {
    const pinned = settings().pinned || [];
    const ids = pinned.slice();
    DT.WM.list().forEach((w) => {
      if (!ids.includes(w.appId)) ids.push(w.appId);
    });
    // Une application qui a un message non lu (pastille) reste visible dans la barre, même si elle n'est pas épinglée.
    Object.keys(DT.badges || {}).forEach((id) => { if (DT.badges[id] > 0 && !ids.includes(id)) ids.push(id); });
    return ids.filter((id) => DT.WM.getApp(id)).map((id) => ({ id: id, pinned: pinned.includes(id), wins: DT.WM.byApp(id).filter((w) => !w.closing) }));
  }

  function togglePin(appId) {
    const pinned = (settings().pinned || []).slice();
    const index = pinned.indexOf(appId);
    if (index >= 0) pinned.splice(index, 1);
    else pinned.push(appId);
    DT.Settings.set("pinned", pinned);
    renderTaskbarApps();
  }

  function taskbarClick(model) {
    const wins = model.wins;
    const active = DT.WM.active();
    if (!wins.length) return openApp(model.id);
    if (wins.length === 1) {
      const win = wins[0];
      if (win.minimized) DT.WM.restore(win), DT.WM.focus(win);
      else if (active === win) DT.WM.minimize(win);
      else DT.WM.focus(win);
      return null;
    }
    const anyHidden = wins.some((w) => w.minimized);
    if (anyHidden || !wins.includes(active)) {
      wins.forEach((w) => DT.WM.restore(w));
      DT.WM.focus(wins[wins.length - 1]);
    } else {
      const index = wins.indexOf(active);
      DT.WM.focus(wins[(index + 1) % wins.length]);
    }
    return null;
  }

  function taskbarMenu(model, x, y) {
    const items = [{ label: appTitle(model.id), icon: "layout", disabled: true }, { separator: true }];
    model.wins.forEach((w) => items.push({ label: w.title.slice(0, 40), icon: "square", action: () => { DT.WM.restore(w); DT.WM.focus(w); } }));
    if (model.wins.length) items.push({ separator: true });
    items.push({ label: model.pinned ? "Détacher de la barre des tâches" : "Épingler à la barre des tâches", icon: "star", action: () => togglePin(model.id) });
    if (!model.wins.length || model.wins.length) items.push({ label: model.wins.length > 1 ? "Fermer toutes les fenêtres" : "Fermer la fenêtre", icon: "x", danger: true, disabled: !model.wins.length, action: async () => {
      for (const w of model.wins) await DT.WM.close(w);
    } });
    DT.UI.contextMenu(x, y, items);
  }

  function renderTaskbarApps() {
    const holder = $("#taskbar-apps", taskbar);
    if (!holder) return;
    const active = DT.WM.active();
    holder.replaceChildren(...appButtonModel().map((model) => {
      const running = model.wins.length > 0;
      const isActive = running && model.wins.includes(active) && !active.minimized;
      const app = DT.WM.getApp(model.id);
      const label = appTitle(model.id);
      const button = h("button", {
        type: "button",
        class: "tb-app" + (running ? " is-running" : "") + (isActive ? " is-active" : ""),
        "data-app": model.id,
        title: label + (model.wins.length > 1 ? " (" + model.wins.length + " fenêtres)" : ""),
        "aria-label": label + (running ? " — " + model.wins.length + (model.wins.length > 1 ? " fenêtres ouvertes" : " fenêtre ouverte") : " — lancer"),
        "aria-pressed": running ? String(isActive) : null,
        onClick: () => taskbarClick(model)
      }, DT.Icons.tile(app.tile || model.id, 26), model.wins.length > 1 ? h("span", { class: "tb-count", text: String(model.wins.length) }) : null,
      DT.badges && DT.badges[model.id] ? h("span", { class: "tb-app-badge", "data-badge": model.id, text: String(DT.badges[model.id]) }) : null);
      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        taskbarMenu(model, event.clientX, event.clientY);
      });
      DT.u.onLongPress(button, (point) => taskbarMenu(model, point.clientX, point.clientY));
      return button;
    }));
  }

  function renderTray() {
    const online = DT.Net.online;
    netBtn.replaceChildren(DT.Icons.el(online ? "wifi" : "wifi-off", 18));
    netBtn.title = online ? "Réseau : connecté selon le navigateur" : "Réseau : hors ligne selon le navigateur";
    netBtn.setAttribute("aria-label", netBtn.title);
    netBtn.classList.toggle("is-offline", !online);
    const unread = DT.Notify.unread();
    bellBadge.textContent = unread > 9 ? "9+" : String(unread);
    bellBadge.hidden = unread === 0;
    bellBtn.setAttribute("aria-label", unread ? "Notifications : " + unread + " non lue" + (unread > 1 ? "s" : "") : "Notifications");
  }

  function networkMenu() {
    const r = netBtn.getBoundingClientRect();
    const online = DT.Net.online;
    DT.UI.contextMenu(r.left - 150, r.top - 8, [
      { label: online ? "Connecté (selon le navigateur)" : "Hors ligne (selon le navigateur)", icon: online ? "wifi" : "wifi-off", disabled: true },
      { label: "Cette indication ne garantit pas l'accès à Internet.", disabled: true },
      { separator: true },
      { label: "Voir le détail dans le Gestionnaire des tâches", icon: "activity", action: () => openApp("taskmanager") },
      { label: "Ouvrir l'état du PC", icon: "layout", action: () => openApp("dashboard") }
    ]);
  }

  function tickClock(now) {
    const text = clockStrings(now || new Date());
    clockEl.textContent = text.time;
    dateEl.textContent = (now || new Date()).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
    clockEl.parentElement.title = text.date + " — " + text.time;
    clockEl.parentElement.setAttribute("datetime", (now || new Date()).toISOString());
  }

  /* ============================================================ Menu Démarrer */
  function isStartOpen() {
    return startOpen;
  }

  function closeStart() {
    if (!startOpen) return;
    startOpen = false;
    startMenu.classList.remove("open");
    startMenu.hidden = true;
    startBtn.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", outsideStart, true);
    document.removeEventListener("keydown", startKeys, true);
  }

  function outsideStart(event) {
    if (startMenu.contains(event.target) || startBtn.contains(event.target)) return;
    if (event.target.closest(".ctx-menu, .dlg-backdrop")) return;
    closeStart();
  }

  function startKeys(event) {
    if (event.key === "Escape" && !DT.UI.hasOpenMenu()) {
      event.preventDefault();
      closeStart();
      startBtn.focus();
    }
  }

  function startItem(item, options) {
    const button = h("button", { type: "button", class: "start-app" + (options && options.grid ? " is-grid" : ""), "data-app": item.id, role: "listitem", onClick: () => (item.action ? item.action() : openApp(item.id)) },
      DT.Icons.tile(item.tile, options && options.grid ? 36 : 28), h("span", { class: "start-app-label", text: item.title }));
    if (!item.action && item.id !== "trash") {
      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        const pinned = (settings().pinned || []).includes(item.id);
        DT.UI.contextMenu(event.clientX, event.clientY, [
          { label: "Ouvrir", icon: "eye", action: () => openApp(item.id) },
          { label: pinned ? "Détacher de la barre des tâches" : "Épingler à la barre des tâches", icon: "star", action: () => togglePin(item.id) }
        ]);
      });
    }
    return button;
  }

  async function powerDialog() {
    closeStart();
    const choice = await DT.UI.choose({
      title: "Alimentation",
      message: "Ces actions ne concernent que la simulation EITT OS : elles n'arrêtent, ne redémarrent et ne mettent jamais en veille votre véritable ordinateur.",
      dismiss: "cancel",
      buttons: [
        { label: "Annuler", value: "cancel" },
        { label: "Mettre en veille", value: "sleep" },
        { label: "Redémarrer", value: "restart" },
        { label: "Arrêter", value: "shutdown", primary: true }
      ]
    });
    if (choice === "shutdown") DT.Session.shutdown();
    else if (choice === "restart") DT.Session.restart();
    else if (choice === "sleep") DT.Session.sleep();
  }

  function renderStart(query) {
    const q = normalize(query || "");
    const body = $(".start-body", startMenu);
    const all = launchables();
    body.replaceChildren();
    if (!q) {
      const pinned = (settings().pinned || []).map((id) => all.find((a) => a.id === id)).filter(Boolean);
      body.append(
        h("h2", { class: "start-h", text: "Épinglées" }),
        h("div", { class: "start-grid", role: "list", "aria-label": "Applications épinglées" }, ...pinned.map((a) => startItem(a, { grid: true }))),
        h("h2", { class: "start-h", text: "Toutes les applications" }),
        h("div", { class: "start-list", role: "list", "aria-label": "Toutes les applications" }, ...all.map((a) => startItem(a))));
      return;
    }
    const apps = all.filter((a) => normalize(a.title + " " + a.keywords.join(" ")).includes(q));
    const files = FS.search(query.trim()).slice(0, 6);
    body.append(h("h2", { class: "start-h", text: "Applications" }));
    if (apps.length) body.append(h("div", { class: "start-list", role: "list", "aria-label": "Applications trouvées" }, ...apps.map((a) => startItem(a))));
    else body.append(h("p", { class: "muted start-none", text: "Aucune application ne correspond." }));
    if (files.length) {
      body.append(h("h2", { class: "start-h", text: "Fichiers et dossiers" }),
        h("div", { class: "start-list", role: "list", "aria-label": "Fichiers trouvés" }, ...files.map((n) => startItem({
          id: "node-" + n.id,
          title: n.name + " — " + FS.displayPath(n.parent),
          tile: "explorer",
          action: () => {
            closeStart();
            DT.Files.open(n.id);
          }
        }))));
    }
  }

  function openStart() {
    if (startOpen) return;
    DT.UI.closeMenus();
    DT.Notify.closePanel();
    startOpen = true;
    startMenu.hidden = false;
    renderStartHead();
    const search = $(".start-search", startMenu);
    search.value = "";
    renderStart("");
    window.requestAnimationFrame(() => {
      startMenu.classList.add("open");
      search.focus();
    });
    startBtn.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", outsideStart, true);
    document.addEventListener("keydown", startKeys, true);
  }

  function toggleStart() {
    if (startOpen) closeStart();
    else openStart();
  }

  function renderStartHead() {
    const profile = DT.Settings.activeProfile();
    const user = $(".start-user", startMenu);
    user.replaceChildren(DT.Icons.avatar(profile.avatar, 30), h("span", { text: profile.name }));
  }

  function buildStart() {
    const search = h("input", { type: "search", class: "field start-search", placeholder: "Rechercher une application ou un fichier", "aria-label": "Rechercher une application", autocomplete: "off", spellcheck: "false" });
    search.addEventListener("input", () => renderStart(search.value));
    search.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const first = $(".start-body .start-app", startMenu);
        if (first) first.click();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        const first = $(".start-body .start-app", startMenu);
        if (first) first.focus();
      }
    });
    startMenu.addEventListener("keydown", (event) => {
      if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(event.key)) return;
      if (event.target === search) return;
      const items = Array.from(startMenu.querySelectorAll(".start-body .start-app"));
      const index = items.indexOf(document.activeElement);
      if (index < 0) return;
      event.preventDefault();
      const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
      const next = items[index + delta];
      if (next) next.focus();
      else if (delta < 0) search.focus();
    });
    startMenu.append(
      h("div", { class: "start-top" }, search),
      h("div", { class: "start-body" }),
      h("div", { class: "start-foot" },
        h("button", { type: "button", class: "start-user", id: "start-user", title: "Changer d'utilisateur", onClick: () => {
          closeStart();
          DT.Session.signOut();
        } }),
        h("div", { class: "start-actions" },
          h("button", { type: "button", class: "icon-btn", id: "start-settings", title: "Paramètres", "aria-label": "Paramètres", onClick: () => openApp("settings") }, DT.Icons.el("settings", 19)),
          h("button", { type: "button", class: "icon-btn", id: "start-lock", title: "Verrouiller", "aria-label": "Verrouiller la session", onClick: () => {
            closeStart();
            DT.Session.lock();
          } }, DT.Icons.el("lock", 19)),
          h("button", { type: "button", class: "icon-btn", id: "start-power", title: "Alimentation", "aria-label": "Alimentation : arrêter, redémarrer, mettre en veille", onClick: powerDialog }, DT.Icons.el("power", 19)))));
  }

  /* ============================================================ Initialisation */
  function init() {
    desktopEl = document.getElementById("desktop");
    layer = document.getElementById("icon-layer");
    taskbar = document.getElementById("taskbar");
    startMenu = document.getElementById("start-menu");

    const bureau = FS.systemFolder("Bureau");
    if (bureau) layer.setAttribute("data-drop-folder", bureau.id);

    startBtn = h("button", { type: "button", class: "tb-start", id: "start-button", title: "Démarrer", "aria-label": "Menu Démarrer", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-controls": "start-menu", onClick: toggleStart }, DT.Icons.tile("eitt", 28));
    netBtn = h("button", { type: "button", class: "tb-tray", id: "tray-network", onClick: networkMenu });
    bellBadge = h("span", { class: "tb-badge", hidden: true });
    bellBtn = h("button", { type: "button", class: "tb-tray", id: "tray-bell", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-controls": "notif-panel", title: "Centre de notifications", onClick: () => DT.Notify.togglePanel(bellBtn) }, DT.Icons.el("bell", 18), bellBadge);
    clockEl = h("span", { class: "tb-time", id: "clock-time" });
    dateEl = h("span", { class: "tb-date", id: "clock-date" });
    const clockBox = h("time", { class: "tb-clock", id: "taskbar-clock" }, clockEl, dateEl);
    const showDesktopBtn = h("button", { type: "button", class: "tb-show", id: "show-desktop", title: "Afficher le bureau", "aria-label": "Afficher le bureau", onClick: () => DT.WM.showDesktop() });

    taskbar.append(
      startBtn,
      h("div", { class: "tb-apps", id: "taskbar-apps", role: "toolbar", "aria-label": "Applications" }),
      h("div", { class: "tb-tray-area", role: "group", "aria-label": "Zone de notification" }, netBtn, bellBtn, clockBox),
      showDesktopBtn);

    buildStart();
    renderTray();
    renderTaskbarApps();
    tickClock(new Date());

    layer.addEventListener("click", (event) => {
      if (event.target === layer) select(null);
      closeStart();
    });
    layer.addEventListener("pointerdown", (event) => {
      if (event.target === layer) {
        select(null);
        closeStart();
      }
    });
    layer.addEventListener("contextmenu", (event) => {
      if (event.target !== layer) return;
      event.preventDefault();
      desktopMenu(event.clientX, event.clientY);
    });
    DT.u.onLongPress(layer, (point) => {
      if (point.target === layer) desktopMenu(point.clientX, point.clientY);
    });
    desktopEl.addEventListener("pointerdown", (event) => {
      if (startOpen || !event.target.closest("#windows-layer .win")) return;
      closeStart();
    });
    document.addEventListener("keydown", (event) => {
      if (!DT.Session || DT.Session.state() !== "desktop") return;
      if (event.key === "Escape" && event.ctrlKey) {
        event.preventDefault();
        toggleStart();
      }
    });

    DT.bus.on("clock:tick", tickClock);
    DT.bus.on("wm:change", renderTaskbarApps);
    DT.bus.on("net:change", renderTray);
    DT.bus.on("badge:change", () => { renderTaskbarApps(); scheduleIcons(); });
    DT.bus.on("notify:change", renderTray);
    DT.bus.on("fs:change", () => {
      scheduleIcons();
      renderTray();
    });
    DT.bus.on("fs:clipboard", () => {});
    DT.bus.on("settings:change", (e) => {
      if (["shownIcons", "iconSize", "showDesktopFiles"].includes(e.key)) scheduleIcons();
      if (e.key === "pinned") renderTaskbarApps();
    });
    DT.bus.on("profile:change", () => {
      if (startOpen) renderStartHead();
    });
    window.addEventListener("resize", scheduleIcons);
    renderIcons();
  }

  DT.Desktop = {
    init: init,
    openApp: openApp,
    renderIcons: renderIcons,
    toggleStart: toggleStart,
    closeStart: closeStart,
    isStartOpen: isStartOpen,
    powerDialog: powerDialog,
    focusStart: () => startBtn && startBtn.focus()
  };
}());
