/*
 * EITT OS — session : démarrage, connexion, verrouillage, veille, arrêt et redémarrage SIMULÉS.
 *
 * Aucune de ces actions n'agit sur le vrai ordinateur : elles ne changent que l'état de cette page web
 * (écrans affichés). Il n'y a ni mot de passe, ni compte réel : les profils sont fictifs.
 */
(function () {
  "use strict";
  const DT = window.DT;
  const { h, $, clockStrings } = DT.u;

  let state = "off"; // off | boot | login | desktop | locked | sleeping | shutdown | restarting
  let startedAt = null;
  let welcomed = false;
  let screenRoot;
  let desktopEl;
  let busy = false;
  const cleanups = [];

  const reduceMotion = () => DT.u.prefersReducedMotion();
  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, reduceMotion() ? Math.min(ms, 120) : ms));

  function setState(next) {
    state = next;
    document.documentElement.dataset.session = next;
    DT.bus.emit("session:change", next);
  }

  /* ------------------------------ Aides d'écran ------------------------------ */
  function makeScreen(name, withWallpaper) {
    const el = h("section", { class: "screen screen-" + name, id: "screen-" + name, "aria-label": name });
    if (withWallpaper) el.append(h("div", { class: "wallpaper-layer" }), h("div", { class: "screen-dim" }));
    screenRoot.append(el);
    if (withWallpaper) DT.Settings.apply();
    window.requestAnimationFrame(() => el.classList.add("is-in"));
    return el;
  }

  async function removeScreen(el) {
    if (!el) return;
    el.classList.remove("is-in");
    el.classList.add("is-out");
    await wait(260);
    el.remove();
  }

  function removeAllScreens() {
    cleanups.splice(0).forEach((fn) => fn());
    Array.from(screenRoot.children).forEach((el) => el.remove());
  }

  function bindClock(el) {
    const time = $(".sc-time", el);
    const date = $(".sc-date", el);
    const paint = (now) => {
      const text = clockStrings(now || new Date());
      if (time) time.textContent = text.time;
      if (date) date.textContent = text.date;
    };
    paint();
    const off = DT.bus.on("clock:tick", paint);
    cleanups.push(off);
  }

  function showDesktop(on) {
    desktopEl.classList.toggle("is-off", !on);
    desktopEl.inert = !on;
    desktopEl.setAttribute("aria-hidden", String(!on));
  }

  function closeTransient() {
    DT.UI.closeMenus();
    DT.Desktop.closeStart();
    DT.Notify.closePanel();
  }

  /* ------------------------------ Démarrage ------------------------------ */
  function boot() {
    removeAllScreens();
    showDesktop(false);
    setState("boot");
    const messages = [
      "Démarrage de la simulation EITT…",
      "Chargement du système de fichiers virtuel…",
      "Lecture de la sauvegarde locale du navigateur…",
      "Préparation des applications…",
      "Votre environnement virtuel est prêt."
    ];
    const screen = makeScreen("boot", false);
    const video = h("video", { class: "boot-video", muted: true, autoplay: true, playsinline: true, preload: "auto", "aria-hidden": "true", tabindex: "-1" });
    video.muted = true;
    video.append(h("source", { src: "assets/logo/eitt-logo-animation.mp4", type: "video/mp4" }));
    const fallback = h("img", { class: "boot-logo-static", src: "assets/logo/eitt-logo.png", alt: "Logo EITT", draggable: "false", hidden: true });
    const message = h("p", { class: "boot-message", role: "status", "aria-live": "polite", text: messages[0] });
    const barFill = h("div", { class: "bar-fill" });
    const bar = h("div", { class: "bar boot-bar", role: "progressbar", "aria-label": "Chargement de la simulation", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": "0" }, barFill);
    const skip = h("button", { type: "button", class: "btn boot-skip", id: "boot-skip" }, "Passer");
    screen.append(
      h("div", { class: "boot-center" }, video, fallback, message, bar,
        h("p", { class: "boot-note muted", text: "Simulation pédagogique EITT — votre véritable ordinateur n'est pas modifié." })),
      skip);
    const useFallback = () => {
      video.hidden = true;
      fallback.hidden = false;
    };
    video.addEventListener("error", useFallback, true);
    if (reduceMotion()) useFallback();
    else {
      const attempt = video.play();
      if (attempt && typeof attempt.catch === "function") attempt.catch(useFallback);
    }

    let finished = false;
    let progress = 0;
    const total = reduceMotion() ? 600 : 3600;
    const startTime = Date.now();
    const timer = window.setInterval(() => {
      progress = Math.min(100, ((Date.now() - startTime) / total) * 100);
      barFill.style.width = progress + "%";
      bar.setAttribute("aria-valuenow", String(Math.round(progress)));
      message.textContent = messages[Math.min(messages.length - 1, Math.floor((progress / 100) * messages.length))];
      if (progress >= 100) done();
    }, 60);
    function done() {
      if (finished) return;
      finished = true;
      window.clearInterval(timer);
      showLogin();
    }
    cleanups.push(() => {
      finished = true;
      window.clearInterval(timer);
      video.pause();
    });
    skip.addEventListener("click", done);
    skip.focus();
  }

  /* ------------------------------ Connexion ------------------------------ */
  /* ------------------------------ Connexion (sans mot de passe) ------------------------------ */
  /** Ouverture de session en un clic : comptes fictifs de démonstration, aucun mot de passe. */
  function showLogin(options) {
    removeAllScreens();
    showDesktop(false);
    setState("login");
    const screen = makeScreen("login", true);
    const profiles = DT.Settings.profiles();
    const last = DT.Settings.activeProfile().id;
    let working = false;

    const loading = h("div", { class: "login-loading", id: "login-loading", hidden: true, role: "status" },
      h("div", { class: "spinner", "aria-hidden": "true" }), h("span", { text: "Ouverture de la session…" }));
    const buttons = profiles.map((p) => h("button", {
      type: "button",
      class: "login-account" + (p.id === last ? " is-last" : ""),
      id: "login-" + p.id,
      "data-profile": p.id,
      "aria-label": "Ouvrir la session de " + p.name,
      onClick: async (event) => {
        if (working) return;
        working = true;
        buttons.forEach((b) => { b.disabled = true; });
        event.currentTarget.classList.add("is-picked");
        loading.hidden = false;
        await wait(reduceMotion() ? 0 : 650);
        signIn(p.id);
      }
    }, DT.Icons.avatar(p.avatar, 96), h("span", { class: "login-account-name", text: p.name }), h("span", { class: "login-account-go", text: "Ouvrir la session" })));

    const powerBtn = h("button", { type: "button", class: "icon-btn login-power", id: "login-power", title: "Alimentation de la simulation", "aria-label": "Alimentation de la simulation", onClick: async () => {
      const choice = await DT.UI.choose({ title: "Alimentation", message: "Ces actions ne concernent que la simulation, jamais votre vrai ordinateur.", dismiss: "cancel", buttons: [{ label: "Annuler", value: "cancel" }, { label: "Redémarrer", value: "restart" }, { label: "Arrêter", value: "shutdown", primary: true }] });
      if (choice === "shutdown") shutdown();
      else if (choice === "restart") restart();
    } }, DT.Icons.el("power", 20));

    screen.append(
      h("div", { class: "login-center" },
        h("div", { class: "sc-time" }), h("div", { class: "sc-date" }),
        h("img", { class: "login-logo", src: "assets/logo/eitt-logo.png", alt: "EITT", draggable: "false" }),
        h("p", { class: "login-os", text: "EITT OS" }),
        h("p", { class: "login-prompt", id: "login-prompt", text: "Choisissez votre session" }),
        h("div", { class: "login-accounts", role: "group", "aria-labelledby": "login-prompt" }, ...buttons),
        loading,
        h("p", { class: "login-note muted", id: "login-note", text: "Comptes fictifs de démonstration, sans mot de passe : ils ne sont liés à aucun compte réel." })),
      powerBtn);
    bindClock(screen);
    window.setTimeout(() => { const first = buttons.find((b) => b.dataset.profile === last) || buttons[0]; if (first) first.focus({ preventScroll: true }); }, 60);
    void options;
  }

  async function signIn(profileId) {
    if (busy) return;
    busy = true;
    DT.Settings.setActiveProfile(profileId);
    const screen = $("#screen-login");
    showDesktop(true);
    startedAt = Date.now();
    setState("desktop");
    cleanups.splice(0).forEach((fn) => fn());
    await removeScreen(screen);
    busy = false;
    const profile = DT.Settings.activeProfile();
    if (!welcomed) {
      welcomed = true;
      DT.Notify.push({ title: "Bienvenue dans EITT OS.", message: "Session ouverte pour " + profile.name + ". Ouvrez « Ransomware Lab » pour commencer l'exercice.", type: "info" });
      DT.Notify.push({ title: "Votre environnement virtuel est prêt.", message: "Tout reste dans ce navigateur : aucun vrai fichier n'est touché.", type: "success", silent: true });
      if (!DT.Net.online) DT.Notify.push({ title: "Vous êtes actuellement hors ligne selon le navigateur.", message: "Les sites fictifs et vos fichiers restent disponibles.", type: "warning" });
    } else {
      DT.Notify.push({ title: "Session ouverte", message: "Connecté en tant que " + profile.name + ".", type: "info" });
    }
    DT.bus.emit("session:signin", profile);
    const first = document.getElementById("start-button");
    if (first) first.focus({ preventScroll: true });
  }

  /** Retour à l'écran de connexion (changement d'utilisateur). Les fenêtres sont fermées proprement. */
  async function signOut() {
    if (busy || state !== "desktop") return false;
    busy = true;
    closeTransient();
    const closed = await DT.WM.closeAll();
    busy = false;
    if (!closed) {
      DT.Notify.push({ title: "Changement d'utilisateur annulé", message: "Une fenêtre a demandé à enregistrer ses modifications.", type: "warning" });
      return false;
    }
    DT.Store.flush();
    showLogin();
    return true;
  }

  /* ------------------------------ Verrouillage ------------------------------ */
  function lock() {
    if (state !== "desktop" || busy) return;
    closeTransient();
    const screen = makeScreen("lock", true);
    const profile = DT.Settings.activeProfile();
    const unlockBtn = h("button", { type: "button", class: "btn btn-primary btn-large", id: "unlock-button", onClick: () => unlock() }, DT.Icons.el("log-out", 18), "Déverrouiller");
    screen.append(h("div", { class: "login-center lock-center" },
      h("div", { class: "sc-time" }), h("div", { class: "sc-date" }),
      DT.Icons.avatar(profile.avatar, 96),
      h("h1", { class: "login-title", text: profile.name }),
      h("p", { class: "muted", text: "Session verrouillée (simulation) — vos fenêtres et vos données sont conservées." }),
      unlockBtn,
      h("div", { class: "lock-notices", id: "lock-notices", "aria-live": "polite" })));
    bindClock(screen);
    setState("locked");
    window.setTimeout(() => {
      if (state !== "locked") return; // déverrouillé entre-temps : ne pas recacher le bureau
      showDesktop(false);
      unlockBtn.focus({ preventScroll: true });
    }, reduceMotion() ? 0 : 280);
  }

  /**
   * Notification affichée SUR l'écran de verrouillage (comme sur un vrai ordinateur). Un clic dessus déverrouille la
   * session puis exécute spec.run (ex. ouvrir la messagerie). Renvoie false si la session n'est pas verrouillée.
   */
  function lockNotice(spec) {
    const zone = state === "locked" ? document.getElementById("lock-notices") : null;
    if (!zone) return false;
    const card = h("button", { type: "button", class: "lock-notice", "data-app": spec.app || "", onClick: async () => {
      card.disabled = true;
      await unlock();
      if (typeof spec.run === "function") spec.run();
    } },
    spec.app ? DT.Icons.tile(spec.app, 40) : null,
    h("span", { class: "lock-notice-text" },
      h("strong", { text: spec.title }),
      h("span", { text: spec.message }),
      h("small", { text: "Cliquer pour déverrouiller et répondre" })));
    zone.append(card);
    return true;
  }

  async function unlock() {
    if (state !== "locked") return;
    const screen = $("#screen-lock");
    cleanups.splice(0).forEach((fn) => fn());
    showDesktop(true);
    setState("desktop");
    await removeScreen(screen);
    const active = DT.WM.active();
    if (active) active.el.focus({ preventScroll: true });
    DT.Notify.push({ title: "Session reprise", message: "Vos fenêtres ont été conservées.", type: "info", silent: true });
  }

  /* ------------------------------ Veille ------------------------------ */
  function sleep() {
    if (state !== "desktop" || busy) return;
    closeTransient();
    DT.Store.flush();
    const screen = makeScreen("sleep", false);
    screen.append(h("div", { class: "sleep-center" },
      h("img", { class: "sleep-logo", src: "assets/logo/eitt-mark.png", alt: "", draggable: "false" }),
      h("p", { class: "sleep-text", text: "Simulation en veille" }),
      h("button", { type: "button", class: "btn", id: "wake-button" }, "Reprendre"),
      h("p", { class: "muted small", text: "Touchez l'écran ou appuyez sur une touche. Votre vrai ordinateur n'est pas en veille." })));
    setState("sleeping");
    window.setTimeout(() => {
      if (state === "sleeping") showDesktop(false);
    }, reduceMotion() ? 0 : 260);
    const armedAt = Date.now() + 350; // évite de se réveiller avec la touche/le clic qui vient de lancer la veille
    let waking = false;
    const wake = (force) => {
      if (waking || (force !== true && Date.now() < armedAt)) return;
      waking = true;
      document.removeEventListener("keydown", wake, true);
      removeScreen(screen).then(() => {
        setState("desktop");
        lockAfterSleep();
      });
    };
    screen.addEventListener("pointerdown", () => wake());
    document.addEventListener("keydown", wake, true);
    $("#wake-button", screen).addEventListener("click", () => wake(true));
    $("#wake-button", screen).focus();
  }

  function lockAfterSleep() {
    showDesktop(true);
    lock();
  }

  /* ------------------------------ Arrêt et redémarrage ------------------------------ */
  async function leaveSession(title, subtitle) {
    closeTransient();
    const closed = await DT.WM.closeAll();
    if (!closed) {
      DT.Notify.push({ title: "Opération annulée", message: "Une fenêtre a demandé à enregistrer ses modifications avant de fermer.", type: "warning" });
      return false;
    }
    DT.Store.flush();
    const screen = makeScreen("closing", false);
    screen.append(h("div", { class: "closing-center" },
      h("div", { class: "spinner", "aria-hidden": "true" }),
      h("p", { class: "closing-title", role: "status", text: title }),
      h("p", { class: "muted", text: subtitle })));
    return screen;
  }

  async function shutdown() {
    if (busy || (state !== "desktop" && state !== "login")) return;
    busy = true;
    const closing = await leaveSession("Fermeture de la session virtuelle...", "Enregistrement de la simulation en cours.");
    if (!closing) {
      busy = false;
      return;
    }
    setState("shutdown");
    showDesktop(false);
    await wait(1700);
    removeAllScreens();
    const screen = makeScreen("off", false);
    const again = h("button", { type: "button", class: "btn btn-primary btn-large", id: "restart-simulation" }, DT.Icons.el("restart", 18), "Redémarrer la simulation");
    again.addEventListener("click", () => {
      busy = false;
      boot();
    });
    screen.append(h("div", { class: "off-center" },
      h("img", { class: "sleep-logo is-dim", src: "assets/logo/eitt-mark.png", alt: "", draggable: "false" }),
      h("h1", { class: "off-title", text: "La simulation est arrêtée" }),
      h("p", { class: "muted", text: "Seule la simulation EITT OS est arrêtée. Votre véritable ordinateur est toujours allumé." }),
      again));
    busy = false;
    again.focus();
  }

  async function restart() {
    if (busy || (state !== "desktop" && state !== "login")) return;
    busy = true;
    const closing = await leaveSession("Redémarrage de la simulation...", "Votre véritable ordinateur ne redémarre pas.");
    if (!closing) {
      busy = false;
      return;
    }
    setState("restarting");
    showDesktop(false);
    await wait(1600);
    busy = false;
    showLogin();
  }

  DT.Session = {
    state: () => state,
    startedAt: () => startedAt,
    boot: boot,
    showLogin: showLogin,
    signIn: signIn,
    signOut: signOut,
    lockNotice: lockNotice,
    lock: lock,
    unlock: unlock,
    sleep: sleep,
    shutdown: shutdown,
    restart: restart,
    init() {
      screenRoot = document.getElementById("screen-root");
      desktopEl = document.getElementById("desktop");
    }
  };
}());
