# EITT Ransomware Lab

**Un ordinateur virtuel pour comprendre une attaque par rançongiciel — sans aucun risque.**
Un outil pédagogique du projet **EITT — Enseignement Informatique pour Toutes et Tous**.

Application 100 % statique : HTML5, CSS3 et JavaScript « vanilla ». Aucune bibliothèque, aucune base de données, aucune API externe, aucun compte réel. Ouvrez simplement `index.html` dans un navigateur récent (Chrome, Edge, Firefox, Safari), ou publiez le dossier sur n'importe quel hébergement web classique.

## ⚠️ Ce qui est simulé (et ce qui ne l'est pas)

- **Tout est virtuel.** Les fichiers, dossiers, corbeille, applications et « disque » n'existent que dans la mémoire de la page et dans le stockage local de votre navigateur (`localStorage`, clés `eitt-ransomware-lab:*`). Ce ne sont **pas** de vrais fichiers de votre ordinateur.
- **Aucun vrai fichier n'est lu, modifié ni chiffré.** L'application n'utilise aucune API d'accès aux fichiers du navigateur.
- **Le « chiffrement » est une mise en scène.** Le contenu d'origine d'un fichier virtuel est simplement mis de côté, remplacé par un texte illisible et renommé en `.eitt-locked` ; la restauration le remet en place. Il n'y a aucune cryptographie réelle, aucune clé, aucun programme exécutable.
- **Aucun paiement possible.** Le montant, le compte à rebours et l'« adresse de paiement » de la note de rançon sont fictifs.
- **Rien ne quitte votre navigateur** : aucune requête réseau, aucune télémétrie, aucune clé d'API. L'« isolement du réseau » est lui aussi simulé et ne touche pas à votre vraie connexion.
- **Arrêt, redémarrage, veille et verrouillage** ne concernent que cette page, jamais votre vrai ordinateur.
- Le code n'utilise ni `eval`, ni `new Function`, ni exécution de code importé (vérifié par les tests).

## Connexion

**Aucun mot de passe.** L'écran de connexion propose deux sessions fictives, **Utilisateur** et **Utilisatrice** (chacune avec son nom et son avatar) : un clic (ou la touche Entrée) sur la session et le bureau s'ouvre. Le dernier compte utilisé est mis en avant. Ces comptes ne sont liés à aucun compte réel. Le verrouillage de session se lève lui aussi d'un clic sur « Déverrouiller ». Une sauvegarde créée avec une version précédente est mise à niveau automatiquement (compte Utilisatrice et application EITT Chat ajoutés, fichiers conservés).

## EITT OS : le bureau virtuel

