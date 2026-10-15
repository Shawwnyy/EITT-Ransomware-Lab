/*
 * EITT Ransomware Lab — simulation pédagogique d'une attaque par rançongiciel.
 *
 * ================================  SÉCURITÉ  ================================
 * Tout ce module agit UNIQUEMENT sur le système de fichiers VIRTUEL de la simulation (DT.FS, en mémoire et dans le
 * stockage local du navigateur). Il n'accède à aucun vrai fichier, n'utilise aucune API de fichiers du navigateur,
 * n'envoie rien sur le réseau, n'exécute aucun code importé et n'embarque aucun vrai programme malveillant.
 * Le « chiffrement » est une mise en scène : le contenu d'origine d'un fichier virtuel est simplement mis de côté
 * (node.sim) et remplacé par un texte illisible ; la restauration le remet en place. Aucune cryptographie réelle,
 * aucune clé, aucun paiement : les montants et adresses de la note de rançon sont fictifs.
 * ============================================================================
 */
(function () {
  "use strict";
  const DT = window.DT;
  const FS = DT.FS;
  const { h, plural } = DT.u;

  const LOCK_EXT = ".eitt-locked";
  const SAMPLE_NAME = "Facture_Octobre.pdf.exe";
  const NOTE_NAME = "LISEZ-MOI-RANCON-SIMULATION.txt";
  const TABS = [
    { id: "mission", label: "Mission", icon: "book" },
    { id: "prepare", label: "Préparer", icon: "shield" },
    { id: "mail", label: "Messagerie", icon: "mail" },
    { id: "incident", label: "Incident", icon: "alert" },
    { id: "response", label: "Réponse", icon: "check-circle" },
    { id: "report", label: "Bilan", icon: "star" }
  ];

  /* ------------------------------ État ------------------------------ */
  const freshChat = () => ({ stage: "idle", messages: [], unread: 0, typing: false }); // idle | received | replied | done

  function fresh() {
    return {
      version: 1, phase: "ready", // ready | attacking | infected | recovered
      tab: "mission",
      backup: null, // { kind: "offline" | "local", at, files: [{ id, name, content }], lost }
      mail: { choice: null, analysed: false, open: "m2", delivered: false }, // choice : opened | reported | deleted | demo
      chat: freshChat(),
      startedAt: Date.now(), infectedAt: null, locked: 0, total: 0, sampleId: null, noteId: null,
      ended: false, cutManual: false, // ended : l'utilisateur est revenu à sa session normale après l'exercice
      isolated: false, isolatedAt: null, alerted: false, identified: false, eradicated: false, paid: false, refused: false,
      restored: 0, remaining: 0, reinfections: 0, preAttack: null, log: []
    };
  }

  const S = () => {
    if (!DT.Store.state.ransom) DT.Store.state.ransom = fresh();
    const s = DT.Store.state.ransom;
    // Sauvegarde créée par une version précédente : on complète les nouveaux champs.
    if (!s.chat) s.chat = freshChat();
    if (s.mail.delivered === undefined) s.mail.delivered = true;
    return s;
  };
  const save = () => DT.Store.touch();
  const reduceMotion = () => DT.u.prefersReducedMotion();
  const pad2 = (n) => String(n).padStart(2, "0");
  const hhmmss = (t) => {
    const d = new Date(t);
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
  };

  function log(text, tone) {
    const s = S();
    s.log.push({ t: Date.now(), text: text, tone: tone || "info" });
    if (s.log.length > 200) s.log.splice(0, s.log.length - 200);
    save();
    DT.bus.emit("ransom:change", s);
  }

  function setPhase(phase) {
    const s = S();
    s.phase = phase;
    document.documentElement.dataset.ransom = phase;
    paintBanner();
    save();
    DT.bus.emit("ransom:change", s);
  }

  /** Le message piégé arrive dans la messagerie (après la réponse au patron sur EITT Chat). */
  /**
   * Nouvelle session alors que l'échange avec le patron est terminé mais que le mail piégé n'a pas été traité :
   * on rejoue l'introduction (le patron écrit de nouveau). Rien d'autre n'est touché (sauvegarde, fichiers, score).
   */
  function restartIntro() {
    const s = S();
    if (s.phase !== "ready" || s.mail.choice) return false;
    s.chat = freshChat();
    s.mail.delivered = false;
    log("Nouvelle session : le patron va écrire de nouveau.", "info");
    save();
    DT.bus.emit("ransom:change", s);
    return true;
  }

  function deliverMail() {
    const s = S();
    if (s.mail.delivered) return;
    s.mail.delivered = true;
    s.mail.open = "m2";
    log("Nouveau message dans la messagerie : « URGENT : facture d'octobre impayée — dernier rappel ».", "info");
    DT.Sound.play("message");
    DT.Notify.push({ title: "Nouveau message", message: "« URGENT : facture d'octobre impayée — dernier rappel »", type: "info", action: { label: "Ouvrir", run: () => DT.WM.open("ransomlab", { tab: "mail" }) } });
    save();
    DT.bus.emit("ransom:change", s);
  }

  /* ------------------------ Fichiers virtuels : verrouillage ------------------------ */
  const textSize = (text) => (typeof TextEncoder === "function" ? new TextEncoder().encode(text).length : text.length);

  /** Texte illisible d'aspect « chiffré » (mise en scène : AUCUN chiffrement réel, le résultat est sans valeur). */
  function scramble(length, seed) {
    let x = 7;
    for (let i = 0; i < seed.length; i += 1) x = (x * 31 + seed.charCodeAt(i)) >>> 0;
    const lines = ["EITT-LOCKED // SIMULATION PÉDAGOGIQUE — contenu fictif volontairement illisible", ""];
    const count = Math.min(14, Math.max(3, Math.ceil(length / 70)));
    for (let i = 0; i < count; i += 1) {
      let line = "";
      for (let j = 0; j < 36; j += 1) {
        x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
        line += (x >>> 24).toString(16).padStart(2, "0");
      }
      lines.push(line);
    }
    return lines.join("\n");
  }

  function lockNode(node) {
    if (!node || node.sim) return false;
    node.sim = { name: node.name };
    if (typeof node.content === "string") {
      node.sim.content = node.content;
      node.content = scramble(node.content.length, node.id);
      node.size = textSize(node.content);
    }
    node.name = node.name + LOCK_EXT;
    node.modified = Date.now();
    return true;
  }

  function unlockNode(node, backupEntry) {
    if (!node || !node.sim) return false;
    let name = backupEntry ? backupEntry.name : node.sim.name;
    if (FS.nameTaken(node.parent, name, node.id)) name = FS.uniqueName(node.parent, name, node.id);
    node.name = name;
    const original = backupEntry && typeof backupEntry.content === "string" ? backupEntry.content : node.sim.content;
    if (typeof original === "string") {
      node.content = original;
      node.size = textSize(original);
    }
    delete node.sim;
    node.modified = Date.now();
    return true;
  }

  const notifyFs = () => DT.bus.emit("fs:change", { type: "ransom", ids: [], names: [] });
  const quiet = (fn) => {
    const previous = DT.quiet;
    DT.quiet = true;
    try {
      return fn();
    } finally {
      DT.quiet = previous;
    }
  };

  /** Supprime définitivement un fichier virtuel (passage par la corbeille virtuelle, sans notification). */
  function wipe(node) {
    if (!node) return;
    quiet(() => {
      if (!node.trashed) FS.trash([node.id]);
      FS.deletePermanently([node.id], true);
    });
  }

  const targets = () => FS.allFiles().filter((n) => !n.sim && n.id !== S().sampleId && n.id !== S().noteId);
  const lockedNodes = () => FS.allFiles().filter((n) => n.sim);
  const desktopFolder = () => FS.systemFolder("Bureau");

  /* ------------------------------ Sauvegarde ------------------------------ */
  function makeBackup(kind) {
    const s = S();
    if (s.phase !== "ready") return { ok: false, error: "Les fichiers sont déjà verrouillés : une sauvegarde faite maintenant serait inutile." };
    const files = targets().map((n) => ({ id: n.id, name: n.name, content: typeof n.content === "string" ? n.content : undefined }));
    s.backup = { kind: kind, at: Date.now(), files: files, lost: false };
    log("Sauvegarde " + (kind === "offline" ? "hors ligne (disque externe déconnecté)" : "sur le même ordinateur") + " : " + files.length + " fichiers copiés.", "good");
    DT.Notify.push({ title: "Sauvegarde terminée", message: files.length + " fichiers copiés " + (kind === "offline" ? "sur un disque externe (simulation)." : "dans un dossier du même ordinateur (simulation)."), type: "success" });
    return { ok: true };
  }

  /* ------------------------------ Attaque ------------------------------ */
  let attackTimer = null;

  function startAttack(origin) {
    const s = S();
    if (s.phase !== "ready") return false;
    s.preAttack = JSON.stringify(DT.Store.state.fs.nodes);
    s.mail.choice = origin === "demo" ? "demo" : "opened";
    s.mail.delivered = true;
    const bureau = desktopFolder();
    quiet(() => {
      const sample = FS.create(bureau.id, "file", FS.nameTaken(bureau.id, SAMPLE_NAME) ? FS.uniqueName(bureau.id, SAMPLE_NAME) : SAMPLE_NAME, {
        content: "[PROGRAMME DE DÉMONSTRATION EITT — INOFFENSIF]\nCe fichier fictif représente le programme malveillant de la simulation.\nIl ne contient aucun code et ne peut rien exécuter.\nSupprimez-le (étape « Réponse ») avant de restaurer vos fichiers.\n"
      });
      if (sample.ok) s.sampleId = sample.node.id;
    });
    const list = targets();
    s.total = list.length;
    s.locked = 0;
    s.queue = list.map((n) => n.id);
    log(origin === "demo" ? "Mode démonstration : un collègue ouvre « " + SAMPLE_NAME + " »." : "Vous avez ouvert la pièce jointe « " + SAMPLE_NAME + " ».", "bad");
    log("Un programme inconnu démarre et parcourt les dossiers du poste.", "bad");
    setPhase("attacking");
    if (DT.Chat) DT.Chat.attackStart(); // la demande initiale du patron n'a plus d'objet
    DT.Notify.push({ title: "Activité inhabituelle détectée", message: "Un programme modifie de nombreux fichiers très vite. (simulation)", type: "warning" });
    DT.WM.open("ransomlab", { tab: "incident" });
    runAttackLoop();
    return true;
  }

  function lockStep() {
    const s = S();
    const id = s.queue && s.queue.shift();
    if (!id) return false;
    const node = FS.get(id);
    if (node && lockNode(node)) {
      s.locked += 1;
      if (s.locked <= 8 || s.locked % 3 === 0) log("Verrouillage : " + FS.displayPath(node.id).replace(/\.eitt-locked$/, ""), "bad");
    }
    return s.queue.length > 0;
  }

  function runAttackLoop() {
    window.clearInterval(attackTimer);
    const delay = reduceMotion() ? 25 : 380;
    attackTimer = window.setInterval(() => {
      const more = lockStep();
      notifyFs();
      DT.bus.emit("ransom:change", S());
      // En pleine attaque (un tiers des fichiers déjà verrouillés), le patron prévient : « On se fait pirater ! »
      if (DT.Chat && S().locked * 3 >= S().total) DT.Chat.attackAlert();
      if (!more) {
        window.clearInterval(attackTimer);
        attackTimer = null;
        finishAttack();
      }
    }, delay);
  }

  function noteText() {
    return "================================================================\n" +
      "  SIMULATION PÉDAGOGIQUE EITT — AUCUN VRAI FICHIER N'A ÉTÉ TOUCHÉ\n" +
      "================================================================\n\n" +
      "VOS FICHIERS ONT ÉTÉ VERROUILLÉS\n\n" +
      "Les documents de ce poste VIRTUEL ont été « chiffrés » (en simulation).\n" +
      "Dans une vraie attaque, les criminels exigeraient ici un paiement en cryptomonnaie\n" +
      "(montant fictif : 0,05 BTC sous 72 heures, sinon le prix double).\n\n" +
      "Adresse de paiement : [AUCUNE — cette simulation ne permet aucun paiement réel]\n\n" +
      "----------------------------------------------------------------\n" +
      "CE QU'IL FAUT FAIRE (vraiment) :\n" +
      "  1. Ne pas payer : rien ne garantit que les fichiers seront rendus.\n" +
      "  2. Débrancher le poste du réseau pour limiter la propagation.\n" +
      "  3. Prévenir le responsable informatique.\n" +
      "  4. Supprimer le programme malveillant, puis restaurer depuis une sauvegarde saine.\n\n" +
      "Ouvrez l'application « Ransomware Lab », onglet « Réponse », pour suivre ces étapes.\n";
  }

  function finishAttack() {
    const s = S();
    const bureau = desktopFolder();
    quiet(() => {
      const note = FS.create(bureau.id, "file", FS.nameTaken(bureau.id, NOTE_NAME) ? FS.uniqueName(bureau.id, NOTE_NAME) : NOTE_NAME, { content: noteText() });
      if (note.ok) s.noteId = note.node.id;
    });
    if (s.backup && s.backup.kind === "local" && !s.backup.lost) {
      s.backup.lost = true;
      log("La « sauvegarde » stockée sur le même ordinateur a été verrouillée elle aussi : elle est inutilisable.", "bad");
    }
    s.infectedAt = Date.now();
    log("Attaque terminée : " + s.locked + " " + plural(s.locked, "fichier verrouillé", "fichiers verrouillés") + ". Une note de rançon (fictive) est apparue sur le bureau.", "bad");
    setPhase("infected");
    notifyFs();
    DT.Notify.push({ title: "Vos fichiers ont été verrouillés", message: "Simulation : lisez la note de rançon, puis réagissez dans le bon ordre (onglet « Réponse »).", type: "error" });
  }

  /* ------------------------------ Réponse à incident ------------------------------ */
  const sampleNode = () => (S().sampleId ? FS.get(S().sampleId) : null);
  const sampleGone = () => {
    const n = sampleNode();
    return !n || FS.isInTrash(n);
  };

  function isolate(on) {
    const s = S();
    if (s.phase === "ready") return;
    DT.Net.setIsolated(on);
    s.isolated = on;
    if (on) {
      s.isolatedAt = s.isolatedAt || Date.now();
      log("Poste isolé du réseau (simulation) : la propagation vers les autres machines est stoppée.", "good");
      DT.Notify.push({ title: "Poste isolé du réseau", message: "Simulation : le réseau est coupé pour ce poste. Votre vraie connexion n'est pas modifiée.", type: "success" });
    } else {
      log("Poste reconnecté au réseau.", "info");
    }
    save();
    DT.bus.emit("ransom:change", s);
  }

  function alertSecurity() {
    const s = S();
    if (s.alerted || s.phase === "ready") return;
    s.alerted = true;
    log("Le responsable sécurité a été prévenu (simulation).", "good");
    DT.Notify.push({ title: "Alerte transmise", message: "Simulation : l'équipe de sécurité a été informée de l'incident.", type: "success" });
    save();
    DT.bus.emit("ransom:change", s);
  }

  function identify() {
    const s = S();
    if (s.phase === "ready") return;
    if (!s.identified) {
      s.identified = true;
      log("Analyse : le processus « " + SAMPLE_NAME + " » (ouvert depuis un e-mail) est à l'origine du verrouillage.", "good");
    }
    save();
    DT.bus.emit("ransom:change", s);
  }

  function eradicate() {
    const s = S();
    const node = sampleNode();
    wipe(node);
    s.eradicated = true;
    log("Le programme malveillant « " + SAMPLE_NAME + " » a été supprimé du poste.", "good");
    DT.Notify.push({ title: "Programme malveillant supprimé", message: "Vous pouvez maintenant restaurer vos fichiers sans risque de réinfection.", type: "success" });
    notifyFs();
    save();
    DT.bus.emit("ransom:change", s);
  }

  function decidePay(pay) {
    const s = S();
    if (s.paid || s.refused || s.phase === "ready") return;
    if (pay) {
      s.paid = true;
      log("Vous avez choisi de payer la rançon (simulation).", "bad");
      DT.UI.alert({
        title: "Vous avez payé… et rien ne revient",
        message: "Dans cette simulation, aucun paiement réel n'est possible et aucune clé n'arrive. Dans la réalité, payer ne garantit pas la récupération des fichiers, finance les criminels et vous désigne comme une cible rentable. Les fichiers restent verrouillés : utilisez votre sauvegarde."
      });
    } else {
      s.refused = true;
      log("Vous avez refusé de payer : c'est la bonne décision.", "good");
      DT.Notify.push({ title: "Bonne décision", message: "Ne jamais payer : privilégiez la restauration depuis une sauvegarde saine.", type: "success", silent: true });
    }
    save();
    DT.bus.emit("ransom:change", s);
  }

  async function restore() {
    const s = S();
    if (s.phase !== "infected" || !s.backup) return;
    if (s.backup.lost) {
      DT.UI.alert({ title: "Sauvegarde inutilisable", message: "La sauvegarde était stockée sur le même ordinateur : le programme l'a verrouillée aussi. C'est pourquoi une sauvegarde doit être hors ligne ou sur un autre support déconnecté." });
      return;
    }
    const risky = !s.eradicated && !sampleGone();
    if (risky) {
      const choice = await DT.UI.choose({
        title: "Le programme malveillant est toujours là",
        message: "Si vous restaurez maintenant, le programme encore présent risque de verrouiller de nouveau vos fichiers. Voulez-vous quand même continuer pour voir ce qui se passe ?",
        dismiss: "cancel",
        buttons: [{ label: "Annuler", value: "cancel", primary: true }, { label: "Restaurer quand même", value: "go" }]
      });
      if (choice !== "go") return;
    }
    let count = 0;
    const byId = new Map(s.backup.files.map((f) => [f.id, f]));
    lockedNodes().forEach((node) => {
      const entry = byId.get(node.id);
      if (entry && unlockNode(node, entry)) count += 1;
    });
    s.restored += count;
    s.remaining = lockedNodes().length;
    log(count + " " + plural(count, "fichier restauré", "fichiers restaurés") + " depuis la sauvegarde" + (s.remaining ? " (" + s.remaining + " absents de la sauvegarde restent verrouillés)." : "."), "good");
    notifyFs();
    if (risky) {
      DT.Notify.push({ title: "Réinfection en cours", message: "Le programme malveillant est toujours actif…", type: "warning" });
      window.setTimeout(() => reinfect(), reduceMotion() ? 300 : 3200);
      save();
      DT.bus.emit("ransom:change", s);
      return;
    }
    finishRecovery();
  }

  function reinfect() {
    const s = S();
    if (s.phase !== "infected" || sampleGone()) return;
    const list = targets();
    list.forEach(lockNode);
    s.reinfections += 1;
    s.remaining = lockedNodes().length;
    log("RÉINFECTION : le programme resté sur le poste a verrouillé " + list.length + " fichiers de plus. Il fallait le supprimer avant de restaurer.", "bad");
    DT.Notify.push({ title: "Réinfection !", message: "Supprimez d'abord le programme malveillant (onglet « Réponse »), puis restaurez de nouveau.", type: "error" });
    notifyFs();
    save();
    DT.bus.emit("ransom:change", s);
  }

  /**
   * Remet la connexion SIMULÉE du poste en état normal : fin de l'isolement, et Wi-Fi / mode avion si c'est le joueur qui les
   * avait coupés pendant l'incident. `s.isolated` n'est PAS modifié : il sert au score (« poste isolé pendant l'incident »).
   */
  function reconnectNetwork() {
    const s = S();
    DT.Net.setIsolated(false);
    if (s.cutManual) {
      DT.Net.setAirplane(false);
      DT.Net.setWifi(true);
      s.cutManual = false;
    }
  }

  function finishRecovery() {
    const s = S();
    s.remaining = lockedNodes().length;
    const note = s.noteId ? FS.get(s.noteId) : null;
    wipe(note);
    log("Poste rétabli : fichiers restaurés, note de rançon supprimée.", "good");
    setPhase("recovered");
    // Fin de l'incident : le poste est vérifié, on le reconnecte (avant, le réseau restait coupé et le bouton était grisé).
    const wasCut = DT.Net.isolated || s.cutManual;
    reconnectNetwork();
    if (wasCut) log("Réseau rétabli après vérification : le poste est de nouveau connecté (simulation).", "good");
    if (DT.Chat) DT.Chat.wrapUp();
    save();
    notifyFs();
    DT.Notify.push({ title: "Poste rétabli", message: "Consultez le bilan pour comprendre votre score, ou reprenez votre travail.", type: "success", sticky: true, tag: "ransom-end",
      action: { label: "Revenir à ma session", run: () => endExercise() } });
  }

  /** « Terminer et revenir à ma session » : ferme le laboratoire, plus aucun rappel du patron, le poste est prêt à servir. */
  function endExercise() {
    const s = S();
    if (s.phase !== "recovered") return false;
    s.ended = true;
    reconnectNetwork();
    DT.Notify.dismissTag("chat");
    DT.Notify.dismissTag("ransom-end");
    log("Retour à la session normale.", "info");
    save();
    DT.bus.emit("ransom:change", s);
    DT.WM.byApp("ransomlab").forEach((w) => DT.WM.close(w));
    DT.Notify.push({ title: "Vous êtes revenu à votre session", message: "Le poste est rétabli et connecté. Le Ransomware Lab reste dans le menu Démarrer si vous voulez rejouer l'exercice.", type: "success" });
    return true;
  }

  function resetScenario(silent) {
    const s = S();
    window.clearInterval(attackTimer);
    attackTimer = null;
    if (s.preAttack) {
      try {
        DT.Store.state.fs.nodes = JSON.parse(s.preAttack);
      } catch (error) { /* instantané illisible : on garde l'état courant */ }
    } else {
      lockedNodes().forEach((n) => unlockNode(n));
      [s.sampleId, s.noteId].forEach((id) => { const n = id ? FS.get(id) : null; if (n) wipe(n); });
    }
    FS.refresh(); // l'arbre de fichiers a été remplacé : sans cela, le bureau et l'explorateur gardaient les fichiers verrouillés, le programme et la note
    reconnectNetwork();
    DT.Notify.dismissTag("ransom-end");
    const fresher = fresh();
    DT.Store.state.ransom = fresher;
    if (DT.Chat) DT.Chat.reset();
    document.documentElement.dataset.ransom = "ready";
    paintBanner();
    notifyFs();
    save();
    DT.bus.emit("ransom:change", fresher);
    if (silent === true) return; // relance automatique à l'ouverture de la page : pas de message superflu
    DT.Notify.push({ title: "Scénario réinitialisé", message: "Le poste est revenu à son état d'origine : vous pouvez recommencer.", type: "info" });
  }

  /* ------------------------------ Score ------------------------------ */
  function computeScore() {
    const s = S();
    const attacked = s.phase !== "ready";
    const items = [];
    const b = s.backup;
    items.push({ id: "backup", label: "Sauvegarde faite avant l'attaque", max: 25, pts: b ? (b.kind === "offline" ? 25 : 5) : 0,
      detail: b ? (b.kind === "offline" ? "Sauvegarde hors ligne : elle a été protégée de l'attaque." : "Sauvegarde sur le même ordinateur : elle a été verrouillée aussi.") : "Aucune sauvegarde : les fichiers ne peuvent pas être récupérés." });
    const phish = s.mail.choice === "reported" ? 15 : s.mail.choice === "deleted" ? 10 : 0;
    items.push({ id: "phishing", label: "Message piégé repéré", max: 15, pts: phish,
      detail: s.mail.choice === "reported" ? "Vous avez signalé le message : excellent réflexe." : s.mail.choice === "deleted" ? "Message supprimé sans être ouvert, mais non signalé aux collègues." : s.mail.choice === "demo" ? "Mode démonstration : le message n'a pas été analysé." : s.mail.choice === "opened" ? "La pièce jointe a été ouverte." : "Le message n'a pas encore été traité." });
    if (attacked) {
      items.push({ id: "isolate", label: "Poste isolé du réseau", max: 15, pts: s.isolated ? 15 : 0, detail: s.isolated ? "Propagation stoppée." : "Le poste est resté connecté : l'attaque aurait pu se propager." });
      items.push({ id: "pay", label: "Rançon non payée", max: 10, pts: s.refused && !s.paid ? 10 : 0, detail: s.paid ? "Payer ne garantit rien et finance les criminels." : s.refused ? "Bonne décision." : "Aucune décision enregistrée." });
      items.push({ id: "alert", label: "Responsable sécurité alerté", max: 5, pts: s.alerted ? 5 : 0, detail: s.alerted ? "L'équipe peut protéger les autres postes." : "Personne n'a été prévenu." });
      items.push({ id: "identify", label: "Source de l'attaque identifiée", max: 5, pts: s.identified ? 5 : 0, detail: s.identified ? "Origine : pièce jointe d'un e-mail piégé." : "Non analysée." });
      items.push({ id: "eradicate", label: "Programme malveillant supprimé avant la restauration", max: 10, pts: s.eradicated && s.reinfections === 0 ? 10 : 0, detail: s.reinfections ? "Réinfection subie : le programme était encore là." : s.eradicated ? "Poste nettoyé avant restauration." : "Programme non supprimé." });
      const ratio = s.total ? Math.min(1, (s.total - s.remaining) / s.total) : 0;
      const recovered = s.phase === "recovered" && s.remaining === 0 ? 15 : s.phase === "recovered" ? Math.round(15 * ratio) : 0;
      items.push({ id: "restore", label: "Fichiers restaurés", max: 15, pts: recovered, detail: s.phase === "recovered" ? (s.total - s.remaining) + " fichiers sur " + s.total + " restaurés." : "Restauration non terminée." });
    }
    const total = items.reduce((sum, i) => sum + i.pts, 0);
    const max = items.reduce((sum, i) => sum + i.max, 0);
    return { items: items, total: total, max: max, attacked: attacked };
  }

  /** Sortie de secours, toujours visible pendant un incident : remet le poste sain d'origine. */
  async function askBannerReset() {
    const ok = await DT.UI.choose({ title: "Quitter la simulation ?", message: "Le poste revient à son état d'origine : fichiers virtuels restaurés, réseau rétabli, score effacé. Vos vrais fichiers ne sont pas concernés.", dismiss: "cancel", buttons: [{ label: "Rester", value: "cancel", primary: true }, { label: "Quitter la simulation", value: "go" }] });
    if (ok === "go") resetScenario();
  }

  /* ------------------------------ Bandeau « simulation » ------------------------------ */
  let bannerEl = null;
  function paintBanner() {
    bannerEl = bannerEl || document.getElementById("sim-banner");
    if (!bannerEl) return;
    const phase = S().phase;
    const on = phase === "attacking" || phase === "infected";
    bannerEl.hidden = !on;
    if (!on) return;
    bannerEl.replaceChildren(
      DT.Icons.el("shield-alert", 18),
      h("span", { class: "sim-banner-text", text: phase === "attacking" ? "SIMULATION — attaque en cours : des fichiers virtuels se verrouillent…" : "SIMULATION — incident de sécurité : réagissez dans le bon ordre." }),
      h("button", { type: "button", class: "btn sim-banner-btn", id: "sim-banner-open", onClick: () => DT.WM.open("ransomlab", { tab: phase === "infected" ? "response" : "incident" }) }, "Ouvrir le Lab"),
      h("button", { type: "button", class: "btn sim-banner-btn", id: "sim-banner-reset", title: "Quitter la simulation : le poste revient à son état d'origine", onClick: () => askBannerReset() }, "Quitter"));
  }

  /* ------------------------------ Contenu pédagogique ------------------------------ */
  const MAILS = [
    { id: "m1", from: "Direction EITT", addr: "direction@eitt.local", subject: "Planning des ateliers — semaine 42", time: "08:12", legit: true,
      body: ["Bonjour à toutes et à tous,", "Voici le planning des ateliers de la semaine prochaine. Les salles sont réservées du lundi au jeudi.", "Merci de signaler toute difficulté d'ici vendredi.", "Bien cordialement,", "La direction"] },
    { id: "m2", from: "Service Comptabilité", addr: "compta.eitt@factures-eitt-paiement.example", subject: "URGENT : facture d'octobre impayée — dernier rappel", time: "09:41", legit: false,
      attachment: { name: SAMPLE_NAME, size: "412 Ko" },
      body: ["Cher client,", "Votre facture d'octobre est restée impayée. Sans règlement sous 2 HEURES, des pénalités de 250 € seront appliquées et votre dossier sera transmis au contentieux.", "Ouvrez immédiatement la pièce jointe pour consulter le détail et régulariser.", "Cordialement,", "Service Comptabilité"],
      flags: [
        "Domaine de l'expéditeur suspect : « factures-eitt-paiement.example » ne correspond pas au domaine habituel « eitt.local ».",
        "Urgence et menace (« sous 2 heures », pénalités, contentieux) : une pression pour vous faire agir sans réfléchir.",
        "Salutation générique (« Cher client ») alors que vous êtes un collègue connu.",
        "Pièce jointe à double extension « .pdf.exe » : le vrai type est « .exe », un programme, pas un document.",
        "Facture inattendue : vérifiez par un autre canal (téléphone, collègue) avant d'ouvrir quoi que ce soit."
      ] },
    { id: "m3", from: "Support informatique", addr: "support@eitt.local", subject: "Rappel : pensez à sauvegarder vos fichiers", time: "10:05", legit: true,
      body: ["Bonjour,", "Un rappel amical : une sauvegarde régulière sur un support déconnecté vous sauvera en cas de panne ou d'attaque.", "L'outil de sauvegarde se trouve dans l'onglet « Préparer » du Ransomware Lab.", "Le support informatique"] }
  ];

  const GOOD_PRACTICES = [
    ["Règle 3-2-1", "3 copies de vos données, sur 2 supports différents, dont 1 hors ligne ou hors site. Une copie toujours branchée peut être chiffrée avec le reste."],
    ["Mises à jour", "Les attaques exploitent souvent des failles déjà corrigées : mettez à jour le système et les applications."],
    ["Prudence avec les messages", "Vérifiez l'expéditeur, méfiez-vous de l'urgence, ne cliquez pas sur une pièce jointe inattendue, signalez le message."],
    ["Droits limités", "Travaillez avec un compte standard, pas administrateur : un programme malveillant aura moins de pouvoir."],
    ["Mot de passe et double authentification", "Un mot de passe unique par service et une double authentification limitent les intrusions."],
    ["Plan de réaction", "Sachez qui prévenir et quoi faire dans quel ordre : isoler, alerter, comprendre, nettoyer, restaurer."]
  ];

  /* ------------------------------ Interface de l'application ------------------------------ */
  function createLab(ctx) {
    ctx.body.classList.add("rl-app");
    let tab = (ctx.params && ctx.params.tab) || S().tab || "mission";
    const main = h("section", { class: "rl-main" });
    const nav = h("nav", { class: "rl-nav", "aria-label": "Étapes du laboratoire" });
    ctx.body.append(nav, main);

    ctx.onParams((params) => {
      if (params && params.tab) go(params.tab);
    });
    const off = [DT.bus.on("ransom:change", () => render()), DT.bus.on("fs:change", () => { /* l'état du lab suit les fichiers */ })];
    ctx.onClose(() => off.forEach((fn) => fn()));
    const countdown = window.setInterval(() => {
      const el = main.querySelector(".rl-countdown");
      if (el) el.textContent = countdownText();
    }, 1000);
    ctx.onClose(() => window.clearInterval(countdown));

    function go(next) {
      tab = next;
      S().tab = next;
      render();
    }

    function statusInfo() {
      const s = S();
      if (s.phase === "ready" && s.mail.choice === "reported") return { cls: "ok", text: "Poste sain — attaque évitée", sub: "Vous avez signalé le message piégé." };
      if (s.phase === "ready") return { cls: "ok", text: "Poste sain", sub: "Aucune menace détectée pour le moment." };
      if (s.phase === "attacking") return { cls: "warn", text: "Attaque en cours…", sub: s.locked + " / " + s.total + " fichiers verrouillés" };
      if (s.phase === "infected") return { cls: "bad", text: "Poste compromis", sub: s.locked + " fichiers verrouillés (simulation)" };
      return { cls: "ok", text: "Poste rétabli", sub: (s.total - s.remaining) + " / " + s.total + " fichiers récupérés" };
    }

    function render() {
      const s = S();
      const status = statusInfo();
      const scroll = main.querySelector(".rl-panel") ? main.querySelector(".rl-panel").scrollTop : 0;
      nav.replaceChildren(...TABS.map((t) => {
        const attention = (t.id === "incident" && (s.phase === "attacking" || s.phase === "infected")) || (t.id === "response" && s.phase === "infected");
        return h("button", { type: "button", class: "rl-tab" + (tab === t.id ? " is-on" : "") + (attention ? " has-alert" : ""), id: "rl-tab-" + t.id, "aria-current": tab === t.id ? "page" : null, onClick: () => go(t.id) },
          DT.Icons.el(t.icon, 17), h("span", { text: t.label }));
      }));
      const header = h("header", { class: "rl-status rl-status-" + status.cls, role: "status" },
        DT.Icons.el(status.cls === "bad" ? "shield-alert" : status.cls === "warn" ? "alert" : "shield", 22),
        h("div", {}, h("strong", { class: "rl-status-text", text: status.text }), h("span", { class: "rl-status-sub", text: status.sub })),
        h("span", { class: "rl-fake-tag", title: "Rien de ce qui se passe ici ne touche vos vrais fichiers.", text: "SIMULATION" }));
      const panel = h("div", { class: "rl-panel", id: "rl-panel-" + tab, role: "region", "aria-label": TABS.find((t) => t.id === tab).label },
        ...({ mission: panelMission, prepare: panelPrepare, mail: panelMail, incident: panelIncident, response: panelResponse, report: panelReport }[tab])());
      main.replaceChildren(header, panel);
      panel.scrollTop = scroll;
    }

    /* ---- Mission ---- */
    function objective(done, text) {
      return h("li", { class: "rl-obj" + (done ? " is-done" : "") }, h("span", { class: "rl-obj-mark", "aria-hidden": "true", text: done ? "✓" : "○" }), h("span", { text: text }), h("span", { class: "sr-only", text: done ? " (accompli)" : " (à faire)" }));
    }
    function panelMission() {
      const s = S();
      const attacked = s.phase !== "ready";
      return [
        h("h2", { text: "Bienvenue dans le Ransomware Lab" }),
        h("p", { class: "rl-lead", text: "Un rançongiciel (ransomware) verrouille vos fichiers puis réclame de l'argent pour les rendre. Ici, vous vivez une attaque entièrement fictive sur un ordinateur virtuel, pour apprendre à vous en protéger et à réagir calmement." }),
        h("div", { class: "rl-card rl-safe" }, DT.Icons.el("info", 18), h("p", {}, h("strong", { text: "100 % simulé. " }), "Seuls les fichiers virtuels de ce navigateur sont concernés. Aucun vrai fichier n'est lu, modifié ou chiffré, aucun paiement n'est possible, rien n'est envoyé sur Internet. Le bouton « Réinitialiser » remet tout à zéro.")),
        h("h3", { text: "Vos objectifs" }),
        h("ul", { class: "rl-objs" },
          objective(s.chat.stage === "replied" || s.chat.stage === "done", "Répondre au patron sur EITT Chat"),
          objective(Boolean(s.backup) && s.backup.kind === "offline", "Faire une sauvegarde hors ligne avant l'attaque"),
          objective(s.mail.choice === "reported" || s.mail.choice === "deleted", "Repérer le message piégé dans la messagerie"),
          objective(attacked && s.isolated, "Isoler le poste du réseau dès l'incident"),
          objective(attacked && s.refused && !s.paid, "Ne pas payer la rançon"),
          objective(attacked && s.eradicated, "Supprimer le programme malveillant"),
          objective(s.phase === "recovered", "Restaurer les fichiers depuis la sauvegarde")),
        h("div", { class: "rl-actions" },
          s.chat.stage === "idle" && !attacked ? h("button", { type: "button", class: "btn btn-primary", id: "rl-launch", onClick: () => DT.Chat.launch() }, "Lancer la simulation") : null,
          h("button", { type: "button", class: "btn" + (s.chat.stage === "idle" && !attacked ? "" : " btn-primary"), id: "rl-start", onClick: () => go(attacked ? "response" : "prepare") }, attacked ? "Continuer la réponse" : "Préparer le poste"),
          h("button", { type: "button", class: "btn", id: "rl-open-explorer", onClick: () => DT.WM.open("explorer", { folderId: FS.systemFolder("Documents").id }) }, "Voir mes fichiers"),
          h("button", { type: "button", class: "btn", id: "rl-reset-1", onClick: askReset }, "Réinitialiser")),
        s.chat.stage === "idle" && !attacked ? h("p", { class: "rl-note", id: "rl-launch-note", text: "La simulation démarre toute seule 2 à 5 secondes après l'ouverture (ou le verrouillage) de la session : le patron vous écrit sur EITT Chat, avec une notification. Vous pouvez aussi la lancer vous-même avec le bouton ci-dessus." }) : null,
        h("h3", { text: "Comment se déroule une attaque ?" }),
        h("ol", { class: "rl-steps" },
          h("li", {}, h("strong", { text: "Entrée : " }), "un message piégé (hameçonnage) avec une pièce jointe ou un lien, parfois relayé par un supérieur pressé."),
          h("li", {}, h("strong", { text: "Exécution : " }), "le programme démarre dès que la victime l'ouvre."),
          h("li", {}, h("strong", { text: "Verrouillage : " }), "il « chiffre » les documents et les sauvegardes accessibles."),
          h("li", {}, h("strong", { text: "Rançon : " }), "une note exige un paiement, avec une pression de temps."),
          h("li", {}, h("strong", { text: "Réaction : " }), "isoler, alerter, comprendre, nettoyer, restaurer."))
      ];
    }

    /* ---- Préparer ---- */
    function panelPrepare() {
      const s = S();
      const ready = s.phase === "ready";
      let kind = "offline";
      const radios = [["offline", "Disque externe déconnecté (hors ligne)", "Copie conservée hors de portée du poste : recommandé."], ["local", "Dossier sur ce même ordinateur", "Pratique, mais accessible au programme malveillant."]].map(([value, label, hint], index) =>
        h("label", { class: "rl-choice" }, h("input", { type: "radio", name: "rl-backup-kind", value: value, checked: index === 0 ? true : null, onChange: () => { kind = value; } }), h("span", {}, h("strong", { text: label }), h("small", { text: hint }))));
      const b = s.backup;
      return [
        h("h2", { text: "Préparer le poste" }),
        h("p", { class: "rl-lead", text: "Avant toute attaque, la meilleure défense est une sauvegarde saine. Choisissez où la stocker, puis créez-la." }),
        h("div", { class: "rl-card" },
          h("h3", { text: "Sauvegarde de mes fichiers" }),
          h("div", { class: "rl-choices", role: "radiogroup", "aria-label": "Emplacement de la sauvegarde" }, ...radios),
          h("div", { class: "rl-actions" },
            h("button", { type: "button", class: "btn btn-primary", id: "rl-backup", disabled: ready ? null : true, onClick: () => {
              const result = makeBackup(kind);
              if (!result.ok) DT.Notify.push({ title: "Sauvegarde impossible", message: result.error, type: "warning" });
              save();
              render();
            } }, b ? "Refaire la sauvegarde" : "Créer la sauvegarde maintenant")),
          b ? h("p", { class: "rl-note rl-backup-info", id: "rl-backup-info" }, h("strong", { text: "Dernière sauvegarde : " }), hhmmss(b.at) + " — " + b.files.length + " fichiers — " + (b.kind === "offline" ? "hors ligne" : "sur le même ordinateur") + (b.lost ? " — verrouillée par l'attaque" : "")) : h("p", { class: "rl-note rl-backup-info", id: "rl-backup-info", text: "Aucune sauvegarde pour l'instant." }),
          ready ? null : h("p", { class: "rl-note", text: "L'attaque a commencé : il n'est plus possible de sauvegarder des fichiers déjà verrouillés." })),
        h("h3", { text: "Les bons réflexes" }),
        h("div", { class: "rl-practices" }, ...GOOD_PRACTICES.map(([title, text]) => h("details", { class: "rl-practice" }, h("summary", { text: title }), h("p", { text: text })))),
        h("div", { class: "rl-actions" }, h("button", { type: "button", class: "btn btn-primary", id: "rl-to-mail", onClick: () => go("mail") }, "Étape suivante : la messagerie"))
      ];
    }

    /* ---- Messagerie ---- */
    function panelMail() {
      const s = S();
      const mails = MAILS.filter((m) => m.id !== "m2" || s.mail.delivered);
      const current = mails.find((m) => m.id === s.mail.open) || mails[0];
      const list = h("ul", { class: "rl-maillist", role: "list", "aria-label": "Boîte de réception" }, ...mails.map((m) =>
        h("li", {}, h("button", { type: "button", class: "rl-mailrow" + (m.id === current.id ? " is-on" : ""), "data-mail": m.id, onClick: () => { s.mail.open = m.id; save(); render(); } },
          h("strong", {}, m.from, m.id === "m2" && !s.mail.choice && s.phase === "ready" ? h("span", { class: "rl-new", text: "Nouveau" }) : null), h("span", { class: "rl-mail-subject", text: m.subject }), h("small", { text: m.time })))));
      const locked = s.phase !== "ready";
      const detail = h("article", { class: "rl-mail", "aria-label": "Message ouvert" },
        h("header", {}, h("h3", { text: current.subject }), h("p", { class: "rl-mail-from" }, h("strong", { text: current.from }), " ", h("span", { class: "rl-mail-addr", text: "<" + current.addr + ">" }))),
        h("div", { class: "rl-mail-body" }, ...current.body.map((line) => h("p", { text: line }))),
        current.attachment ? h("p", { class: "rl-attach" }, DT.Icons.el("file-text", 16), h("span", { text: " Pièce jointe : " }), h("strong", { text: current.attachment.name }), h("small", { text: " (" + current.attachment.size + ")" })) : null);
      const extras = [];
      if (current.id === "m2") {
        if (s.mail.analysed) extras.push(h("div", { class: "rl-card rl-flags", id: "rl-flags" }, h("h4", { text: "Indices d'hameçonnage repérés" }), h("ul", {}, ...current.flags.map((f) => h("li", { text: f })))));
        if (!locked && !s.mail.choice) {
          extras.push(h("div", { class: "rl-actions rl-mail-actions" },
            h("button", { type: "button", class: "btn", id: "rl-analyse", onClick: () => { s.mail.analysed = true; save(); render(); } }, "Analyser ce message"),
            h("button", { type: "button", class: "btn btn-primary", id: "rl-report", onClick: () => { s.mail.choice = "reported"; log("Message d'hameçonnage signalé : attaque évitée.", "good"); DT.Notify.push({ title: "Message signalé", message: "Bravo : vous avez évité l'attaque et prévenu vos collègues.", type: "success" }); save(); render(); } }, "Signaler comme hameçonnage"),
            h("button", { type: "button", class: "btn", id: "rl-delete-mail", onClick: () => { s.mail.choice = "deleted"; log("Message suspect supprimé sans être ouvert.", "good"); save(); render(); } }, "Supprimer le message"),
            h("button", { type: "button", class: "btn btn-danger", id: "rl-open-attach", onClick: openAttachment }, "Ouvrir la pièce jointe")));
        } else if (s.mail.choice === "reported" || s.mail.choice === "deleted") {
          extras.push(h("div", { class: "rl-card rl-win", id: "rl-avoided" }, h("strong", { text: s.mail.choice === "reported" ? "Attaque évitée : message signalé." : "Message supprimé sans être ouvert." }), h("p", { text: "C'est le meilleur scénario. Pour comprendre ce que vous avez évité, vous pouvez lancer l'attaque en mode démonstration." }),
            s.phase === "ready" ? h("button", { type: "button", class: "btn", id: "rl-demo", onClick: askDemo }, "Voir l'attaque (mode démonstration)") : null));
        } else if (locked) {
          extras.push(h("p", { class: "rl-note", text: s.mail.choice === "opened" ? "Vous avez ouvert la pièce jointe : voyez l'onglet « Incident »." : "L'attaque a été lancée en mode démonstration." }));
        }
      }
      const waiting = !s.mail.delivered;
      return [
        h("h2", { text: "Messagerie" }),
        waiting
          ? h("div", { class: "rl-card", id: "rl-mail-wait" }, DT.Icons.el("message-circle", 20),
            h("p", { text: s.chat.stage === "idle" ? "Aucun message important pour l'instant. Lancez la simulation : le patron va vous écrire sur EITT Chat." : "Le patron vous a écrit sur EITT Chat à propos d'un mail à traiter. Répondez-lui : le mail arrivera ensuite ici." }),
            h("div", { class: "rl-actions" }, s.chat.stage === "idle"
              ? h("button", { type: "button", class: "btn btn-primary", id: "rl-launch-2", onClick: () => DT.Chat.launch() }, "Lancer la simulation")
              : h("button", { type: "button", class: "btn btn-primary", id: "rl-open-chat", onClick: () => DT.WM.open("chat") }, "Ouvrir EITT Chat")))
          : h("p", { class: "rl-lead", text: "Trois messages sont dans la boîte de réception. L'un d'eux n'est pas ce qu'il prétend être : lisez-les avec attention avant d'agir." }),
        h("div", { class: "rl-mailbox" }, list, h("div", { class: "rl-mailview" }, detail, ...extras))
      ];
    }

    async function openAttachment() {
      const ok = await DT.UI.choose({ title: "Ouvrir « " + SAMPLE_NAME + " » ?", message: "Simulation : ce fichier est un programme (.exe) déguisé en facture. L'ouvrir déclenchera l'attaque fictive sur ce poste virtuel. Continuer ?", dismiss: "cancel", buttons: [{ label: "Annuler", value: "cancel", primary: true }, { label: "Ouvrir quand même", value: "go" }] });
      if (ok === "go") startAttack("opened");
    }
    async function askDemo() {
      const ok = await DT.UI.choose({ title: "Lancer la démonstration ?", message: "Un collègue (fictif) ouvre la pièce jointe à votre place. Vous pourrez ensuite exercer la réponse à incident. Le score tiendra compte du mode démonstration.", dismiss: "cancel", buttons: [{ label: "Annuler", value: "cancel", primary: true }, { label: "Lancer la démonstration", value: "go" }] });
      if (ok === "go") startAttack("demo");
    }
    async function askReset() {
      const ok = await DT.UI.choose({ title: "Réinitialiser le scénario ?", message: "Les fichiers virtuels reviennent à leur état d'avant l'attaque, la sauvegarde et le score sont effacés. Vos vrais fichiers ne sont pas concernés.", dismiss: "cancel", buttons: [{ label: "Annuler", value: "cancel", primary: true }, { label: "Réinitialiser", value: "go" }] });
      if (ok === "go") resetScenario();
    }

    /* ---- Incident ---- */
    function countdownText() {
      const s = S();
      const end = (s.infectedAt || Date.now()) + 72 * 3600 * 1000;
      const left = Math.max(0, end - Date.now());
      const total = Math.floor(left / 1000);
      return pad2(Math.floor(total / 3600)) + ":" + pad2(Math.floor((total % 3600) / 60)) + ":" + pad2(total % 60);
    }
    function logList(max) {
      const s = S();
      const lines = s.log.slice(-max);
      return h("ol", { class: "rl-log", id: "rl-log", "aria-label": "Journal de l'incident" }, ...(lines.length ? lines.map((l) => h("li", { class: "rl-log-" + l.tone }, h("time", { text: hhmmss(l.t) }), h("span", { text: l.text }))) : [h("li", { class: "rl-log-info", text: "Le journal est vide : aucun événement pour l'instant." })]));
    }
    function panelIncident() {
      const s = S();
      if (s.phase === "ready") {
        return [
          h("h2", { text: "Incident" }),
          h("div", { class: "rl-card" }, DT.Icons.el("shield", 20), h("p", { text: "Aucun incident en cours. Lisez la messagerie : l'attaque démarre si vous ouvrez la pièce jointe piégée." }),
            h("div", { class: "rl-actions" },
              h("button", { type: "button", class: "btn", id: "rl-go-mail", onClick: () => go("mail") }, "Aller à la messagerie"),
              h("button", { type: "button", class: "btn", id: "rl-demo-2", onClick: askDemo }, "Lancer la démonstration directement")))
        ];
      }
      const pct = s.total ? Math.round((s.locked / s.total) * 100) : 0;
      const parts = [
        h("h2", { text: s.phase === "attacking" ? "Attaque en cours" : "Incident : vos fichiers sont verrouillés" }),
        h("div", { class: "rl-progress", role: "progressbar", "aria-label": "Fichiers verrouillés", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(pct) },
          h("div", { class: "rl-progress-fill", style: { width: pct + "%" } }), h("span", { class: "rl-progress-text", text: s.locked + " / " + s.total + " fichiers verrouillés" })),
        logList(14)
      ];
      if (s.phase === "infected" || s.phase === "recovered") {
        parts.push(h("div", { class: "rl-ransom", id: "rl-ransom" },
          h("div", { class: "rl-ransom-head" }, DT.Icons.el("lock", 22), h("strong", { text: "VOS FICHIERS ONT ÉTÉ VERROUILLÉS" }), h("span", { class: "rl-fake-tag", text: "NOTE FICTIVE" })),
          h("p", { text: "Les documents de ce poste virtuel sont « chiffrés ». Pour obtenir une clé, les attaquants exigent 0,05 BTC (montant fictif) avant la fin du compte à rebours." }),
          h("p", { class: "rl-countdown", "aria-label": "Compte à rebours fictif", text: countdownText() }),
          h("p", { class: "rl-note", text: "Adresse de paiement : [AUCUNE — cette simulation ne permet aucun paiement réel]." }),
          s.phase === "infected" ? (s.paid || s.refused
            ? h("p", { class: "rl-decided", id: "rl-decided", text: s.paid ? "Décision : rançon payée (simulation) — rien n'a été rendu." : "Décision : rançon refusée — bonne décision." })
            : h("div", { class: "rl-actions" },
              h("button", { type: "button", class: "btn btn-danger", id: "rl-pay", onClick: async () => { const c = await DT.UI.choose({ title: "Payer la rançon ?", message: "Simulation : aucun argent réel n'est en jeu. Voulez-vous voir ce qui se passerait si vous payiez ?", dismiss: "cancel", buttons: [{ label: "Annuler", value: "cancel", primary: true }, { label: "Payer (simulation)", value: "pay" }] }); if (c === "pay") decidePay(true); } }, "Payer (simulation)"),
              h("button", { type: "button", class: "btn btn-primary", id: "rl-refuse", onClick: () => decidePay(false) }, "Ne pas payer"))) : null));
        parts.push(h("div", { class: "rl-actions" }, h("button", { type: "button", class: "btn btn-primary", id: "rl-go-response", onClick: () => go("response") }, "Passer à la réponse à incident")));
      }
      return parts;
    }

    /* ---- Réponse ---- */
    function stepCard(n, title, text, done, control) {
      return h("div", { class: "rl-step" + (done ? " is-done" : ""), "data-step": n },
        h("span", { class: "rl-step-n", "aria-hidden": "true", text: done ? "✓" : String(n) }),
        h("div", { class: "rl-step-body" }, h("strong", { text: title }), h("p", { text: text })),
        h("div", { class: "rl-step-ctl" }, control));
    }
    function panelResponse() {
      const s = S();
      if (s.phase === "ready") return [h("h2", { text: "Réponse à incident" }), h("p", { class: "rl-lead", text: "Rien à faire pour l'instant : aucun incident. Revenez ici si une attaque survient (ou lancez la démonstration)." }), h("div", { class: "rl-actions" }, h("button", { type: "button", class: "btn", id: "rl-go-mail-2", onClick: () => go("mail") }, "Messagerie"))];
      const attacking = s.phase === "attacking";
      const gone = sampleGone();
      const hasBackup = Boolean(s.backup);
      return [
        h("h2", { text: "Réponse à incident" }),
        h("p", { class: "rl-lead", text: "L'ordre compte. Suivez les étapes : isoler, alerter, comprendre, nettoyer, puis restaurer." }),
        attacking ? h("p", { class: "rl-note", text: "L'attaque est encore en cours : isolez le poste le plus vite possible." }) : null,
        stepCard(1, "Isoler le poste du réseau", "Couper le réseau limite la propagation vers les autres machines (simulé : votre vraie connexion n'est pas modifiée).", s.isolated,
          h("button", { type: "button", class: "btn " + (s.isolated ? "" : "btn-primary"), id: "rl-isolate", disabled: s.phase === "recovered" ? true : null, onClick: () => isolate(!s.isolated) }, s.phase === "recovered" ? "Réseau rétabli" : s.isolated ? "Reconnecter" : "Isoler le poste")),
        stepCard(2, "Alerter le responsable sécurité", "Prévenir vite permet de protéger les autres postes et de préparer la suite.", s.alerted,
          h("button", { type: "button", class: "btn", id: "rl-alert", disabled: s.alerted ? true : null, onClick: alertSecurity }, s.alerted ? "Alerte envoyée" : "Envoyer l'alerte")),
        stepCard(3, "Identifier l'origine", "Retrouver comment l'attaque est entrée évite qu'elle recommence.", s.identified,
          h("button", { type: "button", class: "btn", id: "rl-identify", disabled: attacking ? true : null, onClick: identify }, s.identified ? "Analyse faite" : "Analyser les journaux")),
        s.identified ? h("div", { class: "rl-card rl-analysis", id: "rl-analysis" }, h("h4", { text: "Résultat de l'analyse (simulation)" }),
          h("table", { class: "rl-table" }, h("thead", {}, h("tr", {}, h("th", { text: "Processus" }), h("th", { text: "Ouvert depuis" }), h("th", { text: "Verdict" }))),
            h("tbody", {}, h("tr", { class: "is-bad" }, h("td", { text: SAMPLE_NAME + " (PID 4812)" }), h("td", { text: "Pièce jointe — message de « Service Comptabilité »" }), h("td", { text: "Malveillant" })),
              h("tr", {}, h("td", { text: "Explorateur EITT" }), h("td", { text: "Session utilisateur" }), h("td", { text: "Normal" }))))) : null,
        stepCard(4, "Supprimer le programme malveillant", "Il faut nettoyer AVANT de restaurer, sinon il verrouillera de nouveau les fichiers récupérés.", gone,
          h("button", { type: "button", class: "btn", id: "rl-eradicate", disabled: attacking || gone ? true : null, onClick: eradicate }, gone ? "Supprimé" : "Supprimer « " + SAMPLE_NAME + " »")),
        stepCard(5, "Restaurer depuis la sauvegarde", hasBackup ? (s.backup.lost ? "La sauvegarde a été verrouillée avec le reste : elle est inutilisable." : "Une sauvegarde saine est disponible (" + s.backup.files.length + " fichiers).") : "Aucune sauvegarde n'a été faite : les fichiers ne peuvent pas être récupérés. Réinitialisez le scénario pour recommencer en préparant une sauvegarde.", s.phase === "recovered",
          h("button", { type: "button", class: "btn btn-primary", id: "rl-restore", disabled: attacking || s.phase === "recovered" || !hasBackup ? true : null, onClick: restore }, s.phase === "recovered" ? "Fichiers restaurés" : "Restaurer mes fichiers")),
        s.phase === "infected" && !s.paid && !s.refused ? h("p", { class: "rl-note", text: "N'oubliez pas la décision sur la rançon (onglet « Incident »)." }) : null,
        h("h3", { text: "Journal" }),
        logList(10),
        h("div", { class: "rl-actions" },
          s.phase === "recovered" ? h("button", { type: "button", class: "btn btn-primary", id: "rl-end", onClick: () => endExercise() }, "Terminer et revenir à ma session") : null,
          h("button", { type: "button", class: "btn" + (s.phase === "recovered" ? "" : " btn-primary"), id: "rl-go-report", onClick: () => go("report") }, "Voir le bilan"),
          h("button", { type: "button", class: "btn", id: "rl-reset-2", onClick: askReset }, "Réinitialiser"))
      ];
    }

    /* ---- Bilan ---- */
    function panelReport() {
      const s = S();
      const score = computeScore();
      const finished = s.phase === "recovered";
      const verdict = !score.attacked ? "Aucun incident pour l'instant" : finished ? (score.total >= 85 ? "Excellent : vous avez géré l'incident comme un professionnel." : score.total >= 60 ? "Bien joué : l'essentiel est là, quelques points à améliorer." : "Vous avez traversé l'incident, mais plusieurs réflexes manquent : rejouez pour progresser.") : "Incident en cours : ce score est provisoire.";
      return [
        h("h2", { text: "Bilan" }),
        h("div", { class: "rl-score", role: "status" }, h("strong", { class: "rl-score-num", id: "rl-score", text: score.total + " / " + score.max }), h("span", { class: "rl-score-text", text: verdict })),
        h("table", { class: "rl-table rl-scoretable" }, h("thead", {}, h("tr", {}, h("th", { text: "Critère" }), h("th", { text: "Points" }), h("th", { text: "Commentaire" }))),
          h("tbody", {}, ...score.items.map((i) => h("tr", { class: i.pts === i.max ? "is-good" : i.pts === 0 ? "is-bad" : "" }, h("td", { text: i.label }), h("td", { text: i.pts + " / " + i.max }), h("td", { text: i.detail }))))),
        h("h3", { text: "Chronologie" }),
        logList(30),
        h("h3", { text: "À retenir" }),
        h("ul", { class: "rl-lessons" },
          h("li", { text: "Une sauvegarde hors ligne et récente est votre meilleure assurance : elle rend la rançon inutile." }),
          h("li", { text: "Un message urgent avec une pièce jointe inattendue (surtout « .pdf.exe ») doit être vérifié, jamais ouvert." }),
          h("li", { text: "« Bien reçu » ne veut pas dire « ouvert sans réfléchir » : même quand le patron vous demande de traiter un mail, vérifiez l'expéditeur et la pièce jointe avant d'agir (et rappelez-le en cas de doute)." }),
          h("li", { text: "Réagir dans l'ordre : isoler, alerter, comprendre, nettoyer, restaurer." }),
          h("li", { text: "Ne pas payer : aucune garantie, et cela finance les attaquants." }),
          h("li", { text: "Nettoyer avant de restaurer, sinon la réinfection est probable." })),
        h("p", { class: "rl-note", text: "Pour aller plus loin : cybermalveillance.gouv.fr (assistance aux victimes) et nomoreransom.org (outils de déchiffrement gratuits pour certains rançongiciels connus). Ce laboratoire est une simulation pédagogique, pas une certification." }),
        h("div", { class: "rl-actions" },
          finished ? h("button", { type: "button", class: "btn btn-primary", id: "rl-end-2", onClick: () => endExercise() }, "Terminer et revenir à ma session") : null,
          h("button", { type: "button", class: "btn" + (finished ? "" : " btn-primary"), id: "rl-replay", onClick: askReset }, "Rejouer le scénario"))
      ];
    }

    render();
  }

  /* ------------------------------ Fichier verrouillé ------------------------------ */
  async function openLocked(node) {
    const choice = await DT.UI.choose({
      title: "Fichier verrouillé (simulation)",
      message: "« " + (node.sim ? node.sim.name : node.name) + " » a été verrouillé par le programme de la simulation : son contenu est illisible. Ouvrez le Ransomware Lab, onglet « Réponse », pour le restaurer.",
      dismiss: "close",
      buttons: [{ label: "Fermer", value: "close" }, { label: "Ouvrir le Ransomware Lab", value: "lab", primary: true }]
    });
    if (choice === "lab") DT.WM.open("ransomlab", { tab: "response" });
  }

  /* ------------------------------ Initialisation ------------------------------ */
  function init() {
    let s = S();
    /**
     * LANCEMENT de la page avec un incident laissé par la visite précédente (attaque en cours ou poste compromis) :
     * on repart d'un poste sain (fichiers d'origine, réseau, notifications) et le patron écrit de nouveau. Sinon le
     * bureau s'ouvrait toujours sur la note de rançon et les fichiers verrouillés, sans moyen évident d'en sortir.
     * (Avec « ?auto=0 », réservé aux démonstrations et aux tests, l'état est conservé tel quel.)
     */
    let cleaned = false;
    if ((s.phase === "attacking" || s.phase === "infected") && DT.Chat && DT.Chat.autoEnabled()) {
      resetScenario(true);
      s = S();
      cleaned = true;
    }
    if (cleaned) {
      let told = false;
      DT.bus.on("session:signin", () => {
        if (told) return;
        told = true;
        DT.Notify.push({ title: "Nouvelle session", message: "L'incident de la session précédente a été nettoyé : le poste est revenu à son état d'origine.", type: "info" });
      });
    }
    // Reprise après un rechargement en pleine attaque : on termine immédiatement le verrouillage.
    if (s.phase === "attacking") {
      while (lockStep()) { /* verrouille tout */ }
      finishAttack();
    }
    if (s.isolated && s.phase !== "ready" && s.phase !== "recovered") DT.Net.setIsolated(true);
    document.documentElement.dataset.ransom = s.phase;
    paintBanner();
    // Couper le Wi-Fi ou activer le mode avion (barre des tâches) pendant l'incident = isoler le poste.
    DT.bus.on("net:change", (net) => {
      const st = S();
      if (!net.manual) return;
      if (st.phase !== "attacking" && st.phase !== "infected") return;
      st.cutManual = true; // le joueur a coupé Wi-Fi / mode avion : on les rétablira à la fin de l'exercice
      if (st.isolated) { save(); return; }
      st.isolated = true;
      st.isolatedAt = st.isolatedAt || Date.now();
      log("Vous avez coupé le réseau (Wi-Fi ou mode avion) : le poste est isolé (simulation).", "good");
      DT.Notify.push({ title: "Poste isolé du réseau", message: "Bon réflexe : couper le Wi-Fi limite la propagation (simulation).", type: "success" });
      save();
      DT.bus.emit("ransom:change", st);
    });
  }

  DT.WM.registerApp({
    id: "ransomlab",
    title: "Ransomware Lab",
    tile: "ransomlab",
    size: { w: 900, h: 600 },
    minSize: { w: 520, h: 400 },
    singleton: true,
    keywords: ["ransomware", "rançongiciel", "cybersécurité", "attaque", "sauvegarde", "hameçonnage", "phishing", "incident", "simulation", "laboratoire"],
    create: createLab
  });

  DT.Ransom = { init: init, log: log, restartIntro: restartIntro, deliverMail: deliverMail, openLocked: openLocked, state: S, startAttack: startAttack, computeScore: computeScore, reset: resetScenario, endExercise: endExercise, LOCK_EXT: LOCK_EXT, SAMPLE_NAME: SAMPLE_NAME };
}());
