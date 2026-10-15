/*
 * EITT OS — Navigateur FICTIF.
 *
 * Sécurité : le navigateur n'ouvre QUE les sites de la liste blanche (data/websites.js, hôtes en « .local »).
 * Il n'envoie jamais l'utilisateur vers un vrai site Internet, n'exécute aucun code provenant d'une adresse
 * (javascript:, data:… sont refusés), n'utilise ni iframe ni fetch. Une adresse inconnue affiche une page
 * pédagogique « Site introuvable dans l'environnement virtuel ».
 */
(function () {
  "use strict";
  const DT = window.DT;
  const { h, $ } = DT.u;

  const MAX_TABS = 8;
  const HOME = "about:home";

  /** Analyse une adresse saisie ou cliquée. Ne fait AUCUNE requête : retourne seulement une description. */
  function parse(input) {
    const raw = String(input === null || input === undefined ? "" : input).trim().slice(0, 300);
    if (!raw || raw.toLowerCase() === HOME || raw.toLowerCase() === "accueil") return { kind: "home", url: HOME, input: raw };
    if (/^(javascript|data|file|vbscript|blob|ftp|chrome|view-source):/i.test(raw)) return { kind: "blocked", url: raw, input: raw, reason: "Ce type d'adresse (" + raw.split(":")[0].toLowerCase() + ":) n'est pas autorisé dans le navigateur simulé." };
    let rest = raw;
    const m = raw.match(/^([a-z][a-z0-9+.-]*):\/\/(.*)$/i);
    if (m) {
      const scheme = m[1].toLowerCase();
      if (scheme !== "http" && scheme !== "https") return { kind: "blocked", url: raw, input: raw, reason: "Le protocole « " + scheme + " » n'est pas géré par le navigateur simulé." };
      rest = m[2];
    }
    if (/\s/.test(rest.split(/[/?#]/)[0])) return { kind: "unknown", url: raw, input: raw, host: raw };
    let host = rest.split(/[/?#]/)[0].toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
    let tail = rest.slice(rest.split(/[/?#]/)[0].length).split("#")[0];
    let path = tail.split("?")[0] || "/";
    const query = tail.includes("?") ? tail.split("?")[1] : "";
    try {
      path = decodeURIComponent(path);
    } catch (error) {
      path = "/";
    }
    if (path.length > 1) path = path.replace(/\/+$/, "") || "/";
    const info = DT.Sites.hostInfo(host);
    if (!info) return { kind: "unknown", url: raw, input: raw, host: host };
    return { kind: "site", info: info, host: host, path: path, query: query, url: "http://" + host + path + (query ? "?" + query : ""), input: raw };
  }

  function createBrowser(ctx) {
    ctx.body.classList.add("br-app");
    const winId = ctx.win.id;
    const tabs = [];
    let active = null;

    /* ------------------------------ Squelette ------------------------------ */
    const tabStrip = h("div", { class: "br-tabs", role: "tablist", "aria-label": "Onglets" });
    const btnBack = h("button", { type: "button", class: "fx-nav", "data-nav": "back", "aria-label": "Page précédente", title: "Précédent (Alt+Gauche)", onClick: () => goBack() }, DT.Icons.el("arrow-left", 17));
    const btnFwd = h("button", { type: "button", class: "fx-nav", "data-nav": "forward", "aria-label": "Page suivante", title: "Suivant (Alt+Droite)", onClick: () => goForward() }, DT.Icons.el("arrow-right", 17));
    const btnReload = h("button", { type: "button", class: "fx-nav", "data-nav": "reload", "aria-label": "Actualiser la page", title: "Actualiser (F5)", onClick: () => reload() }, DT.Icons.el("refresh", 16));
    const btnHome = h("button", { type: "button", class: "fx-nav", "data-nav": "home", "aria-label": "Page d'accueil", title: "Page d'accueil", onClick: () => navigate(HOME) }, DT.Icons.el("home", 17));
    const scope = h("span", { class: "br-scope", "data-scope": "home" });
    const address = h("input", { type: "text", class: "field br-address", "aria-label": "Barre d'adresse", autocomplete: "off", spellcheck: "false", placeholder: "Saisissez une adresse, par exemple eitt.local", list: "br-hosts-" + winId });
    const datalist = h("datalist", { id: "br-hosts-" + winId }, ...DT.Sites.hosts().map((s) => h("option", { value: s.host })));
    const form = h("form", { class: "br-form", role: "search", "aria-label": "Aller à une adresse", autocomplete: "off" }, scope, address, datalist,
      h("button", { type: "submit", class: "fx-nav", "aria-label": "Aller à cette adresse", title: "Aller", "data-nav": "go" }, DT.Icons.el("arrow-right", 17)));
    const toolbar = h("div", { class: "fx-toolbar br-toolbar" }, btnBack, btnFwd, btnReload, btnHome, form);
    const banner = h("p", { class: "br-banner", role: "note" });
    const page = h("div", { class: "br-page", tabindex: "-1" });
    ctx.body.append(tabStrip, toolbar, banner, page);

    /* ------------------------------ Onglets ------------------------------ */
    function newTab(url) {
      if (tabs.length >= MAX_TABS) {
        DT.Notify.push({ title: "Trop d'onglets", message: "La simulation limite le nombre d'onglets à " + MAX_TABS + ".", type: "warning" });
        return null;
      }
      const tab = { id: DT.u.uid("tab"), history: [parse(url || HOME).url], index: 0, title: "Nouvel onglet", view: {} };
      tabs.push(tab);
      activate(tab);
      return tab;
    }

    function activate(tab) {
      active = tab;
      renderTab(tab);
      renderTabs();
    }

    async function closeTab(tab) {
      const index = tabs.indexOf(tab);
      if (index < 0) return;
      if (tabs.length === 1) {
        ctx.close();
        return;
      }
      tabs.splice(index, 1);
      if (active === tab) activate(tabs[Math.min(index, tabs.length - 1)]);
      else renderTabs();
    }

    function renderTabs() {
      const nodes = tabs.map((tab) => {
        const selected = tab === active;
        return h("div", { class: "br-tab" + (selected ? " is-on" : ""), role: "presentation" },
          h("button", { type: "button", class: "br-tab-main", role: "tab", "aria-selected": String(selected), "data-tab": tab.id, title: tab.title, onClick: () => activate(tab) }, h("span", { class: "br-tab-title", text: tab.title })),
          h("button", { type: "button", class: "br-tab-close", "aria-label": "Fermer l'onglet « " + tab.title + " »", onClick: () => closeTab(tab) }, DT.Icons.el("x", 12)));
      });
      nodes.push(h("button", { type: "button", class: "br-newtab", id: "br-newtab-" + winId, "aria-label": "Nouvel onglet", title: "Nouvel onglet", onClick: () => newTab(HOME) }, DT.Icons.el("plus", 15)));
      tabStrip.replaceChildren(...nodes);
    }

    /* ------------------------------ Navigation ------------------------------ */
    function navigate(url) {
      const tab = active;
      if (!tab) return;
      const parsed = parse(url);
      const current = tab.history[tab.index];
      if (parsed.url !== current) {
        tab.history = tab.history.slice(0, tab.index + 1);
        tab.history.push(parsed.url);
        tab.index = tab.history.length - 1;
      }
      tab.view = {};
      renderTab(tab);
      page.scrollTop = 0;
    }

    function goBack() {
      const tab = active;
      if (!tab || tab.index <= 0) return;
      tab.index -= 1;
      tab.view = {};
      renderTab(tab);
    }

    function goForward() {
      const tab = active;
      if (!tab || tab.index >= tab.history.length - 1) return;
      tab.index += 1;
      tab.view = {};
      renderTab(tab);
    }

    function reload() {
      if (!active) return;
      active.view = {};
      renderTab(active);
    }

    /* ------------------------------ Pages internes ------------------------------ */
    function siteLinks(extraClass) {
      return h("ul", { class: "br-sites " + (extraClass || "") }, ...DT.Sites.hosts().map((s) => h("li", null,
        h("a", { href: "http://" + s.host + "/", "data-go": "1", class: "br-site-tile", style: { "--site": s.color } },
          h("span", { class: "br-site-glyph", "aria-hidden": "true", text: s.glyph }),
          h("span", { class: "br-site-text" }, h("strong", { text: s.name }), h("small", { text: s.host }), h("small", { class: "muted", text: s.tagline }))))));
    }

    function homePage(tab) {
      tab.title = "Page d'accueil";
      const input = h("input", { type: "text", class: "field br-home-input", "aria-label": "Aller à une adresse", placeholder: "Saisissez par exemple technews.local", autocomplete: "off", spellcheck: "false" });
      const homeForm = h("form", { class: "br-home-form" }, input, h("button", { type: "submit", class: "btn btn-primary" }, "Aller"));
      homeForm.addEventListener("submit", (event) => {
        event.preventDefault();
        navigate(input.value);
      });
      return h("div", { class: "br-home" },
        h("img", { src: "assets/logo/eitt-logo.png", alt: "Logo EITT", class: "br-home-logo", draggable: "false" }),
        h("h1", { text: "Navigateur EITT" }),
        h("p", { class: "muted", text: "Un navigateur de démonstration : il ne visite que cinq sites fictifs intégrés à la simulation." }),
        homeForm,
        siteLinks(),
        h("p", { class: "br-note muted", text: "Pourquoi « .local » ? Ces adresses n'existent pas sur Internet : le navigateur simulé les reconnaît lui-même, sans serveur ni DNS. Rien n'est envoyé sur Internet." }));
    }

    function notFoundPage(tab, parsed) {
      tab.title = "Site introuvable";
      const blocked = parsed.kind === "blocked";
      return h("div", { class: "br-error", role: "alert" },
        h("div", { class: "br-error-icon", "aria-hidden": "true" }, DT.Icons.el("globe", 40)),
        h("h1", { text: blocked ? "Adresse non autorisée" : "Site introuvable dans l'environnement virtuel" }),
        h("p", null, "Adresse demandée : ", h("code", { text: parsed.input || "(vide)" })),
        h("p", { text: blocked ? parsed.reason : "Le navigateur EITT ne peut ouvrir que les sites fictifs intégrés à la simulation. Il n'ira jamais chercher une vraie page sur Internet, même si vous saisissez l'adresse d'un vrai site." }),
        h("section", { class: "br-help" },
          h("h2", { text: "Pour comprendre" }),
          h("ul", null,
            h("li", { text: "Dans un vrai navigateur, le nom d'un site est traduit en adresse numérique par un service appelé DNS. Ici, aucun DNS n'est utilisé." }),
            h("li", { text: "Vérifiez l'orthographe : par exemple « technews.local » et non « technews.com »." }),
            h("li", { text: "Une adresse inconnue ne provoque aucun danger : la simulation affiche simplement cette page." }))),
        h("h2", { text: "Sites disponibles" }),
        siteLinks("br-sites-compact"),
        h("button", { type: "button", class: "btn btn-primary", onClick: () => navigate(HOME) }, DT.Icons.el("home", 16), "Retour à la page d'accueil"));
    }

    function siteErrorPage(tab) {
      tab.title = "Erreur d'affichage";
      return h("div", { class: "br-error" }, h("h1", { text: "Cette page fictive a rencontré une erreur" }), h("p", { text: "Le reste de la simulation n'est pas affecté. Essayez d'actualiser ou de revenir à l'accueil." }), h("button", { type: "button", class: "btn", onClick: () => navigate(HOME) }, "Accueil"));
    }

    /* ------------------------------ Rendu ------------------------------ */
    function renderTab(tab) {
      const url = tab.history[tab.index];
      const parsed = parse(url);
      let node;
      if (parsed.kind === "home") node = homePage(tab);
      else if (parsed.kind === "site") {
        const site = DT.Sites.registry[parsed.info.id];
        const api = {
          url: parsed.url,
          host: parsed.host,
          path: parsed.path,
          query: new URLSearchParams(parsed.query),
          view: tab.view,
          root: page,
          go: (target) => navigate(target),
          rerender: () => renderTab(tab),
          setTitle: (title) => {
            tab.title = title;
          }
        };
        try {
          node = site.render(parsed.path, api);
        } catch (error) {
          if (window.console) console.error("[EITT navigateur]", error);
          node = siteErrorPage(tab);
        }
      } else node = notFoundPage(tab, parsed);

      page.replaceChildren(node);
      address.value = parsed.kind === "home" ? "" : parsed.url;
      scope.dataset.scope = parsed.kind;
      scope.textContent = parsed.kind === "site" ? "Site fictif" : parsed.kind === "home" ? "Accueil" : "Introuvable";
      banner.hidden = false;
      banner.textContent = parsed.kind === "site"
        ? "Démonstration — « " + parsed.info.name + " » est un site fictif intégré à la simulation. Rien n'est envoyé sur Internet."
        : parsed.kind === "home"
          ? "Navigateur de démonstration — seuls les sites fictifs intégrés sont accessibles."
          : "Cette adresse n'existe pas dans l'environnement virtuel.";
      banner.dataset.kind = parsed.kind;
      btnBack.disabled = tab.index <= 0;
      btnFwd.disabled = tab.index >= tab.history.length - 1;
      ctx.setTitle(tab.title + " — Navigateur");
      renderTabs();
    }

    page.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (!link || !page.contains(link)) return;
      event.preventDefault();
      navigate(link.getAttribute("href") || "");
    });
    page.addEventListener("auxclick", (event) => {
      if (event.target.closest("a")) event.preventDefault();
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      navigate(address.value);
      page.focus({ preventScroll: true });
    });
    address.addEventListener("focus", () => address.select());

    ctx.body.addEventListener("keydown", (event) => {
      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        goBack();
      } else if (event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        goForward();
      } else if (event.key === "F5" || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "r")) {
        event.preventDefault();
        reload();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
        event.preventDefault();
        address.focus();
      }
    });

    const offNet = DT.bus.on("net:change", (state) => {
      if (!state.online) DT.Notify.push({ title: "Vous êtes hors ligne", message: "Le navigateur indique l'absence de connexion. Les sites fictifs restent consultables car ils sont intégrés à la simulation.", type: "warning", silent: true });
    });
    ctx.onClose(() => offNet());
    ctx.onParams((params) => {
      if (params && params.url) navigate(params.url);
    });

    newTab((ctx.params && ctx.params.url) || HOME);
    void $;
  }

  DT.WM.registerApp({
    id: "browser",
    title: "Navigateur",
    tile: "browser",
    size: { w: 940, h: 600 },
    minSize: { w: 380, h: 320 },
    singleton: false,
    keywords: ["internet", "web", "site", "navigateur", "eitt.local", "technews", "shoptech", "learnit", "cloudbox"],
    create: createBrowser
  });

  DT.Browser = { parse: parse };
}());
