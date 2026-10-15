/*
 * EITT OS — zone de notification : sécurité, langue du clavier, Wi-Fi, volume, batterie, calendrier,
 * panneau « Paramètres rapides » (Wi-Fi, Bluetooth, mode avion, économiseur, mode nuit, thème, luminosité, volume).
 *
 * Tout est SIMULÉ et local : ces réglages ne modifient ni le clavier, ni le son, ni la luminosité, ni le Wi-Fi de
 * votre vrai ordinateur. Ils sont enregistrés dans le stockage local du navigateur (settings.system).
 * - Batterie : valeur réelle si le navigateur la fournit (API « Battery Status »), sinon valeur fictive signalée.
 * - Son : de courts bips générés par le navigateur (Web Audio), au volume du curseur simulé, jamais de fichier externe.
 */
(function () {
  "use strict";
  const DT = window.DT;
  const { h } = DT.u;

  const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const DAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
  const LAYOUTS = {
    fr: { code: "FRA", name: "Français (AZERTY)", sub: "FR" },
    en: { code: "ENG", name: "English – United States (QWERTY)", sub: "US" }
  };

  let battery = { level: 0.87, charging: true, real: false, toFull: null, toEmpty: null };
  let batteryTimer = null;
  const els = {};
  let panel = null; // { name, el, cleanup }
  let veil = null;
  let night = null;

  /* ------------------------------ Réglages simulés ------------------------------ */
  const defaultsSys = () => ({ volume: 60, muted: false, brightness: 100, night: false, bluetooth: true, saver: false, keyboard: "fr" });
  function sys() {
    // Toujours le MÊME objet : les panneaux gardent une référence et la modifient directement.
    const st = DT.Store.state.settings;
    if (!st.system || typeof st.system !== "object") st.system = {};
    const defaults = defaultsSys();
    Object.keys(defaults).forEach((key) => { if (typeof st.system[key] !== typeof defaults[key]) st.system[key] = defaults[key]; });
    return st.system;
  }
  const saveSys = () => DT.Store.touch();

  /* ------------------------------ Son (Web Audio, local) ------------------------------ */
  let audio = null;
  function tone(freq, start, length, gainValue) {
    const ctx = audio;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(gainValue, ctx.currentTime + start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + length);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + length + 0.03);
  }
  const Sound = {
    /** Joue un bip court au volume simulé (rien si le son est coupé). Ne fait jamais échouer l'application. */
    play(kind) {
      const s = sys();
      DT.Sound.last = { kind: kind, at: Date.now(), muted: s.muted, volume: s.volume };
      if (s.muted || s.volume <= 0) return false;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return false;
        // Les navigateurs interdisent le son avant tout geste de l'utilisateur : on n'essaie pas (aucun avertissement).
        if (!audio && navigator.userActivation && !navigator.userActivation.hasBeenActive) return false;
        audio = audio || new Ctx();
        if (audio.state === "suspended") audio.resume();
        const g = Math.max(0.002, (s.volume / 100) * 0.12);
        if (kind === "message") {
          tone(880, 0, 0.14, g);
          tone(1175, 0.13, 0.2, g);
        } else if (kind === "alarm") {
          // Alerte du patron en pleine attaque : trois notes descendantes, plus pressantes qu'un message ordinaire.
          tone(988, 0, 0.12, g);
          tone(740, 0.14, 0.12, g);
          tone(988, 0.28, 0.12, g);
          tone(740, 0.42, 0.18, g);
        } else {
          tone(660, 0, 0.16, g);
        }
        return true;
      } catch (error) {
        return false;
      }
    },
    last: null
  };
  DT.Sound = Sound;

  /* ------------------------------ Batterie (en direct) ------------------------------ */
  const batteryPct = () => Math.max(0, Math.min(100, Math.round(battery.level * 100)));

  /** « 1 h 05 », « 25 min » : durée lisible, ou null si le navigateur ne la connaît pas. */
  function duration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    const minutes = Math.max(1, Math.round(seconds / 60));
    return minutes >= 60 ? Math.floor(minutes / 60) + " h " + String(minutes % 60).padStart(2, "0") : minutes + " min";
  }

  /** Phrase d'état : « 87 % · en charge · complète dans 25 min ». */
  function batteryStatus() {
    const pct = batteryPct();
    const parts = [pct + " %"];
    if (battery.charging) {
      parts.push(pct >= 100 ? "complètement chargée (branchée)" : "en charge");
      const left = duration(battery.toFull);
      if (left && pct < 100) parts.push("complète dans " + left);
    } else {
      parts.push("sur batterie");
      const left = duration(battery.toEmpty);
      if (left) parts.push("autonomie restante : " + left);
    }
    return parts.join(" · ");
  }

  /** Petite batterie dessinée : remplissage proportionnel, éclair quand elle charge. */
  function batteryGlyph() {
    const pct = batteryPct();
    return h("span", { class: "batt-glyph", "data-charging": String(battery.charging), "data-low": String(pct <= 20 && !battery.charging), "aria-hidden": "true" },
      h("span", { class: "batt-body" }, h("span", { class: "batt-fill", style: { width: pct + "%" } })),
      h("span", { class: "batt-bolt" }, DT.Icons.el("bolt", 11)));
  }

  function paintBattery() {
    if (!els.battery) return;
    const s = sys();
    const pct = batteryPct();
    els.batteryLabel.textContent = pct + " %";
    els.batteryGlyphBox.replaceChildren(batteryGlyph());
    els.battery.classList.toggle("is-low", pct <= 20 && !battery.charging);
    els.battery.classList.toggle("is-charging", battery.charging);
    els.battery.classList.toggle("is-saver", s.saver);
    els.battery.dataset.real = String(battery.real);
    els.battery.dataset.charging = String(battery.charging);
    els.battery.dataset.level = String(pct);
    const title = "Batterie : " + batteryStatus() + (s.saver ? " — économiseur activé" : "") + (battery.real ? " — mesure en direct fournie par votre navigateur" : " — valeur simulée (votre navigateur ne fournit pas la batterie)");
    els.battery.title = title;
    els.battery.setAttribute("aria-label", title);
    // Panneau rapide ouvert : on met à jour le texte sur place (sans le reconstruire, pour ne pas gêner les curseurs).
    const text = document.getElementById("qs-battery-text");
    if (text) text.textContent = "Batterie " + batteryStatus() + (battery.real ? "" : " (simulée)");
    const box = document.getElementById("qs-battery-glyph");
    if (box) box.replaceChildren(batteryGlyph());
  }

  /** Lecture réelle : mise à jour à chaque changement annoncé par le navigateur, et toutes les 5 s par sécurité. */
  function applyReal(b) {
    const next = { level: b.level, charging: b.charging, real: true, toFull: b.chargingTime, toEmpty: b.dischargingTime };
    const same = next.real === battery.real && Math.round(next.level * 100) === Math.round(battery.level * 100) && next.charging === battery.charging
      && duration(next.toFull) === duration(battery.toFull) && duration(next.toEmpty) === duration(battery.toEmpty);
    battery = next;
    if (!same) paintBattery();
  }

  /** Navigateur sans API batterie (Firefox, Safari) : valeur fictive qui évolue, clairement signalée « simulée ». */
  function simulateBattery() {
    battery = { level: Math.min(1, Math.max(0.05, battery.level)), charging: true, real: false, toFull: null, toEmpty: null };
    paintBattery();
    window.clearInterval(batteryTimer);
    batteryTimer = window.setInterval(() => {
      if (battery.charging && battery.level < 1) battery.level = Math.min(1, battery.level + 0.01);
      paintBattery();
    }, 30000);
  }

  function initBattery() {
    if (typeof navigator.getBattery !== "function") {
      simulateBattery();
      return;
    }
    navigator.getBattery().then((b) => {
      const sync = () => applyReal(b);
      sync();
      ["levelchange", "chargingchange", "chargingtimechange", "dischargingtimechange"].forEach((name) => b.addEventListener(name, sync));
      window.clearInterval(batteryTimer);
      batteryTimer = window.setInterval(sync, 5000);
    }).catch(() => simulateBattery());
  }

  /* ------------------------------ Icônes de la zone de notification ------------------------------ */
  function paintVolume() {
    if (!els.volume) return;
    const s = sys();
    const icon = s.muted || s.volume === 0 ? "volume-x" : s.volume < 40 ? "volume-1" : "volume-2";
    els.volume.replaceChildren(DT.Icons.el(icon, 18));
    const title = s.muted ? "Volume : son coupé" : "Volume : " + s.volume + " %";
    els.volume.title = title + " (simulation)";
    els.volume.setAttribute("aria-label", title);
    els.volume.classList.toggle("is-muted", s.muted || s.volume === 0);
  }

  function paintKeyboard() {
    if (!els.keyboard) return;
    const layout = LAYOUTS[sys().keyboard] || LAYOUTS.fr;
    els.keyboardLabel.textContent = layout.code;
    els.keyboard.title = "Disposition du clavier : " + layout.name + " (simulation)";
    els.keyboard.setAttribute("aria-label", els.keyboard.title);
  }

  function paintSecurity() {
    if (!els.security) return;
    const rs = DT.Store.state.ransom;
    const phase = rs ? rs.phase : "ready";
    const info = phase === "attacking" ? ["bad", "Menace en cours d'exécution"] : phase === "infected" ? ["bad", "Menace active : fichiers verrouillés"] : phase === "recovered" ? ["ok", "Poste rétabli : protection active"] : ["ok", "Protection active : aucun problème détecté"];
    els.security.dataset.state = info[0];
    els.security.replaceChildren(DT.Icons.el(info[0] === "bad" ? "shield-alert" : "shield", 18));
    els.security.title = "Sécurité EITT : " + info[1] + " (simulation)";
    els.security.setAttribute("aria-label", els.security.title);
  }

  function paintNetwork() {
    if (els.network) els.network.dataset.wifi = String(DT.Net.wifi && !DT.Net.airplane);
  }

  /* ------------------------------ Panneaux ------------------------------ */
  function closePanel() {
    if (!panel) return;
    panel.el.remove();
    if (panel.cleanup) panel.cleanup();
    const trigger = panel.trigger;
    panel = null;
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  }

  function openPanel(name, el, trigger, onTick) {
    const same = Boolean(panel && panel.name === name && panel.trigger === trigger);
    closePanel();
    if (same) return false;
    DT.Notify.closePanel();
    DT.Desktop.closeStart();
    DT.UI.closeMenus();
    el.dataset.panel = name;
    document.getElementById("desktop").append(el);
    if (trigger) trigger.setAttribute("aria-expanded", "true");
    const off = onTick ? DT.bus.on("clock:tick", onTick) : null;
    const outside = (event) => {
      if (panel && !panel.el.contains(event.target) && !(event.target.closest && event.target.closest(".tb-tray, #taskbar-clock"))) closePanel();
    };
    const esc = (event) => {
      if (event.key === "Escape") {
        const t = panel && panel.trigger;
        closePanel();
        if (t) t.focus();
      }
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", esc, true);
    panel = {
      name: name, el: el, trigger: trigger,
      cleanup: () => {
        if (off) off();
        document.removeEventListener("pointerdown", outside, true);
        document.removeEventListener("keydown", esc, true);
      }
    };
    return true;
  }

  /* ---- Calendrier ---- */
  let calView = new Date();
  function renderCalendar(el) {
    const today = new Date();
    const year = calView.getFullYear();
    const month = calView.getMonth();
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const total = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < offset; i += 1) cells.push(h("span", { class: "cal-cell is-empty", "aria-hidden": "true" }));
    for (let day = 1; day <= total; day += 1) {
      const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      cells.push(h("span", { class: "cal-cell" + (isToday ? " is-today" : ""), "aria-current": isToday ? "date" : null, text: String(day) }));
    }
    const long = today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    el.replaceChildren(
      h("div", { class: "cal-today" },
        h("strong", { class: "cal-time", id: "cal-time", text: DT.u.clockStrings(today).time }),
        h("span", { class: "muted", text: long.charAt(0).toUpperCase() + long.slice(1) })),
      h("div", { class: "cal-head" },
        h("button", { type: "button", class: "icon-btn", id: "cal-prev", "aria-label": "Mois précédent", onClick: () => { calView = new Date(year, month - 1, 1); renderCalendar(el); } }, DT.Icons.el("chevron-left", 16)),
        h("strong", { class: "cal-title", "aria-live": "polite", text: MONTHS[month] + " " + year }),
        h("button", { type: "button", class: "icon-btn", id: "cal-next", "aria-label": "Mois suivant", onClick: () => { calView = new Date(year, month + 1, 1); renderCalendar(el); } }, DT.Icons.el("chevron-right", 16))),
      h("div", { class: "cal-grid", role: "grid", "aria-label": "Calendrier de " + MONTHS[month] + " " + year },
        ...DAYS.map((d) => h("span", { class: "cal-dow", text: d })), ...cells),
      h("button", { type: "button", class: "btn cal-now", id: "cal-now", onClick: () => { calView = new Date(); renderCalendar(el); } }, "Aujourd'hui"));
  }

  function toggleCalendar() {
    calView = new Date();
    const el = h("div", { class: "cal-panel", id: "calendar-panel", role: "dialog", "aria-label": "Calendrier" });
    renderCalendar(el);
    openPanel("calendar", el, els.clock, (now) => {
      const t = document.getElementById("cal-time");
      if (t) t.textContent = DT.u.clockStrings(now || new Date()).time;
    });
  }

  /* ---- Paramètres rapides ---- */
  function applyVeils() {
    const s = sys();
    if (veil) veil.style.opacity = String(((100 - s.brightness) / 100) * 0.75);
    if (night) night.style.opacity = s.night ? "1" : "0";
    document.documentElement.dataset.saver = String(s.saver);
  }

  function refreshQuick() {
    if (panel && panel.name === "quick") buildQuick(panel.el);
  }

  function tile(id, icon, title, subtitle, on, onClick) {
    return h("button", { type: "button", class: "qs-tile" + (on ? " is-on" : ""), id: "qs-" + id, "aria-pressed": String(Boolean(on)), onClick: onClick },
      DT.Icons.el(icon, 20), h("span", { class: "qs-tile-text" }, h("strong", { text: title }), h("small", { text: subtitle })));
  }

  function buildQuick(el) {
    const s = sys();
    const wifiOn = DT.Net.wifi && !DT.Net.airplane;
    const refocus = (id) => window.requestAnimationFrame(() => { const t = document.getElementById(id); if (t) t.focus(); });
    const volume = h("input", { type: "range", class: "qs-range", id: "qs-volume", min: "0", max: "100", step: "1", value: String(s.muted ? 0 : s.volume), "aria-label": "Volume (simulation)" });
    const volValue = h("span", { class: "qs-value", id: "qs-volume-value", text: (s.muted ? 0 : s.volume) + " %" });
    volume.addEventListener("input", () => {
      const v = Number(volume.value);
      s.volume = v;
      if (v > 0) s.muted = false;
      volValue.textContent = v + " %";
      paintVolume();
      saveSys();
    });
    volume.addEventListener("change", () => { Sound.play("beep"); refreshQuick(); refocus("qs-volume"); });
    const muteBtn = h("button", { type: "button", class: "icon-btn qs-mute", id: "qs-mute", "aria-pressed": String(s.muted), "aria-label": s.muted ? "Réactiver le son" : "Couper le son", title: s.muted ? "Réactiver le son" : "Couper le son", onClick: () => {
      s.muted = !s.muted;
      saveSys();
      paintVolume();
      refreshQuick();
      refocus("qs-mute");
    } }, DT.Icons.el(s.muted || s.volume === 0 ? "volume-x" : "volume-2", 18));
    const bright = h("input", { type: "range", class: "qs-range", id: "qs-brightness", min: "25", max: "100", step: "1", value: String(s.brightness), "aria-label": "Luminosité (simulation)" });
    const brightValue = h("span", { class: "qs-value", id: "qs-brightness-value", text: s.brightness + " %" });
    bright.addEventListener("input", () => {
      s.brightness = Number(bright.value);
      brightValue.textContent = s.brightness + " %";
      applyVeils();
      saveSys();
    });
    const toggle = (fn, id) => () => { fn(); saveSys(); applyVeils(); paintBattery(); paintNetwork(); refreshQuick(); refocus(id); };
    el.replaceChildren(
      h("div", { class: "qs-grid" },
        tile("wifi", wifiOn ? "wifi" : "wifi-off", "Wi-Fi", wifiOn ? (DT.Net.isolated ? "Isolé (simulation)" : "EITT-Lab") : "Désactivé", wifiOn, toggle(() => { if (DT.Net.airplane) DT.Net.setAirplane(false); DT.Net.setWifi(!DT.Net.wifi); }, "qs-wifi")),
        tile("bluetooth", "bluetooth", "Bluetooth", s.bluetooth && !DT.Net.airplane ? "Activé" : "Désactivé", s.bluetooth && !DT.Net.airplane, toggle(() => { s.bluetooth = !s.bluetooth; }, "qs-bluetooth")),
        tile("airplane", "plane", "Mode avion", DT.Net.airplane ? "Activé" : "Désactivé", DT.Net.airplane, toggle(() => DT.Net.setAirplane(!DT.Net.airplane), "qs-airplane")),
        tile("saver", "leaf", "Économiseur", s.saver ? "Activé" : "Désactivé", s.saver, toggle(() => { s.saver = !s.saver; }, "qs-saver")),
        tile("night", "moon", "Mode nuit", s.night ? "Activé" : "Désactivé", s.night, toggle(() => { s.night = !s.night; }, "qs-night")),
        tile("theme", "sun", "Thème", DT.Settings.get("theme") === "light" ? "Clair" : "Sombre", DT.Settings.get("theme") === "dark", toggle(() => DT.Settings.set("theme", DT.Settings.get("theme") === "light" ? "dark" : "light"), "qs-theme"))),
      h("div", { class: "qs-row" }, DT.Icons.el("sun", 18), bright, brightValue),
      h("div", { class: "qs-row" }, muteBtn, volume, volValue),
      h("div", { class: "qs-foot" },
        h("span", { class: "qs-batt" }, h("span", { id: "qs-battery-glyph" }, batteryGlyph()), h("span", { id: "qs-battery-text", text: "Batterie " + batteryStatus() + (battery.real ? "" : " (simulée)") })),
        h("button", { type: "button", class: "btn", id: "qs-settings", onClick: () => { closePanel(); DT.WM.open("settings"); } }, DT.Icons.el("settings", 15), "Paramètres")),
      h("p", { class: "qs-note", text: "Ces réglages sont simulés : ils ne modifient pas le Wi-Fi, le son ni la luminosité de votre vrai ordinateur." }));
  }

  function toggleQuick(trigger) {
    const el = h("div", { class: "qs-panel", id: "quick-panel", role: "dialog", "aria-label": "Paramètres rapides" });
    buildQuick(el);
    openPanel("quick", el, trigger || els.network);
  }

  /* ---- Menus ---- */
  function keyboardMenu() {
    const r = els.keyboard.getBoundingClientRect();
    const current = sys().keyboard;
    DT.UI.contextMenu(Math.max(8, r.left - 130), r.top - 8, [
      ...Object.keys(LAYOUTS).map((id) => ({
        label: LAYOUTS[id].name,
        checked: current === id,
        action: () => {
          sys().keyboard = id;
          saveSys();
          paintKeyboard();
          DT.Notify.push({ title: "Disposition du clavier : " + LAYOUTS[id].name, message: "Simulation : la disposition réelle de votre clavier n'est pas modifiée.", type: "info", silent: true });
        }
      })),
      { separator: true },
      { label: "Paramètres de langue (simulation)", icon: "settings", action: () => DT.WM.open("settings") }
    ]);
  }

  function securityMenu() {
    const r = els.security.getBoundingClientRect();
    const rs = DT.Store.state.ransom;
    const phase = rs ? rs.phase : "ready";
    const lines = phase === "ready" ? ["Protection active : aucun problème détecté.", "Dernière analyse : à l'instant (simulation)."]
      : phase === "attacking" ? ["Menace en cours d'exécution !", "Des fichiers sont en train d'être verrouillés."]
        : phase === "infected" ? ["Menace active : fichiers verrouillés.", "Ouvrez le Ransomware Lab pour réagir."]
          : ["Poste rétabli.", "Consultez le bilan dans le Ransomware Lab."];
    DT.UI.contextMenu(Math.max(8, r.left - 170), r.top - 8, [
      { label: "Sécurité EITT (simulation)", icon: phase === "ready" || phase === "recovered" ? "shield" : "shield-alert", disabled: true },
      ...lines.map((label) => ({ label: label, disabled: true })),
      { separator: true },
      { label: "Ouvrir le Ransomware Lab", icon: "shield-alert", action: () => DT.WM.open("ransomlab", { tab: phase === "infected" ? "response" : "mission" }) }
    ]);
  }

  /* ------------------------------ Initialisation ------------------------------ */
  function init() {
    const area = document.querySelector(".tb-tray-area");
    const clock = document.getElementById("taskbar-clock");
    if (!area || !clock) return;
    const network = document.getElementById("tray-network");
    els.network = network;
    els.clock = clock;

    els.security = h("button", { type: "button", class: "tb-tray tb-security", id: "tray-security", "aria-haspopup": "menu" });
    els.keyboardLabel = h("span", { class: "tb-kbd-label" });
    els.keyboard = h("button", { type: "button", class: "tb-tray tb-kbd", id: "tray-keyboard", "aria-haspopup": "menu" }, els.keyboardLabel);
    els.volume = h("button", { type: "button", class: "tb-tray", id: "tray-volume", "aria-haspopup": "dialog", "aria-expanded": "false" });
    els.batteryLabel = h("span", { class: "tb-batt-label" });
    els.batteryGlyphBox = h("span", { class: "tb-batt-glyph" });
    els.battery = h("button", { type: "button", class: "tb-tray tb-batt", id: "tray-battery", "aria-haspopup": "dialog", "aria-expanded": "false" }, els.batteryGlyphBox, els.batteryLabel);

    area.insertBefore(els.security, area.firstChild);
    area.insertBefore(els.keyboard, network);
    area.insertBefore(els.volume, network.nextSibling);
    area.insertBefore(els.battery, els.volume.nextSibling);
    network.setAttribute("aria-haspopup", "dialog");
    network.setAttribute("aria-expanded", "false");

    // Le réseau, le volume et la batterie ouvrent le même panneau « Paramètres rapides ».
    network.addEventListener("click", (event) => { event.stopImmediatePropagation(); toggleQuick(network); }, true);
    els.volume.addEventListener("click", () => toggleQuick(els.volume));
    els.battery.addEventListener("click", () => toggleQuick(els.battery));
    els.volume.addEventListener("wheel", (event) => {
      event.preventDefault();
      const s = sys();
      s.volume = Math.max(0, Math.min(100, s.volume + (event.deltaY < 0 ? 5 : -5)));
      if (s.volume > 0) s.muted = false;
      saveSys();
      paintVolume();
      refreshQuick();
    }, { passive: false });
    els.keyboard.addEventListener("click", keyboardMenu);
    els.security.addEventListener("click", securityMenu);

    // Voiles de luminosité et de mode nuit (au-dessus de tout, sans capturer les clics).
    veil = h("div", { class: "veil veil-dark", id: "brightness-veil", "aria-hidden": "true" });
    night = h("div", { class: "veil veil-night", id: "night-veil", "aria-hidden": "true" });
    document.body.append(night, veil);

    clock.setAttribute("role", "button");
    clock.setAttribute("tabindex", "0");
    clock.setAttribute("aria-haspopup", "dialog");
    clock.setAttribute("aria-expanded", "false");
    clock.addEventListener("click", toggleCalendar);
    clock.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleCalendar();
      }
    });

    paintBattery();
    paintVolume();
    paintKeyboard();
    paintSecurity();
    paintNetwork();
    applyVeils();
    initBattery();
    DT.bus.on("session:change", (state) => { if (state !== "desktop") closePanel(); });
    DT.bus.on("net:change", () => { paintNetwork(); refreshQuick(); });
    DT.bus.on("ransom:change", paintSecurity);
  }

  DT.Tray = { init: init, closePanel: closePanel, closeCalendar: closePanel, sys: sys };
}());
