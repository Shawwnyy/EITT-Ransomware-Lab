/*
 * EITT OS — utilitaires partagés : création de DOM, bus d'événements, formats, aides diverses.
 * Tout le projet utilise l'espace de noms global « DT » (pas de modules ES, pour fonctionner en file://).
 */
(function () {
  "use strict";
  const DT = (window.DT = window.DT || {});
  DT.Data = DT.Data || {};

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  /** Ajoute des enfants (nœuds, textes ou tableaux imbriqués) en ignorant null/false/undefined. */
  function append(parent, children) {
    for (const child of children.flat(Infinity)) {
      if (child === null || child === undefined || child === false) continue;
      parent.append(child.nodeType ? child : document.createTextNode(String(child)));
    }
    return parent;
  }

  /**
   * Crée un élément DOM. Les textes passent par textContent (aucune injection HTML).
   * L'attribut « html » est réservé aux SVG statiques écrits dans le projet.
   */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (value === null || value === undefined || value === false) continue;
        if (key === "class") el.className = value;
        else if (key === "text") el.textContent = value;
        else if (key === "html") el.innerHTML = value;
        else if (key === "style" && typeof value === "object") Object.assign(el.style, value);
        else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
        else if (value === true) el.setAttribute(key, "");
        else el.setAttribute(key, String(value));
      }
    }
    return append(el, children);
  }

  /* ----------------------------- Bus d'événements ----------------------------- */
  const listeners = {};
  const bus = {
    on(name, fn) {
      (listeners[name] = listeners[name] || new Set()).add(fn);
      return () => listeners[name].delete(fn);
    },
    emit(name, data) {
      if (!listeners[name]) return;
      for (const fn of Array.from(listeners[name])) {
        try {
          fn(data);
        } catch (error) {
          if (window.console) console.error("[bus:" + name + "]", error);
        }
      }
    }
  };

  /* --------------------------------- Formats ---------------------------------- */
  function formatSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) bytes = 0;
    if (bytes < 1024) return bytes + " o";
    const units = ["Ko", "Mo", "Go", "To"];
    let value = bytes;
    let i = -1;
    do {
      value /= 1024;
      i += 1;
    } while (value >= 1024 && i < units.length - 1);
    return (value >= 100 ? value.toFixed(0) : value.toFixed(1)).replace(".", ",") + " " + units[i];
  }

  function formatDate(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  }

  /** Heure (HH:MM:SS) et date longue (« Samedi 10 octobre 2026 ») dans le fuseau local du navigateur. */
  function clockStrings(date) {
    const d = date || new Date();
    const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    let day = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    day = day.charAt(0).toUpperCase() + day.slice(1);
    return { time: time, date: day };
  }

  const pad2 = (n) => String(n).padStart(2, "0");
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const plural = (n, one, many) => (n > 1 ? many : one);
  const normalize = (text) => String(text).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

  let uidCounter = 0;
  function uid(prefix) {
    uidCounter += 1;
    return (prefix || "id") + "_" + Date.now().toString(36) + uidCounter.toString(36) + Math.floor(Math.random() * 1296).toString(36);
  }

  function debounce(fn, delay) {
    let timer = null;
    const wrapped = (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), delay);
    };
    wrapped.flush = (...args) => {
      window.clearTimeout(timer);
      fn(...args);
    };
    return wrapped;
  }

  /** Distance de Levenshtein (suggestions de commandes dans le terminal). */
  function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    const d = Array.from({ length: m + 1 }, (_, i) => [i].concat(new Array(n).fill(0)));
    for (let j = 0; j <= n; j += 1) d[0][j] = j;
    for (let i = 1; i <= m; i += 1) {
      for (let j = 1; j <= n; j += 1) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return d[m][n];
  }

  const isCoarsePointer = () => typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const prefersReducedMotion = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Ajoute un appui long (écran tactile) qui déclenche l'équivalent d'un clic droit. */
  function onLongPress(element, callback) {
    let timer = null;
    let startX = 0;
    let startY = 0;
    const cancel = () => {
      window.clearTimeout(timer);
      timer = null;
    };
    element.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch") return;
      startX = event.clientX;
      startY = event.clientY;
      cancel();
      timer = window.setTimeout(() => {
        timer = null;
        callback({ clientX: startX, clientY: startY, target: event.target, longPress: true });
      }, 550);
    });
    element.addEventListener("pointermove", (event) => {
      if (timer && Math.hypot(event.clientX - startX, event.clientY - startY) > 10) cancel();
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((name) => element.addEventListener(name, cancel));
  }

  DT.u = {
    $: $, $$: $$, h: h, append: append, uid: uid, clamp: clamp, pad2: pad2, plural: plural,
    formatSize: formatSize, formatDate: formatDate, clockStrings: clockStrings,
    normalize: normalize, capitalize: capitalize, debounce: debounce, levenshtein: levenshtein,
    isCoarsePointer: isCoarsePointer, prefersReducedMotion: prefersReducedMotion, onLongPress: onLongPress
  };
  DT.bus = bus;
}());
