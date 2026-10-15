/*
 * EITT OS — Bloc-notes.
 * Les documents sont enregistrés dans le système de fichiers virtuel (DT.FS), donc visibles dans l'Explorateur
 * et conservés après actualisation. Ils ne sont PAS écrits sur le disque réel de l'ordinateur.
 */
(function () {
  "use strict";
  const DT = window.DT;
  const FS = DT.FS;
  const { h, plural } = DT.u;

  function createNotepad(ctx) {
    ctx.body.classList.add("np-app");
    const win = ctx.win;
    const state = { fileId: null, saved: "", missing: false, wrap: true, size: 15 };

    const textarea = h("textarea", { class: "np-text", "aria-label": "Contenu du document", spellcheck: "false", wrap: "soft" });
    const stateLabel = h("span", { class: "np-state", "data-dirty": "false" });
    const posLabel = h("span", { class: "np-pos" });
    const countLabel = h("span", { class: "np-count" });
    const pathLabel = h("span", { class: "np-path muted" });
    const status = h("div", { class: "np-status", role: "status" }, stateLabel, pathLabel, h("span", { class: "fx-grow" }), posLabel, countLabel);

    function btn(id, icon, label, action, shortcut, noLabel) {
      return h("button", { type: "button", class: "fx-cmd", "data-cmd": id, title: label + (shortcut ? " (" + shortcut + ")" : ""), "aria-label": label, onClick: action }, DT.Icons.el(icon, 17), noLabel ? null : h("span", { class: "fx-cmd-label", text: label }));
    }
    const wrapBtn = btn("wrap", "wrap-text", "Retour à la ligne automatique", () => setWrap(!state.wrap), null, true);
    wrapBtn.setAttribute("aria-pressed", "true");
    const bar = h("div", { class: "fx-commands np-bar", role: "toolbar", "aria-label": "Actions du Bloc-notes" },
      btn("new", "file-plus", "Nouveau", () => newDocument(), "Ctrl+N"),
      btn("open", "folder", "Ouvrir…", () => openDialog(), "Ctrl+O"),
      btn("save", "save", "Enregistrer", () => save(), "Ctrl+S"),
      btn("saveas", "copy", "Enregistrer sous…", () => saveAs(), "Ctrl+Maj+S"),
      h("span", { class: "fx-sep", role: "separator" }),
      wrapBtn,
      btn("smaller", "minus", "Réduire le texte", () => setSize(state.size - 1), null, true),
      btn("larger", "plus", "Agrandir le texte", () => setSize(state.size + 1), null, true));
    ctx.body.append(bar, textarea, status);

    const isDirty = () => textarea.value !== state.saved;

    function setWrap(on) {
      state.wrap = on;
      textarea.setAttribute("wrap", on ? "soft" : "off");
      textarea.classList.toggle("no-wrap", !on);
      wrapBtn.setAttribute("aria-pressed", String(on));
      wrapBtn.classList.toggle("is-on", on);
    }

    function setSize(px) {
      state.size = Math.min(26, Math.max(10, px));
      textarea.style.fontSize = state.size + "px";
    }

    function docName() {
      const node = state.fileId ? FS.get(state.fileId) : null;
      return node ? node.name : "Sans titre";
    }

    function refresh() {
      const dirty = isDirty();
      win.npFileId = state.fileId;
      win.npDirty = dirty;
      ctx.setTitle((dirty ? "● " : "") + docName() + " — Bloc-notes");
      stateLabel.dataset.dirty = String(dirty);
      stateLabel.textContent = dirty ? "● Modifications non enregistrées" : state.fileId && !state.missing ? "✓ Enregistré" : "Nouveau document";
      const node = state.fileId ? FS.get(state.fileId) : null;
      pathLabel.textContent = node && !state.missing ? FS.displayPath(node.parent) : state.missing ? "Le fichier n'existe plus : utilisez « Enregistrer sous »." : "Pas encore enregistré";
      const text = textarea.value;
      const words = (text.trim().match(/\S+/g) || []).length;
      countLabel.textContent = text.length + " " + plural(text.length, "caractère", "caractères") + " • " + words + " " + plural(words, "mot", "mots");
      updatePos();
    }

    function updatePos() {
      const before = textarea.value.slice(0, textarea.selectionStart);
      const line = before.split("\n").length;
      const col = before.length - before.lastIndexOf("\n");
      posLabel.textContent = "Ln " + line + ", col " + col;
    }

    function load(fileId, text) {
      state.fileId = fileId;
      state.missing = false;
      state.saved = text;
      textarea.value = text;
      textarea.setSelectionRange(0, 0);
      refresh();
    }

    /* ------------------------------ Actions ------------------------------ */
    async function confirmDiscard(title) {
      if (!isDirty()) return true;
      const answer = await DT.UI.choose({
        title: title || "Enregistrer les modifications ?",
        message: "Le document « " + docName() + " » contient des modifications non enregistrées.",
        dismiss: "cancel",
        buttons: [
          { label: "Annuler", value: "cancel" },
          { label: "Ne pas enregistrer", value: "discard", danger: true },
          { label: "Enregistrer", value: "save", primary: true }
        ]
      });
      if (answer === "save") return save();
      return answer === "discard";
    }

    async function newDocument() {
      if (!(await confirmDiscard())) return;
      load(null, "");
      textarea.focus();
    }

    async function openDialog() {
      if (!(await confirmDiscard())) return;
      const node = await DT.UI.pickFile({ kind: "text", title: "Ouvrir un document" });
      if (node) openFile(node.id, true);
    }

    function openFile(id, skipCheck) {
      const node = FS.get(id);
      if (!node || !FS.isText(node) || FS.isInTrash(node)) {
        DT.UI.alert({ title: "Ouverture impossible", message: "Ce fichier n'existe plus ou n'est pas un document texte." });
        return;
      }
      load(node.id, node.content || "");
      textarea.focus();
      void skipCheck;
    }

    async function save() {
      if (!state.fileId || state.missing || !FS.alive(state.fileId)) return saveAs();
      const result = FS.writeText(state.fileId, textarea.value);
      if (!result.ok) {
        DT.UI.alert({ title: "Enregistrement impossible", message: result.error });
        return false;
      }
      state.saved = textarea.value;
      refresh();
      return true;
    }

    async function saveAs() {
      const node = state.fileId ? FS.get(state.fileId) : null;
      const answer = await DT.UI.saveAs({ name: node && !state.missing ? node.name : "Nouveau document.txt", folderId: node && FS.alive(node.parent) ? node.parent : null });
      if (!answer) return false;
      const existing = FS.findChild(answer.folderId, answer.name);
      if (existing) {
        if (existing.type === "folder") {
          DT.UI.alert({ title: "Nom déjà utilisé", message: "Un dossier porte déjà le nom « " + answer.name + " » à cet endroit." });
          return false;
        }
        const ok = await DT.UI.confirm({ title: "Remplacer le fichier ?", message: "« " + answer.name + " » existe déjà dans ce dossier. Voulez-vous le remplacer ?", okLabel: "Remplacer", danger: true });
        if (!ok) return false;
        const written = FS.writeText(existing.id, textarea.value);
        if (!written.ok) {
          DT.UI.alert({ title: "Enregistrement impossible", message: written.error });
          return false;
        }
        state.fileId = existing.id;
      } else {
        const created = FS.create(answer.folderId, "file", answer.name, { content: textarea.value });
        if (!created.ok) {
          DT.UI.alert({ title: "Enregistrement impossible", message: created.error });
          return false;
        }
        state.fileId = created.node.id;
      }
      state.missing = false;
      state.saved = textarea.value;
      refresh();
      return true;
    }

    /* ------------------------------ Événements ------------------------------ */
    let frame = 0;
    textarea.addEventListener("input", () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        refresh();
      });
    });
    ["keyup", "click", "select"].forEach((name) => textarea.addEventListener(name, updatePos));

    ctx.body.addEventListener("keydown", (event) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        if (event.shiftKey) saveAs();
        else save();
      } else if (key === "o") {
        event.preventDefault();
        openDialog();
      }
    });

    ctx.setBeforeClose(async () => {
      if (!isDirty()) return true;
      return confirmDiscard("Fermer le Bloc-notes ?");
    });

    const offFs = DT.bus.on("fs:change", (event) => {
      if (!state.fileId || !event.ids.includes(state.fileId)) return;
      if (event.type === "trash" || event.type === "delete" || event.type === "delete-silent" || event.type === "empty-trash") state.missing = !FS.alive(state.fileId);
      else if (event.type === "restore") state.missing = false;
      refresh();
    });
    ctx.onClose(() => {
      offFs();
      window.cancelAnimationFrame(frame);
    });
    ctx.onParams((params) => {
      if (params && params.fileId) openFile(params.fileId);
    });

    setWrap(true);
    setSize(15);
    const initial = ctx.params && ctx.params.fileId ? FS.get(ctx.params.fileId) : null;
    if (initial && FS.isText(initial) && !FS.isInTrash(initial)) load(initial.id, initial.content || "");
    else load(null, ctx.params && typeof ctx.params.text === "string" ? "" : "");
    window.setTimeout(() => textarea.focus({ preventScroll: true }), 30);
  }

  DT.WM.registerApp({
    id: "notepad",
    title: "Bloc-notes",
    tile: "notepad",
    size: { w: 640, h: 460 },
    minSize: { w: 340, h: 260 },
    singleton: false,
    keywords: ["texte", "note", "document", "écrire", "bloc"],
    create: createNotepad
  });

  /** Ouvre un document : si un Bloc-notes l'affiche déjà, cette fenêtre passe au premier plan. */
  DT.Notepad = {
    open(fileId) {
      const existing = DT.WM.byApp("notepad").find((w) => w.npFileId === fileId);
      if (existing) {
        DT.WM.restore(existing);
        DT.WM.focus(existing);
        return existing;
      }
      return DT.WM.open("notepad", { fileId: fileId });
    }
  };
}());
