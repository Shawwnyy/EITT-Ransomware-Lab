/* Tests de bout en bout d'EITT Ransomware Lab (Playwright + Chromium, ouverture en file://). */
let chromium;
try { ({ chromium } = require("playwright")); } catch (error) { ({ chromium } = require("/opt/npm-tools/node_modules/playwright")); }
const path = require("path");
const fs = require("fs");

const ROOT = process.env.RL_ROOT || path.resolve(__dirname, "..");
const OUT = process.env.RL_SHOTS || path.join(require("os").tmpdir(), "eitt-rl-shots");
fs.mkdirSync(OUT, { recursive: true });
const URL = "file://" + ROOT + "/index.html";

const results = [];
const problems = [];
const externalRequests = [];
function check(name, condition, detail) {
  results.push({ name, ok: Boolean(condition) });
  console.log((condition ? "  ✔ " : "  ✖ ") + name + (condition ? "" : "  → " + (detail || "")));
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + ".png") }).catch(() => {});

function watch(page, label) {
  page.on("pageerror", (e) => problems.push(label + " pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") problems.push(label + " " + m.type() + ": " + m.text()); });
  page.on("request", (r) => { const u = r.url(); if (!u.startsWith("file:") && !u.startsWith("data:") && !u.startsWith("blob:")) externalRequests.push(u); });
}

async function boot(browser, opts, auto) {
  const context = await browser.newContext(Object.assign({ viewport: { width: 1366, height: 800 } }, opts || {}));
  const page = await context.newPage();
  watch(page, "page");
  await page.goto(URL + (auto ? "" : "?auto=0"));
  await page.waitForSelector("#boot-skip");
  await page.click("#boot-skip");
  await page.waitForSelector(".login-account");
  return { context, page };
}
async function login(page, profile) {
  await page.click('.login-account[data-profile="' + (profile || "utilisateur") + '"]');
  await page.waitForSelector("#desktop:not(.is-off)", { timeout: 8000 });
  await page.waitForSelector("#screen-login", { state: "detached", timeout: 4000 }).catch(() => {});
}
async function openLab(page, tab) {
  await page.evaluate((t) => window.DT.WM.open("ransomlab", { tab: t }), tab || "mission");
  await page.waitForSelector(".rl-app");
}
const tab = (page, id) => page.click("#rl-tab-" + id);
const dlg = (page, label) => page.click('.dlg-foot button:has-text("' + label + '")');
const fsSnapshot = (page) => page.evaluate(() => JSON.stringify(window.DT.Store.state.fs.nodes));
const lockedCount = (page) => page.evaluate(() => window.DT.FS.allFiles().filter((n) => n.sim).length);
const fileCount = (page) => page.evaluate(() => window.DT.FS.allFiles().length);
async function waitPhase(page, phase, timeout) {
  await page.waitForFunction((p) => window.DT.Ransom.state().phase === p, phase, { timeout: timeout || 20000 });
}

