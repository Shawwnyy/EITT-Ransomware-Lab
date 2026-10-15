/*
 * EITT OS — gestionnaire de fenêtres.
 *
 * Les applications s'enregistrent avec DT.WM.registerApp({ id, title, tile, size, minSize, singleton, create(ctx) }).
 * ctx = { win, body, params, setTitle(t), setBeforeClose(fn), onParams(fn), onClose(fn), close() }
 *
 * Fonctions : déplacer (souris/tactile), redimensionner, réduire, agrandir/restaurer, fermer,
 * premier plan au clic, plusieurs fenêtres, ouverture en plein écran sur petit écran.
 * Événement : "wm:change" (ouverture, fermeture, focus, réduction, titre).
 */
(function () {
  "use strict";
  const DT = window.DT;
  const { h, $, $$, clamp } = DT.u;

  const apps = new Map();
  const windows = [];
  let zCounter = 20;
  let cascade = 0;
  let activeWin = null;
  let hiddenByShowDesktop = [];

  const layer = () => document.getElementById("windows-layer");
  const areaSize = () => {
    const rect = layer().getBoundingClientRect();
    return { w: rect.width || window.innerWidth, h: rect.height || window.innerHeight - 48 };
  };
  const isNarrow = () => areaSize().w < 720;
  const animMs = () => (DT.u.prefersReducedMotion() ? 0 : 170);

  function registerApp(def) {
    apps.set(def.id, def);
  }

  const getApp = (id) => apps.get(id) || null;
  const emit = () => DT.bus.emit("wm:change", { active: activeWin, windows: windows.slice() });

  function setRect(win, rect) {
    win.el.style.left = Math.round(rect.x) + "px";
    win.el.style.top = Math.round(rect.y) + "px";
    win.el.style.width = Math.round(rect.w) + "px";
    win.el.style.height = Math.round(rect.h) + "px";
  }

  function getRect(win) {
    return { x: win.el.offsetLeft, y: win.el.offsetTop, w: win.el.offsetWidth, h: win.el.offsetHeight };
  }

  function open(appId, params) {
    const def = apps.get(appId);
    if (!def) return null;
    if (def.singleton) {
      // Une fenêtre en cours de fermeture ne compte pas : relancer l'application ouvre une nouvelle fenêtre.
      const existing = windows.find((w) => w.appId === appId && !w.closing);
      if (existing) {
        restore(existing);
        focus(existing);
        if (existing.paramsHandler) existing.paramsHandler(params || {});
        return existing;
      }
    }
    return createWindow(def, params || {});
  }

  function createWindow(def, params) {
    const area = areaSize();
    const minSize = def.minSize || { w: 320, h: 220 };
    const wanted = def.size || { w: 720, h: 480 };
    const w = Math.max(Math.min(minSize.w, area.w), Math.min(wanted.w, area.w - 24));
    const hgt = Math.max(Math.min(minSize.h, area.h), Math.min(wanted.h, area.h - 24));
    const step = cascade % 8;
    cascade += 1;
    const x = clamp(36 + step * 28, 0, Math.max(0, area.w - w - 8));
    const y = clamp(24 + step * 26, 0, Math.max(0, area.h - hgt - 8));

    const id = DT.u.uid("win");
    const titleEl = h("span", { class: "win-title", text: def.title });
    const iconEl = h("span", { class: "win-icon" }, DT.Icons.tile(def.tile || def.id, 18));
    const btnMin = h("button", { type: "button", class: "win-btn", "aria-label": "Réduire la fenêtre", title: "Réduire", onClick: () => minimize(win) }, DT.Icons.el("minus", 14));
    const btnMax = h("button", { type: "button", class: "win-btn", "aria-label": "Agrandir la fenêtre", title: "Agrandir", onClick: () => toggleMaximize(win) }, DT.Icons.el("square", 13));
    const btnClose = h("button", { type: "button", class: "win-btn win-close", "aria-label": "Fermer la fenêtre", title: "Fermer", onClick: () => close(win) }, DT.Icons.el("x", 15));
    const titlebar = h("div", { class: "win-titlebar" }, iconEl, titleEl, h("div", { class: "win-controls" }, btnMin, btnMax, btnClose));
    const body = h("div", { class: "win-body" });
    const el = h("div", { class: "win opening", role: "group", "aria-label": def.title, tabindex: "-1", "data-win": id, "data-app": def.id }, titlebar, body);
    ["n", "s", "e", "w", "ne", "nw", "se", "sw"].forEach((dir) => el.append(h("div", { class: "win-resize win-resize-" + dir, "data-dir": dir })));

    const win = {
      id: id,
      appId: def.id,
      def: def,
      el: el,
      body: body,
      titleEl: titleEl,
      title: def.title,
      btnMax: btnMax,
      minimized: false,
      maximized: false,
      restoreRect: null,
      beforeClose: null,
      paramsHandler: null,
      closeHandlers: [],
      closing: false,
      opened: Date.now()
    };

    setRect(win, { x: x, y: y, w: w, h: hgt });
    layer().append(el);
    windows.push(win);
    wireWindow(win, titlebar);

    const ctx = {
      win: win,
      body: body,
      params: params,
      setTitle: (title) => setTitle(win, title),
      setBeforeClose: (fn) => {
        win.beforeClose = fn;
      },
      onParams: (fn) => {
        win.paramsHandler = fn;
      },
      onClose: (fn) => win.closeHandlers.push(fn),
      close: () => close(win)
    };
    try {
      def.create(ctx);
    } catch (error) {
      if (window.console) console.error("[EITT] Erreur à l'ouverture de « " + def.title + " » :", error);
      body.replaceChildren(h("div", { class: "app-error" }, h("strong", { text: "Cette application a rencontré une erreur." }), h("p", { text: "Fermez la fenêtre et réessayez. Le reste de la simulation n'est pas affecté." })));
    }

    if (isNarrow()) maximize(win, true);
    focus(win);
    window.setTimeout(() => el.classList.remove("opening"), animMs() + 20);
    emit();
    return win;
  }

  function setTitle(win, title) {
    win.title = title;
    win.titleEl.textContent = title;
    win.el.setAttribute("aria-label", title);
    emit();
  }

  /* ------------------------------- États ------------------------------- */
  function focus(win) {
    if (!win || win.closing) return;
    if (win.minimized) restore(win);
    zCounter += 1;
    win.el.style.zIndex = String(zCounter);
    if (activeWin !== win) {
      if (activeWin) activeWin.el.classList.remove("active");
      activeWin = win;
      win.el.classList.add("active");
    }
    if (!win.el.contains(document.activeElement)) win.el.focus({ preventScroll: true });
    emit();
  }

  function topVisible() {
    return windows
      .filter((w) => !w.minimized && !w.closing)
      .sort((a, b) => Number(b.el.style.zIndex) - Number(a.el.style.zIndex))[0] || null;
  }

  function minimize(win) {
    if (!win || win.minimized || win.closing) return;
    win.minimized = true;
    win.el.classList.add("minimizing");
    window.setTimeout(() => {
      if (!win.minimized) return;
      win.el.classList.remove("minimizing");
      win.el.classList.add("is-minimized");
      win.el.setAttribute("aria-hidden", "true");
      win.el.hidden = true;
    }, animMs());
    if (activeWin === win) {
      win.el.classList.remove("active");
      activeWin = null;
      const next = windows.filter((w) => w !== win && !w.minimized && !w.closing).sort((a, b) => Number(b.el.style.zIndex) - Number(a.el.style.zIndex))[0];
      if (next) focus(next);
    }
    emit();
  }

  function restore(win) {
    if (!win || !win.minimized) return;
    win.minimized = false;
    win.el.hidden = false;
    win.el.removeAttribute("aria-hidden");
    win.el.classList.remove("is-minimized", "minimizing");
    win.el.classList.add("restoring");
    window.setTimeout(() => win.el.classList.remove("restoring"), animMs() + 20);
    emit();
  }

  function maximize(win, silent) {
    if (win.maximized) return;
    win.restoreRect = getRect(win);
    win.maximized = true;
    win.el.classList.add("maximized");
    win.btnMax.setAttribute("aria-label", "Restaurer la fenêtre");
    win.btnMax.title = "Restaurer";
    win.btnMax.replaceChildren(DT.Icons.el("restore", 14));
    if (!silent) emit();
  }

  function unmaximize(win) {
    if (!win.maximized) return;
    win.maximized = false;
    win.el.classList.remove("maximized");
    if (win.restoreRect) setRect(win, win.restoreRect);
    win.btnMax.setAttribute("aria-label", "Agrandir la fenêtre");
    win.btnMax.title = "Agrandir";
    win.btnMax.replaceChildren(DT.Icons.el("square", 13));
    emit();
  }

  function toggleMaximize(win) {
    if (win.maximized) unmaximize(win);
    else maximize(win);
    focus(win);
  }

  /** Ferme une fenêtre. Une application peut refuser (documents non enregistrés) via setBeforeClose. */
  async function close(win, options) {
    if (!win || win.closing) return false;
    if (!(options && options.force) && typeof win.beforeClose === "function") {
      const allowed = await win.beforeClose();
      if (allowed === false) return false;
    }
    if (win.closing) return false;
    win.closing = true;
    win.el.classList.add("closing");
    await new Promise((resolve) => window.setTimeout(resolve, animMs()));
    win.closeHandlers.forEach((fn) => {
      try {
        fn();
      } catch (error) {
        if (window.console) console.error(error);
      }
    });
    win.el.remove();
    const index = windows.indexOf(win);
    if (index >= 0) windows.splice(index, 1);
    if (activeWin === win) {
      activeWin = null;
      const next = topVisible();
      if (next) focus(next);
    }
    emit();
    return true;
  }

  async function closeAll() {
    for (const win of windows.slice()) {
      const closed = await close(win);
      if (!closed) return false;
    }
    return true;
  }

  function showDesktop() {
    const visible = windows.filter((w) => !w.minimized && !w.closing);
    if (visible.length) {
      hiddenByShowDesktop = visible;
      visible.forEach(minimize);
    } else {
      hiddenByShowDesktop.filter((w) => windows.includes(w)).forEach(restore);
      const last = hiddenByShowDesktop.filter((w) => windows.includes(w)).pop();
      if (last) focus(last);
      hiddenByShowDesktop = [];
    }
  }

  /* ----------------------------- Interactions ----------------------------- */
  function wireWindow(win, titlebar) {
    const el = win.el;

    // Premier plan dès qu'on touche la fenêtre
    el.addEventListener("pointerdown", () => {
      if (activeWin !== win) focus(win);
    }, true);

    titlebar.addEventListener("dblclick", (event) => {
      if (!event.target.closest(".win-controls")) toggleMaximize(win);
    });

    // Déplacement par la barre de titre
    let drag = null;
    titlebar.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest(".win-controls")) return;
      drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, rect: getRect(win), moved: false };
      titlebar.setPointerCapture(event.pointerId);
    });
    titlebar.addEventListener("pointermove", (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      const area = areaSize();
      if (!drag.moved) {
        drag.moved = true;
        if (win.maximized) {
          if (isNarrow()) {
            drag = null;
            return;
          }
          const ratio = (event.clientX - layer().getBoundingClientRect().left) / area.w;
          const restored = win.restoreRect || { x: 60, y: 40, w: 720, h: 480 };
          win.maximized = false;
          el.classList.remove("maximized");
          win.btnMax.replaceChildren(DT.Icons.el("square", 13));
          win.btnMax.setAttribute("aria-label", "Agrandir la fenêtre");
          setRect(win, { x: restored.x, y: restored.y, w: restored.w, h: restored.h });
          drag.rect = { x: clamp(ratio * area.w - restored.w * ratio, 0, area.w - restored.w), y: 0, w: restored.w, h: restored.h };
          drag.startX = event.clientX;
          drag.startY = event.clientY;
          setRect(win, drag.rect);
          return;
        }
      }
      if (win.maximized) return;
      const x = clamp(drag.rect.x + (event.clientX - drag.startX), -(drag.rect.w - 120), area.w - 120);
      const y = clamp(drag.rect.y + (event.clientY - drag.startY), 0, area.h - 36);
      el.style.left = Math.round(x) + "px";
      el.style.top = Math.round(y) + "px";
    });
    const endDrag = (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const moved = drag.moved;
      drag = null;
      if (titlebar.hasPointerCapture(event.pointerId)) titlebar.releasePointerCapture(event.pointerId);
      if (moved && !win.maximized && event.clientY - layer().getBoundingClientRect().top <= 2 && event.type === "pointerup") maximize(win);
    };
    titlebar.addEventListener("pointerup", endDrag);
    titlebar.addEventListener("pointercancel", endDrag);

    // Redimensionnement par les bords et les coins
    $$(".win-resize", el).forEach((handle) => {
      let state = null;
      handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || win.maximized) return;
        event.preventDefault();
        state = { id: event.pointerId, startX: event.clientX, startY: event.clientY, rect: getRect(win), dir: handle.dataset.dir };
        handle.setPointerCapture(event.pointerId);
      });
      handle.addEventListener("pointermove", (event) => {
        if (!state || state.id !== event.pointerId) return;
        const dx = event.clientX - state.startX;
        const dy = event.clientY - state.startY;
        const min = win.def.minSize || { w: 320, h: 220 };
        const area = areaSize();
        let { x, y, w, h: hgt } = state.rect;
        if (state.dir.includes("e")) w = state.rect.w + dx;
        if (state.dir.includes("s")) hgt = state.rect.h + dy;
        if (state.dir.includes("w")) {
          w = state.rect.w - dx;
          x = state.rect.x + dx;
        }
        if (state.dir.includes("n")) {
          hgt = state.rect.h - dy;
          y = state.rect.y + dy;
        }
        if (w < min.w) {
          if (state.dir.includes("w")) x -= min.w - w;
          w = min.w;
        }
        if (hgt < min.h) {
          if (state.dir.includes("n")) y -= min.h - hgt;
          hgt = min.h;
        }
        if (y < 0) {
          hgt += y;
          y = 0;
        }
        w = Math.min(w, Math.max(min.w, area.w - Math.max(0, x)));
        setRect(win, { x: x, y: y, w: w, h: Math.min(hgt, area.h - y) });
      });
      const end = (event) => {
        if (state && state.id === event.pointerId) {
          if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
          state = null;
        }
      };
      handle.addEventListener("pointerup", end);
      handle.addEventListener("pointercancel", end);
    });
  }

  // Les fenêtres restent dans la zone visible quand la fenêtre du navigateur change de taille.
  window.addEventListener("resize", () => {
    const area = areaSize();
    windows.forEach((win) => {
      if (win.maximized) return;
      const rect = getRect(win);
      const w = Math.min(rect.w, area.w);
      const hgt = Math.min(rect.h, area.h);
      setRect(win, { x: clamp(rect.x, 0, Math.max(0, area.w - w)), y: clamp(rect.y, 0, Math.max(0, area.h - hgt)), w: w, h: hgt });
    });
    if (isNarrow()) windows.forEach((win) => maximize(win, true));
  });

  DT.WM = {
    registerApp: registerApp,
    getApp: getApp,
    apps: () => Array.from(apps.values()),
    open: open,
    focus: focus,
    minimize: minimize,
    restore: restore,
    toggleMaximize: toggleMaximize,
    close: close,
    closeAll: closeAll,
    showDesktop: showDesktop,
    list: () => windows.slice(),
    active: () => activeWin,
    byApp: (appId) => windows.filter((w) => w.appId === appId),
    count: () => windows.length,
    setTitle: setTitle
  };
}());