Écran de connexion avec logo EITT, fond d'écran EITT, icônes et raccourcis, barre des tâches, menu Démarrer avec recherche, **horloge en temps réel (HH:MM:SS)**, **calendrier** (clic sur l'heure), centre de notifications, verrouillage de session, arrêt/redémarrage/veille simulés, corbeille, paramètres (thème, couleur, fond d'écran).

**Zone de notification de la barre des tâches** (de gauche à droite) : **sécurité** (bouclier vert, qui passe au rouge pendant l'incident), **langue du clavier** (FRA / ENG, avec menu), **réseau**, **volume** (molette de la souris possible), **batterie** et notifications. La batterie est **lue en direct** auprès du navigateur (API « Battery Status », Chrome et Edge) : pourcentage exact au pour cent près, jauge dessinée, **éclair vert quand l'appareil est en charge**, temps de charge restant (« complète dans 25 min ») ou autonomie (« sur batterie · 2 h 00 »), alerte rouge sous 20 %. Elle se met à jour à chaque changement et le détail est donné dans l'info-bulle et dans le panneau rapide. Si le navigateur ne fournit pas la batterie (Firefox, Safari), une valeur fictive qui évolue est affichée et signalée « simulée ». Le réseau, le volume et la batterie ouvrent le panneau **Paramètres rapides** : Wi-Fi, Bluetooth, mode avion, économiseur de batterie, mode nuit, thème clair/sombre, curseurs de luminosité et de volume, bouton « Couper le son ». **Tous ces réglages sont simulés** : ils ne modifient ni le clavier, ni le son, ni la luminosité, ni le Wi-Fi de votre vrai ordinateur. Pendant un incident, couper le Wi-Fi ou activer le mode avion compte comme un **isolement du poste**.

Fenêtres déplaçables, redimensionnables, réductibles, agrandissables et fermables, avec mise au premier plan au clic et restauration depuis la barre des tâches.

Applications : **Ransomware Lab**, **EITT Chat** (messagerie), Explorateur de fichiers (créer, renommer, déplacer, copier, supprimer, restaurer depuis la corbeille, glisser-déposer), Bloc-notes, Terminal pédagogique (commandes simulées), Navigateur avec sites fictifs, Téléchargements, Gestionnaire des tâches, État du PC, Paramètres.

## EITT Chat : le point de départ du scénario

**2 à 5 secondes après l'ouverture de la session** (ou après son **verrouillage**), **le patron écrit** dans EITT Chat. Il arrive **sous forme de notification** — la fenêtre ne s'ouvre pas toute seule — avec un petit son et une pastille « 1 » sur l'icône EITT Chat de la barre des tâches : *« Nous avons reçu un mail, tu dois le traiter. »*

- **EITT Chat est épinglé dans la barre des tâches** (2e icône, après le Ransomware Lab), sur le bureau et dans le menu Démarrer. Une ancienne sauvegarde est mise à niveau automatiquement.
- **Sur le bureau virtuel** : une **bannière « Le patron »** apparaît en bas à droite, avec deux boutons : **Bien reçu** (la réponse part en un clic, la messagerie s'ouvre pour suivre l'échange) et **Ouvrir le chat**. Elle reste affichée tant qu'on ne l'a pas lue et n'est jamais chassée par d'autres notifications. Une **pastille rouge « 1 »** s'affiche aussi sur l'icône EITT Chat du bureau (qui sautille), sur celle de la barre des tâches et sur la cloche.
- **Sur l'écran de verrouillage** : la même notification s'affiche sous le bouton « Déverrouiller » ; un clic dessus déverrouille la session et ouvre la messagerie.
- **À l'ouverture de la page**, on repart toujours d'une situation où le patron peut écrire : si l'exercice précédent est **terminé** (poste rétabli ou attaque évitée), une **nouvelle simulation** démarre toute seule ; si l'échange est terminé mais que le mail piégé n'a pas été traité, le patron **réécrit**. Une attaque en cours n'est jamais touchée. Un filet de sécurité garantit qu'une notification arrive toujours moins de 10 secondes après l'ouverture de la session.
- **Dans EITT Chat**, si rien n'est arrivé, le chat l'explique et propose toujours un bouton : **« Recevoir le message du patron »** ou **« Rejouer l'exercice »** (zone de réponse jamais « bloquée » sans issue). Ouvrir le chat alors que rien n'est arrivé fait écrire le patron dans la seconde.

Dans la messagerie, la réponse **« Bien reçu » est présélectionnée** ; deux autres réponses rapides sont proposées (« Je m'en occupe tout de suite », « Je vérifie l'expéditeur avant de l'ouvrir ») et le texte reste modifiable. En cliquant sur **Envoyer**, les coches passent de « envoyé » à « distribué » puis « lu », le patron « écrit… » et répond, puis **le message piégé arrive dans la messagerie du Lab : la simulation est lancée**.

- On peut aussi la lancer à la main : bouton **« Lancer la simulation »** (onglet Mission du Lab) ou depuis l'onglet Messagerie ; la messagerie s'ouvre alors immédiatement.
- Pour désactiver le message automatique (cours, démonstration, tests), ouvrez la page avec **`index.html?auto=0`**.
- Si la page est rechargée en plein échange, la suite est menée à terme proprement.

### Discuter librement avec le patron (« IA » locale)

La zone de réponse d'EITT Chat est **toujours utilisable** : avant le premier message du patron, pendant l'attaque, après l'exercice. Il répond à tout, avec un petit délai (coches « envoyé / distribué / lu », puis « écrit… »). Exemples : « Avec plaisir ! » à la fin de l'exercice (présélectionné quand il conclut), « C'est quoi un rançongiciel ? », « Faut-il payer la rançon ? », « Où en est-on ? », « Que dois-je faire ? », « Comment repérer un mail piégé ? », « explique », « pourquoi ? »…

- **Ce n'est pas un vrai modèle d'IA** : c'est un moteur de réponses **100 % local** (`js/boss-ai.js`) qui s'appuie sur une base de connaissances (`data/boss-knowledge.js`, **91 sujets, environ 980 mots-clés et plus de 200 variantes de réponses** : conversation courante, équipe et organisation, scénario, cybersécurité, informatique générale, aide sur l'application). Il normalise la phrase (minuscules, sans accents), note chaque sujet, retient le dernier sujet pour « explique / pourquoi ? », et ne répète pas une variante déjà utilisée. Le patron le dit lui-même si on lui demande s'il est une IA.
- **Il connaît l'état du scénario** : « Où en est-on ? » donne le nombre de fichiers verrouillés et les étapes faites ; « Que dois-je faire ? » propose l'étape suivante (isoler, alerter, analyser, décider pour la rançon, nettoyer, restaurer) ; « Quel est mon score ? » cite le score réel et le point à améliorer.
- **Le scénario n'est pas perturbé** : tant que le patron attend un accusé de réception (« Bien reçu », « Compris »…), une question reçoit une réponse mais n'avance pas le scénario ; l'accusé de réception, lui, le fait avancer comme avant.
- **Rien ne quitte la page** : aucune API, aucune clé, aucune connexion. C'est un choix : un vrai modèle de langage exigerait un serveur ou une clé d'API (visible dans le code de la page) et romprait la garantie « aucune requête réseau ». Pour étendre les connaissances, ajoutez des entrées dans `data/boss-knowledge.js` (le format est expliqué en tête du fichier).
- La conversation et la mémoire du dernier sujet sont conservées avec le scénario (rechargement compris) et remises à zéro par « Rejouer ».

### Le patron prévient en pleine attaque

Quand un tiers des fichiers est déjà verrouillé, **le patron écrit de nouveau** : *« On se fait pirater ! Agis calmement mais intelligemment ! »*. Même mécanique que le premier message, mais plus pressante :

- **notification persistante rouge** (elle reste jusqu'au clic) avec les boutons **Ouvrir le chat** et **Ouvrir le Lab**, son d'alerte à trois notes, pastille « 1 » sur l'icône EITT Chat ;
- **session verrouillée** : la même alerte s'affiche sur l'écran de verrouillage ; un clic déverrouille et ouvre le chat ;
- **dans EITT Chat** : la bulle est rouge ; trois réponses rapides (« Compris, je garde mon calme », « Je coupe le réseau et j'alerte la sécurité », « Je ne paierai rien… »), le patron approuve brièvement. Les fenêtres ne s'ouvrent pas toutes seules ;
- **une seule fois par attaque**, y compris si la page est rechargée en pleine attaque (le patron prévient alors au retour). La demande initiale (« mail à traiter ») disparaît dès que l'attaque démarre, pour ne pas laisser deux notifications contradictoires.

### Fin de l'exercice : revenir à sa session

Quand le poste est rétabli :

- **le réseau est reconnecté** (avant, il restait coupé et le bouton « Reconnecter » était grisé). Le Wi-Fi ou le mode avion coupés par le joueur pendant l'incident sont aussi rétablis ; le point « poste isolé » du score est conservé ;
- la notification du patron disparaît et il **conclut dans le chat** ;
- le bouton **« Terminer et revenir à ma session »** (onglets Réponse et Bilan, et sur la notification « Poste rétabli ») ferme le laboratoire et supprime tout rappel. L'exercice n'est alors **plus relancé tout seul** au rechargement ; il reste rejouable depuis le Bilan (« Rejouer le scénario »), depuis EITT Chat (« Rejouer l'exercice ») ou en réinitialisant ;
- sans cliquer sur ce bouton, le comportement précédent est conservé : à la prochaine ouverture de la page, un exercice terminé repart de zéro.
- **Correctif important** : après « Rejouer », « Réinitialiser » ou « Quitter », l'index interne des fichiers n'était pas rafraîchi : le bureau et l'explorateur continuaient d'afficher les fichiers verrouillés, le programme et la note de rançon alors que le scénario était remis à zéro. C'est corrigé.
- **EITT Chat est une application générique créée pour ce laboratoire** : ce n'est pas WhatsApp et elle n'en reprend ni le nom, ni le logo, ni la charte. Aucun message réel n'est envoyé ni reçu.

## Ransomware Lab : le scénario

1. **Mission** : objectifs et principe d'une attaque.
2. **Préparer** : créer une sauvegarde — *hors ligne* (protégée) ou *sur le même ordinateur* (elle sera verrouillée aussi) — et découvrir les bons réflexes (règle 3-2-1, mises à jour, droits limités…).
3. **Messagerie** : trois messages (le message piégé n'arrive qu'après la réponse au patron) ; l'un est un hameçonnage (domaine suspect, urgence, salutation générique, pièce jointe `.pdf.exe`). Vous pouvez l'**analyser**, le **signaler**, le **supprimer**… ou **ouvrir la pièce jointe**. Un mode démonstration lance l'attaque pour voir ce qui aurait pu arriver.
4. **Incident** : les fichiers virtuels se verrouillent un à un (barre de progression, journal), le bureau passe en ambiance d'alerte avec un bandeau « SIMULATION », une note de rançon fictive apparaît (sur le bureau et dans le Lab) et vous décidez de payer ou non.
5. **Réponse** : isoler le poste, alerter, analyser les journaux, supprimer le programme malveillant, puis restaurer. Restaurer *avant* de nettoyer provoque une **réinfection** ; une sauvegarde faite sur le même ordinateur est inutilisable ; sans sauvegarde, rien n'est récupérable.
6. **Bilan** : score sur 100 par critère, chronologie des événements, points à retenir. **Réinitialiser** remet le poste exactement dans son état d'origine pour rejouer.

| Critère | Points |
| --- | --- |
| Sauvegarde avant l'attaque (hors ligne 25 / locale 5) | 25 |
| Message piégé repéré (signalé 15 / supprimé 10) | 15 |
| Poste isolé du réseau | 15 |
| Rançon non payée | 10 |
| Responsable sécurité alerté | 5 |
| Source de l'attaque identifiée | 5 |
| Programme supprimé avant la restauration | 10 |
| Fichiers restaurés | 15 |

**Au lancement de la page**, un incident laissé par la visite précédente (attaque en cours ou poste compromis) est **nettoyé automatiquement** : fichiers d'origine, réseau, notifications, et le patron écrit de nouveau (un message « Nouvelle session » l'explique). Le bureau ne s'ouvre donc plus sur la note de rançon. Avec **`index.html?auto=0`** (démonstrations, tests), l'état est conservé tel quel, y compris après rechargement. Pendant un incident, le bandeau rouge propose **« Quitter »** : le poste revient à son état d'origine après confirmation.

## Identité visuelle

Fond noir bleuté, cyan EITT `#16DDF3` issu du logo, bordures fines, transparence maîtrisée. Le logo EITT (extrait de la vidéo fournie) est utilisé à l'écran de démarrage (vidéo animée, avec image de secours), à l'écran de connexion, au menu Démarrer, en veille et comme icône d'onglet. Les fichiers sont dans `assets/logo/`. L'application « Ransomware Lab » utilise un rouge-rose volontairement distinct pour signaler son caractère « alerte ».

## Structure

```
index.html            Page unique
css/                  style.css (base), desktop.css, applications.css, ransomware.css (connexion, Lab, incident)
data/                 initial-files.js (fichiers virtuels), websites.js (sites fictifs), boss-knowledge.js (base de connaissances du patron)
js/
  utils.js, icons.js, filesystem.js, persistence.js, ui.js, notifications.js, window-manager.js   Noyau
  explorer.js, notepad.js, terminal.js, browser.js, sites.js, downloads.js, viewer.js,
  settings.js, system-monitor.js                                                                   Applications
  desktop.js, tray.js (zone de notification, panneau rapide, calendrier, son), session.js        Bureau et session
  chat.js             EITT Chat : le patron écrit, « Bien reçu », alerte en pleine attaque, conclusion, discussion libre
  boss-ai.js          « IA » locale du patron : moteur de réponses à base de connaissances (aucun réseau)
  ransomware.js       Simulation d'attaque et application Ransomware Lab
  app.js              Démarrage
assets/logo/          Logo EITT
tests/                Tests de bout en bout (facultatif)
```

Les modules s'enregistrent par `DT.WM.registerApp({ id, title, tile, size, singleton, create(ctx) })` : ajouter une application ou un nouveau scénario ne demande pas de toucher au noyau. Les textes du scénario (messages, indices, barème) sont en tête de `js/ransomware.js`.

## Tests réalisés

Un script automatisé (Playwright + Chromium, ouverture en `file://`, dossier `tests/`) joue le parcours complet : **333 vérifications réussies sur 333**, sans erreur dans la console et **sans aucune requête réseau externe**. Il couvre la connexion (deux sessions en un clic, aucun champ de mot de passe, clavier, chargement, mise à niveau d'une ancienne sauvegarde), la batterie en direct (niveau, charge, débranchement, batterie faible, sans API), le bureau (horloge qui avance, calendrier, batterie, notifications, menu Démarrer, modules de la barre des tâches (clavier FRA/ENG, volume et son coupé, luminosité, mode nuit, Wi-Fi, mode avion, thème, sécurité), EITT Chat (discussion libre avec le patron : sujets de cybersécurité, état du scénario, « Avec plaisir ! », mémoire de conversation, rechargement ; icône dans la barre des tâches, notification en 2 à 5 s à la connexion et au verrouillage, réponse « Bien reçu » en un clic depuis la notification, alerte « On se fait pirater ! » en pleine attaque (notification persistante, écran verrouillé, réponse, rechargement), fin d'exercice (réseau et Wi-Fi rétablis, bouton « Terminer et revenir à ma session », pas de relance au rechargement), relance automatique après un ancien exercice terminé, pastille sur l'icône du bureau, chat « en attente » avec bouton d'action, mise à niveau des anciennes sauvegardes, notification sur l'écran de verrouillage, réponse présélectionnée, réponses rapides, double clic, rechargement en plein échange), fenêtres : déplacer, réduire, agrandir, fermer, premier plan, restauration), les opérations de fichiers virtuels, le verrouillage de session, tout le scénario (évitement, attaque, réinfection, nettoyage, restauration fidèle octet pour octet des noms et contenus, score), les cas d'échec (sauvegarde locale perdue, aucune sauvegarde, rançon payée), la persistance après rechargement, l'affichage mobile (390 px : connexion, panneau rapide, chat), les animations réduites, l'accessibilité de base et une analyse du code source (aucun `eval`, `fetch`, `XMLHttpRequest`, API de fichiers du navigateur…).

**Non testé :** Firefox et Safari, vrais appareils tactiles, lecteurs d'écran (NVDA, VoiceOver…). Un test manuel est recommandé avant une diffusion large.

## Limites

- Les explications sont volontairement simplifiées ; à faire relire par un enseignant ou un spécialiste avant diffusion officielle.
- Les modules de la barre des tâches (clavier, volume, luminosité, Wi-Fi, Bluetooth…) sont des **simulations** : seule la batterie peut être réelle (en direct, si votre navigateur la fournit). Le son est de courts bips générés par le navigateur, au volume du curseur simulé.
- Un seul scénario d'attaque (hameçonnage → rançongiciel) ; le code est prévu pour en ajouter d'autres.
- Le cahier des charges reçu s'arrêtait au §5 (horloge) : les applications, le scénario et le barème ont été déduits des priorités du §1. Envoyez la suite pour ajuster.
- Ce laboratoire est une simulation pédagogique : il ne remplace ni une formation, ni une certification, ni l'avis d'un professionnel en cas d'incident réel (cybermalveillance.gouv.fr).

## Données et vie privée

Tout est conservé localement dans votre navigateur. Le bouton « Réinitialiser » du Lab ou la réinitialisation dans Paramètres efface la simulation. Effacer les données du site dans le navigateur la remet aussi à zéro.