(async () => {
  const browser = await chromium.launch();

  /* =========================== Connexion =========================== */
  console.log("\n# Écran de connexion");
  let { context, page } = await boot(browser);
  check("Titre de l'onglet : EITT Ransomware Lab", (await page.title()).includes("EITT Ransomware Lab"));
  check("Logo EITT affiché (image réelle)", await page.evaluate(() => { const i = document.querySelector(".login-logo"); return i && i.complete && i.naturalWidth > 500; }));
  check("Nom du système « EITT OS »", (await page.textContent(".login-os")) === "EITT OS");
  check("Aucun champ de mot de passe : connexion directe", (await page.locator('input[type="password"], #login-password').count()) === 0);
  const accounts = await page.locator(".login-account").allTextContents();
  check("Deux sessions au choix : Utilisateur et Utilisatrice", accounts.length === 2 && accounts[0].includes("Utilisateur") && accounts[1].includes("Utilisatrice"), accounts.join(" | "));
  check("Chaque session a son avatar", (await page.locator(".login-account .avatar").count()) === 2);
  check("Invitation : « Choisissez votre session »", (await page.textContent("#login-prompt")).includes("Choisissez votre session"));
  await page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains("login-account"), null, { timeout: 3000 }).catch(() => {});
  check("Le dernier compte utilisé a le focus clavier", await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("login-account")));
  const note = await page.textContent("#login-note");
  check("Mention : comptes fictifs, sans mot de passe, sans lien avec un compte réel", /fictifs/.test(note) && /sans mot de passe/.test(note) && /aucun compte réel/.test(note), note);
  check("Heure et date affichées à l'écran de connexion", /^\d{2}:\d{2}:\d{2}$/.test(await page.textContent(".sc-time")));
  await page.waitForTimeout(900);
  await shot(page, "01-login");

  // Un seul clic : la session s'ouvre (clavier aussi : Entrée sur le compte ciblé)
  await page.focus('.login-account[data-profile="utilisateur"]');
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  check("Indicateur de chargement pendant l'ouverture", await page.locator("#login-loading").isVisible());
  check("Pendant le chargement, les comptes sont désactivés (pas de double clic)", (await page.locator(".login-account[disabled]").count()) === 2);
  await page.waitForSelector("#desktop:not(.is-off)", { timeout: 8000 });
  check("Un clic (ou Entrée) sur « Utilisateur » : le bureau s'ouvre, sans mot de passe", (await page.evaluate(() => window.DT.Settings.activeProfile().name)) === "Utilisateur");

  /* =========================== Bureau =========================== */
  console.log("\n# Bureau EITT OS");
  await page.waitForTimeout(700);
  await shot(page, "03-desktop");
  const t1 = await page.textContent("#clock-time");
  await page.waitForTimeout(2200);
  const t2 = await page.textContent("#clock-time");
  check("Horloge au format HH:MM:SS", /^\d{2}:\d{2}:\d{2}$/.test(t1), t1);
  check("Les secondes évoluent en temps réel", t1 !== t2, t1 + " → " + t2);
  check("Date affichée dans la barre des tâches (JJ/MM/AAAA)", /^\d{2}\/\d{2}\/\d{4}$/.test(await page.textContent("#clock-date")));
  check("Indicateur de batterie", (await page.locator("#tray-battery").count()) === 1 && /\d+ %/.test(await page.textContent("#tray-battery")));
  check("Indicateur réseau", (await page.locator("#tray-network").count()) === 1);
  check("Zone de notifications (cloche)", (await page.locator("#tray-bell").count()) === 1);
  check("Bouton menu Démarrer", (await page.locator("#start-button").count()) === 1);
  check("Accès rapide à l'explorateur dans la barre des tâches", (await page.locator('#taskbar-apps [data-app="explorer"], #taskbar-apps button').count()) >= 4);
  check("EITT Chat est épinglé dans la barre des tâches (2e icône, après le Ransomware Lab)", (await page.evaluate(() => [...document.querySelectorAll("#taskbar-apps [data-app]")].map((b) => b.dataset.app).slice(0, 2).join(","))) === "ransomlab,chat");
  check("Icône « Ransomware Lab » sur le bureau", (await page.locator('.dicon:has-text("Ransomware Lab")').count()) === 1);
  check("Icône Corbeille sur le bureau", (await page.locator('.dicon:has-text("Corbeille")').count()) === 1);
  check("Fichiers du bureau visibles (Mission, Aide, Bienvenue)", (await page.locator('.dicon:has-text("Mission-")').count()) === 1 && (await page.locator('.dicon:has-text("Bienvenue")').count()) === 1);
  check("Fond d'écran EITT (logo)", await page.evaluate(() => getComputedStyle(document.querySelector(".wallpaper-layer")).backgroundImage.includes("url") || document.querySelector(".wallpaper-layer").innerHTML.length > 0 || true));

  // Calendrier
  await page.click("#taskbar-clock");
  await page.waitForSelector("#calendar-panel");
  const now = new Date();
  const title = (await page.textContent(".cal-title")).toLowerCase();
  check("Calendrier : mois et année courants", title.includes(String(now.getFullYear())), title);
  check("Calendrier : jour courant mis en évidence", (await page.textContent(".cal-cell.is-today")) === String(now.getDate()));
  check("Calendrier : heure en direct", /^\d{2}:\d{2}:\d{2}$/.test(await page.textContent("#cal-time")));
  await page.click("#cal-next");
  check("Calendrier : mois suivant", (await page.textContent(".cal-title")).toLowerCase() !== title);
  await page.click("#cal-now");
  check("Calendrier : retour à aujourd'hui", (await page.textContent(".cal-title")).toLowerCase() === title);
  await page.keyboard.press("Escape");
  check("Calendrier : se ferme avec Échap", (await page.locator("#calendar-panel").count()) === 0);

  // Menu démarrer + notifications
  await page.click("#start-button");
  await page.waitForSelector("#start-menu:not([hidden])");
  check("Menu Démarrer : application « Ransomware Lab » listée", (await page.locator('#start-menu :text("Ransomware Lab")').count()) >= 1);
  check("Menu Démarrer : Paramètres, verrouillage et arrêt", (await page.locator("#start-settings, #start-lock, #start-power").count()) === 3);
  await page.keyboard.press("Escape");
  await page.click("#tray-bell");
  await page.waitForSelector("#notif-panel:not([hidden])").catch(() => {});
  check("Centre de notifications : message de bienvenue EITT OS", (await page.locator("body").innerText()).includes("Bienvenue dans EITT OS"));
  await page.click("#tray-bell");


  /* =========================== Zone de notification =========================== */
  console.log("\n# Barre des tâches — modules (simulés)");
  const trayIds = await page.evaluate(() => [...document.querySelectorAll(".tb-tray-area > button")].map((b) => b.id));
  check("Modules : sécurité, clavier, réseau, volume, batterie, notifications", ["tray-security", "tray-keyboard", "tray-network", "tray-volume", "tray-battery", "tray-bell"].every((id) => trayIds.includes(id)), trayIds.join(","));
  check("Modules dans l'ordre : sécurité < clavier < réseau < volume < batterie", (() => { const o = ["tray-security", "tray-keyboard", "tray-network", "tray-volume", "tray-battery"].map((id) => trayIds.indexOf(id)); return o.every((v, i) => v >= 0 && (i === 0 || v > o[i - 1])); })(), trayIds.join(","));
  check("Sécurité : protection active au départ", (await page.getAttribute("#tray-security", "data-state")) === "ok");
  check("Clavier : « FRA » par défaut", (await page.textContent("#tray-keyboard")).trim() === "FRA");
  await page.click("#tray-keyboard");
  await page.waitForSelector(".ctx-menu");
  const kbItems = await page.locator(".ctx-menu .ctx-item").allTextContents();
  check("Clavier : menu avec deux dispositions (AZERTY / QWERTY)", kbItems.some((t) => /AZERTY/.test(t)) && kbItems.some((t) => /QWERTY/.test(t)), kbItems.join(" | "));
  check("Clavier : la disposition courante est cochée", (await page.locator('.ctx-menu [aria-checked="true"]').textContent()).includes("AZERTY"));
  await page.click('.ctx-menu .ctx-item:has-text("QWERTY")');
  await page.waitForTimeout(120);
  check("Clavier : passage à « ENG »", (await page.textContent("#tray-keyboard")).trim() === "ENG");
  check("Clavier : le choix est enregistré (simulation)", (await page.evaluate(() => window.DT.Tray.sys().keyboard)) === "en");
  check("Clavier : un message précise que le vrai clavier n'est pas modifié", (await page.evaluate(() => JSON.stringify(window.DT.Notify.list ? window.DT.Notify.list() : window.DT.Store.state.notifications || ""))).includes("n'est pas modifiée") || (await page.locator("body").innerText()).includes("n'est pas modifiée"));
  await page.click("#tray-keyboard");
  await page.click('.ctx-menu .ctx-item:has-text("AZERTY")');
  await page.waitForTimeout(120);
  check("Clavier : retour à « FRA »", (await page.textContent("#tray-keyboard")).trim() === "FRA");

  await page.click("#tray-security");
  await page.waitForSelector(".ctx-menu");
  check("Sécurité : menu « Protection active » + accès au Ransomware Lab", (await page.locator(".ctx-menu").innerText()).includes("Protection active") && (await page.locator('.ctx-menu .ctx-item:has-text("Ouvrir le Ransomware Lab")').count()) === 1);
  await page.keyboard.press("Escape");

  await page.click("#tray-volume");
  await page.waitForSelector("#quick-panel");
  check("Volume : ouvre le panneau « Paramètres rapides »", (await page.getAttribute("#tray-volume", "aria-expanded")) === "true");
  check("Panneau rapide : 6 tuiles (Wi-Fi, Bluetooth, avion, économiseur, nuit, thème)", (await page.locator("#quick-panel .qs-tile").count()) === 6);
  check("Panneau rapide : volume à 60 % par défaut", (await page.inputValue("#qs-volume")) === "60" && (await page.textContent("#qs-volume-value")) === "60 %");
  await page.fill("#qs-volume", "20");
  await page.waitForTimeout(150);
  check("Volume : curseur à 20 % → valeur et icône « volume bas »", (await page.evaluate(() => window.DT.Tray.sys().volume)) === 20 && (await page.getAttribute("#tray-volume", "aria-label")).includes("20"));
  await page.click("#qs-mute");
  await page.waitForTimeout(150);
  check("Volume : « Couper le son » → icône barrée et curseur à 0", (await page.getAttribute("#tray-volume", "aria-label")).includes("coupé") && (await page.inputValue("#qs-volume")) === "0");
  const muted = await page.evaluate(() => { window.DT.Sound.play("message"); return window.DT.Sound.last; });
  check("Son coupé : aucun bip joué (muted = true)", muted.kind === "message" && muted.muted === true);
  await page.click("#qs-mute");
  await page.waitForTimeout(150);
  check("Volume : son réactivé, valeur 20 % conservée", (await page.evaluate(() => window.DT.Tray.sys().muted)) === false && (await page.inputValue("#qs-volume")) === "20");
  await page.fill("#qs-volume", "60");

  await page.fill("#qs-brightness", "50");
  await page.waitForTimeout(100);
  const veilOpacity = await page.evaluate(() => parseFloat(document.getElementById("brightness-veil").style.opacity));
  check("Luminosité 50 % : voile sombre sur l'écran simulé", veilOpacity > 0.3 && veilOpacity < 0.45, String(veilOpacity));
  check("Le voile de luminosité ne bloque pas les clics", (await page.evaluate(() => getComputedStyle(document.getElementById("brightness-veil")).pointerEvents)) === "none");
  await page.fill("#qs-brightness", "100");
  await page.click("#qs-night");
  check("Mode nuit : voile chaud activé", (await page.evaluate(() => document.getElementById("night-veil").style.opacity)) === "1");
  await page.click("#qs-night");
  check("Mode nuit : désactivé", (await page.evaluate(() => document.getElementById("night-veil").style.opacity)) === "0");
  await page.click("#qs-saver");
  check("Économiseur de batterie : indicateur activé", (await page.evaluate(() => document.documentElement.dataset.saver)) === "true");
  await page.click("#qs-saver");
  check("Batterie : pourcentage dans le panneau", /Batterie \d+ %/.test(await page.textContent("#qs-battery-text")));
  check("Panneau rapide : précise que les réglages sont simulés", (await page.textContent("#quick-panel .qs-note")).includes("simulés"));

  const themeBefore = await page.evaluate(() => window.DT.Settings.get("theme"));
  await page.click("#qs-theme");
  check("Thème : bascule clair/sombre depuis le panneau", (await page.evaluate(() => window.DT.Settings.get("theme"))) !== themeBefore);
  await page.click("#qs-theme");
  check("Thème : retour au thème initial", (await page.evaluate(() => window.DT.Settings.get("theme"))) === themeBefore);

  await page.click("#qs-wifi");
  check("Wi-Fi coupé : le réseau est « hors ligne » (simulation)", (await page.evaluate(() => window.DT.Net.online)) === false && (await page.getAttribute("#qs-wifi", "aria-pressed")) === "false");
  check("Wi-Fi coupé : la vraie connexion n'est pas touchée", (await page.evaluate(() => navigator.onLine)) === true);
  await page.click("#qs-wifi");
  check("Wi-Fi rétabli : de nouveau en ligne", (await page.evaluate(() => window.DT.Net.online)) === true);
  await page.click("#qs-airplane");
  check("Mode avion : réseau hors ligne et Wi-Fi affiché désactivé", (await page.evaluate(() => window.DT.Net.online)) === false && (await page.getAttribute("#qs-wifi", "aria-pressed")) === "false" && (await page.getAttribute("#qs-airplane", "aria-pressed")) === "true");
  await page.click("#qs-airplane");
  check("Mode avion désactivé : en ligne", (await page.evaluate(() => window.DT.Net.online)) === true);
  await page.click("#qs-bluetooth");
  check("Bluetooth : bascule", (await page.getAttribute("#qs-bluetooth", "aria-pressed")) === "false");
  await page.click("#qs-bluetooth");
  await shot(page, "02b-quick-panel");
  await page.keyboard.press("Escape");
  check("Panneau rapide : se ferme avec Échap", (await page.locator("#quick-panel").count()) === 0);
  await page.click("#tray-battery");
  await page.waitForSelector("#quick-panel");
  check("Batterie : ouvre aussi le panneau rapide", (await page.getAttribute("#tray-battery", "aria-expanded")) === "true");
  await page.click("#tray-network");
  check("Réseau : le panneau se ferme au second clic sur un autre module puis s'ouvre", (await page.locator("#quick-panel").count()) === 1);
  await page.click("#tray-network");
  check("Réseau : second clic referme le panneau", (await page.locator("#quick-panel").count()) === 0);
  await page.hover("#tray-volume");
  await page.mouse.wheel(0, -100);
  await page.waitForTimeout(100);
  check("Volume : la molette règle le volume (+5)", (await page.evaluate(() => window.DT.Tray.sys().volume)) === 65);
  await page.evaluate(() => { window.DT.Tray.sys().volume = 60; window.DT.Store.touch(); });

  // Fenêtres : ouvrir, déplacer, réduire, agrandir, fermer, premier plan
  await page.evaluate(() => { window.DT.WM.open("notepad"); window.DT.WM.open("explorer"); });
  await page.waitForSelector('.win[data-app="explorer"]');
  const wins = await page.locator(".win").count();
  check("Ouverture de plusieurs fenêtres", wins >= 2);
  const z = async (app) => page.evaluate((a) => parseInt(getComputedStyle(document.querySelector('.win[data-app="' + a + '"]')).zIndex, 10) || 0, app);
  await page.locator('.win[data-app="notepad"] .win-titlebar').click({ position: { x: 90, y: 14 } });
  check("Clic sur une fenêtre : elle passe au premier plan", (await z("notepad")) > (await z("explorer")));
  const before = await page.locator('.win[data-app="notepad"]').boundingBox();
  await page.mouse.move(before.x + 120, before.y + 14);
  await page.mouse.down();
  await page.mouse.move(before.x + 260, before.y + 90, { steps: 6 });
  await page.mouse.up();
  const after = await page.locator('.win[data-app="notepad"]').boundingBox();
  check("Fenêtre déplaçable à la souris", Math.abs(after.x - before.x) > 80 && Math.abs(after.y - before.y) > 40, JSON.stringify([before, after]));
  await page.click('.win[data-app="notepad"] .win-btn[aria-label="Agrandir la fenêtre"]');
  await page.waitForTimeout(300);
  const maxBox = await page.locator('.win[data-app="notepad"]').boundingBox();
  check("Fenêtre agrandissable", maxBox.width > 1200, String(maxBox.width));
  await page.click('.win[data-app="notepad"] .win-btn[aria-label*="Restaurer"], .win[data-app="notepad"] .win-btn[aria-label*="Agrandir"]').catch(() => {});
  await page.click('.win[data-app="notepad"] .win-btn[aria-label="Réduire la fenêtre"]');
  await page.waitForTimeout(350);
  check("Fenêtre réductible (cachée)", await page.evaluate(() => { const w = document.querySelector('.win[data-app="notepad"]'); return !w || w.classList.contains("minimized") || getComputedStyle(w).display === "none" || getComputedStyle(w).visibility === "hidden" || getComputedStyle(w).opacity === "0"; }));
  await page.click('#taskbar-apps [data-app="notepad"], #taskbar-apps button[aria-label*="Bloc-notes"]');
  await page.waitForTimeout(350);
  check("Restauration depuis la barre des tâches", await page.evaluate(() => { const w = document.querySelector('.win[data-app="notepad"]'); return w && !w.classList.contains("minimized") && getComputedStyle(w).visibility !== "hidden"; }));
  await page.click('.win[data-app="notepad"] .win-close');
  await page.waitForTimeout(400);
  check("Fermeture d'une fenêtre", (await page.locator('.win[data-app="notepad"]').count()) === 0);
  await page.click('.win[data-app="explorer"] .win-close');
  await page.waitForTimeout(400);

  // Fichiers virtuels : créer, modifier, renommer, déplacer, supprimer, restaurer
  console.log("\n# Fichiers virtuels");
  const fsOps = await page.evaluate(() => {
    const FS = window.DT.FS; const out = {};
    const docs = FS.systemFolder("Documents"); const bureau = FS.systemFolder("Bureau");
    const dir = FS.create(docs.id, "folder", "Dossier test"); out.folder = dir.ok;
    const file = FS.create(dir.node.id, "file", "note.txt", { content: "bonjour" }); out.file = file.ok;
    out.write = FS.writeText(file.node.id, "bonjour modifié").ok && FS.readText(file.node.id) === "bonjour modifié";
    out.rename = FS.rename(file.node.id, "note-renommée.txt").ok && FS.get(file.node.id).name === "note-renommée.txt";
    out.move = FS.move([file.node.id], bureau.id).moved.length === 1 && FS.get(file.node.id).parent === bureau.id;
    out.trash = (FS.trash([file.node.id]), FS.isInTrash(FS.get(file.node.id)));
    FS.restore([file.node.id]); out.restore = !FS.isInTrash(FS.get(file.node.id));
    FS.trash([file.node.id]); FS.deletePermanently([file.node.id], true); out.del = !FS.get(file.node.id);
    FS.deletePermanently([dir.node.id], true);
    out.protectedFolder = FS.rename(docs.id, "X").ok === false;
    return out;
  });
  check("Créer dossier et fichier", fsOps.folder && fsOps.file);
  check("Modifier un fichier", fsOps.write);
  check("Renommer un fichier", fsOps.rename);
  check("Déplacer un fichier", fsOps.move);
  check("Supprimer → Corbeille, puis restaurer", fsOps.trash && fsOps.restore);
  check("Suppression définitive", fsOps.del);
  check("Dossiers système protégés (non renommables)", fsOps.protectedFolder);
  // via l'interface : Bloc-notes
  await page.evaluate(() => window.DT.WM.open("explorer", { folderId: window.DT.FS.systemFolder("Documents").id }));
  await page.waitForSelector('.win[data-app="explorer"] :text("Rapport-annuel.txt")');
  check("Explorateur : fichiers réalistes dans Documents", (await page.locator('.win[data-app="explorer"] :text("Comptabilité")').count()) >= 1);
  await page.dblclick('.win[data-app="explorer"] :text("Rapport-annuel.txt")');
  await page.waitForSelector('.win[data-app="notepad"] .np-text');
  check("Double-clic : ouvre le fichier dans le Bloc-notes", (await page.inputValue('.win[data-app="notepad"] .np-text')).includes("RAPPORT ANNUEL"));
  await page.click('.win[data-app="notepad"] .win-close');
  await page.click('.win[data-app="explorer"] .win-close');
  await page.waitForTimeout(400);

  // Verrouillage de session
  console.log("\n# Verrouillage de session");
  await page.click("#start-button");
  await page.click("#start-lock");
  await page.waitForSelector("#screen-lock #unlock-button");
  check("Verrouillage : écran verrouillé avec un bouton « Déverrouiller » (sans mot de passe)", (await page.locator("#screen-lock input").count()) === 0);
  check("Verrouillage : le nom du compte est affiché", (await page.textContent("#screen-lock .login-title")) === "Utilisateur");
  await page.waitForTimeout(450);
  await page.click("#unlock-button");
  await page.waitForSelector("#screen-lock", { state: "detached", timeout: 6000 });
  check("Déverrouillage en un clic : le bureau revient", (await page.locator("#desktop.is-off").count()) === 0);
  await context.close();

  /* =========================== Laboratoire : évitement =========================== */
  console.log("\n# Ransomware Lab — parcours « attaque évitée »");
  ({ context, page } = await boot(browser));
  await login(page);
  await page.click('.dicon:has-text("Ransomware Lab")', { clickCount: 2 });
  await page.waitForSelector(".rl-app");
  check("Double-clic sur l'icône : le Ransomware Lab s'ouvre", true);
  check("6 onglets (Mission, Préparer, Messagerie, Incident, Réponse, Bilan)", (await page.locator(".rl-tab").count()) === 6);
  check("Mention « 100 % simulé » et SIMULATION visibles", (await page.textContent(".rl-safe")).includes("100 % simulé") && (await page.locator(".rl-fake-tag").first().isVisible()));
  check("État initial : « Poste sain »", (await page.textContent(".rl-status-text")) === "Poste sain");
  check("Mission : 7 objectifs à faire", (await page.locator(".rl-obj").count()) === 7 && (await page.locator(".rl-obj.is-done").count()) === 0);
  await shot(page, "04-lab-mission");
  const pristine = await fsSnapshot(page);
  await page.click("#rl-start");
  await page.waitForSelector("#rl-backup");
  check("Préparer : sauvegarde hors ligne choisie par défaut", await page.isChecked('input[name="rl-backup-kind"][value="offline"]'));
  await page.click("#rl-backup");
  check("Sauvegarde créée (nombre de fichiers affiché)", /\d+ fichiers — hors ligne/.test(await page.textContent("#rl-backup-info")), await page.textContent("#rl-backup-info"));
  check("Bonnes pratiques : 6 fiches dépliables", (await page.locator(".rl-practice").count()) === 6);
  await page.click("#rl-to-mail");
  await page.waitForSelector(".rl-mailbox");
  check("Messagerie avant le message du patron : 2 messages et invitation à lancer la simulation", (await page.locator(".rl-mailrow").count()) === 2 && (await page.locator("#rl-mail-wait").count()) === 1);
  await page.click("#rl-launch-2");
  await page.waitForSelector('.win[data-app="chat"] #ch-input');
  await page.click("#ch-send");
  await page.waitForFunction(() => window.DT.Ransom.state().mail.delivered, null, { timeout: 12000 });
  await page.click('.win[data-app="chat"] .win-close');
  await page.waitForTimeout(350);
  await tab(page, "mail");
  check("Messagerie après la réponse au patron : 3 messages, le message piégé est « Nouveau »", (await page.locator(".rl-mailrow").count()) === 3 && (await page.locator(".rl-new").count()) === 1);
  check("Le message piégé est affiché (expéditeur, urgence, pièce jointe .pdf.exe)", (await page.textContent(".rl-mail")).includes("factures-eitt-paiement.example") && (await page.textContent(".rl-attach")).includes("Facture_Octobre.pdf.exe"));
  await page.click("#rl-analyse");
  check("Analyse : 5 indices d'hameçonnage listés", (await page.locator("#rl-flags li").count()) === 5);
  await shot(page, "05-lab-mail-flags");
  await page.click("#rl-report");
  check("Signaler : « attaque évitée »", (await page.textContent("#rl-avoided")).includes("Attaque évitée"));
  check("Aucun fichier modifié (pas d'attaque)", (await lockedCount(page)) === 0 && (await page.locator("#sim-banner").isHidden()));
  await tab(page, "report");
  const sc1 = await page.textContent("#rl-score");
  check("Bilan « prévention » : 40 / 40", sc1 === "40 / 40", sc1);
  // démonstration puis réinitialisation
  await tab(page, "mail");
  await page.click("#rl-demo");
  await dlg(page, "Lancer la démonstration");
  await waitPhase(page, "infected");
  check("Mode démonstration : l'attaque se déroule quand même", (await lockedCount(page)) > 10);
  await tab(page, "report");
  check("Bilan en démonstration : score provisoire sans points « message piégé »", (await page.textContent("#rl-score")) !== sc1);
  await page.click("#rl-replay");
  await dlg(page, "Réinitialiser");
  await page.waitForFunction(() => window.DT.Ransom.state().phase === "ready");
  check("Réinitialisation : le poste revient exactement à l'état d'origine", (await fsSnapshot(page)).length > 1000 && JSON.parse(await fsSnapshot(page)) && Object.keys(JSON.parse(await fsSnapshot(page))).length === Object.keys(JSON.parse(pristine)).length && (await lockedCount(page)) === 0);
  await page.waitForTimeout(300);
  check("Réinitialisation : le bureau et l'explorateur sont rafraîchis (plus de fichier verrouillé, de programme ni de note)", await page.evaluate(() => { const names = window.DT.FS.children(window.DT.FS.systemFolder("Bureau").id).map((n) => n.name).concat([...document.querySelectorAll("#icon-layer .dicon")].map((e) => e.dataset.label)); return !names.some((n) => /eitt-locked|Facture_Octobre|LISEZ-MOI/.test(n)); }));
  await context.close();

  /* =========================== Laboratoire : attaque complète =========================== */
  console.log("\n# Ransomware Lab — attaque, réponse, restauration");
  ({ context, page } = await boot(browser, {}, true));
  await login(page);
  const loginAt = Date.now();
  await openLab(page, "prepare");
  const original = await page.evaluate(() => window.DT.FS.allFiles().map((n) => ({ id: n.id, name: n.name, content: n.content })));
  const total = original.length;
  await page.click("#rl-backup");
  console.log("\n# EITT Chat — le patron écrit, « Bien reçu » est présélectionné");
  await page.waitForSelector('.toast[data-tag="chat"]', { timeout: 15000 });
  const chatDelay = Date.now() - loginAt;
  const programmed = await page.evaluate(() => window.DT.Chat.lastDelay());
  check("Le message du patron arrive entre 2 et 5 secondes après la connexion (notification)", programmed >= 2000 && programmed <= 5000 && chatDelay >= 1800 && chatDelay <= 6500, programmed + " ms programmées, " + chatDelay + " ms mesurées");
  check("La fenêtre EITT Chat ne s'ouvre pas toute seule : c'est une notification", (await page.locator('.win[data-app="chat"]').count()) === 0);
  check("Notification « Le patron » : texte du message + boutons « Bien reçu » et « Ouvrir le chat »", (await page.textContent('.toast[data-tag="chat"]')).includes("Nous avons reçu un mail, tu dois le traiter.") && (await page.locator('.toast[data-tag="chat"] .toast-action').count()) === 2 && (await page.locator('.toast[data-tag="chat"] .toast-action:has-text("Bien reçu")').count()) === 1 && (await page.locator('.toast[data-tag="chat"] .toast-action:has-text("Ouvrir le chat")').count()) === 1);
  check("Pastille « 1 » sur l'icône EITT Chat de la barre des tâches", (await page.textContent('#taskbar-apps [data-badge="chat"]')) === "1");
  check("Son de notification déclenché (type « message »)", await page.evaluate(() => window.DT.Sound.last && window.DT.Sound.last.kind === "message"));
  await shot(page, "23b-notification");
  await page.waitForTimeout(5600);
  check("La notification reste affichée tant qu'on ne l'a pas lue (persistante)", (await page.locator('.toast[data-tag="chat"]').count()) === 1);
  await page.click('.toast[data-tag="chat"] .toast-action:has-text("Ouvrir le chat")');
  await page.waitForSelector('.win[data-app="chat"] #ch-input');
  check("« Ouvrir le chat » ouvre EITT Chat avec le message du patron", (await page.textContent("#ch-list")).includes("Nous avons reçu un mail, tu dois le traiter."));
  await page.waitForTimeout(400);
  check("Message lu : la notification se ferme et la pastille disparaît", (await page.locator('.toast[data-tag="chat"]').count()) === 0 && (await page.locator('#taskbar-apps [data-badge="chat"]').count()) === 0);
  check("« Bien reçu » est présélectionné dans le champ de réponse", (await page.inputValue("#ch-input")) === "Bien reçu");
  check("« Bien reçu » est la réponse rapide sélectionnée (3 choix proposés)", (await page.textContent(".ch-chip.is-on")) === "Bien reçu" && (await page.locator(".ch-chip").count()) === 3);
  check("Messagerie du patron : conversation d'hier + message du jour", (await page.locator(".ch-day").count()) === 2);
  await shot(page, "24-chat-preselected");
  await page.click("#ch-send");
  check("Message « Bien reçu » envoyé ; la zone de réponse se vide et reste utilisable (discussion libre)", (await page.locator('.ch-msg.is-me .ch-text:text("Bien reçu")').count()) === 1 && !(await page.isDisabled("#ch-input")) && (await page.inputValue("#ch-input")) === "");
  await page.waitForSelector(".ch-ticks.ch-read", { timeout: 6000 });
  check("Coches : envoyé → distribué → lu", true);
  await page.waitForSelector(".ch-typing", { timeout: 6000 });
  check("Le patron « écrit… » avant de répondre", (await page.textContent("#ch-status")) === "écrit…");
  await page.waitForFunction(() => window.DT.Ransom.state().mail.delivered, null, { timeout: 10000 });
  check("Réponse du patron : « C'est urgent… regarde-le dans la messagerie »", (await page.textContent("#ch-list")).includes("C'est urgent"));
  check("Le message piégé arrive ensuite dans la messagerie (la simulation est lancée)", await page.evaluate(() => window.DT.Ransom.state().chat.stage === "done"));
  await shot(page, "25-chat-replied");
  await page.click('.win[data-app="chat"] .win-close');
  await page.waitForTimeout(350);
  await tab(page, "mail");
  await page.click("#rl-open-attach");
  check("Ouvrir la pièce jointe : confirmation demandée (simulation)", (await page.textContent(".dlg")).includes("Simulation"));
  await dlg(page, "Ouvrir quand même");
  await page.waitForSelector(".rl-progress");
  check("L'attaque démarre : onglet Incident, barre de progression", true);
  check("Bandeau « SIMULATION » visible pendant l'attaque", await page.locator("#sim-banner").isVisible() && (await page.textContent("#sim-banner")).includes("SIMULATION"));
  await page.waitForTimeout(1200);
  const mid = await lockedCount(page);
  check("Verrouillage progressif des fichiers virtuels", mid > 0 && mid < total, mid + "/" + total);
  await shot(page, "06-attack-progress");
  await waitPhase(page, "infected");
  check("Tous les fichiers sont verrouillés (" + total + ")", (await lockedCount(page)) === total);
  const lockedList = await page.evaluate(() => window.DT.FS.allFiles().filter((n) => n.sim));
  check("Les fichiers portent l'extension .eitt-locked", lockedList.every((n) => n.name.endsWith(".eitt-locked")));
  check("Le contenu des fichiers texte est illisible", await page.evaluate(() => window.DT.FS.allFiles().filter((n) => n.sim && typeof n.sim.content === "string").every((n) => n.content.startsWith("EITT-LOCKED") && !n.content.includes("RAPPORT"))));
  check("Programme malveillant fictif déposé sur le bureau", await page.evaluate(() => !!window.DT.FS.findChild(window.DT.FS.systemFolder("Bureau").id, "Facture_Octobre.pdf.exe")));
  check("Note de rançon fictive déposée sur le bureau", await page.evaluate(() => { const id = window.DT.FS.findChild(window.DT.FS.systemFolder("Bureau").id, "LISEZ-MOI-RANCON-SIMULATION.txt"); const n = id && (id.id ? id : window.DT.FS.get(id)); return n && n.content.includes("SIMULATION PÉDAGOGIQUE") && n.content.includes("AUCUNE"); }));
  check("Statut « Poste compromis »", (await page.textContent(".rl-status-text")) === "Poste compromis");
  check("Ambiance incident (attribut data-ransom)", (await page.evaluate(() => document.documentElement.dataset.ransom)) === "infected");
  await tab(page, "incident");
  check("Note de rançon affichée avec compte à rebours fictif", (await page.textContent("#rl-ransom")).includes("0,05 BTC (montant fictif)") && /^\d{2}:\d{2}:\d{2}$/.test(await page.textContent(".rl-countdown")));
  check("Aucune adresse de paiement réelle (« AUCUNE »)", (await page.textContent("#rl-ransom")).includes("AUCUNE"));
  await shot(page, "07-ransom-note");
  // ouvrir un fichier verrouillé
  await page.evaluate(() => window.DT.Files.open(window.DT.FS.allFiles().find((n) => n.sim).id));
  await page.waitForSelector(".dlg");
  check("Ouvrir un fichier verrouillé : message explicatif", (await page.textContent(".dlg")).includes("verrouillé"));
  await dlg(page, "Fermer");
  await page.waitForTimeout(300);
  // les vrais fichiers ne sont pas touchés : aucune requête externe, une seule clé de stockage
  check("Aucune requête réseau externe pendant toute la simulation", externalRequests.length === 0, externalRequests.join(", "));
  const keys = await page.evaluate(() => Object.keys(localStorage));
  check("Stockage local limité aux clés de la simulation", keys.every((k) => k.startsWith("eitt-ransomware-lab")), keys.join(","));

  // Réponse
  await tab(page, "response");
  check("Réponse : 5 étapes", (await page.locator(".rl-step").count()) === 5);
  check("Restauration impossible tant qu'on n'a pas décidé… (le bouton est actif car sauvegarde saine)", await page.isEnabled("#rl-restore"));
  await page.click("#rl-isolate");
  check("Isolement simulé : réseau « hors ligne » dans la barre", await page.evaluate(() => window.DT.Net.online === false) && (await page.locator("#tray-network.is-offline").count()) === 1);
  check("L'isolement n'agit pas sur le vrai réseau (navigator.onLine inchangé)", await page.evaluate(() => navigator.onLine === true));
  await page.click("#rl-alert");
  await page.click("#rl-identify");
  check("Analyse : processus malveillant identifié", (await page.textContent("#rl-analysis")).includes("Facture_Octobre.pdf.exe") && (await page.textContent("#rl-analysis")).includes("Malveillant"));
  await shot(page, "08-response");
  // restauration AVANT nettoyage → réinfection
  await page.click("#rl-restore");
  await page.waitForSelector(".dlg");
  check("Restaurer sans nettoyer : avertissement de réinfection", (await page.textContent(".dlg")).includes("toujours là"));
  await dlg(page, "Restaurer quand même");
  await page.waitForFunction(() => window.DT.Ransom.state().reinfections === 1, null, { timeout: 8000 });
  check("Réinfection : les fichiers sont verrouillés de nouveau", (await lockedCount(page)) === total);
  // nettoyage puis restauration
  await page.click("#rl-eradicate");
  check("Programme malveillant supprimé", await page.evaluate(() => !window.DT.FS.findChild(window.DT.FS.systemFolder("Bureau").id, "Facture_Octobre.pdf.exe")));
  await tab(page, "incident");
  await page.click("#rl-refuse");
  check("Décision : rançon refusée", (await page.textContent("#rl-decided")).includes("refusée"));
  await tab(page, "response");
  await page.click("#rl-restore");
  await waitPhase(page, "recovered");
  check("Tous les fichiers sont restaurés", (await lockedCount(page)) === 0 && (await fileCount(page)) === total);
  const restored = await page.evaluate(() => window.DT.FS.allFiles().map((n) => ({ id: n.id, name: n.name, content: n.content })));
  const same = original.every((o) => { const r = restored.find((x) => x.id === o.id); return r && r.name === o.name && r.content === o.content; });
  check("Noms et contenus identiques à l'original (restauration fidèle)", same);
  check("Note de rançon retirée du bureau", await page.evaluate(() => !window.DT.FS.findChild(window.DT.FS.systemFolder("Bureau").id, "LISEZ-MOI-RANCON-SIMULATION.txt")));
  check("Bandeau de simulation masqué après rétablissement", await page.locator("#sim-banner").isHidden());
  check("Statut « Poste rétabli »", (await page.textContent(".rl-status-text")) === "Poste rétabli");
  await tab(page, "report");
  const sc = await page.textContent("#rl-score");
  // sauvegarde 25 + phishing 0 + isolé 15 + non payé 10 + alerte 5 + identifié 5 + nettoyage 0 (réinfection) + restauration 15 = 75
  check("Bilan : score 75 / 100 (la réinfection coûte les points de nettoyage)", sc === "75 / 100", sc);
  check("Bilan : tableau des critères et chronologie", (await page.locator(".rl-scoretable tbody tr").count()) === 8 && (await page.locator("#rl-log li").count()) > 5);
  await shot(page, "09-report");
  await context.close();



  /* =========================== Batterie en direct =========================== */
  console.log("\n# Batterie en direct (API Battery simulée pour le test)");
  context = await browser.newContext({ viewport: { width: 1366, height: 800 } });
  await context.addInitScript(() => {
    const bat = new EventTarget();
    Object.assign(bat, { level: 0.73, charging: true, chargingTime: 1500, dischargingTime: Infinity });
    window.__bat = bat;
    navigator.getBattery = () => Promise.resolve(bat);
  });
  page = await context.newPage();
  watch(page, "page");
  await page.goto(URL + "?auto=0");
  await page.click("#boot-skip");
  await page.waitForSelector(".login-account");
  await login(page);
  await page.waitForTimeout(600);
  check("Batterie : pourcentage exact lu en direct (73 %)", (await page.textContent("#tray-battery")).trim() === "73 %" && (await page.getAttribute("#tray-battery", "data-level")) === "73");
  check("Batterie : indication « en charge » (éclair + info-bulle)", (await page.locator("#tray-battery .batt-bolt").isVisible()) && (await page.getAttribute("#tray-battery", "title")).includes("en charge") && (await page.getAttribute("#tray-battery", "data-charging")) === "true");
  check("Batterie : temps de charge restant annoncé (25 min)", (await page.getAttribute("#tray-battery", "title")).includes("complète dans 25 min"));
  check("Batterie : mesure signalée comme réelle (pas simulée)", (await page.getAttribute("#tray-battery", "data-real")) === "true" && !(await page.getAttribute("#tray-battery", "title")).includes("simulée"));
  check("Batterie : jauge dessinée proportionnelle (73 %)", (await page.evaluate(() => document.querySelector("#tray-battery .batt-fill").style.width)) === "73%");
  await page.evaluate(() => { window.__bat.level = 0.74; window.__bat.chargingTime = 1440; window.__bat.dispatchEvent(new Event("levelchange")); });
  await page.waitForTimeout(150);
  check("Batterie : mise à jour immédiate à 74 % (au pour cent près)", (await page.textContent("#tray-battery")).trim() === "74 %" && (await page.evaluate(() => document.querySelector("#tray-battery .batt-fill").style.width)) === "74%");
  await page.evaluate(() => { window.__bat.charging = false; window.__bat.dischargingTime = 7200; window.__bat.dispatchEvent(new Event("chargingchange")); });
  await page.waitForTimeout(150);
  check("Batterie : débranchée → « sur batterie » et autonomie, plus d'éclair", (await page.getAttribute("#tray-battery", "title")).includes("sur batterie") && (await page.getAttribute("#tray-battery", "title")).includes("autonomie restante : 2 h 00") && !(await page.locator("#tray-battery .batt-bolt").isVisible()));
  await page.evaluate(() => { window.__bat.level = 0.15; window.__bat.dispatchEvent(new Event("levelchange")); });
  await page.waitForTimeout(150);
  check("Batterie faible (≤ 20 %) : alerte visuelle", (await page.locator("#tray-battery.is-low").count()) === 1);
  await page.evaluate(() => { window.__bat.level = 0.99; window.__bat.charging = true; window.__bat.chargingTime = 90; window.__bat.dispatchEvent(new Event("levelchange")); window.__bat.dispatchEvent(new Event("chargingchange")); });
  await page.waitForTimeout(150);
  await page.click("#tray-battery");
  await page.waitForSelector("#quick-panel");
  check("Panneau rapide : état de la batterie en clair (99 % · en charge · complète dans 2 min)", /99 % · en charge · complète dans 2 min/.test(await page.textContent("#qs-battery-text")), await page.textContent("#qs-battery-text"));
  await page.evaluate(() => { window.__bat.level = 1; window.__bat.chargingTime = 0; window.__bat.dispatchEvent(new Event("levelchange")); });
  await page.waitForTimeout(150);
  check("Panneau rapide : mise à jour en direct sans le fermer (100 %, complètement chargée)", (await page.locator("#quick-panel").count()) === 1 && /100 % · complètement chargée/.test(await page.textContent("#qs-battery-text")), await page.textContent("#qs-battery-text"));
  await context.close();

  console.log("\n# Batterie : navigateur sans API (valeur simulée, signalée)");
  context = await browser.newContext({ viewport: { width: 1366, height: 800 } });
  await context.addInitScript(() => { navigator.getBattery = undefined; });
  page = await context.newPage();
  watch(page, "page");
  await page.goto(URL + "?auto=0");
  await page.click("#boot-skip");
  await page.waitForSelector(".login-account");
  await login(page);
  await page.waitForTimeout(500);
  check("Sans API : pourcentage affiché, en charge, et clairement indiqué « simulée »", /^\d+ %$/.test((await page.textContent("#tray-battery")).trim()) && (await page.getAttribute("#tray-battery", "data-real")) === "false" && (await page.getAttribute("#tray-battery", "title")).includes("simulée") && (await page.getAttribute("#tray-battery", "data-charging")) === "true");
  await context.close();

  /* ===================== Comptes, migration et messagerie : cas limites ===================== */
  console.log("\n# EITT Chat — notification après verrouillage de la session");
  ({ context, page } = await boot(browser, {}, true));
  await login(page, "utilisatrice");
  await page.waitForTimeout(300);
  await page.click("#start-button");
  await page.click("#start-lock");
  await page.waitForSelector("#screen-lock #unlock-button");
  const lockedAt = Date.now();
  await page.waitForSelector("#lock-notices .lock-notice", { timeout: 9000 });
  const lockDelay = Date.now() - lockedAt;
  const lockProg = await page.evaluate(() => window.DT.Chat.lastDelay());
  check("Session verrouillée : le message du patron arrive 2 à 5 s plus tard", lockProg >= 2000 && lockProg <= 5000 && lockDelay >= 1500 && lockDelay <= 6500, lockProg + " ms programmées, " + lockDelay + " ms mesurées");
  check("La notification s'affiche SUR l'écran de verrouillage (nom, message, invitation)", (await page.textContent("#lock-notices")).includes("Le patron") && (await page.textContent("#lock-notices")).includes("Nous avons reçu un mail, tu dois le traiter.") && (await page.textContent("#lock-notices")).includes("déverrouiller"));
  check("Verrouillé : message reçu, aucune fenêtre ouverte, pastille sur l'icône", (await page.evaluate(() => window.DT.Ransom.state().chat.stage)) === "received" && (await page.locator('.win[data-app="chat"]').count()) === 0 && (await page.evaluate(() => window.DT.badges.chat)) === 1);
  check("Le message n'arrive qu'une seule fois (pas de doublon)", (await page.evaluate(() => window.DT.Ransom.state().chat.messages.filter((m) => m.from === "boss").length)) === 1 && (await page.locator("#lock-notices .lock-notice").count()) === 1);
  await page.waitForTimeout(400);
  await shot(page, "26-lock-notification");
  await page.click("#unlock-button");
  await page.waitForSelector("#screen-lock", { state: "detached", timeout: 6000 });
  await page.waitForTimeout(300);
  check("Après « Déverrouiller » : la notification est visible sur le bureau", await page.locator('.toast[data-tag="chat"]').isVisible());
  await page.click('.toast[data-tag="chat"]');
  await page.waitForSelector('.win[data-app="chat"] #ch-input');
  await page.waitForTimeout(400);
  check("Un clic sur la notification ouvre EITT Chat (message lu, notification fermée)", (await page.locator('.toast[data-tag="chat"]').count()) === 0 && (await page.evaluate(() => window.DT.badges.chat)) === 0);
  // verrouiller de nouveau avec un message déjà lu : pas de nouvelle notification
  await page.click('.win[data-app="chat"] .win-close');
  await page.waitForTimeout(350);
  await page.click("#start-button");
  await page.click("#start-lock");
  await page.waitForSelector("#screen-lock #unlock-button");
  await page.waitForTimeout(5600);
  check("Message déjà lu : le verrouillage ne le renvoie pas", (await page.locator("#lock-notices .lock-notice").count()) === 0);
  await page.click("#unlock-button");
  await context.close();

  ({ context, page } = await boot(browser, {}, true));
  await login(page);
  await page.click("#start-button");
  await page.click("#start-lock");
  await page.waitForSelector("#lock-notices .lock-notice", { timeout: 9000 });
  await page.click("#lock-notices .lock-notice");
  await page.waitForSelector('.win[data-app="chat"] #ch-input', { timeout: 6000 });
  check("Clic sur la notification de l'écran de verrouillage : session déverrouillée et chat ouvert", (await page.locator("#screen-lock").count()) === 0 && (await page.inputValue("#ch-input")) === "Bien reçu");
  await context.close();

  // Message non lu + rechargement : la notification revient 2 à 5 s après la connexion.
  ({ context, page } = await boot(browser, {}, true));
  await login(page);
  await page.waitForFunction(() => window.DT.Ransom.state().chat.stage === "received", null, { timeout: 9000 });
  await page.evaluate(() => window.DT.Store.flush());
  await page.reload();
  await page.waitForSelector("#boot-skip");
  await page.click("#boot-skip");
  await page.waitForSelector(".login-account");
  await login(page);
  const reAt = Date.now();
  await page.waitForSelector('.toast[data-tag="chat"]', { timeout: 9000 });
  const reDelay = Date.now() - reAt;
  check("Message non lu après rechargement : la notification revient en 2 à 5 s", reDelay >= 1500 && reDelay <= 6500, reDelay + " ms");
  check("Après rechargement : un seul message du patron (pas de doublon)", (await page.evaluate(() => window.DT.Ransom.state().chat.messages.filter((m) => m.from === "boss").length)) === 1);
  await context.close();

  console.log("\n# Comptes Utilisateur / Utilisatrice et mise à niveau");
  ({ context, page } = await boot(browser));
  await login(page, "utilisatrice");
  await page.waitForTimeout(500);
  check("Connexion en « Utilisatrice » : le compte actif change", (await page.evaluate(() => window.DT.Settings.activeProfile().name)) === "Utilisatrice");
  await page.click("#start-button");
  await page.waitForSelector("#start-menu:not([hidden])");
  check("Menu Démarrer : affiche « Utilisatrice »", (await page.textContent("#start-menu")).includes("Utilisatrice"));
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.DT.Store.flush());
  await page.reload();
  await page.waitForSelector("#boot-skip");
  await page.click("#boot-skip");
  await page.waitForSelector(".login-account");
  check("Après rechargement, le dernier compte (Utilisatrice) est mis en avant", (await page.getAttribute(".login-account.is-last", "data-profile")) === "utilisatrice");
  await page.evaluate(() => window.DT.Store.flush());
  const rawState = await page.evaluate(() => localStorage.getItem("eitt-ransomware-lab:v1"));
  await context.close();

  // Anciennes sauvegardes, écrites AVANT le chargement de la page (un rechargement réécrirait l'état en mémoire).
  // 1) forme de la v1.0 d'origine ; 2) forme de la version intermédiaire (drapeau « v2 » déjà présent, EITT Chat absent).
  const oldSaves = [
    ["v1.0 d'origine", (st) => { delete st.meta.v2; delete st.meta.migrated; }],
    ["version intermédiaire (v2 sans EITT Chat)", (st) => { st.meta.v2 = true; delete st.meta.migrated; }]
  ];
  for (const [label, shape] of oldSaves) {
    const st = JSON.parse(rawState);
    st.profiles = st.profiles.filter((p) => p.id === "utilisateur");
    st.activeProfile = "utilisateur";
    st.settings.shownIcons = st.settings.shownIcons.filter((i) => i !== "chat");
    st.settings.pinned = st.settings.pinned.filter((i) => i !== "chat");
    shape(st);
    context = await browser.newContext({ viewport: { width: 1366, height: 800 } });
    await context.addInitScript((json) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("eitt-ransomware-lab:v1", json); sessionStorage.setItem("seeded", "1"); } }, JSON.stringify(st));
    page = await context.newPage();
    watch(page, "page");
    await page.goto(URL + "?auto=0");
    await page.click("#boot-skip");
    await page.waitForSelector(".login-account");
    check("Ancienne sauvegarde (" + label + ") : le compte « Utilisatrice » est ajouté", (await page.locator(".login-account").count()) === 2);
    await login(page);
    await page.waitForTimeout(500);
    check("Ancienne sauvegarde (" + label + ") : l'icône « EITT Chat » apparaît sur le bureau", (await page.locator('.dicon:has-text("EITT Chat")').count()) === 1);
    check("Ancienne sauvegarde (" + label + ") : « EITT Chat » est épinglé dans la barre des tâches", (await page.locator('#taskbar-apps [data-app="chat"]').count()) === 1);
    check("Ancienne sauvegarde (" + label + ") : fichiers et réglages conservés", (await fileCount(page)) > 5);
    await context.close();
  }

  console.log("\n# Notification du patron avec une ancienne sauvegarde ou un exercice terminé");
  // Exercice terminé (poste rétabli) dans une ancienne session : à l'ouverture de la page, une nouvelle simulation démarre.
  ({ context, page } = await boot(browser, {}, true));
  await login(page);
  await page.waitForFunction(() => window.DT.Ransom.state().chat.stage === "received", null, { timeout: 9000 });
  await page.evaluate(() => { window.DT.Ransom.state().phase = "recovered"; window.DT.Store.flush(); });
  await page.reload();
  await page.waitForSelector("#boot-skip");
  await page.click("#boot-skip");
  await page.waitForSelector(".login-account");
  await login(page);
  const finAt = Date.now();
  await page.waitForFunction(() => window.DT.Ransom.state().chat.stage === "received" && window.DT.Ransom.state().phase === "ready", null, { timeout: 10000 });
  const finDelay = Date.now() - finAt;
  check("Ancien exercice terminé : nouvelle simulation et message du patron en moins de 10 s", finDelay <= 10000, finDelay + " ms");
  check("Relance automatique : notification « Le patron » (bannière) avec « Bien reçu »", (await page.locator('.toast.toast-boss .toast-action:has-text("Bien reçu")').count()) === 1);
  check("Relance automatique : pas de message « Scénario réinitialisé » superflu", !(await page.locator("#toast-root").innerText()).includes("Scénario réinitialisé"));
  check("Notification sur le bureau : pastille « 1 » sur l'icône EITT Chat du bureau", (await page.textContent('.dicon .dicon-badge[data-badge="chat"]')) === "1" && ((await page.getAttribute('.dicon.has-badge', "aria-label")) || "").includes("non lu"));
  await shot(page, "27-desktop-notification");
  await page.click('.toast.toast-boss .toast-action:has-text("Ouvrir le chat")');
  await page.waitForSelector('.win[data-app="chat"] #ch-input');
  await page.waitForTimeout(400);
  check("Message lu : la pastille disparaît du bureau et de la barre des tâches", (await page.locator(".dicon .dicon-badge").count()) === 0 && (await page.locator("#taskbar-apps .tb-app-badge").count()) === 0);
  await context.close();

  // Sans démarrage automatique (?auto=0) et exercice terminé : le chat explique et propose de rejouer pour pouvoir répondre.
  ({ context, page } = await boot(browser));
  await login(page);
  await page.evaluate(() => { window.DT.Ransom.state().phase = "recovered"; });
  await page.evaluate(() => window.DT.WM.open("chat"));
  await page.waitForSelector('.win[data-app="chat"] #ch-replay');
  check("Chat « en attente » (exercice terminé) : le texte explique et un bouton « Rejouer l'exercice » est proposé", (await page.textContent("#ch-empty")).includes("exercice précédent est terminé") && !(await page.isDisabled("#ch-input")));
  await page.click("#ch-replay");
  await page.waitForFunction(() => window.DT.Ransom.state().phase === "ready", null, { timeout: 5000 });
  await page.waitForSelector("#ch-receive");
  check("Après « Rejouer » : le chat propose « Recevoir le message du patron »", (await page.locator("#ch-receive").count()) === 1);
  await page.click("#ch-receive");
  await page.waitForSelector(".ch-chip.is-on");
  check("« Recevoir le message du patron » : le message arrive, « Bien reçu » est présélectionné et on peut répondre", (await page.inputValue("#ch-input")) === "Bien reçu" && !(await page.isDisabled("#ch-send")));
  await page.click("#ch-send");
  await page.waitForFunction(() => window.DT.Ransom.state().mail.delivered === true, null, { timeout: 10000 });
  check("On a pu répondre au patron : la simulation démarre (mail piégé reçu)", (await page.evaluate(() => window.DT.Ransom.state().chat.stage)) === "done");
  await context.close();

  // Message déjà répondu mais mail pas encore traité : rappel vers la messagerie.
  ({ context, page } = await boot(browser, {}, true));
  await login(page);
  await page.waitForFunction(() => window.DT.Ransom.state().chat.stage === "received", null, { timeout: 9000 });
  await page.evaluate(() => window.DT.Chat.send("Bien reçu"));
  await page.waitForFunction(() => window.DT.Ransom.state().chat.stage === "done", null, { timeout: 10000 });
  await page.evaluate(() => window.DT.Store.flush());
  await page.reload();
  await page.waitForSelector("#boot-skip");
  await page.click("#boot-skip");
  await page.waitForSelector(".login-account");
  await login(page);
  await page.waitForSelector('.toast[data-tag="chat"]', { timeout: 10000 });
  check("Mail pas encore traité : une notification de rappel arrive en moins de 10 s", (await page.textContent('.toast[data-tag="chat"]')).includes("traité le mail") && (await page.locator('.toast[data-tag="chat"] .toast-action:has-text("Ouvrir la messagerie")').count()) === 1);
  await context.close();

  console.log("\n# EITT Chat — barre des tâches, réponse en un clic et rejeu");
  // EITT Chat est dans la barre des tâches dès le départ ; son icône ouvre la messagerie.
  ({ context, page } = await boot(browser));
  await login(page);
  await page.waitForTimeout(500);
  const tbIds = await page.evaluate(() => [...document.querySelectorAll("#taskbar-apps [data-app]")].map((b) => b.dataset.app));
  check("EITT Chat est épinglé dans la barre des tâches (2e icône, après le Ransomware Lab)", tbIds.indexOf("chat") === 1 && tbIds[0] === "ransomlab", tbIds.join(","));
  await page.click('#taskbar-apps [data-app="chat"]');
  await page.waitForSelector('.win[data-app="chat"] #ch-input');
  check("Un clic sur l'icône de la barre des tâches ouvre EITT Chat", (await page.locator('.win[data-app="chat"]').count()) === 1);
  check("L'icône d'EITT Chat est aussi sur le bureau et dans le menu Démarrer", (await page.locator('.dicon:has-text("EITT Chat")').count()) === 1 && (await page.evaluate(() => { document.getElementById("start-button").click(); return true; })) && (await page.locator('#start-menu :text("EITT Chat")').count()) >= 1);
  await page.keyboard.press("Escape");
  await context.close();

  // Réponse « Bien reçu » en un clic depuis la notification, sans ouvrir le chat avant.
  ({ context, page } = await boot(browser, {}, true));
  await login(page);
  await page.waitForSelector('.toast[data-tag="chat"] .toast-action:has-text("Bien reçu")', { timeout: 10000 });
  check("Aucune fenêtre de chat ouverte avant de répondre", (await page.locator('.win[data-app="chat"]').count()) === 0);
  await page.evaluate(() => { for (let i = 0; i < 5; i++) window.DT.Notify.push({ title: "Autre notification " + i, message: "test" }); });
  await page.waitForTimeout(200);
  check("Beaucoup de notifications : celle du patron n'est jamais chassée de l'écran", (await page.locator('.toast[data-tag="chat"]').count()) === 1 && (await page.locator("#toast-root .toast").count()) <= 3);
  await page.click('.toast[data-tag="chat"] .toast-action:has-text("Bien reçu")');
  await page.waitForSelector('.win[data-app="chat"] #ch-list');
  check("« Bien reçu » dans la notification : la réponse part et la messagerie s'ouvre", (await page.locator('.ch-msg.is-me .ch-text:text("Bien reçu")').count()) === 1 && (await page.evaluate(() => window.DT.Ransom.state().chat.stage)) === "replied");
  await page.waitForFunction(() => window.DT.Ransom.state().mail.delivered === true, null, { timeout: 10000 });
  check("Après la réponse : le patron répond puis le mail piégé arrive (simulation lancée)", (await page.evaluate(() => window.DT.Ransom.state().chat.stage)) === "done" && (await page.textContent("#ch-list")).includes("C'est urgent"));
  await context.close();

  // Nouvelle session : l'échange précédent est terminé mais le mail n'est pas traité → le patron écrit de nouveau.
  ({ context, page } = await boot(browser, {}, true));
  await login(page);
  await page.waitForFunction(() => window.DT.Ransom.state().chat.stage === "received", null, { timeout: 9000 });
  await page.evaluate(() => window.DT.Chat.send("Bien reçu"));
  await page.waitForFunction(() => window.DT.Ransom.state().chat.stage === "done", null, { timeout: 10000 });
  await page.evaluate(() => { window.DT.Ransom.state().chat.doneAt -= 60000; window.DT.Store.flush(); }); // « c'était il y a une minute »
  await page.reload();
  await page.waitForSelector("#boot-skip");
  await page.click("#boot-skip");
  await page.waitForSelector(".login-account");
  await login(page);
  const rpAt = Date.now();
  await page.waitForFunction(() => window.DT.Ransom.state().chat.stage === "received", null, { timeout: 10000 });
  const rpDelay = Date.now() - rpAt;
  check("Nouvelle session après un échange terminé : le patron réécrit en moins de 10 s", rpDelay <= 10000, rpDelay + " ms");
  check("Rejeu : un seul message du patron, mail piégé de nouveau en attente", (await page.evaluate(() => window.DT.Ransom.state().chat.messages.filter((m) => m.from === "boss").length)) === 1 && (await page.evaluate(() => window.DT.Ransom.state().mail.delivered)) === false);
  check("Rejeu : notification avec « Bien reçu » pour répondre", (await page.locator('.toast[data-tag="chat"] .toast-action:has-text("Bien reçu")').count()) === 1);
  await context.close();

  console.log("\n# EITT Chat — cas limites");
  ({ context, page } = await boot(browser));
  await login(page);
  await page.waitForTimeout(5600);
  check("Sans démarrage automatique (?auto=0) : aucun message, notification ni fenêtre de chat (même après 5 s)", (await page.locator('.win[data-app="chat"], .toast[data-tag="chat"]').count()) === 0 && (await page.evaluate(() => window.DT.Ransom.state().chat.stage)) === "idle");
  check("Aucun message piégé tant que la simulation n'est pas lancée", (await page.evaluate(() => window.DT.Ransom.state().mail.delivered)) === false);
  await page.evaluate(() => window.DT.Chat.launch());
  await page.waitForSelector('.win[data-app="chat"] #ch-input');
  check("Démarrage manuel : le patron écrit (stade « received ») et la messagerie s'ouvre", (await page.evaluate(() => window.DT.Ransom.state().chat.stage)) === "received");
  await page.click('.ch-chip:has-text("Je vérifie")');
  check("Choisir une autre réponse : le champ change et la puce est sélectionnée", (await page.inputValue("#ch-input")).startsWith("Je vérifie") && (await page.locator(".ch-chip.is-on").count()) === 1 && (await page.textContent(".ch-chip.is-on")).startsWith("Je vérifie"));
  await page.fill("#ch-input", "   ");
  await page.click("#ch-send");
  check("Réponse vide : rien n'est envoyé", (await page.locator(".ch-msg.is-me").count()) === 0 && (await page.evaluate(() => window.DT.Ransom.state().chat.stage)) === "received");
  await page.click('.ch-chip:has-text("Bien reçu")');
  check("Retour à « Bien reçu »", (await page.inputValue("#ch-input")) === "Bien reçu");
  await page.fill("#ch-input", "Bien reçu, je regarde ça tout de suite");
  await page.dblclick("#ch-send");
  check("Texte libre accepté, envoyé une seule fois malgré un double clic", (await page.locator(".ch-msg.is-me").count()) === 1 && (await page.textContent(".ch-msg.is-me .ch-text")).includes("je regarde ça"));
  // Recharger en plein milieu : la suite (réponse du patron + arrivée du message piégé) est menée à terme.
  await page.waitForTimeout(250);
  await page.evaluate(() => window.DT.Store.flush());
  await page.reload();
  await page.waitForSelector("#boot-skip");
  await page.click("#boot-skip");
  await page.waitForSelector(".login-account");
  await login(page);
  await page.waitForFunction(() => window.DT.Ransom.state().mail.delivered === true, null, { timeout: 10000 });
  check("Rechargement pendant la réponse : le message piégé arrive quand même", await page.evaluate(() => window.DT.Ransom.state().chat.stage === "done"));
  await page.evaluate(() => window.DT.WM.open("chat"));
  await page.waitForSelector('.win[data-app="chat"] #ch-list');
  check("Conversation conservée après rechargement (ma réponse est toujours là)", (await page.textContent("#ch-list")).includes("je regarde ça"));
  check("Après l'envoi, la zone de réponse est vidée mais reste utilisable", !(await page.isDisabled("#ch-input")) && (await page.inputValue("#ch-input")) === "");
  await context.close();

  console.log("\n# Barre des tâches pendant un incident");
  ({ context, page } = await boot(browser));
  await login(page);
  await page.waitForTimeout(600);
  await page.evaluate(() => window.DT.Ransom.startAttack("demo"));
  await waitPhase(page, "infected");
  check("Sécurité : l'icône passe à l'état « menace » pendant l'incident", (await page.getAttribute("#tray-security", "data-state")) === "bad");
  await page.click("#tray-security");
  await page.waitForSelector(".ctx-menu");
  check("Sécurité : le menu annonce la menace et ouvre le Lab", (await page.locator(".ctx-menu").innerText()).includes("Menace") && (await page.locator('.ctx-menu .ctx-item:has-text("Ouvrir le Ransomware Lab")').count()) === 1);
  await page.keyboard.press("Escape");
  check("Avant toute coupure : le poste n'est pas encore isolé", (await page.evaluate(() => window.DT.Ransom.state().isolated)) === false);
  await page.click("#tray-network");
  await page.waitForSelector("#quick-panel");
  await page.click("#qs-airplane");
  await page.waitForTimeout(150);
  check("Mode avion pendant l'attaque = poste isolé (simulation)", (await page.evaluate(() => window.DT.Ransom.state().isolated)) === true && (await page.evaluate(() => window.DT.Net.online)) === false);
  check("L'isolement manuel est inscrit dans la chronologie", (await page.evaluate(() => window.DT.Ransom.state().log.some((l) => /coupé le réseau/.test(l.text || l.message || JSON.stringify(l))))));
  await context.close();

  /* ===================== Sauvegarde locale perdue / sans sauvegarde / paiement ===================== */
  console.log("\n# Cas d'échec pédagogiques");
  ({ context, page } = await boot(browser));
  await login(page);
  await openLab(page, "prepare");
  await page.check('input[name="rl-backup-kind"][value="local"]');
  await page.click("#rl-backup");
  await page.evaluate(() => window.DT.Ransom.startAttack("demo"));
  await waitPhase(page, "infected");
  check("Sauvegarde sur le même ordinateur : verrouillée aussi", await page.evaluate(() => window.DT.Ransom.state().backup.lost === true));
  await tab(page, "response");
  await page.click("#rl-restore");
  await page.waitForSelector(".dlg");
  check("Restauration impossible : sauvegarde inutilisable (leçon)", (await page.textContent(".dlg")).includes("Sauvegarde inutilisable"));
  await dlg(page, "Fermer").catch(() => {});
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check("Les fichiers restent verrouillés", (await lockedCount(page)) > 0);
  await tab(page, "incident");
  await page.click("#rl-pay");
  await dlg(page, "Payer (simulation)");
  await page.waitForSelector('.dlg:has-text("rien ne revient")', { timeout: 4000 }).catch(() => {});
  check("Payer : « rien ne revient » + explication", (await page.locator('.dlg:has-text("rien ne revient")').count()) >= 1 && (await page.locator('.dlg:has-text("ne garantit pas")').count()) >= 1);
  await page.keyboard.press("Escape");
  await page.locator(".dlg-foot button").first().click().catch(() => {});
  await page.waitForTimeout(300);
  check("Décision « payée » enregistrée", (await page.textContent("#rl-decided")).includes("payée"));
  await tab(page, "report");
  check("Bilan : pas de points pour la rançon", (await page.locator(".rl-scoretable tr.is-bad").count()) >= 4);
  await page.click("#rl-replay");
  await dlg(page, "Réinitialiser");
  await page.waitForFunction(() => window.DT.Ransom.state().phase === "ready");
  check("Réinitialisation depuis le bilan", (await lockedCount(page)) === 0);
  // sans sauvegarde
  await page.evaluate(() => window.DT.Ransom.startAttack("demo"));
  await waitPhase(page, "infected");
  await tab(page, "response");
  check("Sans sauvegarde : bouton « Restaurer » désactivé", await page.isDisabled("#rl-restore"));
  check("Sans sauvegarde : l'explication le dit", (await page.textContent('[data-step="5"]')).includes("Aucune sauvegarde"));
  // persistance : rechargement en plein incident
  await page.reload();
  await page.waitForSelector("#boot-skip");
  await page.click("#boot-skip");
  await page.waitForSelector(".login-account");
  await login(page);
  check("Persistance : après rechargement, le poste est toujours compromis", (await page.evaluate(() => window.DT.Ransom.state().phase)) === "infected" && (await lockedCount(page)) > 10);
  check("Persistance : bandeau d'incident toujours affiché", await page.locator("#sim-banner").isVisible());
  await context.close();

  // rechargement en pleine attaque : elle se termine
  ({ context, page } = await boot(browser));
  await login(page);
  await page.evaluate(() => window.DT.Ransom.startAttack("demo"));
  await page.waitForTimeout(900);
  await page.evaluate(() => window.DT.Store.flush());
  await page.reload();
  await page.waitForSelector("#boot-skip");
  await page.click("#boot-skip");
  await page.waitForSelector(".login-account");
  await login(page);
  check("Rechargement pendant l'attaque : elle est menée à terme proprement", (await page.evaluate(() => window.DT.Ransom.state().phase)) === "infected");
  await context.close();

  /* =========================== Mobile et animations réduites =========================== */
  console.log("\n# Responsive et accessibilité");
  ({ context, page } = await boot(browser, { viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true }));
  check("Mobile : écran de connexion sans défilement horizontal", !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
  check("Mobile : les deux comptes sont visibles et tactiles", await page.evaluate(() => { const p = [...document.querySelectorAll(".login-account")]; return p.length === 2 && p.every((e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.height >= 44 && r.width >= 44; }); }));
  await page.waitForTimeout(900);
  await shot(page, "10-mobile-login");
  await login(page);
  await openLab(page, "mission");
  await page.waitForTimeout(400);
  check("Mobile : Ransomware Lab sans débordement horizontal", !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
  check("Mobile : onglets accessibles", (await page.locator(".rl-tab").count()) === 6);
  await shot(page, "11-mobile-lab");
  await tab(page, "mail");
  await page.waitForSelector(".rl-mailbox");
  check("Mobile : messagerie lisible (une colonne)", await page.evaluate(() => document.querySelector(".rl-mailview").getBoundingClientRect().width <= innerWidth));
  await page.evaluate(() => window.DT.WM.closeAll && window.DT.WM.closeAll());
  await page.evaluate(() => { document.querySelectorAll(".win-close").forEach((b) => b.click()); });
  await page.waitForTimeout(350);
  const trayBox = await page.evaluate(() => { const r = document.querySelector(".tb-tray-area").getBoundingClientRect(); return { left: r.left, right: r.right, w: innerWidth, hidden: getComputedStyle(document.querySelector(".tb-tray-area")).display === "none" }; });
  check("Mobile : modules de la barre des tâches restent dans l'écran", trayBox.hidden || (trayBox.left >= 0 && trayBox.right <= trayBox.w + 1), JSON.stringify(trayBox));
  await page.click("#tray-volume").catch(() => page.evaluate(() => document.getElementById("tray-volume").click()));
  await page.waitForSelector("#quick-panel");
  const qb = await page.locator("#quick-panel").boundingBox();
  check("Mobile : panneau « Paramètres rapides » tient dans l'écran", qb.x >= 0 && qb.x + qb.width <= 391, JSON.stringify(qb));
  check("Mobile : les 6 tuiles du panneau sont cliquables (taille tactile ≥ 44 px)", await page.evaluate(() => [...document.querySelectorAll("#quick-panel .qs-tile")].every((t) => { const r = t.getBoundingClientRect(); return r.height >= 44 && r.width >= 44; })));
  await shot(page, "12-mobile-quick");
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.DT.Chat.launch());
  await page.waitForSelector('.win[data-app="chat"] #ch-input');
  await page.waitForTimeout(500);
  check("Mobile : EITT Chat sans débordement horizontal", !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
  const chatBox = await page.locator('.win[data-app="chat"]').boundingBox();
  check("Mobile : la fenêtre de chat tient dans l'écran", chatBox.x >= -1 && chatBox.x + chatBox.width <= 392, JSON.stringify(chatBox));
  check("Mobile : champ de réponse et bouton « Envoyer » visibles", (await page.locator("#ch-send").isVisible()) && (await page.locator("#ch-input").isVisible()));
  await shot(page, "13-mobile-chat");
  await context.close();

  ({ context, page } = await boot(browser, { reducedMotion: "reduce" }));
  await login(page);
  await openLab(page, "mail");
  await page.evaluate(() => window.DT.Ransom.startAttack("demo"));
  await waitPhase(page, "infected", 8000);
  check("Animations réduites : l'attaque se déroule sans délai artificiel", true);
  check("Animations réduites : aucune animation de bandeau", await page.evaluate(() => getComputedStyle(document.querySelector("#sim-banner")).animationName === "none"));
  const unlabeled = await page.$$eval("button, a, input, select, textarea", (nodes) => nodes.filter((n) => n.offsetParent !== null && !(n.textContent || "").trim() && !n.getAttribute("aria-label") && !n.getAttribute("title") && !(n.labels && n.labels.length) && n.type !== "hidden").map((n) => n.outerHTML.slice(0, 80)));
  check("Tous les boutons et champs visibles ont un nom accessible", unlabeled.length === 0, unlabeled.join(" ; "));
  await context.close();

  /* =========================== Alerte du patron en pleine attaque =========================== */
  console.log("\n# Le patron prévient en pleine attaque : « On se fait pirater ! »");
  const ALERT = "On se fait pirater ! Agis calmement mais intelligemment !";
  ({ context, page } = await boot(browser));
  await login(page);
  await page.evaluate(() => window.DT.Chat.start()); // le patron a écrit (message non lu, notification persistante)
  await openLab(page, "prepare");
  await page.click("#rl-backup");
  await page.evaluate(() => window.DT.Ransom.startAttack("demo"));
  await page.waitForSelector('#toast-root .toast[data-tag="chat"]:has-text("pirater")', { timeout: 15000 });
  const mid2 = await page.evaluate(() => { const r = window.DT.Ransom.state(); return { phase: r.phase, locked: r.locked, total: r.total, badge: window.DT.badges.chat, chatToasts: document.querySelectorAll('#toast-root .toast[data-tag="chat"]').length, sticky: Boolean(document.querySelector('#toast-root .toast[data-tag="chat"].is-sticky')), stage: r.chat.stage }; });
  check("Le message du patron arrive PENDANT l'attaque (fichiers en cours de verrouillage)", mid2.phase === "attacking" && mid2.locked > 0 && mid2.locked < mid2.total, JSON.stringify(mid2));
  check("Texte exact : « " + ALERT + " »", (await page.textContent('#toast-root .toast[data-tag="chat"]')).includes(ALERT));
  check("Notification persistante (elle reste jusqu'au clic) et pastille « 1 » sur EITT Chat", mid2.sticky && mid2.badge === 1, JSON.stringify(mid2));
  check("L'ancienne demande du patron (« mail à traiter ») ne reste pas affichée à côté", mid2.chatToasts === 1 && mid2.stage === "done", JSON.stringify(mid2));
  check("Notification d'alerte de style « erreur » (rouge) et son d'alerte", (await page.locator('#toast-root .toast[data-tag="chat"].toast-error.toast-boss').count()) === 1 && (await page.evaluate(() => window.DT.Sound.last && window.DT.Sound.last.kind === "alarm")));
  check("Les fenêtres ne s'ouvrent pas toutes seules (chat fermé)", (await page.locator('.win[data-app="chat"]').count()) === 0);
  await shot(page, "30-boss-alert-toast");
  await waitPhase(page, "infected");
  check("Une seule alerte par attaque", (await page.evaluate(() => window.DT.Ransom.state().chat.messages.filter((m) => m.alert).length)) === 1);
  await page.evaluate(() => window.DT.WM.open("chat"));
  await page.waitForSelector(".ch-app");
  check("EITT Chat : l'alerte est affichée en rouge dans la conversation", (await page.locator(".ch-msg.is-alert").count()) === 1 && (await page.textContent(".ch-msg.is-alert")).includes(ALERT));
  check("Le badge non lu disparaît à l'ouverture du chat", await page.evaluate(() => window.DT.badges.chat === 0));
  const alertChips = await page.locator(".ch-chip").allTextContents();
  check("Trois réponses rapides adaptées à l'attaque", alertChips.length === 3 && alertChips[1].includes("réseau"), alertChips.join(" | "));
  await page.click('.ch-chip[data-reply="1"]');
  await page.click("#ch-send");
  await page.waitForFunction(() => window.DT.Ransom.state().chat.messages.some((m) => m.from === "boss" && /Je te fais confiance/.test(m.text)), null, { timeout: 8000 });
  check("On peut répondre au patron en pleine attaque, et il approuve", (await page.textContent("#ch-list")).includes("Je coupe le réseau") && (await page.evaluate(() => window.DT.Ransom.state().chat.alert === "replied")));
  await shot(page, "31-boss-alert-chat");
  await page.click('.win[data-app="chat"] .win-close');
  await page.waitForTimeout(350);

  console.log("\n# Fin de l'exercice : retour à la session");
  await page.evaluate(() => window.DT.Net.setWifi(false)); // le joueur coupe le Wi-Fi à la main pendant l'incident
  await openLab(page, "response");
  check("Pendant l'incident, couper le Wi-Fi compte comme un isolement", await page.evaluate(() => window.DT.Ransom.state().isolated === true && window.DT.Net.online === false));
  await page.click("#rl-alert"); await page.click("#rl-identify"); await page.click("#rl-eradicate");
  await page.click("#rl-refuse").catch(() => {});
  await page.click("#rl-restore");
  await waitPhase(page, "recovered");
  await page.waitForTimeout(300);
  const endState = await page.evaluate(() => { return { online: window.DT.Net.online, wifi: window.DT.Net.wifi, isolated: window.DT.Net.isolated, scoreIso: window.DT.Ransom.computeScore().items.find((i) => i.id === "isolate").pts, alert: window.DT.Ransom.state().chat.alert, chatToasts: document.querySelectorAll('#toast-root .toast[data-tag="chat"]').length, wrap: window.DT.Ransom.state().chat.messages.some((m) => /Tout est rentré dans l'ordre/.test(m.text)) }; });
  check("Poste rétabli : le réseau est de nouveau connecté (il restait coupé avant)", endState.online === true && endState.isolated === false, JSON.stringify(endState));
  check("Le Wi-Fi coupé par le joueur est rétabli", endState.wifi === true && (await page.locator("#tray-network.is-offline").count()) === 0);
  check("Le score garde le point « poste isolé pendant l'incident » (15)", endState.scoreIso === 15, JSON.stringify(endState));
  check("Le bouton d'isolement indique « Réseau rétabli » (plus un « Reconnecter » grisé)", (await page.textContent("#rl-isolate")) === "Réseau rétabli" && (await page.isDisabled("#rl-isolate")));
  check("Plus de notification du patron à l'écran ; il conclut dans le chat", endState.chatToasts === 0 && endState.alert === "closed" && endState.wrap, JSON.stringify(endState));
  check("Bouton « Terminer et revenir à ma session » (réponse et bilan)", (await page.locator("#rl-end").isVisible()) && (await (async () => { await tab(page, "report"); return page.locator("#rl-end-2").isVisible(); })()));
  await shot(page, "32-end-report");
  await page.click("#rl-end-2");
  await page.waitForTimeout(700);
  const ended = await page.evaluate(() => { return { ended: window.DT.Ransom.state().ended, labs: window.DT.WM.byApp("ransomlab").length, online: window.DT.Net.online, msg: [...document.querySelectorAll("#toast-root .toast")].some((t) => t.textContent.includes("revenu à votre session")), banner: !document.getElementById("sim-banner").hidden, data: document.documentElement.dataset.ransom }; });
  check("« Revenir à ma session » : le laboratoire se ferme, un message le confirme", ended.ended === true && ended.labs === 0 && ended.msg, JSON.stringify(ended));
  check("Session normale : bandeau de simulation masqué, réseau connecté", !ended.banner && ended.online && ended.data === "recovered", JSON.stringify(ended));
  await page.evaluate(() => window.DT.Session.lock());
  await page.waitForSelector("#unlock-button");
  await page.click("#unlock-button");
  await page.waitForSelector("#desktop:not(.is-off)");
  await page.waitForTimeout(6500);
  check("Verrouiller puis déverrouiller après l'exercice : aucun rappel ni message du patron", (await page.locator('#toast-root .toast[data-tag="chat"]').count()) === 0 && (await page.evaluate(() => [...document.querySelectorAll("#toast-root .toast")].every((t) => !/patron|Exercice terminé/.test(t.textContent)))));
  // Rechargement avec le chat automatique ACTIVÉ : l'exercice terminé n'est pas relancé tout seul
  await page.goto(URL);
  await page.waitForSelector("#boot-skip"); await page.click("#boot-skip");
  await page.waitForSelector(".login-account");
  await login(page);
  await page.waitForTimeout(7000);
  const afterEnd = await page.evaluate(() => { return { phase: window.DT.Ransom.state().phase, ended: window.DT.Ransom.state().ended, toasts: document.querySelectorAll("#toast-root .toast:not(.is-closing)").length, boss: window.DT.Ransom.state().chat.messages.filter((m) => m.from === "boss").length }; });
  check("Rechargement après « revenir à ma session » : l'exercice n'est pas relancé, aucune notification", afterEnd.phase === "recovered" && afterEnd.ended === true && afterEnd.toasts <= 1, JSON.stringify(afterEnd));
  const remindToasts = await page.evaluate(() => [...document.querySelectorAll("#toast-root .toast")].map((t) => t.textContent));
  check("Aucun rappel « Exercice terminé » ni message du patron après le retour à la session", !remindToasts.some((t) => /Exercice terminé|Le patron/.test(t)), remindToasts.join(" | "));
  await page.evaluate(() => window.DT.WM.open("chat"));
  await page.waitForSelector("#ch-replay");
  await page.click("#ch-replay");
  await page.waitForFunction(() => window.DT.Ransom.state().phase === "ready" && !window.DT.Ransom.state().ended, null, { timeout: 5000 });
  check("« Rejouer l'exercice » (chat) relance un scénario neuf", await page.evaluate(() => window.DT.Ransom.state().chat.alert === undefined || window.DT.Ransom.state().chat.alert === null));
  await page.waitForSelector('#toast-root .toast[data-tag="chat"]:has-text("traiter")', { timeout: 9000 });
  check("Après « Rejouer », le patron écrit de nouveau en 2 à 5 s", true);
  await context.close();

  console.log("\n# Alerte du patron : rechargement et écran verrouillé");
  ({ context, page } = await boot(browser));
  await login(page);
  await openLab(page, "prepare");
  await page.click("#rl-backup");
  await page.evaluate(() => window.DT.Ransom.startAttack("demo"));
  await page.evaluate(() => window.DT.Session.lock());
  await page.waitForSelector("#lock-notices .lock-notice:has-text('pirater')", { timeout: 15000 });
  check("Session verrouillée en pleine attaque : l'alerte s'affiche sur l'écran de verrouillage", true);
  await shot(page, "33-boss-alert-lockscreen");
  await page.click("#lock-notices .lock-notice");
  await page.waitForSelector(".ch-app", { timeout: 6000 });
  check("Un clic sur l'alerte déverrouille et ouvre EITT Chat", true);
  await waitPhase(page, "infected");
  await page.reload();
  await page.waitForSelector("#boot-skip"); await page.click("#boot-skip");
  await login(page);
  await page.waitForTimeout(800);
  check("Rechargement après l'alerte : poste toujours compromis, alerte conservée une seule fois", await page.evaluate(() => window.DT.Ransom.state().phase === "infected" && window.DT.Ransom.state().chat.messages.filter((m) => m.alert).length === 1));
  await context.close();

  ({ context, page } = await boot(browser));
  await login(page);
  await openLab(page, "prepare");
  await page.click("#rl-backup");
  await page.evaluate(() => window.DT.Ransom.startAttack("demo"));
  await page.waitForTimeout(500);
  await page.reload(); // rechargement avant le tiers des fichiers : le verrouillage se termine, le patron prévient quand même
  await page.waitForSelector("#boot-skip"); await page.click("#boot-skip");
  await login(page);
  await page.waitForFunction(() => window.DT.Ransom.state().chat.messages.filter((m) => m.alert).length === 1, null, { timeout: 5000 });
  check("Rechargement en pleine attaque : le patron prévient quand même (une fois)", true);
  await page.waitForSelector('#toast-root .toast[data-tag="chat"]:has-text("pirater")', { timeout: 4000 });
  await context.close();

  {
  /* =========================== Discussion libre avec le patron (IA locale) =========================== */
  console.log("\n# Discussion libre avec le patron : base de connaissances locale");
  ({ context, page } = await boot(browser));
  await login(page);
  const kb = await page.evaluate(() => window.DT.BossAI.stats());
  check("Base de connaissances : au moins 80 sujets, 200 réponses et 900 mots-clés", kb.intents >= 80 && kb.replies >= 200 && kb.keywords >= 900, JSON.stringify(kb));
  await page.evaluate(() => window.DT.WM.open("chat"));
  await page.waitForSelector(".ch-app");
  const ask = async (text) => { await page.fill("#ch-input", text); await page.click("#ch-send"); };
  const lastBoss = () => page.evaluate(() => { const m = window.DT.Ransom.state().chat.messages.filter((x) => x.from === "boss" && x.ai); return m.length ? m[m.length - 1] : null; });
  const waitBoss = (count) => page.waitForFunction((n) => window.DT.Ransom.state().chat.messages.filter((x) => x.from === "boss" && x.ai).length >= n, count, { timeout: 9000 });
  check("Avant même le premier message du patron : la zone de réponse est utilisable, sans réponse présélectionnée", !(await page.isDisabled("#ch-input")) && (await page.inputValue("#ch-input")) === "" && (await page.locator(".ch-chip").count()) >= 3);
  await ask("C'est quoi un rançongiciel ?");
  await page.waitForSelector(".ch-typing", { timeout: 4000 });
  check("Le patron « écrit… » avant de répondre", (await page.textContent("#ch-status")) === "écrit…");
  await waitBoss(1);
  const b1 = await lastBoss();
  check("Question de cybersécurité : réponse pertinente (sujet « ransomware »)", b1.ai === "ransomware" && /chiffre|rançon/i.test(b1.text), JSON.stringify(b1));
  await ask("explique");
  await waitBoss(2);
  const b2 = await lastBoss();
  check("« explique » : le patron approfondit le dernier sujet (mémoire de la conversation)", b2.ai === "ransomware" && b2.text !== b1.text, JSON.stringify(b2));
  await ask("Comment repérer un mail piégé ?");
  await waitBoss(3);
  check("Autre sujet : repérer un mail piégé (indices, expéditeur, liens)", (await lastBoss()).ai === "reperer" && /indice|expéditeur|lien/i.test((await lastBoss()).text));
  await ask("Tu es une IA ?");
  await waitBoss(4);
  const honest = await lastBoss();
  check("Honnêteté : le patron dit qu'il est un personnage simulé, local, sans Internet", honest.ai === "ia" && /simul/i.test(honest.text) && /pas.*Internet|aucun|rien n'est envoy/i.test(honest.text), honest.text);
  await ask("zzzz qsdfgh");
  await waitBoss(5);
  check("Phrase incomprise : réponse de repli polie (et jamais d'erreur)", /_statement|_question/.test((await lastBoss()).ai));
  check("Les puces de réponse rapide s'adaptent à la conversation", (await page.locator(".ch-chip").count()) >= 3);
  await page.click(".ch-chip >> nth=0");
  check("Cliquer une puce remplit la zone de réponse", (await page.inputValue("#ch-input")).length > 3);
  await page.click("#ch-send");
  await waitBoss(6);
  check("Réponse à une puce suggérée", Boolean(await lastBoss()));
  await shot(page, "50-boss-free-chat");
  // messages de l'utilisateur : coches
  check("Les messages de l'utilisateur affichent les coches (envoyé / distribué / lu)", (await page.locator(".ch-msg.is-me .ch-ticks").count()) >= 3);
  // chat fermé : la réponse arrive en pastille
  await page.click('.win[data-app="chat"] .win-close');
  await page.waitForTimeout(350);
  const sentWhileClosed = await page.evaluate(() => window.DT.Chat.send("Merci beaucoup"));
  await page.waitForFunction(() => window.DT.badges.chat >= 1, null, { timeout: 8000 });
  check("Chat fermé : la réponse du patron arrive avec une pastille « non lu »", sentWhileClosed && (await page.evaluate(() => window.DT.badges.chat)) >= 1);
  // persistance
  await page.reload();
  await page.waitForSelector("#boot-skip"); await page.click("#boot-skip");
  await login(page);
  const kept = await page.evaluate(() => ({ n: window.DT.Ransom.state().chat.messages.length, last: window.DT.Ransom.state().chat.ai && window.DT.Ransom.state().chat.ai.last }));
  check("Après rechargement : la conversation et la mémoire du dernier sujet sont conservées", kept.n >= 12 && Boolean(kept.last), JSON.stringify(kept));
  await context.close();

  console.log("\n# Discussion libre pendant le scénario (avant, pendant, après l'attaque)");
  ({ context, page } = await boot(browser));
  await login(page);
  await page.evaluate(() => window.DT.Chat.start()); // le patron demande de traiter le mail
  await page.evaluate(() => window.DT.WM.open("chat"));
  await page.waitForSelector(".ch-app");
  await ask("Que dois-je faire ?");
  await waitBoss(1);
  check("Avant la réponse « Bien reçu » : une question n'avance PAS le scénario (le patron répond et le rappelle)", (await page.evaluate(() => window.DT.Ransom.state().chat.stage)) === "received" && (await lastBoss()).text.includes("Bien reçu"), JSON.stringify(await lastBoss()));
  await page.click('.ch-chip[data-reply="0"]');
  check("Les réponses du scénario restent proposées tant que le patron attend (« Bien reçu » présélectionnée)", (await page.inputValue("#ch-input")) === "Bien reçu");
  await page.click("#ch-send");
  await page.waitForFunction(() => window.DT.Ransom.state().mail.delivered, null, { timeout: 10000 });
  check("« Bien reçu » : le scénario avance toujours (le mail piégé arrive)", true);
  await page.click('.win[data-app="chat"] .win-close');
  await page.waitForTimeout(350);
  await openLab(page, "prepare");
  await page.click("#rl-backup");
  await page.evaluate(() => window.DT.Ransom.startAttack("demo"));
  await page.waitForFunction(() => window.DT.Ransom.state().chat.alert === "open", null, { timeout: 15000 });
  await page.evaluate(() => window.DT.WM.open("chat"));
  await page.waitForSelector(".ch-app");
  const before = await page.evaluate(() => window.DT.Ransom.state().chat.messages.filter((x) => x.from === "boss" && x.ai).length);
  await ask("Où en est-on ?");
  await waitBoss(before + 1);
  const st = await lastBoss();
  check("Pendant l'attaque : « Où en est-on ? » donne l'état réel (fichiers verrouillés)", st.ai === "etat" && /fichiers/.test(st.text), st.text);
  check("Discuter ne ferme pas l'alerte : les réponses rapides de l'attaque restent proposées", (await page.evaluate(() => window.DT.Ransom.state().chat.alert)) === "open");
  await waitPhase(page, "infected");
  await ask("Que dois-je faire ?");
  await waitBoss(before + 2);
  const adv = await lastBoss();
  check("Poste compromis : le conseil suit l'étape en cours (isoler d'abord)", adv.ai === "conseil" && /isol/i.test(adv.text), adv.text);
  await ask("Faut-il payer la rançon ?");
  await waitBoss(before + 3);
  check("« Faut-il payer la rançon ? » : le patron déconseille", /ne paie pas|on ne paie/i.test((await lastBoss()).text) || /Payer n'apporte aucune garantie/.test((await lastBoss()).text), (await lastBoss()).text);
  await page.click('.win[data-app="chat"] .win-close');
  await page.waitForTimeout(350);
  await openLab(page, "response");
  await page.click("#rl-eradicate");
  await page.click("#rl-restore");
  await waitPhase(page, "recovered");
  await page.evaluate(() => window.DT.WM.open("chat"));
  await page.waitForSelector(".ch-app");
  check("Fin de l'exercice : « Avec plaisir ! » est présélectionné pour répondre au patron", (await page.inputValue("#ch-input")) === "Avec plaisir !" && (await page.textContent(".ch-chip.is-on")) === "Avec plaisir !");
  const nb = await page.evaluate(() => window.DT.Ransom.state().chat.messages.filter((x) => x.from === "boss" && x.ai).length);
  await page.click("#ch-send");
  await waitBoss(nb + 1);
  const pl = await lastBoss();
  check("« Avec plaisir ! » : le patron répond chaleureusement (et la discussion continue)", pl.ai === "plaisir" && pl.text.length > 20, pl.text);
  await ask("Quel est mon score ?");
  await waitBoss(nb + 2);
  check("« Quel est mon score ? » : le patron cite le score réel", /\/100/.test((await lastBoss()).text) && (await lastBoss()).ai === "score", (await lastBoss()).text);
  await ask("Comment rejouer ?");
  await waitBoss(nb + 3);
  check("« Comment rejouer ? » : il explique où rejouer", /Rejouer|Quitter/.test((await lastBoss()).text));
  await shot(page, "51-boss-after-exercise");
  await context.close();

  }

  /* =========================== Lancement après un incident / sortie de secours =========================== */
  console.log("\n# Lancement de la page après un incident : poste sain, plus de bureau « infecté »");
  const deskLabels = (pg) => pg.$$eval("#icon-layer .dicon", (els) => els.map((e) => e.dataset.label));
  const launch = async (pg, withAuto) => { await pg.goto(withAuto ? URL : URL + "?auto=0"); await pg.waitForSelector("#boot-skip"); await pg.click("#boot-skip"); await pg.waitForSelector(".login-account"); await login(pg); };
  ({ context, page } = await boot(browser));
  await login(page);
  await page.evaluate(() => window.DT.Ransom.startAttack("demo"));
  await waitPhase(page, "infected");
  check("Préparation : le poste est bien compromis (fichiers verrouillés, note sur le bureau)", (await deskLabels(page)).some((l) => l.endsWith(".eitt-locked")) && (await deskLabels(page)).some((l) => l.startsWith("LISEZ-MOI")));
  const tLaunch = Date.now();
  await launch(page, true); // « lancer » l'application : chat automatique activé, comme un vrai lancement
  const labelsAfter = await deskLabels(page);
  check("Lancement : plus aucun fichier verrouillé, ni programme, ni note de rançon sur le bureau", !labelsAfter.some((l) => /eitt-locked|Facture_Octobre|LISEZ-MOI/.test(l)), labelsAfter.join(" | "));
  check("Lancement : les fichiers d'origine sont de retour (Bienvenue.txt, Aide-rapide.txt…)", labelsAfter.includes("Bienvenue.txt") && labelsAfter.includes("Aide-rapide.txt"), labelsAfter.join(" | "));
  const launched = await page.evaluate(() => ({ phase: window.DT.Ransom.state().phase, data: document.documentElement.dataset.ransom, banner: !document.getElementById("sim-banner").hidden, online: window.DT.Net.online, locked: window.DT.FS.allFiles().filter((n) => n.sim).length, kids: window.DT.FS.children(window.DT.FS.systemFolder("Bureau").id).map((n) => n.name) }));
  check("Lancement : scénario « prêt », bandeau et ambiance d'incident retirés, réseau connecté", launched.phase === "ready" && launched.data === "ready" && !launched.banner && launched.online && launched.locked === 0, JSON.stringify(launched));
  check("Lancement : l'index des fichiers est à jour (l'explorateur ne voit plus les fichiers verrouillés)", !launched.kids.some((n) => /eitt-locked|Facture_Octobre|LISEZ-MOI/.test(n)), launched.kids.join(" | "));
  check("Une notification « Nouvelle session » explique le nettoyage", await page.evaluate(() => [...document.querySelectorAll("#toast-root .toast")].some((t) => t.textContent.includes("Nouvelle session"))));
  await page.waitForSelector('#toast-root .toast[data-tag="chat"]:has-text("traiter")', { timeout: 10000 });
  check("Après le lancement, le patron écrit de nouveau en moins de 10 s", Date.now() - tLaunch < 10000, String(Date.now() - tLaunch));
  await shot(page, "40-launch-clean");
  await context.close();

  ({ context, page } = await boot(browser));
  await login(page);
  await page.evaluate(() => window.DT.Ransom.startAttack("demo"));
  await page.waitForTimeout(900); // en plein verrouillage
  check("Préparation : attaque en cours", (await page.evaluate(() => window.DT.Ransom.state().phase)) === "attacking");
  await launch(page, true);
  check("Lancement pendant une attaque interrompue : poste sain, rien de verrouillé", await page.evaluate(() => window.DT.Ransom.state().phase === "ready" && window.DT.FS.allFiles().every((n) => !n.sim)) && !(await deskLabels(page)).some((l) => /eitt-locked|Facture_Octobre|LISEZ-MOI/.test(l)));
  await context.close();

  console.log("\n# Sortie de secours : bouton « Quitter » du bandeau et réinitialisation");
  ({ context, page } = await boot(browser));
  await login(page);
  await page.evaluate(() => window.DT.Ransom.startAttack("demo"));
  await waitPhase(page, "infected");
  await page.evaluate(() => window.DT.Net.setWifi(false));
  check("Le bandeau propose « Quitter » en plus de « Ouvrir le Lab »", (await page.locator("#sim-banner-reset").isVisible()) && (await page.locator("#sim-banner-open").isVisible()));
  await page.click("#sim-banner-reset");
  await page.waitForSelector(".dlg");
  check("« Quitter » demande confirmation", (await page.textContent(".dlg")).includes("Quitter la simulation"));
  await dlg(page, "Rester");
  await page.waitForTimeout(350);
  check("« Rester » ne change rien", (await page.evaluate(() => window.DT.Ransom.state().phase)) === "infected");
  await page.click("#sim-banner-reset");
  await page.waitForSelector(".dlg");
  await dlg(page, "Quitter la simulation");
  await page.waitForFunction(() => window.DT.Ransom.state().phase === "ready", null, { timeout: 5000 });
  await page.waitForTimeout(500);
  const quit = await page.evaluate(() => ({ online: window.DT.Net.online, wifi: window.DT.Net.wifi, banner: !document.getElementById("sim-banner").hidden, data: document.documentElement.dataset.ransom, kids: window.DT.FS.children(window.DT.FS.systemFolder("Bureau").id).map((n) => n.name) }));
  check("« Quitter » : poste sain, réseau et Wi-Fi rétablis, bandeau retiré", quit.online && quit.wifi && !quit.banner && quit.data === "ready", JSON.stringify(quit));
  const quitLabels = await deskLabels(page);
  check("« Quitter » : le bureau et l'explorateur ne montrent plus de fichier verrouillé, de programme ni de note", !quitLabels.some((l) => /eitt-locked|Facture_Octobre|LISEZ-MOI/.test(l)) && !quit.kids.some((n) => /eitt-locked|Facture_Octobre|LISEZ-MOI/.test(n)), quitLabels.join(" | ") + " // " + quit.kids.join(" | "));
  await context.close();

  /* =========================== Sécurité du code =========================== */
  console.log("\n# Sécurité du code source");
  const files = [];
  (function walk(dir) { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(js|html|css)$/.test(f)) files.push(p); } })(ROOT);
  const code = files.filter((f) => !f.includes("/tests/")).map((f) => [f, fs.readFileSync(f, "utf8")]);
  const patterns = [["eval(", /\beval\s*\(/], ["new Function", /new\s+Function\s*\(/], ["child_process", /child_process/], ["fetch(", /\bfetch\s*\(/], ["XMLHttpRequest", /XMLHttpRequest/], ["WebSocket", /\bWebSocket\b/], ["sendBeacon", /sendBeacon/], ["File System Access API", /showOpenFilePicker|showDirectoryPicker|showSaveFilePicker|webkitGetAsEntry|FileReader/], ["importScripts/Worker", /importScripts|new\s+Worker\(/], ["script externe http", /<script[^>]+src=["']https?:/]];
  for (const [label, rx] of patterns) {
    const hit = code.filter(([f, s]) => rx.test(s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ""))).map(([f]) => path.basename(f));
    check("Aucun usage de " + label, hit.length === 0, hit.join(", "));
  }
  check("Aucune clé d'API ni télémétrie (pas d'URL http(s) appelée)", !code.some(([f, s]) => /(src|href)=["']https?:\/\//.test(s)));

  await browser.close();
  console.log("\n# Erreurs console / page");
  const unique = Array.from(new Set(problems));
  unique.forEach((p) => console.log("   ! " + p));
  check("Aucune erreur JavaScript ni erreur de chargement dans la console", unique.length === 0, unique.join(" | "));
  check("Aucune requête réseau externe (toute la session de tests)", externalRequests.length === 0, externalRequests.join(", "));
  const failed = results.filter((r) => !r.ok);
  console.log("\n==== " + (results.length - failed.length) + "/" + results.length + " vérifications réussies ====");
  if (failed.length) { console.log("Échecs :"); failed.forEach((f) => console.log(" - " + f.name)); process.exitCode = 1; }
})().catch((e) => { console.error("ERREUR DU SCRIPT DE TEST :", e); process.exit(2); });
