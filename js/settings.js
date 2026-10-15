/*
 * EITT OS — paramètres : moteur de personnalisation (fond d'écran, thème, accent, icônes, profils)
 * et application « Paramètres ». Toute modification est appliquée immédiatement ET sauvegardée localement.
 */
(function () {
  "use strict";
  const DT = window.DT;
  const { h, $, $$, formatSize, plural } = DT.u;

  /* ------------------------------ Fonds d'écran ------------------------------ */
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a += 0x6d2b79f5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const svgUrl = (svg) => 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")';

  function landscapeSvg() {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">' +
      '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1d3a"/><stop offset=".55" stop-color="#5a4b8a"/><stop offset="1" stop-color="#f4a66a"/></linearGradient>' +
      '<radialGradient id="sun"><stop offset="0" stop-color="#fff1c9"/><stop offset=".35" stop-color="#ffd08a" stop-opacity=".75"/><stop offset="1" stop-color="#ffb070" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4a66a" stop-opacity=".55"/><stop offset="1" stop-color="#0d1330"/></linearGradient></defs>' +
      '<rect width="1600" height="900" fill="url(#sky)"/>' +
      '<circle cx="1050" cy="520" r="280" fill="url(#sun)"/><circle cx="1050" cy="520" r="64" fill="#fff3d6"/>' +
      '<path d="M0 560 L180 430 L330 520 L520 380 L720 540 L900 450 L1120 560 L1320 420 L1600 560 L1600 900 L0 900Z" fill="#3b3f7c" opacity=".9"/>' +
      '<path d="M0 640 L220 520 L420 620 L640 500 L860 640 L1080 560 L1300 660 L1600 540 L1600 900 L0 900Z" fill="#262c5e"/>' +
      '<path d="M0 740 L260 640 L520 740 L800 660 L1100 760 L1400 690 L1600 760 L1600 900 L0 900Z" fill="#141838"/>' +
      '<rect y="760" width="1600" height="140" fill="url(#lake)"/>' +
      '<ellipse cx="1050" cy="800" rx="120" ry="10" fill="#ffe2b0" opacity=".5"/><ellipse cx="1050" cy="830" rx="70" ry="6" fill="#ffe2b0" opacity=".3"/>' +
      "</svg>"
    );
  }

  function spaceSvg() {
    const random = rng(42);
    let stars = "";
    for (let i = 0; i < 170; i += 1) {
      stars += '<circle cx="' + (random() * 1600).toFixed(1) + '" cy="' + (random() * 900).toFixed(1) + '" r="' + (0.4 + random() * 1.3).toFixed(2) + '" fill="#fff" opacity="' + (0.25 + random() * 0.75).toFixed(2) + '"/>';
    }
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">' +
      '<defs><radialGradient id="bg" cx=".5" cy=".5" r=".8"><stop offset="0" stop-color="#0b1230"/><stop offset="1" stop-color="#02030a"/></radialGradient>' +
      '<radialGradient id="n1"><stop offset="0" stop-color="#1677ff" stop-opacity=".38"/><stop offset="1" stop-color="#1677ff" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="n2"><stop offset="0" stop-color="#8b5cf6" stop-opacity=".32"/><stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="pl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient></defs>' +
      '<rect width="1600" height="900" fill="url(#bg)"/>' +
      '<circle cx="380" cy="300" r="440" fill="url(#n1)"/><circle cx="1260" cy="680" r="480" fill="url(#n2)"/>' +
      stars +
      '<g transform="translate(1250 250)"><ellipse rx="210" ry="48" transform="rotate(-18)" fill="none" stroke="#9be7ff" stroke-opacity=".35" stroke-width="6"/>' +
      '<circle r="118" fill="url(#pl)"/><ellipse rx="210" ry="48" transform="rotate(-18)" fill="none" stroke="#9be7ff" stroke-opacity=".55" stroke-width="3" stroke-dasharray="330 400" stroke-dashoffset="-120"/></g>' +
      "</svg>"
    );
  }

  function techSvg() {
    const random = rng(7);
    let nodes = "";
    const paths = [
      "M80 180 H360 L420 240 H700 L760 300 H980",
      "M120 760 H420 L480 700 H820 L880 640 H1120",
      "M1500 140 H1240 L1180 200 H960",
      "M1520 820 H1260 L1200 760 H1000 L940 700",
      "M60 480 H260 L320 420 H560",
      "M1000 80 V220 L1060 280 V420"
    ];
    let lines = "";
    paths.forEach((d) => {
      lines += '<path d="' + d + '" fill="none" stroke="#16ddf3" stroke-opacity=".42" stroke-width="2"/>';
    });
    for (let i = 0; i < 14; i += 1) {
      nodes += '<circle cx="' + Math.round(random() * 1500 + 50) + '" cy="' + Math.round(random() * 800 + 50) + '" r="' + (3 + random() * 3).toFixed(1) + '" fill="#16ddf3" opacity="' + (0.35 + random() * 0.5).toFixed(2) + '"/>';
    }
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">' +
      '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#040913"/><stop offset="1" stop-color="#0b2147"/></linearGradient>' +
      '<pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="#16ddf3" stroke-opacity=".07" stroke-width="1"/></pattern></defs>' +
      '<rect width="1600" height="900" fill="url(#bg)"/><rect width="1600" height="900" fill="url(#grid)"/>' +
      '<g fill="none" stroke="#16ddf3"><circle cx="1220" cy="430" r="90" stroke-opacity=".5" stroke-width="3"/><circle cx="1220" cy="430" r="150" stroke-opacity=".28" stroke-width="2"/>' +
      '<circle cx="1220" cy="430" r="220" stroke-opacity=".16" stroke-width="2" stroke-dasharray="6 14"/><circle cx="1220" cy="430" r="300" stroke-opacity=".1" stroke-width="2"/></g>' +
      lines + nodes + "</svg>"
    );
  }

  const WALLPAPERS = [
    {
      id: "eitt-blue",
      name: "Bleu EITT",
      css:
        "background-color:#050a14;" +
        "background-image:url(assets/logo/eitt-logo-watermark.png),radial-gradient(ellipse at 18% 8%,rgba(22,221,243,.26),transparent 55%),radial-gradient(ellipse at 88% 92%,rgba(22,119,255,.34),transparent 55%),linear-gradient(135deg,#050a14,#0a1a3a 55%,#071022);" +
        "background-repeat:no-repeat;background-position:center,0 0,0 0,0 0;background-size:min(56vw,680px) auto,100% 100%,100% 100%,100% 100%;"
    },
    { id: "landscape", name: "Paysage", css: "background:#101830 " + svgUrl(landscapeSvg()) + " center / cover no-repeat;" },
    { id: "space", name: "Espace", css: "background:#03050e " + svgUrl(spaceSvg()) + " center / cover no-repeat;" },
    { id: "dark-gradient", name: "Dégradé sombre", css: "background:linear-gradient(160deg,#04060c 0%,#0d1424 48%,#1a1030 100%);" },
    { id: "tech", name: "Abstrait technologique", css: "background:#040913 " + svgUrl(techSvg()) + " center / cover no-repeat;" },
    { id: "minimal", name: "Fond minimaliste", css: "background:#1a2233;" }
  ];

  const ACCENTS = [
    { id: "eitt", name: "Cyan EITT (logo)", hex: "#16DDF3" },
    { id: "blue", name: "Bleu EITT", hex: "#1677FF" },
    { id: "violet", name: "Violet", hex: "#8B5CF6" },
    { id: "green", name: "Vert", hex: "#22C55E" },
    { id: "orange", name: "Orange", hex: "#F59E0B" },
    { id: "pink", name: "Rose", hex: "#EC4899" }
  ];

  const ICON_SIZES = {
    small: { w: 76, h: 86, icon: 34, label: "Petites" },
    medium: { w: 92, h: 104, icon: 46, label: "Moyennes" },
    large: { w: 112, h: 126, icon: 60, label: "Grandes" }
  };

  /** Icônes d'application proposées sur le bureau (source unique pour Paramètres et Bureau). */
  const SYSTEM_ICONS = [
    { id: "ransomlab", label: "Ransomware Lab", appId: "ransomlab", tile: "ransomlab" },
    { id: "chat", label: "EITT Chat", appId: "chat", tile: "chat" },
    { id: "explorer", label: "Ce PC", appId: "explorer", tile: "explorer" },
    { id: "trash", label: "Corbeille", appId: "explorer", params: { loc: "trash" }, tile: "trash" },
    { id: "browser", label: "Navigateur", appId: "browser", tile: "browser" },
    { id: "notepad", label: "Bloc-notes", appId: "notepad", tile: "notepad" },
    { id: "dashboard", label: "État du PC", appId: "dashboard", tile: "dashboard" },
    { id: "terminal", label: "Terminal", appId: "terminal", tile: "terminal" },
    { id: "downloads", label: "Téléchargements", appId: "downloads", tile: "downloads" },
    { id: "taskmanager", label: "Gestionnaire des tâches", appId: "taskmanager", tile: "taskmanager" },
    { id: "settings", label: "Paramètres", appId: "settings", tile: "settings" }
  ];

  const settings = () => DT.Store.state.settings;

  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    const channel = (v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  }

  function wallpaperCss(id) {
    return (WALLPAPERS.find((w) => w.id === id) || WALLPAPERS[0]).css;
  }

  function apply() {
    const s = settings();
    const root = document.documentElement;
    root.dataset.theme = s.theme === "light" ? "light" : "dark";
    const hex = /^#[0-9a-f]{6}$/i.test(s.accent) ? s.accent : "#16DDF3";
    const n = parseInt(hex.slice(1), 16);
    root.style.setProperty("--accent", hex);
    root.style.setProperty("--accent-rgb", ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255));
    root.style.setProperty("--on-accent", luminance(hex) > 0.32 ? "#04121a" : "#ffffff");
    const size = ICON_SIZES[s.iconSize] || ICON_SIZES.medium;
    root.style.setProperty("--cell-w", size.w + "px");
    root.style.setProperty("--cell-h", size.h + "px");
    root.style.setProperty("--icon-px", size.icon + "px");
    const css = wallpaperCss(s.wallpaper);
    $$(".wallpaper-layer").forEach((layer) => {
      layer.style.cssText = css;
    });
  }

  function set(key, value) {
    settings()[key] = value;
    DT.Store.touch();
    apply();
    DT.bus.emit("settings:change", { key: key, value: value });
  }

  /* -------------------------------- Profils -------------------------------- */
  const profiles = () => DT.Store.state.profiles;
  const activeProfile = () => profiles().find((p) => p.id === DT.Store.state.activeProfile) || profiles()[0];

  function setActiveProfile(id) {
    if (!profiles().some((p) => p.id === id)) return;
    DT.Store.state.activeProfile = id;
    DT.Store.touch();
    DT.bus.emit("profile:change", activeProfile());
  }

  function validateProfileName(name) {
    const value = String(name || "").trim();
    if (!value) return "Le nom affiché ne peut pas être vide.";
    if (value.length > 30) return "Le nom affiché est trop long (30 caractères maximum).";
    if (/[\u0000-\u001f<>]/.test(value)) return "Le nom contient des caractères non autorisés.";
    return null;
  }

  function updateProfile(id, patch) {
    const profile = profiles().find((p) => p.id === id);
    if (!profile) return { ok: false, error: "Profil introuvable." };
    if (patch.name !== undefined) {
      const error = validateProfileName(patch.name);
      if (error) return { ok: false, error: error };
      profile.name = patch.name.trim();
    }
    if (patch.avatar !== undefined && DT.Icons.AVATAR_IDS.includes(patch.avatar)) profile.avatar = patch.avatar;
    DT.Store.touch();
    DT.bus.emit("profile:change", activeProfile());
    return { ok: true };
  }

  /* ----------------------------- Application Paramètres ----------------------------- */
  const PANELS = [
    { id: "wallpaper", label: "Fond d'écran", icon: "image" },
    { id: "appearance", label: "Apparence", icon: "sun" },
    { id: "profile", label: "Profil", icon: "user" },
    { id: "system", label: "Système", icon: "monitor" }
  ];

  function segmented(name, options, current, onChange) {
    const group = h("div", { class: "segmented", role: "radiogroup", "aria-label": name });
    options.forEach((opt) => {
      const button = h("button", {
        type: "button",
        class: "seg" + (opt.value === current ? " is-on" : ""),
        role: "radio",
        "aria-checked": String(opt.value === current),
        onClick: () => onChange(opt.value)
      }, opt.icon ? DT.Icons.el(opt.icon, 15) : null, opt.label);
      group.append(button);
    });
    return group;
  }

  function createSettingsApp(ctx) {
    let current = (ctx.params && ctx.params.panel) || "wallpaper";
    const nav = h("nav", { class: "set-nav", "aria-label": "Catégories de paramètres" });
    const content = h("div", { class: "set-content" });
    ctx.body.classList.add("settings-app");
    ctx.body.append(nav, content);

    function renderNav() {
      nav.replaceChildren(...PANELS.map((panel) => h("button", {
        type: "button",
        class: "set-nav-btn" + (panel.id === current ? " is-on" : ""),
        "aria-current": panel.id === current ? "page" : null,
        onClick: () => show(panel.id)
      }, DT.Icons.el(panel.icon, 18), h("span", { text: panel.label }))));
    }

    function section(title, intro, ...children) {
      return h("section", { class: "set-section" }, h("h2", { text: title }), intro ? h("p", { class: "muted", text: intro }) : null, ...children);
    }

    function wallpaperPanel() {
      const grid = h("div", { class: "wp-grid", role: "radiogroup", "aria-label": "Fonds d'écran" });
      WALLPAPERS.forEach((wp) => {
        const on = settings().wallpaper === wp.id;
        grid.append(h("button", {
          type: "button",
          class: "wp-thumb" + (on ? " is-on" : ""),
          role: "radio",
          "aria-checked": String(on),
          "data-wallpaper": wp.id,
          onClick: () => {
            set("wallpaper", wp.id);
            show("wallpaper");
          }
        }, h("span", { class: "wp-preview", style: wp.css }), h("span", { class: "wp-name", text: wp.name }), on ? h("span", { class: "wp-check" }, DT.Icons.el("check", 14)) : null));
      });
      return section("Fond d'écran", "Le fond change immédiatement et reste enregistré pour votre prochaine visite.", grid);
    }

    function appearancePanel() {
      const s = settings();
      const accents = h("div", { class: "swatches", role: "radiogroup", "aria-label": "Couleur d'accentuation" });
      ACCENTS.forEach((accent) => {
        const on = s.accent.toLowerCase() === accent.hex.toLowerCase();
        accents.append(h("button", {
          type: "button",
          class: "swatch" + (on ? " is-on" : ""),
          role: "radio",
          "aria-checked": String(on),
          "aria-label": accent.name,
          title: accent.name,
          "data-accent": accent.hex,
          style: { background: accent.hex },
          onClick: () => {
            set("accent", accent.hex);
            show("appearance");
          }
        }, on ? DT.Icons.el("check", 16) : null));
      });
      const custom = h("input", { type: "color", class: "color-input", value: /^#[0-9a-f]{6}$/i.test(s.accent) ? s.accent : "#16DDF3", "aria-label": "Couleur personnalisée" });
      custom.addEventListener("change", () => {
        set("accent", custom.value.toUpperCase());
        show("appearance");
      });

      const shown = new Set(s.shownIcons);
      const checks = h("div", { class: "check-grid" });
      SYSTEM_ICONS.forEach((icon) => {
        const id = "set-icon-" + icon.id;
        const input = h("input", { type: "checkbox", id: id, checked: shown.has(icon.id) ? true : null });
        input.addEventListener("change", () => {
          const list = new Set(settings().shownIcons);
          if (input.checked) list.add(icon.id);
          else list.delete(icon.id);
          set("shownIcons", SYSTEM_ICONS.map((i) => i.id).filter((i) => list.has(i)));
        });
        checks.append(h("label", { class: "check", for: id }, input, DT.Icons.tile(icon.tile, 22), h("span", { text: icon.label })));
      });
      const filesInput = h("input", { type: "checkbox", id: "set-icon-files", checked: s.showDesktopFiles ? true : null });
      filesInput.addEventListener("change", () => set("showDesktopFiles", filesInput.checked));
      checks.append(h("label", { class: "check", for: "set-icon-files" }, filesInput, DT.Icons.file("folder", 22), h("span", { text: "Fichiers du dossier Bureau" })));

      return h("div", null,
        section("Thème", "Choisissez l'apparence des fenêtres et des menus.",
          segmented("Thème", [{ value: "dark", label: "Sombre", icon: "moon" }, { value: "light", label: "Clair", icon: "sun" }], s.theme, (value) => {
            set("theme", value);
            show("appearance");
          })),
        section("Couleur d'accentuation", "Utilisée pour les boutons, les sélections et les contours lumineux.", h("div", { class: "swatch-row" }, accents, h("label", { class: "custom-color" }, custom, h("span", { text: "Personnalisée" })))),
        section("Taille des icônes du bureau", null,
          segmented("Taille des icônes", Object.keys(ICON_SIZES).map((key) => ({ value: key, label: ICON_SIZES[key].label })), s.iconSize, (value) => {
            set("iconSize", value);
            show("appearance");
          })),
        section("Icônes affichées sur le bureau", "Cochez les icônes à afficher. Vous pouvez aussi les déplacer à la souris.", checks));
    }

    function profilePanel() {
      const profile = activeProfile();
      const nameInput = h("input", { type: "text", class: "field", id: "set-name", value: profile.name, maxlength: 30, autocomplete: "off", spellcheck: "false" });
      const message = h("p", { class: "field-error", role: "alert" });
      const apply = () => {
        const result = updateProfile(profile.id, { name: nameInput.value });
        if (result.ok) {
          message.textContent = "";
          message.classList.remove("ok");
          DT.Notify.push({ title: "Profil mis à jour", message: "Le nom affiché est maintenant « " + nameInput.value.trim() + " ».", type: "success" });
          show("profile");
        } else {
          message.textContent = result.error;
          nameInput.focus();
        }
      };
      nameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") apply();
      });
      const avatars = h("div", { class: "avatar-grid", role: "radiogroup", "aria-label": "Avatar" });
      DT.Icons.AVATAR_IDS.forEach((id) => {
        const on = profile.avatar === id;
        avatars.append(h("button", {
          type: "button",
          class: "avatar-choice" + (on ? " is-on" : ""),
          role: "radio",
          "aria-checked": String(on),
          "aria-label": "Avatar " + id.slice(1),
          "data-avatar": id,
          onClick: () => {
            updateProfile(profile.id, { avatar: id });
            show("profile");
          }
        }, DT.Icons.avatar(id, 52)));
      });
      return h("div", null,
        section("Profil", "Ce compte est fictif et n'a pas de mot de passe : il ne correspond à aucun compte réel.",
          h("div", { class: "profile-preview" }, DT.Icons.avatar(profile.avatar, 64), h("div", null, h("strong", { text: profile.name }), h("div", { class: "muted", text: "Profil actif" })))),
        section("Nom affiché", null,
          h("div", { class: "inline-form" }, nameInput, h("button", { type: "button", class: "btn btn-primary", onClick: apply }, "Enregistrer le nom")), message),
        section("Avatar", null, avatars),
        section("Session", null, h("button", { type: "button", class: "btn", onClick: () => DT.Session.signOut() }, DT.Icons.el("log-out", 16), "Changer d'utilisateur (écran de connexion)")));
    }

    function systemPanel() {
      const stats = DT.FS.stats();
      const percent = Math.min(100, (stats.bytes / stats.capacity) * 100);
      const online = DT.Net ? DT.Net.online : navigator.onLine;
      const rows = [
        ["Nom de l'environnement", "EITT OS — Simulation pédagogique"],
        ["Version du système (fictive)", "EITT DT 1.0 — build 2026.10"],
        ["Profil actif", activeProfile().name],
        ["Réseau", (online ? "Connecté" : "Hors ligne") + " (état déclaré par le navigateur — ne garantit pas l'accès à Internet)"],
        ["Fichiers et dossiers", stats.files + " " + plural(stats.files, "fichier", "fichiers") + ", " + stats.folders + " " + plural(stats.folders, "dossier", "dossiers")],
        ["Sauvegarde locale", DT.Store.available ? "Active — environ " + formatSize(DT.Store.approxBytes()) + " dans le stockage local de ce navigateur" : "Indisponible : les modifications seront perdues à la fermeture de la page"]
      ];
      const list = h("dl", { class: "props" });
      rows.forEach(([label, value]) => list.append(h("dt", { text: label }), h("dd", { text: value })));
      return h("div", null,
        section("Système", null, list),
        section("Stockage simulé", "Disque virtuel fictif de " + formatSize(stats.capacity) + ". La valeur « utilisé » est calculée à partir des fichiers de la simulation.",
          h("div", { class: "bar", role: "progressbar", "aria-label": "Stockage utilisé", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": Math.round(percent) }, h("div", { class: "bar-fill", style: { width: Math.max(1, percent) + "%" } })),
          h("p", { text: formatSize(stats.bytes) + " utilisés — " + formatSize(stats.capacity - stats.bytes) + " disponibles" })),
        section("Réinitialiser la simulation", "Les données de la simulation (fichiers, corbeille, paramètres, profil) sont stockées localement dans votre navigateur. Elles ne constituent pas de véritables fichiers enregistrés sur votre ordinateur.",
          h("button", { type: "button", class: "btn btn-danger", id: "reset-simulation", onClick: resetSimulation }, DT.Icons.el("rotate-ccw", 16), "Réinitialiser la simulation…")));
    }

    async function resetSimulation() {
      const ok = await DT.UI.confirm({
        title: "Réinitialiser la simulation ?",
        message: "Tous les fichiers et dossiers que vous avez créés, la corbeille, les paramètres et le profil seront effacés, puis l'environnement initial sera restauré. Cette action est irréversible. Rappel : ces données sont stockées localement dans le navigateur ; ce ne sont pas de vrais fichiers de votre ordinateur.",
        okLabel: "Réinitialiser",
        cancelLabel: "Annuler",
        danger: true
      });
      if (ok) DT.Store.resetAndReload();
    }

    function show(id) {
      current = id;
      renderNav();
      const builders = { wallpaper: wallpaperPanel, appearance: appearancePanel, profile: profilePanel, system: systemPanel };
      content.replaceChildren((builders[id] || wallpaperPanel)());
    }

    const offs = [
      DT.bus.on("net:change", () => current === "system" && show("system")),
      DT.bus.on("fs:change", () => current === "system" && show("system")),
      DT.bus.on("profile:change", () => (current === "profile" || current === "system") && show(current))
    ];
    ctx.onClose(() => offs.forEach((off) => off()));
    ctx.onParams((params) => params && params.panel && show(params.panel));
    show(current);
  }

  DT.WM.registerApp({
    id: "settings",
    title: "Paramètres",
    tile: "settings",
    size: { w: 820, h: 560 },
    minSize: { w: 460, h: 360 },
    singleton: true,
    keywords: ["fond", "écran", "thème", "couleur", "profil", "système", "réinitialiser"],
    create: createSettingsApp
  });

  DT.Settings = {
    wallpapers: WALLPAPERS,
    accents: ACCENTS,
    iconSizes: ICON_SIZES,
    systemIcons: SYSTEM_ICONS,
    get: (key) => settings()[key],
    set: set,
    apply: apply,
    wallpaperCss: wallpaperCss,
    cell: () => ICON_SIZES[settings().iconSize] || ICON_SIZES.medium,
    profiles: profiles,
    activeProfile: activeProfile,
    setActiveProfile: setActiveProfile,
    updateProfile: updateProfile
  };
}());
