/*
 * EITT OS — composants d'interface partagés : menus contextuels, boîtes de dialogue
 * (confirmation, saisie, choix, sélecteurs de dossier/fichier, « Enregistrer sous », propriétés).
 * Ce sont des composants de la SIMULATION : aucune fenêtre native du navigateur (alert/confirm/prompt) n'est utilisée.
 */
(function () {
  "use strict";
  const DT = window.DT;
  const { h, $, $$, formatSize, formatDate, plural } = DT.u;

  const overlay = () => document.getElementById("overlay-root");

  /* ================================ Menus contextuels ================================ */
  let openMenus = [];
  let detach = null;
  let menuReturnFocus = null;

  function closeMenus(restoreFocus) {
    openMenus.forEach((menu) => menu.remove());
    openMenus = [];
    if (detach) {
      detach();
      detach = null;
    }
    if (restoreFocus && menuReturnFocus && document.contains(menuReturnFocus)) menuReturnFocus.focus({ preventScroll: true });
    menuReturnFocus = null;
  }

  function placeMenu(menu, x, y) {
    const margin = 6;
    const w = menu.offsetWidth;
    const hgt = menu.offsetHeight;
    const maxX = window.innerWidth - w - margin;
    const maxY = window.innerHeight - hgt - margin;
    menu.style.left = Math.max(margin, Math.min(x, maxX)) + "px";
    menu.style.top = Math.max(margin, Math.min(y, maxY)) + "px";
  }

  function buildMenu(items, level) {
    const menu = h("div", { class: "ctx-menu", role: "menu", tabindex: "-1" });
    menu.dataset.level = String(level);
    items.forEach((item) => {
      if (item.separator) {
        menu.append(h("div", { class: "ctx-sep", role: "separator" }));
        return;
      }
      const hasCheck = item.checked !== undefined;
      const button = h("button", {
        type: "button",
        class: "ctx-item" + (item.danger ? " danger" : ""),
        role: hasCheck ? "menuitemcheckbox" : "menuitem",
        "aria-checked": hasCheck ? String(Boolean(item.checked)) : null,
        "aria-haspopup": item.submenu ? "menu" : null,
        disabled: Boolean(item.disabled),
        tabindex: "-1"
      },
      h("span", { class: "ctx-icon" }, item.icon ? DT.Icons.el(item.icon, 16) : hasCheck && item.checked ? DT.Icons.el("check", 16) : null),
      h("span", { class: "ctx-label", text: item.label }),
      item.shortcut ? h("span", { class: "ctx-shortcut", text: item.shortcut }) : null,
      item.submenu ? h("span", { class: "ctx-arrow" }, DT.Icons.el("chevron-right", 14)) : null);

      if (item.submenu) {
        const open = () => openSubmenu(button, item.submenu, level + 1);
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          open();
        });
        button.addEventListener("pointerenter", () => {
          if (!button.disabled) open();
        });
      } else {
        button.addEventListener("pointerenter", () => closeDeeper(level));
        button.addEventListener("click", () => {
          closeMenus(false);
          if (typeof item.action === "function") window.setTimeout(item.action, 0);
        });
      }
      menu.append(button);
    });

    menu.addEventListener("keydown", (event) => {
      const buttons = $$(".ctx-item:not([disabled])", menu);
      const current = buttons.indexOf(document.activeElement);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!buttons.length) return;
        const delta = event.key === "ArrowDown" ? 1 : -1;
        buttons[(current + delta + buttons.length) % buttons.length].focus();
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        if (buttons.length) buttons[event.key === "Home" ? 0 : buttons.length - 1].focus();
      } else if (event.key === "ArrowRight" && document.activeElement && document.activeElement.getAttribute("aria-haspopup")) {
        event.preventDefault();
        document.activeElement.click();
        const sub = openMenus[openMenus.length - 1];
        const first = sub && $(".ctx-item:not([disabled])", sub);
        if (first) first.focus();
      } else if (event.key === "ArrowLeft" && level > 0) {
        event.preventDefault();
        closeDeeper(level - 1);
        const parent = openMenus[level - 1];
        const owner = parent && $(".ctx-item.is-open", parent);
        if (owner) owner.focus();
      }
    });
    return menu;
  }

  function closeDeeper(level) {
    while (openMenus.length > level + 1) openMenus.pop().remove();
    const parent = openMenus[level];
    if (parent) $$(".ctx-item.is-open", parent).forEach((b) => b.classList.remove("is-open"));
  }

  function openSubmenu(owner, items, level) {
    closeDeeper(level - 1);
    owner.classList.add("is-open");
    const sub = buildMenu(items, level);
    overlay().append(sub);
    openMenus.push(sub);
    const rect = owner.getBoundingClientRect();
    sub.style.left = "0px";
    sub.style.top = "0px";
    const roomRight = window.innerWidth - rect.right;
    const x = roomRight > sub.offsetWidth + 8 ? rect.right - 4 : rect.left - sub.offsetWidth + 4;
    placeMenu(sub, x, rect.top - 6);
  }

  /** Affiche un menu contextuel à la position (x, y). */
  function contextMenu(x, y, items) {
    closeMenus(false);
    menuReturnFocus = document.activeElement;
    const cleaned = items.filter((item, index, list) => {
      if (!item.separator) return true;
      return index > 0 && index < list.length - 1 && !list[index - 1].separator;
    });
    const menu = buildMenu(cleaned, 0);
    overlay().append(menu);
    openMenus.push(menu);
    menu.style.left = "0px";
    menu.style.top = "0px";
    placeMenu(menu, x, y);

    const onPointerDown = (event) => {
      if (!event.target.closest(".ctx-menu")) closeMenus(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeMenus(true);
      }
    };
    const onClose = () => closeMenus(false);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("blur", onClose);
    window.addEventListener("resize", onClose);
    detach = () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("resize", onClose);
    };
    menu.focus({ preventScroll: true });
    return menu;
  }

  /* ================================ Boîtes de dialogue ================================ */
  function dialog(options) {
    return new Promise((resolve) => {
      const previous = document.activeElement;
      const titleId = DT.u.uid("dlgt");
      let finished = false;

      const backdrop = h("div", { class: "dlg-backdrop" });
      const box = h("div", {
        class: "dlg" + (options.className ? " " + options.className : ""),
        role: options.role || "dialog",
        "aria-modal": "true",
        "aria-labelledby": titleId,
        style: options.width ? { width: options.width + "px" } : null
      });
      const body = h("div", { class: "dlg-body" });
      const foot = h("div", { class: "dlg-foot" });

      const api = {
        el: box,
        body: body,
        close(value) {
          if (finished) return;
          finished = true;
          document.removeEventListener("keydown", onKey, true);
          backdrop.classList.add("closing");
          window.setTimeout(() => backdrop.remove(), DT.u.prefersReducedMotion() ? 0 : 120);
          if (previous && document.contains(previous) && typeof previous.focus === "function") previous.focus({ preventScroll: true });
          resolve(value);
        },
        buttons: {}
      };

      const content = typeof options.body === "function" ? options.body(api) : options.body;
      if (typeof content === "string") body.append(h("p", { text: content }));
      else if (content) body.append(content);

      (options.buttons || [{ label: "OK", value: true, primary: true }]).forEach((btn) => {
        const button = h("button", {
          type: "button",
          class: "btn" + (btn.primary ? " btn-primary" : "") + (btn.danger ? " btn-danger" : ""),
          onClick: () => {
            if (typeof btn.beforeClose === "function" && btn.beforeClose(api) === false) return;
            api.close(typeof btn.resolve === "function" ? btn.resolve(api) : btn.value);
          }
        }, btn.label);
        if (btn.id) api.buttons[btn.id] = button;
        foot.append(button);
      });

      box.append(h("div", { class: "dlg-head" }, h("h2", { id: titleId, text: options.title || "" })), body, foot);
      backdrop.append(box);
      backdrop.addEventListener("pointerdown", (event) => {
        if (event.target === backdrop && options.dismiss !== undefined && options.dismissOnBackdrop !== false) api.close(options.dismiss);
      });

      function onKey(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          api.close(options.dismiss);
        } else if (event.key === "Tab") {
          const focusables = $$("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex='0']", box);
          if (!focusables.length) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          } else if (!box.contains(document.activeElement)) {
            event.preventDefault();
            first.focus();
          }
        }
      }
      document.addEventListener("keydown", onKey, true);

      closeMenus(false);
      overlay().append(backdrop);
      const toFocus = (options.focus && $(options.focus, box)) || $(".btn-primary", foot) || $("button", foot);
      window.setTimeout(() => toFocus && toFocus.focus(), 20);
      if (typeof options.onOpen === "function") options.onOpen(api);
    });
  }

  function confirm(options) {
    return dialog({
      title: options.title,
      body: options.message,
      width: options.width,
      dismiss: false,
      buttons: [
        { label: options.cancelLabel || "Annuler", value: false },
        { label: options.okLabel || "OK", value: true, primary: !options.danger, danger: Boolean(options.danger) }
      ],
      focus: options.danger ? ".btn:first-child" : null
    });
  }

  function alertBox(options) {
    return dialog({ title: options.title, body: options.message, dismiss: undefined, buttons: [{ label: options.okLabel || "OK", value: true, primary: true }] });
  }

  /** Boîte de choix libre (ex. Enregistrer / Ne pas enregistrer / Annuler). */
  function choose(options) {
    return dialog({ title: options.title, body: options.message, dismiss: options.dismiss, buttons: options.buttons });
  }

  /** Saisie d'un texte, avec validation affichée sous le champ. Résout la valeur saisie, ou null si annulé. */
  function prompt(options) {
    let input = null;
    let errorBox = null;
    return dialog({
      title: options.title,
      dismiss: null,
      width: options.width || 420,
      focus: "input",
      body: (api) => {
        input = h("input", {
          type: "text",
          class: "field",
          value: options.value || "",
          placeholder: options.placeholder || "",
          autocomplete: "off",
          spellcheck: "false",
          "aria-label": options.label || options.title,
          maxlength: options.maxLength || 120
        });
        errorBox = h("p", { class: "field-error", role: "alert" });
        input.addEventListener("input", () => {
          errorBox.textContent = "";
        });
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            api.buttons.ok.click();
          }
        });
        return h("div", null, options.message ? h("p", { text: options.message }) : null, input, errorBox);
      },
      buttons: [
        { label: "Annuler", value: null },
        {
          id: "ok",
          label: options.okLabel || "OK",
          primary: true,
          beforeClose: () => {
            const error = typeof options.validate === "function" ? options.validate(input.value) : null;
            if (error) {
              errorBox.textContent = error;
              input.focus();
              return false;
            }
            return true;
          },
          resolve: () => input.value
        }
      ],
      onOpen: () => {
        window.setTimeout(() => {
          if (!input) return;
          input.focus();
          const value = input.value;
          const dot = options.selectName ? value.lastIndexOf(".") : -1;
          input.setSelectionRange(0, dot > 0 ? dot : value.length);
        }, 40);
      }
    });
  }

  /* ----------------------------- Sélecteur de dossier ----------------------------- */
  function pickFolder(options) {
    const opts = options || {};
    const excluded = (opts.excludeIds || []).filter(Boolean);
    let selected = opts.startId && DT.FS.alive(opts.startId) && opts.startId !== DT.FS.ROOT ? opts.startId : null;
    let okRef = null;
    const list = h("div", { class: "pick-list", role: "listbox", "aria-label": "Dossiers" });

    function disabledFor(node) {
      return node.id === DT.FS.ROOT || excluded.some((id) => id === node.id || DT.FS.isDescendant(node.id, id));
    }

    function paint(okButton) {
      $$(".pick-item", list).forEach((el) => {
        const on = el.dataset.id === selected;
        el.classList.toggle("is-selected", on);
        el.setAttribute("aria-selected", String(on));
      });
      if (okButton) okButton.disabled = !selected;
    }

    return dialog({
      title: opts.title || "Choisir un dossier",
      dismiss: null,
      width: 440,
      body: () => {
        DT.FS.allFolders().forEach(({ node, depth }) => {
          const off = disabledFor(node);
          const item = h("button", {
            type: "button",
            class: "pick-item",
            role: "option",
            "data-id": node.id,
            disabled: off,
            style: { paddingLeft: 10 + depth * 18 + "px" },
            onClick: () => {
              selected = node.id;
              paint(okRef);
            }
          }, DT.Icons.file("folder", 20), h("span", { text: node.id === DT.FS.ROOT ? "Ce PC" : node.name }));
          list.append(item);
        });
        return h("div", null, opts.message ? h("p", { text: opts.message }) : null, list);
      },
      buttons: [
        { label: "Annuler", value: null },
        { id: "ok", label: opts.okLabel || "Choisir", primary: true, resolve: () => selected }
      ],
      onOpen: (api) => {
        okRef = api.buttons.ok;
        paint(okRef);
      }
    });
  }

  /* ------------------------------ Sélecteur de fichier ----------------------------- */
  function pickFile(options) {
    const opts = options || {};
    const files = DT.FS.allFiles(opts.kind);
    let selected = null;
    let okButton = null;
    const list = h("div", { class: "pick-list", role: "listbox", "aria-label": "Fichiers" });

    return dialog({
      title: opts.title || "Ouvrir un fichier",
      dismiss: null,
      width: 480,
      body: (api) => {
        if (!files.length) return h("p", { class: "muted", text: "Aucun fichier de ce type n'est disponible dans la simulation." });
        files.forEach((node) => {
          const item = h("button", {
            type: "button",
            class: "pick-item",
            role: "option",
            "data-id": node.id,
            onClick: () => {
              selected = node.id;
              $$(".pick-item", list).forEach((el) => {
                el.classList.toggle("is-selected", el.dataset.id === selected);
                el.setAttribute("aria-selected", String(el.dataset.id === selected));
              });
              if (okButton) okButton.disabled = false;
            },
            onDblclick: () => {
              selected = node.id;
              api.close(selected);
            }
          }, DT.Icons.file(DT.FS.kindOf(node), 22), h("span", { class: "pick-name", text: node.name }), h("span", { class: "pick-path muted", text: DT.FS.path(node.parent) }));
          list.append(item);
        });
        return h("div", null, opts.message ? h("p", { text: opts.message }) : null, list);
      },
      buttons: [
        { label: "Annuler", value: null },
        { id: "ok", label: opts.okLabel || "Ouvrir", primary: true, resolve: () => selected }
      ],
      onOpen: (api) => {
        okButton = api.buttons.ok;
        okButton.disabled = true;
      }
    });
  }

  /* --------------------------------- Enregistrer sous -------------------------------- */
  function saveAs(options) {
    const opts = options || {};
    let nameInput = null;
    let folderSelect = null;
    let errorBox = null;
    return dialog({
      title: opts.title || "Enregistrer sous",
      dismiss: null,
      width: 460,
      focus: "input",
      body: (api) => {
        nameInput = h("input", { type: "text", class: "field", value: opts.name || "Sans titre.txt", autocomplete: "off", spellcheck: "false", "aria-label": "Nom du fichier", maxlength: 100 });
        folderSelect = h("select", { class: "field", "aria-label": "Dossier de destination" });
        const defaultFolder = opts.folderId && DT.FS.alive(opts.folderId) && opts.folderId !== DT.FS.ROOT ? opts.folderId : (DT.FS.systemFolder("Documents") || {}).id;
        DT.FS.allFolders().forEach(({ node, depth, path }) => {
          if (node.id === DT.FS.ROOT) return;
          const option = h("option", { value: node.id, text: "  ".repeat(Math.max(0, depth - 1)) + path });
          if (node.id === defaultFolder) option.selected = true;
          folderSelect.append(option);
        });
        errorBox = h("p", { class: "field-error", role: "alert" });
        nameInput.addEventListener("input", () => {
          errorBox.textContent = "";
        });
        nameInput.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            api.buttons.ok.click();
          }
        });
        return h("div", { class: "form-grid" },
          h("label", { class: "field-label", text: "Nom du fichier" }, nameInput),
          h("label", { class: "field-label", text: "Dossier" }, folderSelect),
          errorBox,
          h("p", { class: "muted small", text: "Le fichier sera enregistré dans la simulation, pas sur votre véritable ordinateur." }));
      },
      buttons: [
        { label: "Annuler", value: null },
        {
          id: "ok",
          label: "Enregistrer",
          primary: true,
          beforeClose: () => {
            const error = DT.FS.validateName(nameInput.value);
            if (error) {
              errorBox.textContent = error;
              nameInput.focus();
              return false;
            }
            return true;
          },
          resolve: () => {
            let name = nameInput.value.trim();
            if (!DT.FS.ext(name)) name += ".txt";
            return { name: name, folderId: folderSelect.value };
          }
        }
      ],
      onOpen: () => {
        window.setTimeout(() => {
          if (!nameInput) return;
          nameInput.focus();
          const dot = nameInput.value.lastIndexOf(".");
          nameInput.setSelectionRange(0, dot > 0 ? dot : nameInput.value.length);
        }, 40);
      }
    });
  }

  /* ------------------------------------ Propriétés ----------------------------------- */
  function properties(node) {
    if (!node) return Promise.resolve();
    const isFolder = node.type === "folder";
    const rows = [["Type", DT.FS.typeLabel(node)]];
    if (node.trashed) {
      rows.push(["Emplacement d'origine", node.trashed.fromPath || "—"]);
      rows.push(["Supprimé le", formatDate(node.trashed.at)]);
    } else {
      rows.push(["Emplacement", node.id === DT.FS.ROOT ? "—" : DT.FS.displayPath(node.parent)]);
    }
    const size = DT.FS.sizeOf(node);
    rows.push(["Taille", formatSize(size) + (size >= 1024 ? " (" + size.toLocaleString("fr-FR") + " octets)" : "")]);
    if (isFolder) {
      const c = DT.FS.counts(node);
      rows.push(["Contenu", c.files + " " + plural(c.files, "fichier", "fichiers") + ", " + c.folders + " " + plural(c.folders, "dossier", "dossiers")]);
    }
    rows.push(["Créé le", formatDate(node.created)]);
    rows.push(["Modifié le", formatDate(node.modified)]);
    if (node.protected) rows.push(["Protection", "Dossier système de la simulation (ne peut être ni renommé, ni supprimé)"]);
    if (!isFolder && node.art) rows.push(["Remarque", "Fichier de démonstration : son contenu est simulé."]);

    const list = h("dl", { class: "props" });
    rows.forEach(([label, value]) => list.append(h("dt", { text: label }), h("dd", { text: value })));
    return dialog({
      title: "Propriétés",
      width: 440,
      dismiss: true,
      body: h("div", { class: "props-wrap" },
        h("div", { class: "props-head" }, DT.Icons.file(DT.FS.kindOf(node), 44), h("strong", { text: node.id === DT.FS.ROOT ? "Ce PC" : node.name })),
        list),
      buttons: [{ label: "Fermer", value: true, primary: true }]
    });
  }

  DT.UI = {
    contextMenu: contextMenu,
    closeMenus: () => closeMenus(false),
    hasOpenMenu: () => openMenus.length > 0,
    dialog: dialog,
    confirm: confirm,
    alert: alertBox,
    choose: choose,
    prompt: prompt,
    pickFolder: pickFolder,
    pickFile: pickFile,
    saveAs: saveAs,
    properties: properties
  };
}());
