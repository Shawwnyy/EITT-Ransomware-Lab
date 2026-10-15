/*
 * EITT OS — EITT Chat : messagerie instantanée FICTIVE (conversations préécrites, aucun serveur, aucun vrai compte).
 *
 * Elle déclenche le scénario du Ransomware Lab : le patron écrit « Nous avons reçu un mail, tu dois le traiter. »,
 * la réponse « Bien reçu » est présélectionnée, et une fois envoyée le message piégé arrive dans la messagerie.
 * Rien n'est envoyé sur Internet : tout se passe dans cette page. Ce n'est pas l'application d'une marque existante.
 */
(function () {
  "use strict";
  const DT = window.DT;
  const { h } = DT.u;

  const BOSS = { id: "boss", name: "Le patron", initials: "P", role: "Direction EITT" };
  const BOSS_TEXT = "Nous avons reçu un mail, tu dois le traiter.";
  const REPLIES = ["Bien reçu", "Je m'en occupe tout de suite", "Je vérifie l'expéditeur avant de l'ouvrir"];
  // Message du patron en pleine attaque (envoyé quand un tiers des fichiers est déjà verrouillé) et réponses rapides possibles.
  const ALERT_TEXT = "On se fait pirater ! Agis calmement mais intelligemment !";
  const ALERT_REPLIES = ["Compris, je garde mon calme", "Je coupe le réseau et j'alerte la sécurité", "Je ne paierai rien, je vais restaurer la sauvegarde"];
  const WRAP_TEXT = "Tout est rentré dans l'ordre, bravo d'avoir gardé ton calme. Merci pour ta réactivité ! On fait un point demain matin.";
  // Réponses rapides après la conclusion du patron (la première est présélectionnée).
  const WRAP_REPLIES = ["Avec plaisir !", "Merci patron, à demain", "On fait un point maintenant ?", "Qu'est-ce que j'aurais pu mieux faire ?"];
  // Le patron écrit entre 2 et 5 secondes après l'ouverture (ou le verrouillage) de la session.
  const MIN_DELAY = 2000;
  const MAX_DELAY = 5000;
  const NUDGE_DELAY = 60000;

  const OTHERS = [
    { id: "team", name: "Équipe EITT", initials: "É", role: "Groupe · 6 membres", messages: [
      { who: "Léa", text: "Qui apporte les clés USB pour l'atelier de jeudi ?", time: "08:41" },
      { who: "Hugo", text: "Moi, j'en ai 12 de rechange.", time: "08:44" },
      { who: "Léa", text: "Parfait, merci !", time: "08:45" }] },
    { id: "support", name: "Support informatique", initials: "S", role: "Assistance interne", messages: [
      { who: "Support", text: "Rappel : une sauvegarde hors ligne chaque semaine, c'est gratuit et ça sauve des journées de travail.", time: "Hier" }] }
  ];

  const state = () => DT.Ransom.state().chat;
  const save = () => DT.Store.touch();
  const emit = () => DT.bus.emit("chat:change", state());
  const reduce = () => DT.u.prefersReducedMotion();
  const delay = (ms) => (reduce() ? Math.min(ms, 150) : ms);
  const hhmm = (t) => {
    const d = new Date(t);
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  };
  const autoEnabled = () => !/[?&]auto=0\b/.test(window.location.search);

  let startTimer = null;
  let remindTimer = null;
  let lastDelay = null;
  const randomDelay = () => MIN_DELAY + Math.round(Math.random() * (MAX_DELAY - MIN_DELAY));
  const sessionState = () => document.documentElement.dataset.session;
  let nudgeTimer = null;
  const timers = new Set();
  function later(fn, ms) {
    const id = window.setTimeout(() => { timers.delete(id); fn(); }, delay(ms));
    timers.add(id);
    return id;
  }

  function setBadge() {
    DT.badges = DT.badges || {};
    DT.badges.chat = state().unread || 0;
    DT.bus.emit("badge:change");
  }

  /* ------------------------------ Scénario ------------------------------ */
  function addMessage(from, text, extra) {
    const c = state();
    const m = Object.assign({ id: DT.u.uid("m"), from: from, text: text, t: Date.now() }, extra || {});
    c.messages.push(m);
    if (c.messages.length > 300) c.messages.splice(0, c.messages.length - 300);
    save();
    emit();
    return m;
  }

  /* ------------------------------ Notification du patron ------------------------------ */
  const bossNotice = (text) => ({ app: "chat", title: BOSS.name, message: text || BOSS_TEXT, run: () => DT.WM.open("chat") });
  const toastShown = () => Boolean(document.querySelector('#toast-root .toast[data-tag="chat"]'));

  /**
   * Notification persistante (elle reste jusqu'au clic) + entrée dans le centre de notifications.
   * Session verrouillée : la même notification est aussi affichée sur l'écran de verrouillage.
   * La fenêtre de chat ne s'ouvre PAS toute seule : on l'ouvre en cliquant sur la notification, « Répondre » ou l'icône.
   */
  function notifyBoss(text) {
    const spec = bossNotice(text);
    DT.Notify.push({ title: spec.title, message: spec.message, type: "info", variant: "boss", sticky: true, tag: "chat", onClick: spec.run, actions: [
      // Réponse en un clic depuis la notification : « Bien reçu » part, la messagerie s'ouvre pour suivre l'échange.
      { label: REPLIES[0], primary: true, run: () => { if (send(REPLIES[0])) DT.WM.open("chat"); else spec.run(); } },
      { label: "Ouvrir le chat", run: spec.run }] });
    if (sessionState() === "locked") DT.Session.lockNotice(spec);
  }

  /** Le patron écrit : notification, son et pastille sur l'icône (sans ouvrir de fenêtre). */
  function arrive() {
    const c = state();
    if (c.stage !== "idle" || DT.Ransom.state().phase !== "ready") return false;
    const where = sessionState();
    if (where !== "desktop" && where !== "locked") return false; // reprise à la prochaine ouverture de session
    c.stage = "received";
    c.unread = 1;
    addMessage("boss", BOSS_TEXT);
    DT.Ransom.log("Message du patron sur EITT Chat : « " + BOSS_TEXT + " »", "info");
    setBadge();
    DT.Sound.play("message");
    notifyBoss(BOSS_TEXT);
    window.clearTimeout(nudgeTimer);
    nudgeTimer = window.setTimeout(() => {
      if (state().stage !== "received") return;
      addMessage("boss", "Tu as vu mon message ? C'est urgent.");
      state().unread += 1;
      setBadge();
      DT.Sound.play("message");
    }, NUDGE_DELAY);
    return true;
  }

  /** Lancement MANUEL (bouton « Lancer la simulation ») : le patron écrit tout de suite et la messagerie s'ouvre. */
  function launch() {
    arrive();
    DT.WM.open("chat");
  }

  /** Programme l'arrivée du message entre 2 et 5 s plus tard. Renvoie true si un message est attendu. */
  function scheduleStart(ms, force) {
    if (!autoEnabled()) return false;
    const c = state();
    if (c.stage !== "idle" || DT.Ransom.state().phase !== "ready") return false;
    if (startTimer && !force) return true; // déjà programmé : on ne repousse pas l'arrivée
    window.clearTimeout(startTimer);
    lastDelay = ms === undefined ? randomDelay() : ms;
    startTimer = window.setTimeout(() => { startTimer = null; arrive(); }, lastDelay);
    return true;
  }

  /**
   * Que signaler à l'ouverture de la session ? (jamais pendant une attaque en cours)
   *  - « unread »   : le patron a écrit et la réponse n'est pas partie ;
   *  - « todo »     : le patron a eu sa réponse mais le mail piégé n'est pas encore traité ;
   *  - « finished » : l'exercice est terminé (poste rétabli) : on propose de le rejouer.
   */
  function pendingKind() {
    const c = state();
    const phase = DT.Ransom.state().phase;
    if (DT.Ransom.state().ended) return null; // l'utilisateur a choisi de revenir à sa session : plus aucun rappel
    if (phase === "recovered") return "finished";
    if (phase !== "ready") return null;
    if (DT.Ransom.state().mail.choice) return "finished"; // le mail a déjà été traité (attaque évitée)
    if (c.stage === "received" && c.unread > 0) return "unread";
    if (c.stage === "replied" || c.stage === "done") return "todo";
    return null;
  }

  function notifyKind(kind) {
    if (kind === "unread") { notifyBoss(BOSS_TEXT); return; }
    if (kind === "todo") {
      DT.Notify.push({ title: BOSS.name, message: "Tu as traité le mail ? Il t'attend dans la messagerie du Ransomware Lab.", type: "info", sticky: true, tag: "chat",
        action: { label: "Ouvrir la messagerie", run: () => DT.WM.open("ransomlab", { tab: "mail" }) } });
      return;
    }
    DT.Notify.push({ title: "Exercice terminé", message: "Votre poste a été rétabli. Consultez le bilan, ou rejouez : le patron vous écrira de nouveau.", type: "success", sticky: true, tag: "chat",
      action: { label: "Rejouer l'exercice", run: () => DT.Ransom.reset() } });
  }

  /**
   * Rappel quand la session s'ouvre (ou se verrouille) alors que le message n'est pas nouveau : rechargement, ancienne
   * sauvegarde, exercice déjà terminé… Il y a ainsi TOUJOURS une notification claire, en 2 à 5 s. `all` = ouverture de
   * session (tous les cas) ; sinon (verrouillage / déverrouillage) seulement le message non lu.
   */
  function remind(immediate, all) {
    window.clearTimeout(remindTimer);
    if (!autoEnabled()) return;
    const kind = pendingKind();
    if (!kind || (kind !== "unread" && !all)) return;
    remindTimer = window.setTimeout(() => {
      if (pendingKind() !== kind) return;
      const where = sessionState();
      if (where === "locked") {
        if (kind === "unread" && !document.querySelector("#lock-notices .lock-notice")) DT.Session.lockNotice(bossNotice());
      } else if (where === "desktop" && !toastShown()) {
        notifyKind(kind);
      }
    }, immediate ? 0 : randomDelay());
  }

  function bossReply(text) {
    return /v[ée]rifi/i.test(text) ? "Bonne idée, mais ne traîne pas : le client attend une réponse. Je te le transfère."
      : "Merci. C'est urgent : je te le transfère, regarde-le tout de suite dans la messagerie.";
  }

  /** Envoie la réponse de l'utilisateur ; le patron répond, puis le message piégé arrive. */
  function send(text) {
    const c = state();
    const value = String(text || "").trim();
    if (!value) return false;
    // Un simple accusé de réception (« Bien reçu », « Compris »…) fait avancer le scénario ; tout le reste est une CONVERSATION libre :
    // le patron répond avec sa base de connaissances (questions de cybersécurité, état de l'incident, discussion), à tout moment.
    const ack = DT.BossAI.isAck(value);
    if (c.alert === "open" && (ALERT_REPLIES.includes(value) || ack)) return sendAlertReply(value);
    if (!(c.stage === "received" && (REPLIES.includes(value) || ack))) return converse(value);
    c.stage = "replied";
    c.unread = 0;
    DT.Notify.dismissTag("chat");
    setBadge();
    const mine = addMessage("me", value, { status: "sent" });
    DT.Ransom.log("Vous avez répondu au patron : « " + value + " ».", "good");
    later(() => { mine.status = "delivered"; save(); emit(); }, 600);
    later(() => { mine.status = "read"; save(); emit(); }, 1400);
    later(() => { c.typing = true; emit(); }, 1500);
    later(() => {
      c.typing = false;
      addMessage("boss", bossReply(value));
      finishReply();
    }, 3200);
    return true;
  }

  /** Conversation libre avec le patron : la réponse vient de la base de connaissances locale (DT.BossAI). */
  let pendingReplies = 0;
  const chatOpen = () => DT.WM.byApp("chat").length > 0;
  function converse(value) {
    const c = state();
    DT.Notify.dismissTag("chat"); // on est en train de lui répondre : sa notification n'a plus lieu d'être
    const mine = addMessage("me", value, { status: "sent" });
    later(() => { mine.status = "delivered"; save(); emit(); }, 450);
    later(() => { mine.status = "read"; save(); emit(); }, 1000);
    pendingReplies += 1;
    later(() => { c.typing = true; emit(); }, 1200);
    const answer = () => {
      const r = DT.BossAI.reply(value);
      pendingReplies = Math.max(0, pendingReplies - 1);
      if (!pendingReplies) c.typing = false;
      addMessage("boss", r.text, { ai: r.id });
      if (!chatOpen()) { c.unread = (c.unread || 0) + 1; setBadge(); DT.Sound.play("message"); }
      save();
      emit();
    };
    // Le temps d'« écriture » dépend de la longueur de la réponse (calculée au dernier moment, avec l'état du scénario à jour).
    later(answer, 1200 + 1100 + Math.round(Math.random() * 900));
    return true;
  }

  function finishReply() {
    const c = state();
    if (c.stage === "done") return;
    c.stage = "done";
    c.doneAt = Date.now();
    DT.Ransom.deliverMail();
    save();
    emit();
  }

  /* ------------------------------ Pendant et après l'attaque ------------------------------ */
  /** L'attaque démarre : la demande initiale du patron n'a plus d'objet (ses rappels et sa notification disparaissent). */
  function attackStart() {
    const c = state();
    window.clearTimeout(startTimer);
    window.clearTimeout(remindTimer);
    window.clearTimeout(nudgeTimer);
    startTimer = null;
    DT.Notify.dismissTag("chat");
    if (c.stage === "idle" || c.stage === "received" || c.stage === "replied") {
      c.stage = "done";
      c.doneAt = Date.now();
      c.typing = false;
      if (c.unread) { c.unread = 0; setBadge(); }
      save();
      emit();
    }
  }

  /**
   * En pleine attaque, le patron écrit : « On se fait pirater ! Agis calmement mais intelligemment ! ».
   * Notification persistante (elle reste jusqu'au clic), son d'alerte, pastille, et carte sur l'écran de verrouillage si la
   * session est verrouillée. La fenêtre de chat ne s'ouvre pas toute seule : l'utilisateur garde la main sur l'incident.
   * Une seule fois par exercice (le drapeau est dans l'état sauvegardé, donc il survit à un rechargement).
   */
  function attackAlert() {
    const c = state();
    const phase = DT.Ransom.state().phase;
    if (c.alert || (phase !== "attacking" && phase !== "infected")) return false;
    c.alert = "open"; // open : le patron attend une réponse ; replied : réponse envoyée ; closed : exercice terminé
    c.unread = (c.unread || 0) + 1;
    addMessage("boss", ALERT_TEXT, { alert: true });
    DT.Ransom.log("Message du patron en pleine attaque : « " + ALERT_TEXT + " »", "bad");
    setBadge();
    DT.Sound.play("alarm");
    const spec = { app: "chat", title: BOSS.name, message: ALERT_TEXT, run: () => DT.WM.open("chat") };
    DT.Notify.push({ title: spec.title, message: spec.message, type: "error", variant: "boss", sticky: true, tag: "chat", onClick: spec.run, actions: [
      { label: "Ouvrir le chat", primary: true, run: spec.run },
      { label: "Ouvrir le Lab", run: () => DT.WM.open("ransomlab", { tab: phase === "infected" ? "response" : "incident" }) }] });
    if (sessionState() === "locked") DT.Session.lockNotice(spec);
    return true;
  }

  /** Réponse libre du joueur au message d'alerte : le patron l'approuve brièvement. */
  function sendAlertReply(value) {
    const c = state();
    c.alert = "replied";
    c.unread = 0;
    DT.Notify.dismissTag("chat");
    setBadge();
    addMessage("me", value, { status: "sent" });
    DT.Ransom.log("Vous avez répondu au patron : « " + value + " ».", "good");
    later(() => { c.typing = true; emit(); }, 900);
    later(() => {
      c.typing = false;
      addMessage("boss", "Merci. Je te fais confiance : prends les choses dans l'ordre et tiens-moi au courant.");
      save();
    }, 2400);
    return true;
  }

  /** L'exercice est terminé (poste rétabli) : le patron conclut, et la notification d'alerte éventuelle disparaît. */
  function wrapUp() {
    const c = state();
    DT.Notify.dismissTag("chat");
    if (c.alert === "closed") return;
    c.alert = "closed";
    c.typing = false;
    c.unread = (c.unread || 0) + 1;
    addMessage("boss", WRAP_TEXT, { wrap: true });
    setBadge();
  }

  function reset() {
    DT.Notify.dismissTag("chat");
    timers.forEach((id) => window.clearTimeout(id));
    timers.clear();
    window.clearTimeout(startTimer);
    window.clearTimeout(remindTimer);
    window.clearTimeout(nudgeTimer);
    startTimer = null;
    setBadge();
    emit();
    scheduleStart(undefined, true);
  }

  function init() {
    const c = state();
    setBadge();
    if (c.typing) c.typing = false;
    // Rechargement en pleine attaque (ou poste compromis) sans que le patron ait prévenu : il le fait maintenant.
    if (DT.Ransom.state().phase === "infected" && !c.alert) attackAlert();
    // Rechargement entre la réponse et l'arrivée du mail : on termine l'envoi.
    if (c.stage === "replied") finishReply();
    // Ouverture de session : message dans 2 à 5 s. Verrouillage / déverrouillage : idem, ou rappel s'il n'a pas été lu.
    let firstSignin = true;
    /**
     * Premier accès depuis l'ouverture de la page : on repart d'une situation où le patron PEUT écrire.
     *  - exercice terminé (poste rétabli, ou attaque évitée) → nouvelle simulation ;
     *  - échange terminé mais mail non traité (ancienne session) → le patron réécrit.
     * Une attaque en cours n'est jamais touchée.
     */
    function freshStart() {
      const r = DT.Ransom.state();
      const c0 = state();
      if (r.ended) return; // retour volontaire à la session normale : on ne relance pas l'exercice tout seul
      if (r.phase === "recovered" || (r.phase === "ready" && r.mail.choice)) {
        DT.Ransom.reset(true);
      } else if (c0.stage === "done" && (!c0.doneAt || Date.now() - c0.doneAt > 20000)) {
        DT.Ransom.restartIntro();
      }
    }
    DT.bus.on("session:signin", () => {
      // Premier accès depuis l'ouverture de la page : si l'échange précédent est terminé mais que le mail n'a pas été traité
      // (ancienne session, autre jour…), on le rejoue pour que le patron écrive de nouveau et qu'on puisse lui répondre.
      if (firstSignin) {
        firstSignin = false;
        if (autoEnabled()) freshStart();
      }
      if (!scheduleStart(undefined, true)) remind(false, true);
    });
    // Filet de sécurité : si un événement de session a été manqué, le message est tout de même programmé (au plus 5 s plus tard).
    window.setInterval(() => {
      const where = sessionState();
      if (!startTimer && (where === "desktop" || where === "locked")) scheduleStart();
    }, 1000);
    DT.bus.on("session:change", (where) => {
      if (where === "locked") { if (!scheduleStart(undefined, true)) remind(true); } // 2 à 5 s APRÈS le verrouillage
      else if (where === "desktop") { if (!scheduleStart()) remind(false); }
    });
  }

  /* ------------------------------ Application ------------------------------ */
  function createChat(ctx) {
    ctx.body.classList.add("ch-app");
    if (state().stage === "idle") scheduleStart(1200, true); // on ouvre le chat alors que rien n'est arrivé : le patron écrit tout de suite
    let active = (ctx.params && ctx.params.contact) || "boss";
    let draft = REPLIES[0];
    let chipIndex = 0;
    let mode = "intro"; // intro : première demande du patron ; alert : message d'alerte en pleine attaque
    const side = h("nav", { class: "ch-side", "aria-label": "Conversations" });
    const main = h("section", { class: "ch-main" });
    ctx.body.append(side, main);

    ctx.onParams((p) => { if (p && p.contact) { active = p.contact; render(); } });
    const off = DT.bus.on("chat:change", () => render());
    ctx.onClose(() => off());

    function markRead() {
      const c = state();
      if (active === "boss" && c.unread) {
        c.unread = 0;
        setBadge();
        DT.Notify.dismissTag("chat");
        save();
      }
    }

    function bubble(m) {
      const mine = m.from === "me";
      return h("li", { class: "ch-msg " + (mine ? "is-me" : "is-them") + (m.alert ? " is-alert" : ""), "data-from": m.from },
        h("div", { class: "ch-bubble" },
          mine ? null : h("strong", { class: "ch-who", text: BOSS.name }),
          h("span", { class: "ch-text", text: m.text }),
          h("span", { class: "ch-meta" }, h("time", { text: hhmm(m.t) }),
            mine ? h("span", { class: "ch-ticks ch-" + (m.status || "sent"), "aria-hidden": "true", text: m.status === "sent" ? "✓" : "✓✓" }) : null,
            mine ? h("span", { class: "sr-only", text: m.status === "read" ? "lu" : m.status === "delivered" ? "distribué" : "envoyé" }) : null)));
    }

    function renderSide() {
      const c = state();
      const last = c.messages.length ? c.messages[c.messages.length - 1] : null;
      const rows = [{ id: "boss", name: BOSS.name, initials: BOSS.initials, preview: last ? (last.from === "me" ? "Vous : " : "") + last.text : "Aucun nouveau message", unread: c.unread }]
        .concat(OTHERS.map((o) => ({ id: o.id, name: o.name, initials: o.initials, preview: o.messages[o.messages.length - 1].text, unread: 0 })));
      side.replaceChildren(
        h("div", { class: "ch-side-head" }, DT.Icons.tile("chat", 26), h("strong", { text: "EITT Chat" })),
        ...rows.map((r) => h("button", { type: "button", class: "ch-contact" + (r.id === active ? " is-on" : ""), "data-contact": r.id, "aria-current": r.id === active ? "true" : null, onClick: () => { active = r.id; markRead(); render(); } },
          h("span", { class: "ch-avatar", "aria-hidden": "true", text: r.initials }),
          h("span", { class: "ch-contact-text" }, h("strong", { text: r.name }), h("small", { text: r.preview })),
          r.unread ? h("span", { class: "ch-unread", "aria-label": r.unread + " message non lu", text: String(r.unread) }) : null)),
        h("p", { class: "ch-fake", text: "Messagerie fictive : aucun message n'est envoyé sur Internet." }));
    }

    function render() {
      markRead();
      renderSide();
      const c = state();
      const hadFocus = document.activeElement && document.activeElement.id === "ch-input";
      if (active !== "boss") {
        const o = OTHERS.find((x) => x.id === active) || OTHERS[0];
        main.replaceChildren(
          h("header", { class: "ch-head" }, h("span", { class: "ch-avatar", "aria-hidden": "true", text: o.initials }), h("div", {}, h("strong", { text: o.name }), h("small", { text: o.role }))),
          h("ol", { class: "ch-list", "aria-label": "Messages" }, ...o.messages.map((m) => h("li", { class: "ch-msg is-them" }, h("div", { class: "ch-bubble" }, h("strong", { class: "ch-who", text: m.who }), h("span", { class: "ch-text", text: m.text }), h("span", { class: "ch-meta" }, h("time", { text: m.time })))))),
          h("p", { class: "ch-readonly", text: "Conversation en lecture seule dans la simulation." }));
        return;
      }
      /** Rien reçu pour l'instant : on explique pourquoi et on propose toujours une action pour pouvoir répondre au patron. */
      function idleCard() {
        const r = DT.Ransom.state();
        const finished = r.phase === "recovered" || (r.phase === "ready" && Boolean(r.mail.choice));
        const incident = r.phase === "attacking" || r.phase === "infected";
        let text = "Le patron n'a pas encore écrit.";
        let button = h("button", { type: "button", class: "btn btn-primary", id: "ch-receive", onClick: () => arrive() }, "Recevoir le message du patron");
        if (finished) {
          text = "L'exercice précédent est terminé : le patron n'écrira plus tant que la simulation n'est pas relancée.";
          button = h("button", { type: "button", class: "btn btn-primary", id: "ch-replay", onClick: () => DT.Ransom.reset() }, "Rejouer l'exercice");
        } else if (incident) {
          text = "Un incident est en cours : traitez-le dans le Ransomware Lab. Le patron écrira de nouveau à la prochaine simulation.";
          button = null;
        }
        return h("li", { class: "ch-empty", id: "ch-empty" }, h("span", { text: text }), button);
      }
      /** Exercice terminé : la conversation reste lisible et on peut toujours le rejouer d'un clic. */
      function replayCard() {
        return h("li", { class: "ch-empty", id: "ch-ended" }, h("span", { text: "Exercice terminé : le poste est rétabli. Le patron n'écrira de nouveau que si vous relancez la simulation." }),
          h("button", { type: "button", class: "btn btn-primary", id: "ch-replay", onClick: () => DT.Ransom.reset() }, "Rejouer l'exercice"));
      }
      const alertOpen = c.alert === "open";
      const lastMsg = c.messages[c.messages.length - 1];
      const wrapPending = c.alert === "closed" && Boolean(lastMsg) && lastMsg.from === "boss" && Boolean(lastMsg.wrap);
      // La zone de réponse est TOUJOURS utilisable : on peut discuter avec le patron avant, pendant et après l'incident.
      const nextMode = c.stage === "received" ? "intro" : alertOpen ? "alert" : wrapPending ? "wrap" : "free";
      const quick = nextMode === "intro" ? REPLIES : nextMode === "alert" ? ALERT_REPLIES : nextMode === "wrap" ? WRAP_REPLIES : DT.BossAI.suggestions();
      const preselect = nextMode !== "free";
      if (mode !== nextMode) { mode = nextMode; draft = preselect ? quick[0] : ""; chipIndex = preselect ? 0 : -1; }
      const composerEnabled = true;
      const status = c.typing ? "écrit…" : "en ligne";
      const list = h("ol", { class: "ch-list", id: "ch-list", "aria-label": "Messages", "aria-live": "polite" },
        h("li", { class: "ch-day", text: "Hier" }),
        h("li", { class: "ch-msg is-them" }, h("div", { class: "ch-bubble" }, h("strong", { class: "ch-who", text: BOSS.name }), h("span", { class: "ch-text", text: "Merci pour le rapport annuel, bien reçu. 👍" }), h("span", { class: "ch-meta" }, h("time", { text: "17:52" })))),
        h("li", { class: "ch-day", text: "Aujourd'hui" }),
        ...c.messages.map(bubble),
        c.typing ? h("li", { class: "ch-msg is-them ch-typing", "aria-label": "Le patron est en train d'écrire" }, h("div", { class: "ch-bubble" }, h("span", { class: "ch-dots", "aria-hidden": "true" }, h("i"), h("i"), h("i")))) : null,
        !c.messages.length ? idleCard() : DT.Ransom.state().phase === "recovered" ? replayCard() : null);
      const input = h("input", { type: "text", class: "ch-input", id: "ch-input", autocomplete: "off", maxlength: "200", "aria-label": "Votre réponse au patron", placeholder: nextMode === "free" ? "Écrivez au patron : posez-lui une question…" : "Écrivez un message" });
      input.value = composerEnabled ? draft : "";
      input.addEventListener("input", () => { draft = input.value; chipIndex = quick.indexOf(draft); renderChips(); });
      const chips = h("div", { class: "ch-chips", role: "group", "aria-label": "Réponses rapides" });
      function renderChips() {
        chips.replaceChildren(...quick.map((r, i) => h("button", { type: "button", class: "ch-chip" + (i === chipIndex ? " is-on" : ""), "data-reply": String(i), "aria-pressed": String(i === chipIndex), onClick: () => { chipIndex = i; draft = r; input.value = r; renderChips(); input.focus(); } }, r)));
      }
      renderChips();
      const sendBtn = h("button", { type: "button", class: "btn btn-primary ch-send", id: "ch-send", "aria-label": "Envoyer", disabled: composerEnabled ? null : true, onClick: () => doSend() }, DT.Icons.el("send", 17), h("span", { text: "Envoyer" }));
      function doSend() {
        if (send(input.value)) { draft = ""; chipIndex = -1; input.value = ""; }
      }
      input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); doSend(); } });
      main.replaceChildren(
        h("header", { class: "ch-head" }, h("span", { class: "ch-avatar", "aria-hidden": "true", text: BOSS.initials }), h("div", {}, h("strong", { text: BOSS.name }), h("small", { class: "ch-status", id: "ch-status", text: status }))),
        list,
        h("div", { class: "ch-composer" }, composerEnabled ? chips : null, h("div", { class: "ch-inputrow" }, input, sendBtn)));
      list.scrollTop = list.scrollHeight;
      if (hadFocus && composerEnabled) input.focus();
    }

    render();
    window.setTimeout(() => { const i = document.getElementById("ch-input"); if (i && !i.disabled) i.focus({ preventScroll: true }); }, 60);
  }

  DT.WM.registerApp({
    id: "chat",
    title: "EITT Chat",
    tile: "chat",
    size: { w: 860, h: 540 },
    minSize: { w: 480, h: 380 },
    singleton: true,
    keywords: ["messagerie", "message", "discussion", "patron", "chat", "conversation", "whatsapp"],
    create: createChat
  });

  DT.Chat = { init: init, start: arrive, launch: launch, send: send, reset: reset, scheduleStart: scheduleStart, remind: remind, delayRange: [MIN_DELAY, MAX_DELAY], lastDelay: () => lastDelay, REPLIES: REPLIES, BOSS_TEXT: BOSS_TEXT, ALERT_TEXT: ALERT_TEXT, ALERT_REPLIES: ALERT_REPLIES, WRAP_REPLIES: WRAP_REPLIES, attackStart: attackStart, attackAlert: attackAlert, wrapUp: wrapUp, autoEnabled: autoEnabled };
}());
