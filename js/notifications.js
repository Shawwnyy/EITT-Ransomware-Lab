/*
 * EITT OS — centre de notifications et « toasts ».
 * Les notifications reflètent des actions RÉELLEMENT réalisées dans la simulation (fichier enregistré,
 * dossier créé, changement d'état réseau du navigateur…). Aucune fausse alerte de sécurité n'est simulée.
 */
(function () {
  "use strict";
  const DT = window.DT;
  const { h, $ } = DT.u;

  const MAX_ITEMS = 50;
  const TYPE_ICON = { info: "info", success: "check-circle", warning: "info", error: "x-circle" };

  const items = [];
  let panel = null;
  let panelOpen = false;
  let anchor = null;
  let detachOutside = null;

  function unreadCount() {
    return items.filter((n) => !n.read).length;
  }

  function timeLabel(ts) {
    const seconds = Math.round((Date.now() - ts) / 1000);
    if (seconds < 45) return "à l'instant";
    if (seconds < 3600) return "il y a " + Math.max(1, Math.round(seconds / 60)) + " min";
    return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  }

  function changed() {
    DT.bus.emit("notify:change", { count: items.length, unread: unreadCount() });
    if (panelOpen) renderPanel();
  }

  function push(spec) {
    const item = {
      id: DT.u.uid("nt"),
      title: spec.title || "Notification",
      message: spec.message || "",
      type: spec.type || "info",
      time: Date.now(),
      read: panelOpen,
      sticky: Boolean(spec.sticky),
      tag: spec.tag || "",
      variant: spec.variant || "",
      actions: (Array.isArray(spec.actions) ? spec.actions : spec.action ? [spec.action] : []).filter((a) => a && typeof a.run === "function"),
      onClick: typeof spec.onClick === "function" ? spec.onClick : null
    };
    item.action = item.actions[0] || null;
    if (!item.onClick && item.action) item.onClick = item.action.run;
    items.unshift(item);
    if (items.length > MAX_ITEMS) items.length = MAX_ITEMS;
    changed();
    if (!spec.silent) showToast(item);
    return item;
  }

  function showToast(item) {
    const root = document.getElementById("toast-root");
    if (!root || panelOpen) return;
    const toast = h("div", { class: "toast toast-" + item.type + (item.onClick ? " is-actionable" : "") + (item.sticky ? " is-sticky" : "") + (item.variant ? " toast-" + item.variant : ""), role: "status" },
      h("span", { class: "toast-icon" }, DT.Icons.el(TYPE_ICON[item.type] || "info", 18)),
      h("div", { class: "toast-text" }, h("strong", { text: item.title }), item.message ? h("span", { text: item.message }) : null,
        item.actions.length ? h("div", { class: "toast-actions" }, ...item.actions.map((a) => h("button", { type: "button", class: "btn toast-action" + (a.primary ? " btn-primary" : ""), onClick: () => { dismiss(); a.run(); } }, a.label || "Ouvrir"))) : null),
      h("button", { type: "button", class: "icon-btn", "aria-label": "Fermer la notification", onClick: () => dismiss() }, DT.Icons.el("x", 14)));
    let timer = null;
    function dismiss() {
      window.clearTimeout(timer);
      toast.classList.add("closing");
      window.setTimeout(() => toast.remove(), DT.u.prefersReducedMotion() ? 0 : 180);
    }
    if (item.tag) toast.dataset.tag = item.tag;
    toast._dismiss = dismiss;
    root.append(toast);
    // Trop de notifications affichées : on retire d'abord les plus anciennes NON persistantes (le message du patron reste).
    while (root.children.length > 3) {
      const victim = [...root.children].find((el) => !el.classList.contains("is-sticky")) || root.firstElementChild;
      victim.remove();
    }
    // Une notification « persistante » (ex. message du patron) reste affichée jusqu'à ce qu'on la ferme ou qu'on clique dessus.
    if (!item.sticky) {
      timer = window.setTimeout(dismiss, 5200);
      toast.addEventListener("pointerenter", () => window.clearTimeout(timer));
      toast.addEventListener("pointerleave", () => {
        timer = window.setTimeout(dismiss, 2500);
      });
    }
    // Un clic n'importe où sur la notification (hors boutons) déclenche son action principale.
    if (item.onClick) toast.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      dismiss();
      item.onClick();
    });
  }

  function remove(id) {
    const index = items.findIndex((n) => n.id === id);
    if (index >= 0) items.splice(index, 1);
    changed();
  }

  function clearAll() {
    items.length = 0;
    changed();
  }

  function markAllRead() {
    let touched = false;
    items.forEach((n) => {
      if (!n.read) {
        n.read = true;
        touched = true;
      }
    });
    if (touched) DT.bus.emit("notify:change", { count: items.length, unread: 0 });
  }

  function renderPanel() {
    if (!panel) return;
    const list = $(".notif-list", panel);
    list.replaceChildren();
    if (!items.length) {
      list.append(h("p", { class: "notif-empty", text: "Aucune notification pour le moment." }));
    } else {
      items.forEach((n) => {
        list.append(h("div", { class: "notif-item notif-" + n.type },
          h("span", { class: "notif-icon" }, DT.Icons.el(TYPE_ICON[n.type] || "info", 18)),
          h("div", { class: "notif-text" },
            h("strong", { text: n.title }),
            n.message ? h("span", { text: n.message }) : null,
            h("small", { class: "muted", text: timeLabel(n.time) })),
          h("button", { type: "button", class: "icon-btn", "aria-label": "Supprimer cette notification", onClick: () => remove(n.id) }, DT.Icons.el("x", 14))));
      });
    }
    $(".notif-clear", panel).disabled = !items.length;
  }

  function openPanel(anchorEl) {
    if (panelOpen) return;
    anchor = anchorEl || anchor;
    if (!panel) {
      panel = h("aside", { class: "flyout notif-panel", id: "notif-panel", role: "dialog", "aria-label": "Centre de notifications" },
        h("header", { class: "flyout-head" },
          h("h2", { text: "Notifications" }),
          h("button", { type: "button", class: "btn btn-small notif-clear", onClick: clearAll }, "Tout effacer")),
        h("div", { class: "notif-list", "aria-live": "polite" }),
        h("footer", { class: "flyout-foot muted", text: "Notifications de la simulation EITT OS." }));
      document.getElementById("desktop").append(panel);
    }
    DT.UI.closeMenus();
    panelOpen = true;
    panel.classList.add("open");
    markAllRead();
    renderPanel();
    if (anchor) anchor.setAttribute("aria-expanded", "true");
    const onPointerDown = (event) => {
      if (panel.contains(event.target) || (anchor && anchor.contains(event.target))) return;
      closePanel();
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        closePanel();
        if (anchor) anchor.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey, true);
    detachOutside = () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }

  function closePanel() {
    if (!panelOpen) return;
    panelOpen = false;
    if (panel) panel.classList.remove("open");
    if (anchor) anchor.setAttribute("aria-expanded", "false");
    if (detachOutside) detachOutside();
    detachOutside = null;
  }

  DT.Notify = {
    push: push,
    show: showToast,
    /** Ferme les notifications affichées portant cette étiquette (ex. message lu). */
    dismissTag(tag) {
      const root = document.getElementById("toast-root");
      if (root) root.querySelectorAll('.toast[data-tag="' + tag + '"]').forEach((t) => { if (t._dismiss) t._dismiss(); });
    },
    remove: remove,
    clearAll: clearAll,
    list: () => items.slice(),
    unread: unreadCount,
    togglePanel(anchorEl) {
      if (panelOpen) closePanel();
      else openPanel(anchorEl);
    },
    openPanel: openPanel,
    closePanel: closePanel,
    isOpen: () => panelOpen
  };
}());
