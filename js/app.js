/*
 * EITT OS — point d'entrée : charge la sauvegarde locale, branche les notifications sur les actions
 * réellement effectuées dans la simulation (fichiers, réseau, sauvegarde) et lance la séquence de démarrage.
 */
(function () {
  "use strict";
  const DT = window.DT;
  const { plural } = DT.u;

  const label = (e) => (e.names.length === 1 ? "« " + e.names[0] + " »" : e.names.length + " " + plural(e.names.length, "élément", "éléments"));
  const where = (id) => (id && DT.FS.get(id) ? DT.FS.displayPath(id) : "");

  /** Les notifications reflètent uniquement ce qui s'est réellement produit dans le système de fichiers virtuel. */
  function onFsChange(e) {
    if (DT.quiet) return;
    if (!e.names || !e.names.length) return;
    switch (e.type) {
      case "create":
        DT.Notify.push({
          title: e.nodeType === "folder" ? "Votre nouveau dossier a été créé." : "Votre nouveau fichier a été créé.",
          message: label(e) + (e.target ? " dans " + where(e.target) : ""),
          type: "success"
        });
        break;
      case "write":
        DT.Notify.push({ title: "Le fichier a été enregistré.", message: label(e), type: "success" });
        break;
      case "rename":
        DT.Notify.push({ title: "Élément renommé", message: "« " + (e.previous || "") + " » est devenu « " + e.names[0] + " ».", type: "info", silent: true });
        break;
      case "move":
        DT.Notify.push({ title: "Élément déplacé", message: label(e) + " → " + where(e.target), type: "info", silent: true });
        break;
      case "copy":
        DT.Notify.push({ title: "Élément copié", message: label(e) + " → " + where(e.target), type: "info", silent: true });
        break;
      case "trash":
        DT.Notify.push({ title: "Placé dans la corbeille", message: label(e) + " — restaurable depuis la Corbeille.", type: "info" });
        break;
      case "restore":
        DT.Notify.push({ title: "Élément restauré", message: label(e) + " a retrouvé son emplacement.", type: "success" });
        break;
      case "delete":
        DT.Notify.push({ title: "Supprimé définitivement", message: label(e), type: "warning", silent: true });
        break;
      case "empty-trash":
        DT.Notify.push({ title: "Corbeille vidée", message: label(e) + " supprimé" + (e.names.length > 1 ? "s" : "") + " définitivement.", type: "info" });
        break;
      default:
    }
  }

  function start() {
    DT.Store.load();
    DT.Settings.apply();
    DT.Session.init();
    DT.Desktop.init();
    DT.Tray.init();
    DT.Ransom.init();
    DT.Chat.init();
    DT.Downloads.init();
    DT.Monitor.start();
    DT.Clock.start();

    DT.bus.on("fs:change", onFsChange);
    DT.bus.on("net:change", (state) => {
      if (state.isolated || state.manual) return; // Wi-Fi / mode avion / isolement simulés : messages propres au laboratoire
      if (state.online) DT.Notify.push({ title: "Connexion rétablie", message: "Le navigateur indique de nouveau une connexion réseau (sans garantie d'accès à Internet).", type: "success" });
      else DT.Notify.push({ title: "Vous êtes actuellement hors ligne selon le navigateur.", message: "Les sites fictifs et vos fichiers restent disponibles.", type: "warning" });
    });
    let lastStoreError = 0;
    DT.bus.on("store:error", () => {
      if (Date.now() - lastStoreError < 30000) return;
      lastStoreError = Date.now();
      DT.Notify.push({ title: "Sauvegarde locale impossible", message: "Le stockage du navigateur est plein ou bloqué : vos modifications seront perdues à la fermeture de la page.", type: "error" });
    });
    if (DT.Store.recovered) {
      DT.Notify.push({ title: "Données locales illisibles", message: "La simulation a été remise à son état initial.", type: "warning", silent: true });
    }
    if (!DT.Store.available) {
      DT.Notify.push({ title: "Sauvegarde locale indisponible", message: "Ce navigateur bloque le stockage local : vos modifications ne seront pas conservées.", type: "warning", silent: true });
    }

    DT.Session.boot();
    document.documentElement.dataset.ready = "true";
  }

  // Empêche le menu contextuel natif du navigateur en dehors des zones de saisie (les menus du bureau sont simulés).
  document.addEventListener("contextmenu", (event) => {
    if (event.target.closest("input, textarea")) return;
    event.preventDefault();
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
}());
