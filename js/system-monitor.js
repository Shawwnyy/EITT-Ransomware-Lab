/*
 * EITT OS — horloge, état réseau, moniteur système, Gestionnaire des tâches et tableau de bord « État du PC ».
 *
 * DISTINCTION RÉEL / SIMULÉ (règle centrale du projet) :
 *   RÉEL        : heure du navigateur (Date), navigator.onLine + événements online/offline, nombre de cœurs logiques
 *                 (navigator.hardwareConcurrency), mémoire JavaScript de l'onglet (performance.memory, Chrome uniquement),
 *                 type de connexion annoncé (navigator.connection), niveau de batterie (si l'API existe), nombre de fenêtres ouvertes.
 *   VIRTUEL     : espace disque, nombre de fichiers/dossiers (calculés à partir des données de la simulation).
 *   SIMULATION  : % de processeur, mémoire globale, débit réseau, consommation de chaque processus.
 *                 Ces valeurs sont générées par le programme pour illustrer le principe : ce ne sont PAS des mesures.
 */
(function () {
  "use strict";
  const DT = window.DT;
  const { h, $, formatSize, plural, clamp, pad2 } = DT.u;

  /* ============================================================ Horloge réelle */
  let clockTimer = null;
  function clockTick() {
    DT.bus.emit("clock:tick", new Date());
    clockTimer = window.setTimeout(clockTick, 1000 - (Date.now() % 1000) + 5);
  }
  DT.Clock = {
    start() {
      if (clockTimer === null) clockTick();
    },
    stop() {
      window.clearTimeout(clockTimer);
      clockTimer = null;
    },
    running: () => clockTimer !== null
  };

  /* ============================================================ Réseau (réel) */
  const netState = { online: navigator.onLine !== false, since: Date.now(), changes: 0 };

  function setOnline(value) {
    if (value === netState.online) return;
    netState.online = value;
    netState.since = Date.now();
    netState.changes += 1;
    DT.bus.emit("net:change", { online: value });
  }
  window.addEventListener("online", () => setOnline(true));
  window.addEventListener("offline", () => setOnline(false));

  /** « Isolement » SIMULÉ du poste (exercice de réponse à incident) : n'agit jamais sur le vrai réseau. */
  let isolated = false;
  const link = { wifi: true, airplane: false }; // interrupteurs SIMULÉS de la barre des tâches (Wi-Fi, mode avion)
  const effective = () => netState.online && !isolated && link.wifi && !link.airplane;
  const announce = () => DT.bus.emit("net:change", { online: effective(), isolated: isolated, manual: !link.wifi || link.airplane });
  DT.Net = {
    get online() {
      return effective();
    },
    get isolated() {
      return isolated;
    },
    get wifi() {
      return link.wifi;
    },
    get airplane() {
      return link.airplane;
    },
    /** Coupe/rétablit le Wi-Fi SIMULÉ (n'agit pas sur la vraie connexion). */
    setWifi(value) {
      if (Boolean(value) === link.wifi) return;
      link.wifi = Boolean(value);
      netState.since = Date.now();
      announce();
    },
    setAirplane(value) {
      if (Boolean(value) === link.airplane) return;
      link.airplane = Boolean(value);
      netState.since = Date.now();
      announce();
    },
    setIsolated(value) {
      if (Boolean(value) === isolated) return;
      isolated = Boolean(value);
      netState.since = Date.now();
      announce();
    },
    get since() {
      return netState.since;
    },
    get changes() {
      return netState.changes;
    },
    connection() {
      const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!c) return null;
      return { type: c.effectiveType || null, downlink: typeof c.downlink === "number" ? c.downlink : null, rtt: typeof c.rtt === "number" ? c.rtt : null };
    }
  };

  /* ============================================================ Étiquettes */
  const TAGS = {
    real: { label: "Réel", cls: "tag-real", title: "Mesure fournie par votre navigateur." },
    sim: { label: "Simulation", cls: "tag-sim", title: "Valeur simulée : générée par EITT OS pour illustrer le principe. Ce n'est pas une mesure de votre ordinateur." },
    virtual: { label: "Virtuel", cls: "tag-virtual", title: "Calculé à partir des fichiers de la simulation (disque virtuel fictif)." }
  };

  function tag(kind) {
    const def = TAGS[kind];
    return h("span", { class: "tag " + def.cls, title: def.title, "data-kind": kind, text: def.label });
  }

  /* ============================================================ Moniteur (simulé) */
  const HISTORY = 60;
  const TOTAL_MB = 16384; // mémoire fictive affichée
  const APP_PROFILE = {
    browser: { cpu: 4.2, mem: 190 },
    explorer: { cpu: 1.4, mem: 74 },
    notepad: { cpu: 0.5, mem: 29 },
    terminal: { cpu: 0.8, mem: 25 },
    settings: { cpu: 0.6, mem: 46 },
    taskmanager: { cpu: 2.1, mem: 54 },
    dashboard: { cpu: 1.6, mem: 41 },
    downloads: { cpu: 1.1, mem: 36 },
    viewer: { cpu: 2.4, mem: 88 }
  };
  const SYSTEM_PROCESSES = [
    { key: "sys:core", name: "Noyau de la simulation", cpu: 0.7, mem: 148 },
    { key: "sys:wm", name: "Gestionnaire de fenêtres", cpu: 0.4, mem: 58 },
    { key: "sys:desktop", name: "Bureau et barre des tâches", cpu: 0.5, mem: 66 },
    { key: "sys:fs", name: "Système de fichiers virtuel", cpu: 0.2, mem: 32 },
    { key: "sys:notify", name: "Service de notifications", cpu: 0.1, mem: 19 }
  ];

  const monitor = {
    cpu: [],
    mem: [],
    net: [],
    cpuNow: 0,
    memNow: 0,
    netNow: 0,
    procs: [],
    bursts: 0
  };

  function hash(text) {
    let n = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      n ^= text.charCodeAt(i);
      n = Math.imul(n, 16777619);
    }
    return n >>> 0;
  }

  const noise = (amplitude) => (Math.random() - 0.5) * 2 * amplitude;
  const push = (list, value) => {
    list.push(value);
    if (list.length > HISTORY) list.shift();
  };

  const procState = new Map();

  function sampleProcesses() {
    const active = DT.WM.active();
    const rows = [];
    DT.WM.list().forEach((win) => {
      if (win.closing) return;
      const profile = APP_PROFILE[win.appId] || { cpu: 1, mem: 40 };
      const seed = hash(win.id);
      let st = procState.get(win.id);
      if (!st) {
        st = { cpu: profile.cpu, mem: profile.mem * (0.9 + (seed % 25) / 100) };
        procState.set(win.id, st);
      }
      const factor = win.minimized ? 0.08 : win === active ? 1.5 : 0.7;
      st.cpu = clamp(st.cpu * 0.5 + profile.cpu * factor * (0.5 + Math.random()) * 0.5, 0, 40);
      st.mem = clamp(st.mem + noise(0.6), 12, 900);
      rows.push({ key: win.id, win: win, name: win.title, appId: win.appId, system: false, minimized: win.minimized, cpu: st.cpu, mem: st.mem });
    });
    const files = DT.FS.stats().files;
    SYSTEM_PROCESSES.forEach((def) => {
      let st = procState.get(def.key);
      if (!st) {
        st = { cpu: def.cpu, mem: def.mem };
        procState.set(def.key, st);
      }
      st.cpu = clamp(def.cpu * (0.5 + Math.random()), 0, 6);
      st.mem = def.mem + (def.key === "sys:fs" ? files * 0.04 : 0) + noise(0.4);
      rows.push({ key: def.key, name: def.name, appId: null, system: true, cpu: st.cpu, mem: st.mem });
    });
    for (const key of Array.from(procState.keys())) {
      if (!key.startsWith("sys:") && !rows.some((r) => r.key === key)) procState.delete(key);
    }
    return rows;
  }

  function activeDownloads() {
    return (DT.Store.state.downloads || []).filter((d) => d.status === "downloading").length;
  }

  function sample() {
    const procs = sampleProcesses();
    monitor.procs = procs;

    const procCpu = procs.reduce((sum, p) => sum + p.cpu, 0);
    const burst = monitor.bursts > 0 ? 9 + Math.random() * 14 : 0;
    if (monitor.bursts > 0) monitor.bursts -= 1;
    const target = clamp(2.5 + procCpu + burst, 1, 96);
    monitor.cpuNow = clamp(monitor.cpuNow * 0.45 + target * 0.55 + noise(1.2), 1, 98);
    push(monitor.cpu, monitor.cpuNow);

    const used = 1650 + procs.reduce((sum, p) => sum + p.mem, 0) + noise(6);
    monitor.memNow = used;
    push(monitor.mem, used);

    let kbps = 0;
    if (netState.online) {
      kbps = 3 + Math.random() * 9;
      kbps += activeDownloads() * (350 + Math.random() * 500);
      kbps += DT.WM.byApp("browser").filter((w) => !w.minimized).length * (10 + Math.random() * 60);
    }
    monitor.netNow = kbps;
    push(monitor.net, kbps);

    DT.bus.emit("monitor:tick", monitor);
  }

  /** Simule un pic d'activité (ex. copie de fichiers) : valeur illustrative uniquement. */
  function burst(ticks) {
    monitor.bursts = Math.max(monitor.bursts, ticks || 2);
  }

  let started = false;
  function startMonitor() {
    if (started) return;
    started = true;
    for (let i = 0; i < 20; i += 1) {
      monitor.cpuNow = clamp(5 + Math.random() * 6, 1, 20);
      push(monitor.cpu, monitor.cpuNow);
      push(monitor.mem, 1900 + Math.random() * 40);
      push(monitor.net, netState.online ? 2 + Math.random() * 8 : 0);
    }
    DT.bus.on("clock:tick", () => {
      if (document.hidden) return;
      if (DT.Session && DT.Session.state && DT.Session.state() !== "desktop") return;
      sample();
    });
    DT.bus.on("fs:change", () => burst(1));
    sample();
  }

  function realMemory() {
    const m = window.performance && window.performance.memory;
    return m && typeof m.usedJSHeapSize === "number" ? m : null;
  }

  function battery() {
    return typeof navigator.getBattery === "function" ? navigator.getBattery().catch(() => null) : Promise.resolve(null);
  }

  DT.Monitor = {
    HISTORY: HISTORY,
    TOTAL_MB: TOTAL_MB,
    data: monitor,
    start: startMonitor,
    sample: sample,
    burst: burst,
    tag: tag,
    realMemory: realMemory,
    battery: battery,
    activeDownloads: activeDownloads
  };

  /* ============================================================ Graphique SVG léger */
  function createGraph(label) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 300 90");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("class", "graph");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", label);
    [22, 45, 67].forEach((y) => {
      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", "0");
      line.setAttribute("x2", "300");
      line.setAttribute("y1", String(y));
      line.setAttribute("y2", String(y));
      line.setAttribute("class", "graph-grid");
      svg.append(line);
    });
    const area = document.createElementNS(NS, "path");
    area.setAttribute("class", "graph-area");
    const line = document.createElementNS(NS, "path");
    line.setAttribute("class", "graph-line");
    svg.append(area, line);
    return {
      el: svg,
      update(values, max) {
        if (!values.length) return;
        const step = 300 / (HISTORY - 1);
        const offset = HISTORY - values.length;
        const points = values.map((v, i) => [(offset + i) * step, 88 - clamp(v / max, 0, 1) * 84]);
        const d = "M" + points.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L");
        line.setAttribute("d", d);
        area.setAttribute("d", d + " L300 90 L" + points[0][0].toFixed(1) + " 90Z");
      }
    };
  }

  const fmtPercent = (v) => Math.round(v) + " %";
  const fmtMb = (v) => (v >= 1024 ? (v / 1024).toFixed(1).replace(".", ",") + " Go" : Math.round(v) + " Mo");
  const fmtRate = (kbps) => (kbps >= 1024 ? (kbps / 1024).toFixed(1).replace(".", ",") + " Mo/s" : kbps.toFixed(kbps < 10 ? 1 : 0).replace(".", ",") + " Ko/s");

  /* ============================================================ Gestionnaire des tâches */
  function createTaskManager(ctx) {
    ctx.body.classList.add("tm-app");
    let tab = "processes";
    let selectedKey = null;
    const rowMap = new Map();
    let perfKey = "cpu";

    const banner = h("p", { class: "banner banner-info" },
      DT.Icons.el("info", 16),
      h("span", null, "Les valeurs marquées ", tag("sim"), " sont générées par la simulation : ce ne sont pas des mesures de votre ordinateur. Le navigateur n'autorise pas la lecture du processeur ni de la mémoire du système."));

    const tabs = h("div", { class: "tabs", role: "tablist", "aria-label": "Sections du gestionnaire des tâches" });
    const content = h("div", { class: "tm-content" });
    ctx.body.append(tabs, banner, content);

    function renderTabs() {
      tabs.replaceChildren(...[["processes", "Processus"], ["perf", "Performances"], ["about", "Réel ou simulé ?"]].map(([id, label]) => h("button", {
        type: "button",
        class: "tab" + (tab === id ? " is-on" : ""),
        role: "tab",
        id: "tm-tab-" + id,
        "aria-selected": String(tab === id),
        onClick: () => show(id)
      }, label)));
    }

    /* ---------- Processus ---------- */
    let tbody = null;
    let endButton = null;
    let hint = null;

    function selectedRow() {
      return monitor.procs.find((p) => p.key === selectedKey) || null;
    }

    function updateEndButton() {
      if (!endButton) return;
      const row = selectedRow();
      endButton.disabled = !row;
      hint.textContent = !row ? "Sélectionnez un processus pour le terminer." : row.system ? "« " + row.name + " » est un composant système fictif de la simulation." : "« " + row.name + " » est une application ouverte dans la simulation.";
    }

    function selectRow(key) {
      selectedKey = key;
      rowMap.forEach((entry, k) => {
        entry.tr.classList.toggle("is-selected", k === key);
        entry.tr.setAttribute("aria-selected", String(k === key));
      });
      updateEndButton();
    }

    async function endTask() {
      const row = selectedRow();
      if (!row) return;
      if (row.system) {
        await DT.UI.alert({
          title: "Ce processus ne peut pas être terminé",
          message: "« " + row.name + " » est un composant fictif du système de la simulation. Dans un vrai système, arrêter un processus essentiel peut faire planter l'ordinateur : ici, il est protégé pour que votre environnement continue de fonctionner."
        });
        return;
      }
      const closed = await DT.WM.close(row.win);
      if (closed) {
        DT.Notify.push({ title: "Tâche terminée", message: "« " + row.name + " » a été fermée depuis le Gestionnaire des tâches.", type: "info", silent: true });
        selectedKey = null;
        renderProcesses(true);
      }
    }

    function buildProcesses() {
      rowMap.clear();
      tbody = h("tbody");
      endButton = h("button", { type: "button", class: "btn btn-danger", id: "tm-end-task", onClick: endTask }, DT.Icons.el("x-circle", 16), "Fin de tâche");
      hint = h("span", { class: "muted tm-hint" });
      const select = h("select", { class: "field tm-run-select", "aria-label": "Application à lancer" });
      DT.WM.apps().forEach((app) => select.append(h("option", { value: app.id, text: app.title })));
      const runButton = h("button", { type: "button", class: "btn", id: "tm-run", onClick: () => DT.WM.open(select.value) }, DT.Icons.el("play", 15), "Nouvelle tâche");
      const table = h("table", { class: "tm-table", "aria-label": "Processus en cours" },
        h("thead", null, h("tr", null,
          h("th", { scope: "col", text: "Nom" }),
          h("th", { scope: "col", text: "Type" }),
          h("th", { scope: "col", class: "num" }, "Processeur ", tag("sim")),
          h("th", { scope: "col", class: "num" }, "Mémoire ", tag("sim")))),
        tbody);
      const wrap = h("div", { class: "tm-table-wrap" }, table);
      const toolbar = h("div", { class: "tm-toolbar" }, endButton, select, runButton, hint);
      content.replaceChildren(toolbar, wrap);
      renderProcesses(true);
    }

    function renderProcesses(structure) {
      if (tab !== "processes" || !tbody) return;
      const procs = monitor.procs.slice().sort((a, b) => Number(a.system) - Number(b.system) || b.cpu - a.cpu);
      const keys = new Set(procs.map((p) => p.key));
      rowMap.forEach((entry, key) => {
        if (!keys.has(key)) {
          entry.tr.remove();
          rowMap.delete(key);
          if (selectedKey === key) selectedKey = null;
        }
      });
      procs.forEach((p, index) => {
        let entry = rowMap.get(p.key);
        if (!entry) {
          const cells = {
            name: h("td", { class: "tm-name" }),
            type: h("td"),
            cpu: h("td", { class: "num" }),
            mem: h("td", { class: "num" })
          };
          const tr = h("tr", { tabindex: "0", "data-key": p.key, "aria-selected": "false" }, cells.name, cells.type, cells.cpu, cells.mem);
          tr.addEventListener("click", () => selectRow(p.key));
          tr.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              selectRow(p.key);
            } else if (event.key === "Delete") {
              selectRow(p.key);
              endTask();
            }
          });
          entry = { tr: tr, cells: cells };
          rowMap.set(p.key, entry);
          cells.name.append(p.appId ? DT.Icons.tile(p.appId, 18) : DT.Icons.el("cpu", 18), h("span", { class: "tm-title", text: p.name }));
          cells.type.textContent = p.system ? "Système (fictif)" : "Application";
        }
        entry.cells.name.lastChild.textContent = p.name + (p.minimized ? " (réduite)" : "");
        entry.cells.cpu.textContent = p.cpu.toFixed(1).replace(".", ",") + " %";
        entry.cells.mem.textContent = fmtMb(p.mem);
        if (tbody.children[index] !== entry.tr) tbody.insertBefore(entry.tr, tbody.children[index] || null);
      });
      if (structure) selectRow(selectedKey);
      else updateEndButton();
    }

    /* ---------- Performances ---------- */
    const perf = { graph: null, big: null, details: null, list: {} };

    function perfDefs() {
      const stats = DT.FS.stats();
      const percentDisk = (stats.bytes / stats.capacity) * 100;
      return {
        cpu: { label: "Processeur", kind: "sim", series: monitor.cpu, max: 100, value: fmtPercent(monitor.cpuNow) },
        mem: { label: "Mémoire", kind: "sim", series: monitor.mem, max: TOTAL_MB, value: fmtMb(monitor.memNow) + " / " + fmtMb(TOTAL_MB) },
        net: { label: "Réseau", kind: "real+sim", series: monitor.net, max: Math.max(600, ...monitor.net), value: netState.online ? fmtRate(monitor.netNow) : "Hors ligne" },
        disk: { label: "Stockage", kind: "virtual", series: null, max: 100, value: percentDisk.toFixed(percentDisk < 10 ? 1 : 0).replace(".", ",") + " %" }
      };
    }

    function buildPerf() {
      perf.list = {};
      const side = h("div", { class: "perf-list", role: "listbox", "aria-label": "Ressources" });
      const defs = perfDefs();
      Object.keys(defs).forEach((key) => {
        const button = h("button", { type: "button", class: "perf-item" + (perfKey === key ? " is-on" : ""), role: "option", "aria-selected": String(perfKey === key), "data-perf": key, onClick: () => {
          perfKey = key;
          buildPerf();
        } },
          h("strong", { text: defs[key].label }),
          h("span", { class: "perf-value" }));
        perf.list[key] = button;
        side.append(button);
      });
      perf.details = h("div", { class: "perf-details" });
      perf.big = h("div", { class: "perf-big" });
      content.replaceChildren(h("div", { class: "perf-layout" }, side, h("div", { class: "perf-main" }, perf.big, perf.details)));
      perf.graph = null;
      renderPerf(true);
    }

    function detailRow(label, valueNode, kind) {
      return h("div", { class: "perf-row" }, h("span", { class: "muted", text: label }), h("span", { class: "perf-row-value" }, valueNode, kind ? tag(kind) : null));
    }

    function renderPerf(structure) {
      if (tab !== "perf") return;
      const defs = perfDefs();
      Object.keys(defs).forEach((key) => {
        if (perf.list[key]) perf.list[key].lastChild.textContent = defs[key].value;
      });
      const def = defs[perfKey];
      if (structure) {
        perf.big.replaceChildren();
        perf.details.replaceChildren();
        perf.graph = null;
        const title = h("div", { class: "perf-title" }, h("h2", { text: def.label }));
        if (def.kind === "real+sim") {
          title.append(tag("real"), tag("sim"));
        } else {
          title.append(tag(def.kind));
        }
        perf.big.append(title);
        if (def.series) {
          perf.graph = createGraph("Historique récent : " + def.label);
          perf.big.append(perf.graph.el, h("div", { class: "perf-axis muted" }, h("span", { text: "il y a " + HISTORY + " s" }), h("span", { text: "maintenant" })));
        } else {
          perf.bar = h("div", { class: "bar big", role: "progressbar", "aria-label": "Stockage virtuel utilisé", "aria-valuemin": "0", "aria-valuemax": "100" }, h("div", { class: "bar-fill" }));
          perf.big.append(perf.bar);
        }
      }
      if (perf.graph) perf.graph.update(def.series, def.max);
      perf.details.replaceChildren();
      if (perfKey === "cpu") {
        perf.details.append(
          detailRow("Utilisation actuelle", document.createTextNode(fmtPercent(monitor.cpuNow)), "sim"),
          detailRow("Cœurs logiques de votre appareil", document.createTextNode(navigator.hardwareConcurrency ? String(navigator.hardwareConcurrency) : "Non communiqué par le navigateur"), navigator.hardwareConcurrency ? "real" : null),
          h("p", { class: "muted", text: "Le pourcentage est une valeur illustrative qui varie avec le nombre de fenêtres ouvertes. Un navigateur ne peut pas lire l'utilisation réelle du processeur." }));
      } else if (perfKey === "mem") {
        const real = realMemory();
        perf.details.append(
          detailRow("Mémoire utilisée par la simulation", document.createTextNode(fmtMb(monitor.memNow)), "sim"),
          detailRow("Mémoire totale (fictive)", document.createTextNode(fmtMb(TOTAL_MB)), "sim"),
          detailRow("Mémoire JavaScript de cet onglet", document.createTextNode(real ? formatSize(real.usedJSHeapSize) : "Non disponible dans ce navigateur"), real ? "real" : null),
          detailRow("Mémoire de l'appareil (indication arrondie)", document.createTextNode(navigator.deviceMemory ? "≈ " + navigator.deviceMemory + " Go" : "Non communiquée par le navigateur"), navigator.deviceMemory ? "real" : null),
          h("p", { class: "muted", text: "La valeur « simulation » additionne des consommations fictives par processus. La mémoire JavaScript réelle, quand elle existe, ne concerne que cet onglet." }));
      } else if (perfKey === "net") {
        const connection = DT.Net.connection();
        perf.details.append(
          detailRow("État déclaré par le navigateur", document.createTextNode(netState.online ? "Connecté" : "Hors ligne"), "real"),
          detailRow("Activité réseau estimée", document.createTextNode(netState.online ? fmtRate(monitor.netNow) : "0 Ko/s"), "sim"),
          detailRow("Type de connexion annoncé", document.createTextNode(connection && connection.type ? connection.type : "Non communiqué"), connection && connection.type ? "real" : null),
          h("p", { class: "muted", text: "« Connecté » signifie seulement que le navigateur se croit relié à un réseau : cela ne garantit pas l'accès à Internet. Le débit affiché est simulé (aucun trafic réel n'est mesuré)." }));
      } else {
        const stats = DT.FS.stats();
        const percent = Math.min(100, (stats.bytes / stats.capacity) * 100);
        if (perf.bar) {
          perf.bar.firstChild.style.width = Math.max(0.6, percent) + "%";
          perf.bar.setAttribute("aria-valuenow", String(Math.round(percent)));
        }
        perf.details.append(
          detailRow("Capacité du disque virtuel", document.createTextNode(formatSize(stats.capacity)), "virtual"),
          detailRow("Espace utilisé", document.createTextNode(formatSize(stats.bytes)), "virtual"),
          detailRow("Espace disponible", document.createTextNode(formatSize(stats.capacity - stats.bytes)), "virtual"),
          detailRow("Éléments dans la corbeille", document.createTextNode(stats.trashItems + " (" + formatSize(stats.trashBytes) + ")"), "virtual"),
          h("p", { class: "muted", text: "Ce disque est fictif : sa taille est fixée par la simulation et son contenu est calculé à partir des fichiers virtuels, stockés dans le navigateur." }));
      }
    }

    /* ---------- À propos ---------- */
    function buildAbout() {
      const rows = [
        ["real", "Heure et date", "Lues depuis l'horloge de votre navigateur, dans votre fuseau horaire."],
        ["real", "État de la connexion", "navigator.onLine et événements online/offline. Ne garantit pas l'accès à Internet."],
        ["real", "Cœurs logiques", "navigator.hardwareConcurrency, si le navigateur l'indique."],
        ["real", "Mémoire JavaScript de l'onglet", "performance.memory, disponible seulement sur certains navigateurs (Chrome)."],
        ["virtual", "Stockage, fichiers, dossiers", "Calculés à partir des données de la simulation. Le disque de 512 Mo est fictif."],
        ["sim", "Processeur", "Valeur illustrative qui dépend du nombre de fenêtres ouvertes."],
        ["sim", "Mémoire globale et par processus", "Valeurs illustratives. La mémoire totale de 16 Go est fictive."],
        ["sim", "Débit réseau", "Estimation illustrative : nulle hors ligne, plus élevée pendant un téléchargement simulé."]
      ];
      const list = h("ul", { class: "about-list" });
      rows.forEach(([kind, title, text]) => list.append(h("li", null, tag(kind), h("div", null, h("strong", { text: title }), h("span", { class: "muted", text: text })))));
      content.replaceChildren(h("div", { class: "about-wrap" }, h("p", { text: "Un navigateur web n'a pas le droit de lire librement les statistiques de votre ordinateur. EITT OS sépare donc clairement ce qui est mesuré de ce qui est illustré :" }), list));
    }

    function show(id) {
      tab = id;
      renderTabs();
      if (id === "processes") buildProcesses();
      else if (id === "perf") buildPerf();
      else buildAbout();
    }

    const offs = [
      DT.bus.on("monitor:tick", () => {
        if (tab === "processes") renderProcesses(false);
        else if (tab === "perf") renderPerf(false);
      }),
      DT.bus.on("wm:change", () => {
        if (tab === "processes") {
          sampleProcessesOnly();
          renderProcesses(false);
        }
      }),
      DT.bus.on("net:change", () => tab === "perf" && renderPerf(false))
    ];
    function sampleProcessesOnly() {
      monitor.procs = sampleProcesses();
    }
    ctx.onClose(() => offs.forEach((off) => off()));
    if (!monitor.procs.length) sampleProcessesOnly();
    show("processes");
  }

  DT.WM.registerApp({
    id: "taskmanager",
    title: "Gestionnaire des tâches",
    tile: "taskmanager",
    size: { w: 760, h: 520 },
    minSize: { w: 440, h: 340 },
    singleton: true,
    keywords: ["processus", "performance", "processeur", "mémoire", "réseau", "stockage", "moniteur"],
    create: createTaskManager
  });

  /* ============================================================ Tableau de bord « État du PC » */
  function createDashboard(ctx) {
    ctx.body.classList.add("dash-app");
    const cards = {};
    let batteryInfo = undefined;

    function card(id, title, iconName, ...rows) {
      const el = h("section", { class: "dash-card", id: "dash-" + id, "aria-labelledby": "dash-" + id + "-t" },
        h("header", null, DT.Icons.el(iconName, 18), h("h2", { id: "dash-" + id + "-t", text: title })),
        ...rows);
      cards[id] = el;
      return el;
    }

    const refs = {};
    function row(key, label, kind, note) {
      const value = h("strong", { class: "dash-value", "data-ref": key });
      refs[key] = value;
      return h("div", { class: "dash-row" },
        h("span", { class: "muted", text: label }),
        h("span", { class: "dash-row-right" }, value, kind ? tag(kind) : null, note ? h("small", { class: "sim-note", text: note }) : null));
    }

    const timeBig = h("div", { class: "dash-time", "data-ref": "time", "aria-live": "off" });
    const dateBig = h("div", { class: "muted dash-date", "data-ref": "date" });
    const cpuGraph = createGraph("Historique récent du processeur (simulation)");
    const memGraph = createGraph("Historique récent de la mémoire (simulation)");
    const diskBar = h("div", { class: "bar", role: "progressbar", "aria-label": "Stockage virtuel utilisé", "aria-valuemin": "0", "aria-valuemax": "100" }, h("div", { class: "bar-fill" }));
    const profileBox = h("div", { class: "dash-profile" });
    const appList = h("p", { class: "muted dash-apps" });

    const grid = h("div", { class: "dash-grid" },
      card("time", "Heure locale", "activity", timeBig, dateBig, h("p", { class: "muted small" }, tag("real"), " Horloge de votre navigateur, fuseau horaire local.")),
      card("session", "Session virtuelle", "user", profileBox, row("state", "État de la session", null), row("uptime", "Durée de la session", null)),
      card("net", "Réseau", "wifi", row("online", "État de la connexion", "real"), row("activity", "Activité réseau", "sim", "Valeur simulée"),
        h("p", { class: "muted small", text: "Indication du navigateur (navigator.onLine) : elle ne garantit pas l'accès à Internet." })),
      card("cpu", "Processeur", "cpu", row("cpu", "Utilisation", "sim", "Valeur simulée"), cpuGraph.el, row("cores", "Cœurs logiques de l'appareil", null)),
      card("mem", "Mémoire", "activity", row("mem", "Utilisée", "sim", "Valeur simulée"), memGraph.el, row("heap", "Mémoire JavaScript de l'onglet", null)),
      card("disk", "Stockage virtuel", "folder", diskBar, row("disk", "Espace utilisé", "virtual"), row("free", "Espace disponible", "virtual"), row("files", "Fichiers", "virtual"), row("folders", "Dossiers", "virtual"), row("trash", "Dans la corbeille", "virtual")),
      card("apps", "Applications ouvertes", "layout", row("count", "Nombre de fenêtres", "real"), appList),
      card("save", "Sauvegarde locale", "save", row("store", "Stockage du navigateur", null), row("battery", "Batterie de l'appareil", null)));
    ctx.body.append(grid);

    const setText = (key, text) => {
      if (refs[key]) refs[key].textContent = text;
    };

    function update() {
      const now = DT.u.clockStrings(new Date());
      timeBig.textContent = now.time;
      dateBig.textContent = now.date;
      const profile = DT.Settings.activeProfile();
      profileBox.replaceChildren(DT.Icons.avatar(profile.avatar, 44), h("div", null, h("strong", { text: profile.name }), h("div", { class: "muted", text: "Profil fictif actif" })));
      const sessionState = DT.Session && DT.Session.state ? DT.Session.state() : "desktop";
      setText("state", sessionState === "desktop" ? "Active" : sessionState === "locked" ? "Verrouillée" : "Inactive");
      const started = DT.Session && DT.Session.startedAt ? DT.Session.startedAt() : null;
      if (started) {
        const s = Math.floor((Date.now() - started) / 1000);
        setText("uptime", (s >= 3600 ? Math.floor(s / 3600) + " h " : "") + pad2(Math.floor((s % 3600) / 60)) + " min " + pad2(s % 60) + " s");
      } else setText("uptime", "—");

      setText("online", DT.Net.online ? "Connecté" : "Hors ligne");
      refs.online.className = "dash-value " + (DT.Net.online ? "ok" : "warn");
      setText("activity", DT.Net.online ? fmtRate(monitor.netNow) : "0 Ko/s");
      setText("cpu", fmtPercent(monitor.cpuNow));
      cpuGraph.update(monitor.cpu, 100);
      setText("cores", navigator.hardwareConcurrency ? navigator.hardwareConcurrency + " (réel)" : "Non communiqué par le navigateur");
      setText("mem", fmtMb(monitor.memNow) + " sur " + fmtMb(TOTAL_MB) + " (fictifs)");
      memGraph.update(monitor.mem, TOTAL_MB);
      const real = realMemory();
      setText("heap", real ? formatSize(real.usedJSHeapSize) + " (réel)" : "Non disponible dans ce navigateur");

      const stats = DT.FS.stats();
      const percent = Math.min(100, (stats.bytes / stats.capacity) * 100);
      diskBar.firstChild.style.width = Math.max(0.6, percent) + "%";
      diskBar.setAttribute("aria-valuenow", String(Math.round(percent)));
      setText("disk", formatSize(stats.bytes) + " sur " + formatSize(stats.capacity));
      setText("free", formatSize(stats.capacity - stats.bytes));
      setText("files", String(stats.files));
      setText("folders", String(stats.folders));
      setText("trash", stats.trashItems + " " + plural(stats.trashItems, "élément", "éléments"));

      const wins = DT.WM.list().filter((w) => !w.closing);
      setText("count", String(wins.length));
      appList.textContent = wins.length ? wins.map((w) => w.title + (w.minimized ? " (réduite)" : "")).join(" · ") : "Aucune application ouverte.";
      setText("store", DT.Store.available ? "Actif — environ " + formatSize(DT.Store.approxBytes()) : "Indisponible (les données seront perdues à la fermeture)");
      if (batteryInfo === undefined) {
        batteryInfo = null;
        battery().then((b) => {
          batteryInfo = b || false;
          update();
        });
      }
      if (batteryInfo) setText("battery", Math.round(batteryInfo.level * 100) + " % — " + (batteryInfo.charging ? "en charge" : "sur batterie") + " (réel)");
      else setText("battery", batteryInfo === false ? "Non communiquée par le navigateur" : "Recherche…");
    }

    const offs = [
      DT.bus.on("clock:tick", update),
      DT.bus.on("monitor:tick", update),
      DT.bus.on("wm:change", update),
      DT.bus.on("fs:change", update),
      DT.bus.on("net:change", update),
      DT.bus.on("profile:change", update)
    ];
    ctx.onClose(() => offs.forEach((off) => off()));
    update();
  }

  DT.WM.registerApp({
    id: "dashboard",
    title: "État du PC",
    tile: "dashboard",
    size: { w: 860, h: 580 },
    minSize: { w: 420, h: 360 },
    singleton: true,
    keywords: ["tableau", "bord", "état", "statistiques", "résumé"],
    create: createDashboard
  });
}());
