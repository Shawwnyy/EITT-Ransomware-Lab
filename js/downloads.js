/*
 * EITT OS — Gestionnaire de téléchargements FICTIFS.
 * Aucun fichier n'est téléchargé depuis Internet : la progression est simulée et, à la fin, un petit fichier de
 * démonstration est créé dans le dossier virtuel « Téléchargements ». Quand le navigateur est hors ligne, les
 * téléchargements en cours attendent le retour de la connexion (état réel du navigateur).
 */
(function () {
  "use strict";
  const DT = window.DT;
  const FS = DT.FS;
  const { h, formatSize, plural } = DT.u;

  const TICK_MS = 500;
  const MAX_ITEMS = 60;
  const DEMO_CONTENT = "Fichier de démonstration EITT OS\n\nCe fichier a été créé par un téléchargement FICTIF de la simulation.\nIl n'a pas été téléchargé depuis Internet et n'existe pas sur votre véritable ordinateur.\n";

  const list = () => DT.Store.state.downloads;
  const find = (id) => list().find((d) => d.id === id) || null;
  const structure = () => DT.bus.emit("downloads:change", { structure: true });

  function durationSeconds(size) {
    return Math.min(40, Math.max(6, size / (3 * 1024 * 1024)));
  }

  function start(spec) {
    const items = list();
    const item = {
      id: DT.u.uid("dl"),
      name: spec.name,
      size: spec.size || (spec.content ? spec.content.length : 1024),
      status: "downloading",
      progress: 0,
      source: spec.source || "site fictif",
      createdAt: Date.now()
    };
    if (typeof spec.content === "string") item.content = spec.content;
    items.unshift(item);
    if (items.length > MAX_ITEMS) items.length = MAX_ITEMS;
    DT.Store.touch();
    structure();
    DT.Notify.push({ title: "Téléchargement démarré", message: "« " + item.name + " » (téléchargement fictif depuis " + item.source + ").", type: "info", silent: true });
    return item;
  }

  function setStatus(id, status) {
    const item = find(id);
    if (!item) return;
    if (item.status === "done") return;
    item.status = status;
    DT.Store.touch();
    structure();
  }

  const pause = (id) => {
    const item = find(id);
    if (item && item.status === "downloading") setStatus(id, "paused");
  };
  const resume = (id) => {
    const item = find(id);
    if (item && item.status === "paused") setStatus(id, "downloading");
  };
  function cancel(id) {
    const item = find(id);
    if (item && (item.status === "downloading" || item.status === "paused")) {
      delete item.content;
      setStatus(id, "cancelled");
    }
  }
  function remove(id) {
    const items = list();
    const index = items.findIndex((d) => d.id === id);
    if (index >= 0) {
      items.splice(index, 1);
      DT.Store.touch();
      structure();
    }
  }
  function clearFinished() {
    const items = list();
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (items[i].status === "done" || items[i].status === "cancelled") items.splice(i, 1);
    }
    DT.Store.touch();
    structure();
  }

  function complete(item) {
    item.status = "done";
    item.progress = 1;
    const folder = FS.systemFolder("Téléchargements");
    if (folder && FS.alive(folder.id)) {
      DT.quiet = (DT.quiet || 0) + 1; // la fin du téléchargement a sa propre notification
      try {
        const result = FS.createUnique(folder.id, "file", item.name, { content: typeof item.content === "string" ? item.content : DEMO_CONTENT });
        if (result.ok) item.savedId = result.node.id;
      } finally {
        DT.quiet -= 1;
      }
    }
    delete item.content;
    DT.Store.touch();
    DT.Notify.push({ title: "Téléchargement terminé", message: "« " + item.name + " » a été enregistré dans Téléchargements (fichier fictif).", type: "success" });
    structure();
  }

  let timer = null;
  function tick() {
    const active = list().filter((d) => d.status === "downloading");
    if (!active.length || !DT.Net.online) return;
    let finished = false;
    active.forEach((item) => {
      const step = (1 / (durationSeconds(item.size) * (1000 / TICK_MS))) * (0.7 + Math.random() * 0.6);
      item.progress = Math.min(1, item.progress + step);
      if (item.progress >= 1) {
        complete(item);
        finished = true;
      }
    });
    if (!finished) {
      DT.Store.touch();
      DT.bus.emit("downloads:change", { structure: false });
    }
  }

  function init() {
    if (timer === null) timer = window.setInterval(tick, TICK_MS);
  }

  DT.Downloads = { start: start, pause: pause, resume: resume, cancel: cancel, remove: remove, clearFinished: clearFinished, list: list, init: init, demoContent: DEMO_CONTENT };

  /* ============================================================ Application */
  const STATUS_LABEL = { downloading: "Téléchargement en cours", paused: "En pause", done: "Terminé", cancelled: "Annulé" };

  function createDownloads(ctx) {
    ctx.body.classList.add("dl-app");
    let filter = "all";
    const rows = new Map();

    const banner = h("p", { class: "banner banner-info" }, DT.Icons.el("info", 16), h("span", null, "Téléchargements fictifs : aucun fichier n'est récupéré sur Internet. Les contenus sont des exemples intégrés à la simulation."));
    const tabs = h("div", { class: "tabs", role: "tablist", "aria-label": "Filtrer les téléchargements" });
    const listEl = h("ul", { class: "dl-list", "aria-label": "Téléchargements" });
    const empty = h("p", { class: "muted dl-empty", hidden: true });
    const offline = h("p", { class: "banner banner-warn", hidden: true }, DT.Icons.el("wifi-off", 16), h("span", { text: "Le navigateur indique que vous êtes hors ligne : les téléchargements en cours attendent le retour de la connexion." }));
    const select = h("select", { class: "field", "aria-label": "Exemple à télécharger" });
    DT.Data.websites.resources.forEach((r) => select.append(h("option", { value: r.id, text: r.title })));
    const addBtn = h("button", { type: "button", class: "btn", id: "dl-add", onClick: () => {
      const res = DT.Data.websites.resources.find((r) => r.id === select.value);
      if (res) start({ name: res.name, size: res.size, content: res.content, source: "exemple intégré" });
    } }, DT.Icons.el("download", 16), "Télécharger l'exemple");
    const clearBtn = h("button", { type: "button", class: "btn", id: "dl-clear", onClick: () => clearFinished() }, DT.Icons.el("x-circle", 16), "Effacer les éléments terminés");
    const foot = h("div", { class: "dl-foot" }, select, addBtn, h("span", { class: "fx-grow" }), clearBtn);
    ctx.body.append(banner, offline, tabs, h("div", { class: "dl-scroll" }, listEl, empty), foot);

    function visible() {
      return list().filter((d) => (filter === "all" ? true : filter === "active" ? d.status === "downloading" || d.status === "paused" : d.status === "done" || d.status === "cancelled"));
    }

    function renderTabs() {
      const counts = {
        all: list().length,
        active: list().filter((d) => d.status === "downloading" || d.status === "paused").length,
        finished: list().filter((d) => d.status === "done" || d.status === "cancelled").length
      };
      tabs.replaceChildren(...[["all", "Tous"], ["active", "En cours"], ["finished", "Terminés"]].map(([id, label]) => h("button", {
        type: "button",
        class: "tab" + (filter === id ? " is-on" : ""),
        role: "tab",
        "aria-selected": String(filter === id),
        "data-filter": id,
        onClick: () => {
          filter = id;
          renderAll();
        }
      }, label + " (" + counts[id] + ")")));
    }

    function statusText(item) {
      if (item.status === "downloading") return DT.Net.online ? "Téléchargement en cours… " + Math.round(item.progress * 100) + " %" : "En attente de connexion (hors ligne)";
      if (item.status === "paused") return "En pause à " + Math.round(item.progress * 100) + " %";
      return STATUS_LABEL[item.status] || item.status;
    }

    function buildRow(item) {
      const status = h("span", { class: "dl-status" });
      const bar = h("div", { class: "bar", role: "progressbar", "aria-label": "Progression de « " + item.name + " »", "aria-valuemin": "0", "aria-valuemax": "100" }, h("div", { class: "bar-fill" }));
      const actions = h("div", { class: "dl-actions" });
      const li = h("li", { class: "dl-item", "data-id": item.id, "data-status": item.status },
        h("span", { class: "dl-icon" }, DT.Icons.file(FS.kindOf({ type: "file", name: item.name }), 34)),
        h("div", { class: "dl-main" },
          h("strong", { class: "dl-name", text: item.name }),
          h("span", { class: "muted dl-meta", text: formatSize(item.size) + " • source : " + item.source + " (fictive)" }),
          bar, status),
        actions);
      rows.set(item.id, { li: li, bar: bar, status: status, actions: actions, key: "" });
      return li;
    }

    function updateRow(item) {
      const row = rows.get(item.id);
      if (!row) return;
      row.li.dataset.status = item.status;
      row.status.textContent = statusText(item);
      const percent = Math.round(item.progress * 100);
      row.bar.firstChild.style.width = percent + "%";
      row.bar.setAttribute("aria-valuenow", String(percent));
      row.bar.classList.toggle("is-done", item.status === "done");
      row.bar.classList.toggle("is-paused", item.status === "paused" || item.status === "cancelled");
      const key = item.status + ":" + (item.savedId && FS.alive(item.savedId) ? "1" : "0");
      if (row.key !== key) {
        row.key = key;
        const buttons = [];
        const small = (label, icon, action, danger) => h("button", { type: "button", class: "btn btn-small" + (danger ? " btn-danger" : ""), "data-action": label, "aria-label": label + " : " + item.name, onClick: action }, DT.Icons.el(icon, 14), label);
        if (item.status === "downloading") buttons.push(small("Pause", "pause", () => pause(item.id)));
        if (item.status === "paused") buttons.push(small("Reprendre", "play", () => resume(item.id)));
        if (item.status === "downloading" || item.status === "paused") buttons.push(small("Annuler", "x", () => cancel(item.id), true));
        if (item.status === "done" && item.savedId && FS.alive(item.savedId)) buttons.push(small("Ouvrir", "eye", () => DT.Files.open(item.savedId)));
        if (item.status === "done" || item.status === "cancelled") buttons.push(small("Retirer de la liste", "trash", () => remove(item.id)));
        row.actions.replaceChildren(...buttons);
      }
    }

    function renderAll() {
      renderTabs();
      const shown = visible();
      rows.forEach((row, id) => {
        if (!shown.some((d) => d.id === id)) {
          row.li.remove();
          rows.delete(id);
        }
      });
      shown.forEach((item, index) => {
        let row = rows.get(item.id);
        if (!row) {
          buildRow(item);
          row = rows.get(item.id);
        }
        updateRow(item);
        if (listEl.children[index] !== row.li) listEl.insertBefore(row.li, listEl.children[index] || null);
      });
      empty.hidden = shown.length > 0;
      empty.textContent = filter === "active" ? "Aucun téléchargement en cours." : filter === "finished" ? "Aucun téléchargement terminé." : "Aucun téléchargement pour le moment.";
      clearBtn.disabled = !list().some((d) => d.status === "done" || d.status === "cancelled");
      offline.hidden = DT.Net.online || !list().some((d) => d.status === "downloading");
    }

    const offs = [
      DT.bus.on("downloads:change", (event) => {
        if (event.structure) renderAll();
        else {
          visible().forEach(updateRow);
        }
      }),
      DT.bus.on("net:change", () => {
        renderAll();
      }),
      DT.bus.on("fs:change", () => visible().forEach((item) => {
        const row = rows.get(item.id);
        if (row) row.key = "";
        updateRow(item);
      }))
    ];
    ctx.onClose(() => offs.forEach((off) => off()));
    void plural;
    renderAll();
  }

  DT.WM.registerApp({
    id: "downloads",
    title: "Téléchargements",
    tile: "downloads",
    size: { w: 660, h: 480 },
    minSize: { w: 360, h: 320 },
    singleton: true,
    keywords: ["télécharger", "fichiers", "progression"],
    create: createDownloads
  });
}());
