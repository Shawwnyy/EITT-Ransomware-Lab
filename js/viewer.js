/*
 * EITT OS — Visionneuse (images, audio, vidéo de démonstration) et illustrations générées.
 * Aucune image, aucun son et aucune vidéo n'est téléchargé : les illustrations sont dessinées en SVG par le programme,
 * la vidéo est l'animation du logo EITT fournie avec le projet (assets/logo/).
 */
(function () {
  "use strict";
  const DT = window.DT;
  const FS = DT.FS;
  const { h, formatSize, formatDate, pad2 } = DT.u;

  /* ============================================================ Illustrations générées */
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a += 0x6d2b79f5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const wrap = (inner, id) =>
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustration de démonstration" data-art="' + id + '">' + inner + "</svg>";

  const ART = {
    mountain() {
      return wrap(
        '<defs><linearGradient id="m-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b3a6b"/><stop offset=".6" stop-color="#7fb4e6"/><stop offset="1" stop-color="#f6dca8"/></linearGradient>' +
          '<linearGradient id="m-lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb4e6"/><stop offset="1" stop-color="#1c3d63"/></linearGradient></defs>' +
          '<rect width="800" height="500" fill="url(#m-sky)"/><circle cx="610" cy="140" r="46" fill="#fff6d8" opacity=".95"/>' +
          '<path d="M0 330 L120 210 L210 290 L330 120 L470 300 L560 220 L690 320 L800 250 L800 500 L0 500Z" fill="#41608f"/>' +
          '<path d="M330 120 L290 175 L322 165 L340 190 L365 160 L395 178Z" fill="#f4f8ff"/><path d="M120 210 L96 238 L118 232 L138 246Z" fill="#f4f8ff"/>' +
          '<path d="M0 380 L150 300 L270 360 L420 280 L560 370 L700 310 L800 360 L800 500 L0 500Z" fill="#27406a"/>' +
          '<path d="M0 430 L200 380 L400 430 L620 390 L800 430 L800 500 L0 500Z" fill="#162a4a"/>' +
          '<rect y="430" width="800" height="70" fill="url(#m-lake)" opacity=".85"/><ellipse cx="400" cy="458" rx="150" ry="6" fill="#fff" opacity=".18"/>',
        "mountain"
      );
    },
    circuit() {
      const random = rng(11);
      let traces = "";
      const lines = ["M0 90 H180 L230 140 H330", "M0 210 H120 L170 260 H300", "M0 380 H150 L210 320 H320", "M800 90 H620 L570 140 H470", "M800 250 H680 L630 200 H500", "M800 410 H640 L590 360 H480", "M400 0 V90 L430 120 V170", "M360 500 V420 L330 390 V340"];
      lines.forEach((d) => {
        traces += '<path d="' + d + '" fill="none" stroke="#16ddf3" stroke-opacity=".6" stroke-width="3"/>';
      });
      let dots = "";
      for (let i = 0; i < 18; i += 1) dots += '<circle cx="' + Math.round(random() * 780 + 10) + '" cy="' + Math.round(random() * 480 + 10) + '" r="' + (2 + random() * 3).toFixed(1) + '" fill="#16ddf3" opacity="' + (0.3 + random() * 0.6).toFixed(2) + '"/>';
      let pins = "";
      for (let i = 0; i < 9; i += 1) {
        pins += '<rect x="' + (330 + i * 17) + '" y="170" width="7" height="14" fill="#9be7ff"/><rect x="' + (330 + i * 17) + '" y="316" width="7" height="14" fill="#9be7ff"/>';
        pins += '<rect x="316" y="' + (184 + i * 14) + '" width="14" height="7" fill="#9be7ff"/><rect x="470" y="' + (184 + i * 14) + '" width="14" height="7" fill="#9be7ff"/>';
      }
      return wrap(
        '<defs><linearGradient id="c-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#06101f"/><stop offset="1" stop-color="#0b2a4a"/></linearGradient>' +
          '<radialGradient id="c-glow"><stop offset="0" stop-color="#16ddf3" stop-opacity=".45"/><stop offset="1" stop-color="#16ddf3" stop-opacity="0"/></radialGradient></defs>' +
          '<rect width="800" height="500" fill="url(#c-bg)"/><circle cx="400" cy="250" r="260" fill="url(#c-glow)"/>' + traces + dots +
          pins + '<rect x="330" y="184" width="140" height="132" rx="12" fill="#0e1b2e" stroke="#16ddf3" stroke-width="3"/>' +
          '<text x="400" y="244" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="30" font-weight="700" fill="#16ddf3">EITT</text>' +
          '<text x="400" y="272" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="13" fill="#9be7ff" letter-spacing="3">PUCE FICTIVE</text>',
        "circuit"
      );
    },
    planet() {
      const random = rng(5);
      let stars = "";
      for (let i = 0; i < 90; i += 1) stars += '<circle cx="' + (random() * 800).toFixed(0) + '" cy="' + (random() * 500).toFixed(0) + '" r="' + (0.5 + random() * 1.2).toFixed(2) + '" fill="#fff" opacity="' + (0.3 + random() * 0.7).toFixed(2) + '"/>';
      return wrap(
        '<defs><radialGradient id="p-bg" cx=".5" cy=".5" r=".8"><stop offset="0" stop-color="#14224a"/><stop offset="1" stop-color="#03050e"/></radialGradient>' +
          '<radialGradient id="p-body" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#ffd59a"/><stop offset=".55" stop-color="#e2744b"/><stop offset="1" stop-color="#5b1f3d"/></radialGradient></defs>' +
          '<rect width="800" height="500" fill="url(#p-bg)"/>' + stars +
          '<g transform="translate(430 255)"><ellipse rx="250" ry="50" transform="rotate(-16)" fill="none" stroke="#f8d9a8" stroke-opacity=".45" stroke-width="12"/>' +
          '<circle r="130" fill="url(#p-body)"/><path d="M-130 -10 Q-40 -50 40 -10 T130 -10" fill="none" stroke="#f6c58a" stroke-opacity=".35" stroke-width="10"/>' +
          '<path d="M-120 45 Q-30 10 55 50 T126 40" fill="none" stroke="#7a2c47" stroke-opacity=".4" stroke-width="12"/>' +
          '<path d="M-250 36 Q0 120 250 -66" fill="none" stroke="#f8d9a8" stroke-opacity=".7" stroke-width="12" transform="rotate(-16) translate(0 -2)" clip-path="inset(50% 0 0 0)"/></g>' +
          '<circle cx="170" cy="120" r="30" fill="#c9d3e6"/><circle cx="160" cy="112" r="6" fill="#aab6cf"/><circle cx="182" cy="130" r="4" fill="#aab6cf"/>',
        "planet"
      );
    }
  };

  DT.Art = {
    has: (id) => Boolean(ART[id]),
    svg: (id) => (ART[id] ? ART[id]() : null),
    /** Vignette (élément DOM) pour l'Explorateur, ou null si le fichier n'a pas d'illustration. */
    thumb(node) {
      if (!node || !ART[node.art]) return null;
      return h("span", { class: "fx-thumb", html: ART[node.art]() });
    }
  };

  /* ============================================================ Application Visionneuse */
  function createViewer(ctx) {
    ctx.body.classList.add("vw-app");
    let fileId = ctx.params && ctx.params.fileId;
    let audioTimer = null;

    const stage = h("div", { class: "vw-stage" });
    const info = h("div", { class: "vw-info" });
    ctx.body.append(stage, info);

    function stopAudio() {
      window.clearInterval(audioTimer);
      audioTimer = null;
    }

    function renderInfo(node) {
      info.replaceChildren(
        h("strong", { text: node.name }),
        h("span", { class: "muted", text: FS.typeLabel(node) + " • " + formatSize(node.size || 0) + " • " + formatDate(node.modified) }),
        h("span", { class: "muted", text: "Contenu de démonstration de la simulation EITT (aucun vrai fichier)." }));
    }

    function renderImage(node) {
      let zoom = 1;
      const frame = h("div", { class: "vw-frame", html: DT.Art.svg(node.art) || "" });
      const label = h("span", { class: "vw-zoom-label", text: "100 %" });
      const apply = () => {
        frame.style.transform = "scale(" + zoom + ")";
        label.textContent = Math.round(zoom * 100) + " %";
      };
      const bar = h("div", { class: "vw-bar" },
        h("button", { type: "button", class: "fx-cmd", "aria-label": "Zoom arrière", title: "Zoom arrière", onClick: () => { zoom = Math.max(0.4, zoom - 0.2); apply(); } }, DT.Icons.el("minus", 16)),
        label,
        h("button", { type: "button", class: "fx-cmd", "aria-label": "Zoom avant", title: "Zoom avant", onClick: () => { zoom = Math.min(2.6, zoom + 0.2); apply(); } }, DT.Icons.el("plus", 16)),
        h("button", { type: "button", class: "fx-cmd", "aria-label": "Taille réelle", title: "Taille réelle", onClick: () => { zoom = 1; apply(); } }, DT.Icons.el("refresh", 16), h("span", { class: "fx-cmd-label", text: "Réinitialiser" })));
      stage.replaceChildren(bar, h("div", { class: "vw-canvas" }, frame));
    }

    function renderVideo(node) {
      const video = h("video", { class: "vw-video", controls: true, preload: "metadata", playsinline: true, loop: true, muted: true, poster: "assets/logo/eitt-logo-sur-noir.png", "aria-label": "Vidéo : " + node.name });
      video.muted = true;
      video.append(h("source", { src: "assets/logo/eitt-logo-animation.mp4", type: "video/mp4" }));
      const fallback = h("p", { class: "muted vw-fallback", hidden: true, text: "La vidéo de démonstration n'a pas pu être chargée par ce navigateur. Les fichiers du dossier assets/logo doivent rester à côté de index.html." });
      video.addEventListener("error", () => {
        fallback.hidden = false;
      }, true);
      stage.replaceChildren(h("div", { class: "vw-canvas vw-video-wrap" }, video), fallback, h("p", { class: "muted vw-note", text: "Vidéo de démonstration : animation du logo EITT fournie avec le projet." }));
      ctx.onClose(() => video.pause());
    }

    function renderAudio(node) {
      const duration = 187;
      let position = 0;
      let playing = false;
      const play = h("button", { type: "button", class: "btn btn-primary vw-play", "aria-label": "Lecture" }, DT.Icons.el("play", 18), "Lecture");
      const time = h("span", { class: "vw-time", text: "0:00 / 3:07" });
      const progress = h("div", { class: "bar", role: "progressbar", "aria-label": "Progression de la lecture simulée", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": "0" }, h("div", { class: "bar-fill", style: { width: "0%" } }));
      const fmt = (s) => Math.floor(s / 60) + ":" + pad2(Math.floor(s % 60));
      const tick = () => {
        position += 1;
        if (position >= duration) {
          position = 0;
          toggle(false);
        }
        paint();
      };
      const paint = () => {
        time.textContent = fmt(position) + " / " + fmt(duration);
        progress.firstChild.style.width = (position / duration) * 100 + "%";
        progress.setAttribute("aria-valuenow", String(Math.round((position / duration) * 100)));
      };
      const toggle = (on) => {
        playing = on;
        stopAudio();
        if (on) audioTimer = window.setInterval(tick, 1000);
        play.replaceChildren(DT.Icons.el(on ? "pause" : "play", 18), on ? "Pause" : "Lecture");
        play.setAttribute("aria-label", on ? "Pause" : "Lecture");
      };
      play.addEventListener("click", () => toggle(!playing));
      let bars = "";
      const random = rng(hash(node.name));
      for (let i = 0; i < 42; i += 1) bars += '<rect x="' + (i * 14 + 6) + '" y="' + (50 - (8 + random() * 38)) + '" width="8" height="' + (16 + random() * 76) + '" rx="4"/>';
      const wave = h("div", { class: "vw-wave", html: '<svg viewBox="0 0 600 100" preserveAspectRatio="none" aria-hidden="true">' + bars + "</svg>" });
      stage.replaceChildren(h("div", { class: "vw-audio" },
        h("div", { class: "vw-cover" }, DT.Icons.file("audio", 72)),
        h("h2", { text: node.name }),
        wave, progress, time,
        h("div", { class: "vw-controls" }, play),
        h("p", { class: "muted vw-note", text: "Lecteur de démonstration : la progression est simulée et aucun son n'est produit." })));
    }

    function hash(text) {
      let n = 2166136261;
      for (let i = 0; i < text.length; i += 1) {
        n ^= text.charCodeAt(i);
        n = Math.imul(n, 16777619);
      }
      return n >>> 0;
    }

    function renderOther(node) {
      stage.replaceChildren(h("div", { class: "vw-other" }, DT.Icons.file("other", 72), h("h2", { text: node.name }), h("p", { class: "muted", text: "Aucun aperçu n'est disponible pour ce type de fichier dans la simulation." }),
        h("button", { type: "button", class: "btn", onClick: () => DT.UI.properties(node) }, DT.Icons.el("info", 16), "Voir les propriétés")));
    }

    function render() {
      stopAudio();
      const node = fileId ? FS.get(fileId) : null;
      if (!node || node.type !== "file") {
        ctx.setTitle("Visionneuse");
        stage.replaceChildren(h("div", { class: "vw-other" }, DT.Icons.el("image", 48), h("h2", { text: "Aucun fichier ouvert" }), h("p", { class: "muted", text: "Ouvrez une image, un son ou une vidéo depuis l'Explorateur." })));
        info.replaceChildren();
        return;
      }
      ctx.setTitle(node.name + " — Visionneuse");
      const kind = FS.kindOf(node);
      if (kind === "image" && DT.Art.has(node.art)) renderImage(node);
      else if (kind === "video") renderVideo(node);
      else if (kind === "audio") renderAudio(node);
      else renderOther(node);
      renderInfo(node);
    }

    const offFs = DT.bus.on("fs:change", (event) => {
      if (fileId && event.ids.includes(fileId) && (event.type === "rename" || event.type === "delete" || event.type === "delete-silent" || event.type === "empty-trash")) render();
    });
    ctx.onClose(() => {
      stopAudio();
      offFs();
    });
    ctx.onParams((params) => {
      if (params && params.fileId) {
        fileId = params.fileId;
        render();
      }
    });
    render();
  }

  DT.WM.registerApp({
    id: "viewer",
    title: "Visionneuse",
    tile: "viewer",
    size: { w: 680, h: 520 },
    minSize: { w: 340, h: 300 },
    singleton: false,
    create: createViewer
  });
}());
