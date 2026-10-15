/*
 * EITT OS — Terminal pédagogique.
 *
 * SÉCURITÉ : ce terminal n'exécute JAMAIS de vraie commande du système. Il n'utilise ni évaluation dynamique de code,
 * ni shell. Chaque ligne est découpée en mots (analyse explicite) puis comparée à une liste blanche de commandes
 * écrites ci-dessous, qui n'agissent que sur le système de fichiers VIRTUEL (DT.FS) de la simulation.
 */
(function () {
  "use strict";
  const DT = window.DT;
  const FS = DT.FS;
  const { h, plural, formatSize, formatDate } = DT.u;

  const MAX_LINES = 600;
  const MAX_HISTORY = 100;

  /** Découpe une ligne en mots (guillemets simples/doubles gérés) et détecte les redirections > et >>. */
  function tokenize(line) {
    const tokens = [];
    let current = "";
    let quote = null;
    let started = false;
    const flush = () => {
      if (started) tokens.push({ value: current, op: false });
      current = "";
      started = false;
    };
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (quote) {
        if (c === quote) quote = null;
        else current += c;
      } else if (c === '"' || c === "'") {
        quote = c;
        started = true;
      } else if (/\s/.test(c)) {
        flush();
      } else if (c === ">") {
        flush();
        if (line[i + 1] === ">") {
          tokens.push({ value: ">>", op: true });
          i += 1;
        } else tokens.push({ value: ">", op: true });
      } else {
        current += c;
        started = true;
      }
    }
    if (quote) return { error: "Guillemet non refermé : ajoutez un " + quote + " à la fin de la ligne." };
    flush();
    return { tokens: tokens };
  }

  const KNOWN_REAL = {
    sudo: "« sudo » donne des droits d'administrateur sur un vrai système. Ici, il n'y a aucun vrai système à administrer.",
    rmdir: "Utilisez « rm -r NomDuDossier » pour envoyer un dossier à la corbeille virtuelle.",
    del: "« del » existe sous Windows. Dans ce terminal, utilisez « rm NomDuFichier ».",
    format: "Formater un disque efface tout son contenu. Cette commande n'existe volontairement pas ici.",
    shutdown: "Pour arrêter la simulation, utilisez le menu Démarrer › Alimentation. Cette commande ne touche jamais au vrai ordinateur.",
    reboot: "Pour redémarrer la simulation, utilisez le menu Démarrer › Alimentation.",
    curl: "« curl » télécharge des données sur Internet. Ce terminal n'a aucun accès au réseau.",
    wget: "« wget » télécharge des données sur Internet. Ce terminal n'a aucun accès au réseau.",
    ping: "« ping » teste un réseau réel. Ce terminal n'a aucun accès au réseau.",
    ssh: "« ssh » ouvre une connexion à distance. Ce terminal n'a aucun accès au réseau.",
    python: "Ce terminal n'exécute pas de programmes : il ne connaît que ses propres commandes (tapez « help »).",
    node: "Ce terminal n'exécute pas de programmes : il ne connaît que ses propres commandes (tapez « help »).",
    bash: "Ce terminal n'ouvre pas d'autre interpréteur de commandes.",
    sh: "Ce terminal n'ouvre pas d'autre interpréteur de commandes.",
    cmd: "Ce terminal n'ouvre pas d'autre interpréteur de commandes.",
    powershell: "Ce terminal n'ouvre pas d'autre interpréteur de commandes."
  };

  function createTerminal(ctx) {
    ctx.body.classList.add("term-app");
    const state = { cwd: FS.ROOT, history: [], hIndex: 0, draft: "" };
    const output = h("div", { class: "term-out", role: "log", "aria-live": "polite", "aria-label": "Sortie du terminal" });
    const promptEl = h("span", { class: "term-prompt" });
    const input = h("input", { type: "text", class: "term-input", "aria-label": "Ligne de commande", autocomplete: "off", autocapitalize: "off", spellcheck: "false", maxlength: "300" });
    const line = h("form", { class: "term-line" }, promptEl, input);
    const screen = h("div", { class: "term-screen" }, output, line);
    ctx.body.append(screen);

    const profile = () => DT.Settings.activeProfile();
    const userSlug = () => DT.u.normalize(profile().name.split(" ")[0]).replace(/[^a-z0-9]/g, "") || "invite";
    const cwdPath = () => (state.cwd === FS.ROOT ? "/" : FS.path(state.cwd));

    function print(text, cls) {
      const row = h("div", { class: "term-row" + (cls ? " " + cls : "") });
      row.textContent = text;
      output.append(row);
      while (output.children.length > MAX_LINES) output.firstChild.remove();
    }
    const printAll = (lines, cls) => lines.forEach((l) => print(l, cls));
    const error = (text) => print(text, "is-error");
    const hint = (text) => print(text, "is-hint");

    function refreshPrompt() {
      if (!FS.alive(state.cwd)) state.cwd = FS.ROOT;
      promptEl.textContent = userSlug() + "@eitt-dt:" + cwdPath() + "$";
    }

    function scrollDown() {
      screen.scrollTop = screen.scrollHeight;
    }

    function resolveTarget(text) {
      return FS.resolve(state.cwd, text);
    }

    function requireFolderContext(action) {
      if (state.cwd !== FS.ROOT) return true;
      error(action + " : impossible à la racine « / » (elle ne contient que les dossiers système).");
      hint("Placez-vous d'abord dans un dossier, par exemple : cd Documents");
      return false;
    }

    /* ------------------------------ Commandes ------------------------------ */
    const commands = {
      help: {
        usage: "help",
        text: "Affiche les commandes disponibles.",
        run() {
          print("Commandes disponibles (toutes agissent uniquement sur la simulation) :");
          Object.keys(commands).forEach((name) => {
            const cmd = commands[name];
            if (cmd.hidden) return;
            print("  " + cmd.usage.padEnd(24, " ") + cmd.text, "is-help");
          });
          hint("Astuce : les flèches ↑ ↓ rappellent les commandes précédentes, la touche Tab complète les noms.");
        }
      },
      date: {
        usage: "date",
        text: "Affiche la date et l'heure locales (réelles, de votre navigateur).",
        run() {
          const now = new Date();
          print(now.toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "short" }));
        }
      },
      whoami: {
        usage: "whoami",
        text: "Affiche le nom du profil virtuel actif.",
        run() {
          print(profile().name + "  (profil fictif de la simulation)");
        }
      },
      pwd: {
        usage: "pwd",
        text: "Affiche le chemin du dossier virtuel courant.",
        run() {
          print(cwdPath());
        }
      },
      ls: {
        usage: "ls [-l] [chemin]",
        text: "Liste le contenu d'un dossier virtuel.",
        run(args) {
          const long = args.includes("-l");
          const pathArg = args.find((a) => !a.startsWith("-"));
          const target = pathArg ? resolveTarget(pathArg) : FS.get(state.cwd);
          if (!target) return error("ls : « " + pathArg + " » est introuvable.");
          if (target.type === "file") return print(target.name);
          const kids = FS.children(target.id).sort((a, b) => (a.type === b.type ? FS.byName(a, b) : a.type === "folder" ? -1 : 1));
          if (!kids.length) return hint("(dossier vide)");
          if (long) {
            kids.forEach((n) => print((n.type === "folder" ? "d " : "- ") + (n.type === "folder" ? "".padStart(9) : formatSize(n.size || 0).padStart(9)) + "  " + formatDate(n.modified) + "  " + n.name + (n.type === "folder" ? "/" : ""), n.type === "folder" ? "is-dir" : ""));
          } else {
            const row = h("div", { class: "term-row term-cols" });
            kids.forEach((n) => row.append(h("span", { class: n.type === "folder" ? "is-dir" : "", text: n.name + (n.type === "folder" ? "/" : "") })));
            output.append(row);
          }
        }
      },
      cd: {
        usage: "cd [dossier]",
        text: "Change de dossier (cd .. pour remonter, cd / pour la racine).",
        run(args) {
          if (args.length > 1) return error("cd : trop d'arguments. Si le nom contient des espaces, entourez-le de guillemets.");
          const target = args.length ? resolveTarget(args[0]) : FS.get(FS.ROOT);
          if (!target) return error("cd : dossier introuvable : « " + args[0] + " ».");
          if (target.type !== "folder") return error("cd : « " + target.name + " » est un fichier, pas un dossier.");
          state.cwd = target.id;
        }
      },
      mkdir: {
        usage: "mkdir NomDuDossier",
        text: "Crée un dossier virtuel dans le dossier courant.",
        run(args) {
          if (!args.length) return error("mkdir : indiquez un nom. Exemple : mkdir MesPhotos");
          if (!requireFolderContext("mkdir")) return;
          args.forEach((name) => {
            if (name.includes("/")) return error("mkdir : « " + name + " » contient « / ». Créez les dossiers un par un avec cd.");
            const result = FS.create(state.cwd, "folder", name);
            if (result.ok) print("Dossier créé : " + result.node.name, "is-ok");
            else error("mkdir : " + result.error);
          });
        }
      },
      touch: {
        usage: "touch NomDuFichier",
        text: "Crée un fichier texte vide.",
        run(args) {
          if (!args.length) return error("touch : indiquez un nom. Exemple : touch notes.txt");
          if (!requireFolderContext("touch")) return;
          args.forEach((name) => {
            if (FS.findChild(state.cwd, name)) return hint("touch : « " + name + " » existe déjà.");
            const result = FS.create(state.cwd, "file", name, { content: "" });
            if (result.ok) print("Fichier créé : " + result.node.name, "is-ok");
            else error("touch : " + result.error);
          });
        }
      },
      cat: {
        usage: "cat NomDuFichier",
        text: "Affiche le contenu d'un fichier texte.",
        run(args) {
          if (!args.length) return error("cat : indiquez un fichier. Exemple : cat Bienvenue.txt");
          args.forEach((name) => {
            const node = resolveTarget(name);
            if (!node) return error("cat : « " + name + " » est introuvable.");
            if (node.type === "folder") return error("cat : « " + node.name + " » est un dossier. Utilisez ls pour le lister.");
            if (!FS.isText(node)) return error("cat : « " + node.name + " » n'est pas un fichier texte (" + FS.typeLabel(node) + ").");
            const text = node.content || "";
            if (!text) return hint("(fichier vide)");
            text.replace(/\n$/, "").split("\n").forEach((l) => print(l));
          });
        }
      },
      echo: {
        usage: "echo texte [> fichier]",
        text: "Affiche un texte, ou l'écrit dans un fichier virtuel (> remplace, >> ajoute).",
        run(args, tokens) {
          const opIndex = tokens.findIndex((t) => t.op);
          if (opIndex < 0) return print(args.join(" "));
          const op = tokens[opIndex].value;
          const words = tokens.slice(0, opIndex).map((t) => t.value);
          const rest = tokens.slice(opIndex + 1);
          if (rest.length !== 1 || rest[0].op) return error("echo : indiquez un seul nom de fichier après " + op + ". Exemple : echo Bonjour > salut.txt");
          if (!requireFolderContext("echo " + op)) return;
          const name = rest[0].value;
          const text = words.join(" ");
          const existing = FS.findChild(state.cwd, name);
          if (existing && existing.type === "folder") return error("echo : « " + name + " » est un dossier.");
          if (existing) {
            if (!FS.isText(existing)) return error("echo : « " + name + " » n'est pas un fichier texte.");
            const next = op === ">>" ? (existing.content || "").replace(/\n?$/, "\n") + text + "\n" : text + "\n";
            const result = FS.writeText(existing.id, next);
            if (result.ok) print("Fichier mis à jour : " + name, "is-ok");
            else error("echo : " + result.error);
          } else {
            const result = FS.create(state.cwd, "file", name, { content: text + "\n" });
            if (result.ok) print("Fichier créé : " + name, "is-ok");
            else error("echo : " + result.error);
          }
        }
      },
      rm: {
        usage: "rm [-r] Nom",
        text: "Envoie un fichier (ou un dossier avec -r) à la corbeille virtuelle.",
        run(args) {
          const recursive = args.includes("-r") || args.includes("-rf") || args.includes("-fr");
          const names = args.filter((a) => !a.startsWith("-"));
          if (!names.length) return error("rm : indiquez un nom. Exemple : rm brouillon.txt");
          names.forEach((name) => {
            const node = resolveTarget(name);
            if (node && node.id === FS.ROOT) {
              error("rm : la racine « / » de la simulation ne peut pas être supprimée.");
              return hint("Ce terminal est un exercice : il ne touche jamais aux fichiers de votre véritable ordinateur, et la commande « rm -rf / » est justement l'une des plus dangereuses d'un vrai système.");
            }
            if (!node) return error("rm : « " + name + " » est introuvable.");
            if (node.type === "folder" && !recursive) return error("rm : « " + node.name + " » est un dossier. Ajoutez -r pour l'envoyer à la corbeille.");
            const result = FS.trash([node.id]);
            if (result.errors.length) error("rm : " + result.errors[0]);
            else print("« " + node.name + " » placé dans la corbeille virtuelle (restaurable depuis l'Explorateur).", "is-ok");
          });
        }
      },
      open: {
        usage: "open Nom",
        text: "Ouvre un fichier ou un dossier dans l'application adaptée.",
        run(args) {
          if (!args.length) return error("open : indiquez un nom. Exemple : open Bienvenue.txt");
          const node = resolveTarget(args[0]);
          if (!node) return error("open : « " + args[0] + " » est introuvable.");
          DT.Files.open(node.id);
          print("Ouverture de « " + node.name + " »…", "is-ok");
        }
      },
      clear: {
        usage: "clear",
        text: "Efface l'écran du terminal.",
        run() {
          output.replaceChildren();
        }
      },
      history: {
        usage: "history",
        text: "Affiche les commandes tapées dans cette fenêtre.",
        run() {
          if (!state.history.length) return hint("(aucune commande pour l'instant)");
          state.history.forEach((c, i) => print(String(i + 1).padStart(4) + "  " + c));
        }
      },
      systeminfo: {
        usage: "systeminfo",
        text: "Affiche les informations de la simulation (réel / simulé / virtuel).",
        run() {
          const stats = FS.stats();
          const online = DT.Net.online;
          const lines = [
            ["Environnement", "EITT OS 1.0 — simulation pédagogique", "simulation"],
            ["Profil actif", profile().name, "virtuel"],
            ["Date et heure locales", new Date().toLocaleString("fr-FR", { hourCycle: "h23" }), "réel"],
            ["Langue du navigateur", navigator.language || "inconnue", "réel"],
            ["Connexion", online ? "connecté selon le navigateur (ne garantit pas l'accès à Internet)" : "hors ligne selon le navigateur", "réel"],
            ["Cœurs logiques", navigator.hardwareConcurrency ? String(navigator.hardwareConcurrency) : "non communiqué", navigator.hardwareConcurrency ? "réel" : "—"],
            ["Disque virtuel", formatSize(stats.bytes) + " utilisés sur " + formatSize(stats.capacity) + " (disque fictif)", "virtuel"],
            ["Fichiers / dossiers", stats.files + " " + plural(stats.files, "fichier", "fichiers") + ", " + stats.folders + " " + plural(stats.folders, "dossier", "dossiers"), "virtuel"],
            ["Processeur", Math.round(DT.Monitor.data.cpuNow) + " % d'utilisation", "simulation"],
            ["Mémoire", Math.round(DT.Monitor.data.memNow) + " Mo utilisés sur " + DT.Monitor.TOTAL_MB + " Mo (fictifs)", "simulation"],
            ["Fenêtres ouvertes", String(DT.WM.count()), "réel"],
            ["Sauvegarde locale", DT.Store.available ? "active (stockage du navigateur)" : "indisponible", "réel"]
          ];
          lines.forEach(([label, value, kind]) => print(label.padEnd(24, " ") + value + "  [" + kind + "]"));
          hint("[réel] mesuré par le navigateur • [virtuel] calculé depuis les fichiers simulés • [simulation] valeur illustrative");
        }
      },
      exit: {
        usage: "exit",
        text: "Ferme la fenêtre du terminal.",
        run() {
          window.setTimeout(() => ctx.close(), 0);
        }
      }
    };
    commands.cls = { hidden: true, run: commands.clear.run };
    commands.dir = { hidden: true, run: commands.ls.run };

    /* ------------------------------ Exécution ------------------------------ */
    function suggest(name) {
      const names = Object.keys(commands).filter((n) => !commands[n].hidden);
      let best = null;
      let bestDistance = 3;
      names.forEach((candidate) => {
        const d = DT.u.levenshtein(name, candidate);
        if (d < bestDistance) {
          bestDistance = d;
          best = candidate;
        }
      });
      return best;
    }

    function execute(raw) {
      const text = raw.trim();
      print(promptEl.textContent + " " + raw, "is-echo");
      if (!text) return;
      state.history.push(text);
      if (state.history.length > MAX_HISTORY) state.history.shift();
      const parsed = tokenize(text);
      if (parsed.error) return error(parsed.error);
      const tokens = parsed.tokens;
      if (!tokens.length || tokens[0].op) return error("Une commande doit commencer par un mot (par exemple « ls »).");
      const name = tokens[0].value.toLowerCase();
      const rest = tokens.slice(1);
      const args = rest.filter((t) => !t.op).map((t) => t.value);
      if (rest.some((t) => t.op) && name !== "echo") return error("Les redirections (> et >>) ne fonctionnent qu'avec « echo » dans ce terminal pédagogique.");
      const cmd = Object.prototype.hasOwnProperty.call(commands, name) ? commands[name] : null;
      if (cmd) {
        try {
          cmd.run(args, rest);
        } catch (err) {
          if (window.console) console.error(err);
          error("Une erreur interne est survenue pendant cette commande. Le reste de la simulation n'est pas affecté.");
        }
        return;
      }
      error("« " + tokens[0].value + " » n'est pas une commande reconnue par ce terminal pédagogique.");
      if (Object.prototype.hasOwnProperty.call(KNOWN_REAL, name)) hint(KNOWN_REAL[name]);
      else {
        const near = suggest(name);
        if (near) hint("Vous vouliez peut-être « " + near + " » ?");
        hint("Ce terminal ne comprend qu'une liste de commandes de démonstration et n'exécute jamais de vraie commande. Tapez « help » pour la voir.");
      }
    }

    line.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = input.value;
      input.value = "";
      state.hIndex = state.history.length + 1;
      execute(value);
      refreshPrompt();
      scrollDown();
    });

    function complete() {
      const value = input.value;
      const parts = value.split(/\s+/);
      const last = parts[parts.length - 1] || "";
      const pool = parts.length <= 1 ? Object.keys(commands).filter((n) => !commands[n].hidden) : FS.children(state.cwd).map((n) => n.name);
      const matches = pool.filter((n) => n.toLowerCase().startsWith(last.toLowerCase()));
      if (!matches.length) return;
      if (matches.length === 1) {
        const word = matches[0].includes(" ") ? '"' + matches[0] + '"' : matches[0];
        parts[parts.length - 1] = word;
        input.value = parts.join(" ") + (parts.length <= 1 ? " " : "");
      } else {
        print(promptEl.textContent + " " + value, "is-echo");
        print(matches.join("    "));
        scrollDown();
      }
    }

    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!state.history.length) return;
        if (state.hIndex > state.history.length) state.hIndex = state.history.length;
        if (state.hIndex === state.history.length) state.draft = input.value;
        state.hIndex = Math.max(0, state.hIndex - 1);
        input.value = state.history[state.hIndex] || "";
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        if (state.hIndex >= state.history.length) return;
        state.hIndex += 1;
        input.value = state.hIndex >= state.history.length ? state.draft : state.history[state.hIndex];
      } else if (event.key === "Tab") {
        event.preventDefault();
        complete();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
        event.preventDefault();
        output.replaceChildren();
      } else if (event.ctrlKey && event.key.toLowerCase() === "c") {
        if (window.getSelection && String(window.getSelection())) return;
        event.preventDefault();
        print(promptEl.textContent + " " + input.value + "^C", "is-echo");
        input.value = "";
      }
    });

    screen.addEventListener("pointerup", () => {
      if (!window.getSelection || !String(window.getSelection())) input.focus({ preventScroll: true });
    });

    const offs = [DT.bus.on("fs:change", refreshPrompt), DT.bus.on("profile:change", refreshPrompt)];
    ctx.onClose(() => offs.forEach((off) => off()));

    print("EITT OS — Terminal pédagogique", "is-title");
    print("Ce terminal est une démonstration : il n'exécute jamais de vraie commande et n'agit que sur les fichiers virtuels.");
    hint("Vous êtes à la racine « / ». Essayez : help, ls, cd Documents, mkdir MonDossier");
    refreshPrompt();
    window.setTimeout(() => input.focus({ preventScroll: true }), 40);
  }

  DT.WM.registerApp({
    id: "terminal",
    title: "Terminal",
    tile: "terminal",
    size: { w: 700, h: 440 },
    minSize: { w: 340, h: 240 },
    singleton: false,
    keywords: ["commande", "ligne", "console", "shell"],
    create: createTerminal
  });
}());
