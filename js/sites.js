/*
 * EITT OS — pages des cinq sites FICTIFS du navigateur simulé (voir data/websites.js).
 * Chaque site a son design (css/applications.css, classes .site-*) et quelques interactions réellement fonctionnelles
 * (panier, « j'aime », progression, téléchargement fictif…). L'état est enregistré dans DT.Store.state.sites.
 * Aucun appel réseau, aucun formulaire envoyé : tout reste dans le navigateur.
 */
(function () {
  "use strict";
  const DT = window.DT;
  const { h, formatSize, plural } = DT.u;
  const data = DT.Data.websites;

  const registry = {};
  const euro = (n) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  const siteInfo = (id) => data.hosts.find((s) => s.id === id);
  const href = (id, path) => "http://" + siteInfo(id).host + (path || "/");
  const link = (url, cls, ...children) => h("a", { href: url, class: cls || null, "data-go": "1" }, ...children);

  function state(id) {
    const all = DT.Store.state.sites;
    all[id] = all[id] || {};
    return all[id];
  }
  const save = () => DT.Store.touch();

  function frame(id, api, nav, body, options) {
    const info = siteInfo(id);
    const opts = options || {};
    return h("div", { class: "site site-" + id, style: { "--site": info.color } },
      h("header", { class: "site-head" },
        link(href(id, "/"), "site-brand", h("span", { class: "site-logo", "aria-hidden": "true", text: info.glyph }), h("span", { class: "site-brand-text" }, h("strong", { text: info.name }), h("small", { text: info.tagline }))),
        h("nav", { class: "site-nav", "aria-label": "Navigation de " + info.name }, ...nav.map((item) => link(href(id, item.path), "site-nav-link" + (api.path === item.path || (item.match && api.path.startsWith(item.match)) ? " is-on" : ""), item.label, item.badge ? h("span", { class: "cart-count", text: String(item.badge()) }) : null)))),
      opts.hero || null,
      h("main", { class: "site-main", id: "site-main" }, body),
      h("footer", { class: "site-foot" }, h("span", null, "Site fictif de démonstration — « " + info.name + " » n'existe pas sur Internet. Contenus inventés, aucune donnée envoyée."), link("http://eitt.local/", "site-foot-link", "Retour à EITT Portal")));
  }

  function notFound(id, api) {
    const info = siteInfo(id);
    api.setTitle("Page introuvable — " + info.name);
    return frame(id, api, [], h("section", { class: "site-card site-center" },
      h("h1", { text: "Page introuvable sur " + info.host }),
      h("p", { text: "Cette page n'existe pas dans ce site fictif." }),
      link(href(id, "/"), "site-btn", "Revenir à l'accueil de " + info.name)));
  }

  function button(label, onClick, cls, attrs) {
    return h("button", Object.assign({ type: "button", class: "site-btn" + (cls ? " " + cls : ""), onClick: onClick }, attrs || {}), label);
  }

  /* ============================================================ EITT Portal */
  registry.eitt = {
    render(path, api) {
      const nav = [{ path: "/", label: "Accueil" }, { path: "/parcours", label: "Parcours" }, { path: "/ressources", label: "Ressources" }, { path: "/contact", label: "Contact" }];
      if (path === "/") {
        api.setTitle("EITT Portal — Accueil");
        const hero = h("section", { class: "eitt-hero" },
          h("img", { src: "assets/logo/eitt-logo.png", alt: "Logo EITT", class: "eitt-hero-logo", draggable: "false" }),
          h("h1", { text: "L'informatique pour toutes et tous" }),
          h("p", { class: "lead", text: "EITT — Enseignement Informatique pour Toutes et Tous — vous aide à comprendre votre ordinateur, pas à pas, sans jargon." }),
          h("div", { class: "site-actions" }, link(href("eitt", "/parcours"), "site-btn", "Découvrir les parcours"), link(href("learnit", "/"), "site-btn site-btn-ghost", "Ouvrir LearnIT")));
        const cards = h("section", { class: "site-grid" },
          ...[["Comprendre", "Des explications claires sur le matériel, les fichiers et Internet."], ["Pratiquer", "Un ordinateur virtuel pour essayer sans risque : rien n'est abîmé."], ["Progresser", "Des parcours courts pour avancer à votre rythme."]].map(([t, p]) => h("article", { class: "site-card" }, h("h2", { text: t }), h("p", { text: p }))));
        const how = h("section", { class: "site-card" }, h("h2", { text: "Où êtes-vous ?" }), h("p", { text: "Vous utilisez EITT OS : une simulation pédagogique d'ordinateur qui s'exécute dans votre navigateur. Ce portail, comme TechNews, ShopTech, LearnIT et CloudBox, est un site fictif intégré à la simulation." }), h("p", { class: "muted", text: "Essayez de taper une autre adresse (par exemple technews.local) dans la barre d'adresse." }));
        return frame("eitt", api, nav, [cards, how], { hero: hero });
      }
      if (path === "/parcours") {
        api.setTitle("EITT Portal — Parcours");
        return frame("eitt", api, nav, h("section", null, h("h1", { text: "Nos parcours" }),
          h("div", { class: "site-grid" }, ...data.parcours.map((p) => h("article", { class: "site-card" }, h("span", { class: "site-chip", text: p.level }), h("h2", { text: p.title }), h("p", { text: p.text }), link(href("learnit", "/cours/" + p.course), "site-btn", "Commencer sur LearnIT"))))));
      }
      if (path === "/ressources") {
        api.setTitle("EITT Portal — Ressources");
        return frame("eitt", api, nav, h("section", null, h("h1", { text: "Sites de démonstration" }), h("p", { text: "Voici les autres sites fictifs disponibles dans la simulation." }),
          h("div", { class: "site-grid" }, ...data.hosts.filter((s) => s.id !== "eitt").map((s) => h("article", { class: "site-card", style: { borderTopColor: s.color } }, h("h2", { text: s.name }), h("p", { text: s.tagline }), link("http://" + s.host + "/", "site-btn", "Visiter " + s.host))))));
      }
      if (path === "/contact") {
        api.setTitle("EITT Portal — Contact");
        const name = h("input", { type: "text", id: "ct-name", class: "site-field", maxlength: "40", autocomplete: "off", placeholder: "Un pseudo (pas de vrai nom nécessaire)" });
        const message = h("textarea", { id: "ct-msg", class: "site-field", rows: "4", maxlength: "500", placeholder: "Votre message de démonstration" });
        const error = h("p", { class: "site-error", role: "alert" });
        const result = h("div", { class: "site-card site-ok", hidden: true, role: "status" });
        const form = h("form", { class: "site-card site-form", novalidate: true },
          h("h1", { text: "Nous écrire (démonstration)" }),
          h("p", { class: "muted", text: "Ce formulaire est fictif : votre message n'est envoyé nulle part et n'est pas enregistré." }),
          h("label", { for: "ct-name", text: "Pseudo" }), name,
          h("label", { for: "ct-msg", text: "Message" }), message, error,
          h("button", { type: "submit", class: "site-btn", text: "Envoyer (simulation)" }));
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          if (!name.value.trim()) {
            error.textContent = "Indiquez un pseudo (il peut être inventé).";
            name.focus();
            return;
          }
          if (message.value.trim().length < 10) {
            error.textContent = "Votre message est un peu court (10 caractères minimum).";
            message.focus();
            return;
          }
          error.textContent = "";
          result.hidden = false;
          result.replaceChildren(h("strong", { text: "Merci " + name.value.trim() + " !" }), h("p", { text: "Message simulé : rien n'a été envoyé. Dans un vrai site, il aurait été transmis à un serveur." }));
          form.hidden = true;
        });
        return frame("eitt", api, nav, [form, result]);
      }
      return notFound("eitt", api);
    }
  };

  /* ============================================================ TechNews */
  registry.technews = {
    render(path, api) {
      const s = state("technews");
      s.likes = s.likes || {};
      const nav = [{ path: "/", label: "À la une", match: "/article" }];
      const likeCount = (a) => (a.id.length * 7 + a.title.length) % 40 + (s.likes[a.id] ? 1 : 0);

      if (path === "/") {
        api.setTitle("TechNews — À la une");
        api.view.cat = api.view.cat || "Tout";
        api.view.q = api.view.q || "";
        const list = h("div", { class: "news-list" });
        const chips = h("div", { class: "news-chips", role: "group", "aria-label": "Catégories" });
        const count = h("p", { class: "muted", role: "status" });
        const search = h("input", { type: "search", class: "site-field", placeholder: "Rechercher un article", "aria-label": "Rechercher un article", value: api.view.q });
        function drawList() {
          const q = DT.u.normalize(api.view.q);
          const found = data.articles.filter((a) => (api.view.cat === "Tout" || a.cat === api.view.cat) && (!q || DT.u.normalize(a.title + " " + a.summary).includes(q)));
          list.replaceChildren(...(found.length ? found.map((a) => h("article", { class: "news-card" },
            h("span", { class: "site-chip", text: a.cat }),
            h("h2", null, link(href("technews", "/article/" + a.id), null, a.title)),
            h("p", { text: a.summary }),
            h("small", { class: "muted", text: a.minutes + " min de lecture • ♥ " + likeCount(a) }))) : [h("p", { class: "site-card", text: "Aucun article ne correspond à votre recherche." })]));
          count.textContent = found.length + " " + plural(found.length, "article", "articles");
        }
        function drawChips() {
          chips.replaceChildren(...data.categories.map((c) => h("button", { type: "button", class: "news-chip" + (api.view.cat === c ? " is-on" : ""), "aria-pressed": String(api.view.cat === c), onClick: () => {
            api.view.cat = c;
            drawChips();
            drawList();
          } }, c)));
        }
        search.addEventListener("input", () => {
          api.view.q = search.value;
          drawList();
        });
        drawChips();
        drawList();
        const hero = h("section", { class: "news-hero" }, h("h1", { text: "TechNews" }), h("p", { text: "L'actualité tech expliquée simplement — articles fictifs écrits pour la démonstration." }));
        return frame("technews", api, nav, [search, chips, count, list], { hero: hero });
      }
      const m = path.match(/^\/article\/([a-z0-9-]+)$/);
      if (m) {
        const article = data.articles.find((a) => a.id === m[1]);
        if (!article) return notFound("technews", api);
        api.setTitle(article.title + " — TechNews");
        const like = h("button", { type: "button", class: "site-btn site-like", "aria-pressed": String(Boolean(s.likes[article.id])) });
        const paintLike = () => {
          const on = Boolean(s.likes[article.id]);
          like.setAttribute("aria-pressed", String(on));
          like.textContent = (on ? "♥ Vous aimez cet article" : "♡ J'aime") + " (" + likeCount(article) + ")";
        };
        like.addEventListener("click", () => {
          if (s.likes[article.id]) delete s.likes[article.id];
          else s.likes[article.id] = true;
          save();
          paintLike();
        });
        paintLike();
        return frame("technews", api, nav, h("article", { class: "news-article" },
          link(href("technews", "/"), "site-back", "← Retour à la une"),
          h("span", { class: "site-chip", text: article.cat }),
          h("h1", { text: article.title }),
          h("p", { class: "muted", text: new Date(article.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) + " • " + article.minutes + " min de lecture • article fictif" }),
          ...article.body.map((p) => h("p", { text: p })),
          like));
      }
      return notFound("technews", api);
    }
  };

  /* ============================================================ ShopTech */
  function cart() {
    const s = state("shoptech");
    s.cart = Array.isArray(s.cart) ? s.cart : [];
    return s.cart;
  }
  const cartCount = () => cart().reduce((n, line) => n + line.qty, 0);
  const productById = (id) => data.products.find((p) => p.id === id);
  const cartTotal = () => cart().reduce((sum, line) => sum + (productById(line.id) ? productById(line.id).price * line.qty : 0), 0);

  function addToCart(id) {
    const lines = cart();
    const line = lines.find((l) => l.id === id);
    if (line) line.qty = Math.min(20, line.qty + 1);
    else lines.push({ id: id, qty: 1 });
    save();
  }

  function refreshBadges(root) {
    root.querySelectorAll(".cart-count").forEach((el) => {
      el.textContent = String(cartCount());
    });
  }

  function productArt(p) {
    return h("div", { class: "shop-art", style: { background: "linear-gradient(135deg," + p.tone + ",#0f172a)" }, "aria-hidden": "true" }, h("span", { text: p.cat }));
  }

  registry.shoptech = {
    render(path, api) {
      const nav = [{ path: "/", label: "Catalogue", match: "/produit" }, { path: "/panier", label: "Panier", badge: cartCount, match: "/commande" }];
      const notice = h("p", { class: "shop-notice" }, "Boutique fictive : les prix sont inventés, aucun paiement n'est possible et aucune donnée bancaire n'est demandée.");

      if (path === "/") {
        api.setTitle("ShopTech — Catalogue");
        api.view.cat = api.view.cat || "Tout";
        api.view.q = api.view.q || "";
        const grid = h("div", { class: "shop-grid" });
        const live = h("p", { class: "sr-only", role: "status" });
        const count = h("p", { class: "muted", role: "status" });
        const select = h("select", { class: "site-field", "aria-label": "Catégorie" }, ...data.productCategories.map((c) => h("option", { value: c, text: c })));
        select.value = api.view.cat;
        const search = h("input", { type: "search", class: "site-field", placeholder: "Rechercher un composant", "aria-label": "Rechercher un composant", value: api.view.q });
        function draw() {
          const q = DT.u.normalize(api.view.q);
          const found = data.products.filter((p) => (api.view.cat === "Tout" || p.cat === api.view.cat) && (!q || DT.u.normalize(p.name + " " + p.cat).includes(q)));
          grid.replaceChildren(...(found.length ? found.map((p) => h("article", { class: "shop-card", "data-product": p.id },
            productArt(p),
            h("h2", null, link(href("shoptech", "/produit/" + p.id), null, p.name)),
            h("p", { class: "shop-price", text: euro(p.price) }),
            button("Ajouter au panier", () => {
              addToCart(p.id);
              refreshBadges(api.root);
              live.textContent = p.name + " ajouté au panier.";
            }, null, { "data-add": p.id, "aria-label": "Ajouter au panier : " + p.name }))) : [h("p", { class: "site-card", text: "Aucun produit ne correspond." })]));
          count.textContent = found.length + " " + plural(found.length, "produit", "produits");
        }
        select.addEventListener("change", () => {
          api.view.cat = select.value;
          draw();
        });
        search.addEventListener("input", () => {
          api.view.q = search.value;
          draw();
        });
        draw();
        return frame("shoptech", api, nav, [notice, h("div", { class: "shop-filters" }, search, select), count, live, grid]);
      }

      let m = path.match(/^\/produit\/([a-z0-9-]+)$/);
      if (m) {
        const p = productById(m[1]);
        if (!p) return notFound("shoptech", api);
        api.setTitle(p.name + " — ShopTech");
        const live = h("p", { role: "status", class: "muted" });
        return frame("shoptech", api, nav, [notice, h("article", { class: "shop-detail" },
          productArt(p),
          h("div", null,
            link(href("shoptech", "/"), "site-back", "← Retour au catalogue"),
            h("h1", { text: p.name }), h("p", { class: "shop-price", text: euro(p.price) }), h("p", { text: p.desc }),
            h("ul", { class: "shop-specs" }, ...p.specs.map((x) => h("li", { text: x }))),
            button("Ajouter au panier", () => {
              addToCart(p.id);
              refreshBadges(api.root);
              live.textContent = "Ajouté au panier.";
            }, null, { "data-add": p.id }), live))]);
      }

      if (path === "/panier") {
        api.setTitle("Panier — ShopTech");
        const lines = cart().filter((l) => productById(l.id));
        if (!lines.length) {
          return frame("shoptech", api, nav, [notice, h("section", { class: "site-card site-center" }, h("h1", { text: "Votre panier est vide" }), h("p", { text: "Ajoutez des composants depuis le catalogue." }), link(href("shoptech", "/"), "site-btn", "Voir le catalogue"))]);
        }
        const rows = lines.map((l) => {
          const p = productById(l.id);
          return h("tr", { "data-line": l.id },
            h("td", null, link(href("shoptech", "/produit/" + p.id), null, p.name)),
            h("td", { class: "num", text: euro(p.price) }),
            h("td", null, h("span", { class: "shop-qty" },
              h("button", { type: "button", class: "site-btn site-btn-small", "aria-label": "Retirer une unité : " + p.name, onClick: () => { l.qty = Math.max(1, l.qty - 1); save(); api.rerender(); } }, "−"),
              h("span", { class: "shop-qty-n", text: String(l.qty) }),
              h("button", { type: "button", class: "site-btn site-btn-small", "aria-label": "Ajouter une unité : " + p.name, onClick: () => { l.qty = Math.min(20, l.qty + 1); save(); api.rerender(); } }, "+"))),
            h("td", { class: "num", text: euro(p.price * l.qty) }),
            h("td", null, h("button", { type: "button", class: "site-btn site-btn-small site-btn-ghost", "aria-label": "Retirer du panier : " + p.name, onClick: () => { const arr = cart(); arr.splice(arr.indexOf(l), 1); save(); api.rerender(); } }, "Retirer")));
        });
        const order = () => {
          const snapshot = lines.map((l) => ({ name: productById(l.id).name, qty: l.qty, total: productById(l.id).price * l.qty }));
          state("shoptech").lastOrder = { no: "FICTIF-" + String(Math.floor(100000 + Math.random() * 899999)), total: cartTotal(), lines: snapshot, at: Date.now() };
          state("shoptech").cart = [];
          save();
          api.go(href("shoptech", "/commande"));
        };
        return frame("shoptech", api, nav, [notice, h("section", { class: "site-card" }, h("h1", { text: "Votre panier" }),
          h("table", { class: "shop-table" }, h("thead", null, h("tr", null, h("th", { scope: "col", text: "Produit" }), h("th", { scope: "col", class: "num", text: "Prix" }), h("th", { scope: "col", text: "Quantité" }), h("th", { scope: "col", class: "num", text: "Total" }), h("th", { scope: "col", text: "" }))), h("tbody", null, ...rows)),
          h("p", { class: "shop-total" }, "Total : ", h("strong", { id: "shop-total", text: euro(cartTotal()) })),
          button("Passer la commande (fictive)", order, null, { id: "shop-order" }))]);
      }

      if (path === "/commande") {
        api.setTitle("Commande — ShopTech");
        const o = state("shoptech").lastOrder;
        if (!o) return frame("shoptech", api, nav, h("section", { class: "site-card site-center" }, h("h1", { text: "Aucune commande" }), link(href("shoptech", "/"), "site-btn", "Voir le catalogue")));
        return frame("shoptech", api, nav, [notice, h("section", { class: "site-card site-ok", role: "status" },
          h("h1", { text: "Commande fictive enregistrée" }),
          h("p", null, "Numéro : ", h("strong", { text: o.no })),
          h("ul", null, ...o.lines.map((l) => h("li", { text: l.qty + " × " + l.name + " — " + euro(l.total) }))),
          h("p", { text: "Total : " + euro(o.total) }),
          h("p", { class: "muted", text: "Rien n'a été payé ni expédié : c'est une démonstration. Aucune adresse ni donnée bancaire n'a été demandée." }),
          link(href("shoptech", "/"), "site-btn", "Continuer mes achats"))]);
      }
      return notFound("shoptech", api);
    }
  };

  /* ============================================================ LearnIT */
  function courseProgress(course) {
    const done = state("learnit").done || {};
    const finished = course.lessons.filter((l) => done[l.id]).length;
    return { finished: finished, total: course.lessons.length, ratio: finished / course.lessons.length };
  }

  registry.learnit = {
    render(path, api) {
      const s = state("learnit");
      s.done = s.done || {};
      const nav = [{ path: "/", label: "Cours", match: "/cours" }, { path: "/ressources", label: "Ressources" }];
      if (path === "/") {
        api.setTitle("LearnIT — Cours");
        const hero = h("section", { class: "learn-hero" }, h("h1", { text: "LearnIT" }), h("p", { text: "Apprenez à votre rythme. Votre progression est enregistrée dans la simulation." }));
        return frame("learnit", api, nav, h("div", { class: "site-grid" }, ...data.courses.map((c) => {
          const p = courseProgress(c);
          return h("article", { class: "site-card learn-card", style: { borderTopColor: c.color } },
            h("span", { class: "site-chip", text: c.level }), h("h2", { text: c.title }), h("p", { text: c.summary }),
            h("div", { class: "bar", role: "progressbar", "aria-label": "Progression : " + c.title, "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round(p.ratio * 100)) }, h("div", { class: "bar-fill", style: { width: Math.round(p.ratio * 100) + "%" } })),
            h("small", { class: "muted", text: p.finished + " leçon" + (p.finished > 1 ? "s" : "") + " sur " + p.total + " terminée" + (p.finished > 1 ? "s" : "") }),
            link(href("learnit", "/cours/" + c.id), "site-btn", p.finished ? "Continuer" : "Commencer"));
        })), { hero: hero });
      }
      const m = path.match(/^\/cours\/([a-z0-9-]+)$/);
      if (m) {
        const course = data.courses.find((c) => c.id === m[1]);
        if (!course) return notFound("learnit", api);
        api.setTitle(course.title + " — LearnIT");
        const progress = h("div", { class: "bar", role: "progressbar", "aria-label": "Progression du cours", "aria-valuemin": "0", "aria-valuemax": "100" }, h("div", { class: "bar-fill" }));
        const label = h("p", { class: "muted", role: "status" });
        const finish = h("div", { class: "site-card site-ok", hidden: true });
        function paint() {
          const p = courseProgress(course);
          progress.firstChild.style.width = Math.round(p.ratio * 100) + "%";
          progress.setAttribute("aria-valuenow", String(Math.round(p.ratio * 100)));
          label.textContent = p.finished + " leçon" + (p.finished > 1 ? "s" : "") + " terminée" + (p.finished > 1 ? "s" : "") + " sur " + p.total;
          finish.hidden = p.finished < p.total;
          if (p.finished === p.total) {
            finish.replaceChildren(h("strong", { text: "Bravo, cours terminé !" }), h("p", { text: "Vous pouvez récupérer une attestation fictive (un petit fichier texte de démonstration)." }),
              button("Télécharger l'attestation (fictive)", () => DT.Downloads.start({ name: "attestation-" + course.id + ".txt", size: 900, content: "Attestation fictive — " + course.title + "\n\nDélivrée par LearnIT (site fictif) dans la simulation EITT OS.\nElle n'a aucune valeur officielle.\n", source: "learnit.local" }), null, { id: "learn-cert" }));
          }
        }
        const lessons = course.lessons.map((lesson, index) => {
          const id = "lesson-" + lesson.id;
          const box = h("input", { type: "checkbox", id: id, checked: s.done[lesson.id] ? true : null });
          box.addEventListener("change", () => {
            if (box.checked) s.done[lesson.id] = true;
            else delete s.done[lesson.id];
            save();
            paint();
          });
          return h("article", { class: "learn-lesson" },
            h("h2", null, h("span", { class: "learn-n", text: String(index + 1) }), lesson.title),
            h("p", { text: lesson.text }),
            h("label", { class: "learn-check", for: id }, box, " Marquer comme terminé"));
        });
        paint();
        return frame("learnit", api, nav, [link(href("learnit", "/"), "site-back", "← Tous les cours"), h("h1", { text: course.title }), progress, label, ...lessons, finish]);
      }
      if (path === "/ressources") {
        api.setTitle("LearnIT — Ressources");
        return frame("learnit", api, nav, [h("h1", { text: "Ressources à télécharger" }),
          h("p", { class: "muted", text: "Téléchargements fictifs : le fichier est créé dans le dossier virtuel Téléchargements, pas sur votre ordinateur." }),
          ...data.resources.map((r) => h("article", { class: "site-card learn-res" }, h("div", null, h("strong", { text: r.title }), h("small", { class: "muted", text: " " + r.name + " • " + formatSize(r.size) })),
            button("Télécharger (fictif)", () => DT.Downloads.start({ name: r.name, size: r.size, content: r.content, source: "learnit.local" }), null, { "data-download": r.id })))]);
      }
      return notFound("learnit", api);
    }
  };

  /* ============================================================ CloudBox */
  function cloudFiles() {
    const s = state("cloudbox");
    if (!Array.isArray(s.files)) {
      s.files = data.cloudFiles.map((f) => Object.assign({}, f));
      s.counter = 0;
      save();
    }
    return s.files;
  }

  registry.cloudbox = {
    render(path, api) {
      const s = state("cloudbox");
      const nav = [{ path: "/", label: "Mes fichiers" }, { path: "/partages", label: "Partages" }];
      if (path === "/") {
        api.setTitle("CloudBox — Mes fichiers");
        const body = h("div", { class: "cloud-body" });
        function draw() {
          const files = cloudFiles();
          const used = files.reduce((n, f) => n + f.size, 0);
          const percent = Math.min(100, (used / data.cloudCapacity) * 100);
          body.replaceChildren(
            h("div", { class: "cloud-top site-card" },
              h("div", null, h("strong", { text: "Espace utilisé (fictif)" }), h("div", { class: "bar", role: "progressbar", "aria-label": "Espace CloudBox utilisé", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round(percent)) }, h("div", { class: "bar-fill", style: { width: Math.max(1, percent) + "%" } })), h("small", { class: "muted", text: formatSize(used) + " sur " + formatSize(data.cloudCapacity) })),
              button("Téléverser un fichier d'exemple", () => {
                s.counter = (s.counter || 0) + 1;
                files.unshift({ id: "up" + Date.now() + s.counter, name: "Fichier-exemple-" + s.counter + ".txt", size: 1024 + s.counter * 311, modified: new Date().toISOString().slice(0, 10), content: "Fichier d'exemple n°" + s.counter + " téléversé dans CloudBox (fictif).\nIl n'a quitté ni votre navigateur ni la simulation.\n" });
                save();
                draw();
              }, null, { id: "cloud-upload" })),
            files.length ? h("table", { class: "cloud-table" }, h("thead", null, h("tr", null, h("th", { scope: "col", text: "Nom" }), h("th", { scope: "col", text: "Modifié" }), h("th", { scope: "col", class: "num", text: "Taille" }), h("th", { scope: "col", text: "Actions" }))),
              h("tbody", null, ...files.map((f) => h("tr", { "data-file": f.id },
                h("td", null, DT.Icons.file(DT.FS.kindOf({ type: "file", name: f.name }), 22), " ", f.name),
                h("td", { text: new Date(f.modified).toLocaleDateString("fr-FR") }),
                h("td", { class: "num", text: formatSize(f.size) }),
                h("td", null,
                  button("Télécharger", () => DT.Downloads.start({ name: f.name, size: f.size, content: f.content, source: "cloudbox.local" }), "site-btn-small", { "data-dl": f.id, "aria-label": "Télécharger : " + f.name }),
                  button("Supprimer", async () => {
                    const ok = await DT.UI.confirm({ title: "Supprimer de CloudBox ?", message: "« " + f.name + " » sera retiré de CloudBox (site fictif). Cela n'affecte pas vos fichiers virtuels.", okLabel: "Supprimer", danger: true });
                    if (!ok) return;
                    files.splice(files.indexOf(f), 1);
                    save();
                    draw();
                  }, "site-btn-small site-btn-ghost", { "aria-label": "Supprimer : " + f.name })))))) : h("p", { class: "site-card site-center", text: "Aucun fichier. Téléversez un fichier d'exemple." }));
        }
        draw();
        return frame("cloudbox", api, nav, [h("h1", { text: "Mes fichiers" }), h("p", { class: "muted", text: "Stockage en ligne fictif : « Télécharger » crée un fichier dans le dossier virtuel Téléchargements." }), body]);
      }
      if (path === "/partages") {
        api.setTitle("CloudBox — Partages");
        s.shared = s.shared || { carnet: true, budget: false };
        const items = [["carnet", "Notes-de-cours.txt", "Partagé avec : groupe « Atelier EITT » (lecture seule)"], ["budget", "Budget-familial.csv", "Partage désactivé"]];
        return frame("cloudbox", api, nav, [h("h1", { text: "Partages (démonstration)" }), h("p", { class: "muted", text: "Activer ou désactiver un partage change seulement l'affichage dans la simulation." }),
          ...items.map(([key, name, desc]) => {
            const box = h("input", { type: "checkbox", id: "share-" + key, checked: s.shared[key] ? true : null });
            const text = h("small", { class: "muted", text: s.shared[key] ? desc : "Partage désactivé" });
            box.addEventListener("change", () => {
              s.shared[key] = box.checked;
              save();
              text.textContent = box.checked ? desc : "Partage désactivé";
            });
            return h("article", { class: "site-card cloud-share" }, h("div", null, h("strong", { text: name }), h("br"), text), h("label", { class: "learn-check", for: "share-" + key }, box, " Partagé"));
          })]);
      }
      return notFound("cloudbox", api);
    }
  };

  DT.Sites = {
    registry: registry,
    hosts: () => data.hosts,
    hostInfo: (host) => data.hosts.find((s) => s.host === host) || null,
    href: href
  };
}());
