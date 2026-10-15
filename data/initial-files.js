/*
 * EITT OS — Arborescence initiale du système de fichiers virtuel.
 *
 * Ces données sont écrites en JavaScript (et non en .json) pour que l'application fonctionne
 * en ouvrant directement index.html : les navigateurs bloquent souvent fetch() sur file://.
 *
 * Format d'un nœud :
 *   dossier : { type: "folder", name, children: [...] }
 *   fichier : { type: "file", name, content }                    -> fichier texte
 *             { type: "file", name, art, artKind, size }         -> contenu de démonstration (image, audio, vidéo)
 * Les 6 dossiers de premier niveau sont les dossiers système : ils ne peuvent être ni supprimés, ni renommés.
 */
window.DT = window.DT || {};
DT.Data = DT.Data || {};

DT.Data.initialFiles = {
  folders: [
    {
      type: "folder",
      name: "Bureau",
      children: [
        {
          type: "file",
          name: "Bienvenue.txt",
          content:
            "Bienvenue dans EITT OS !\n\n" +
            "Ceci est une simulation pédagogique d'un ordinateur de bureau, réalisée par EITT —\n" +
            "Enseignement Informatique pour Toutes et Tous.\n\n" +
            "Ce que vous pouvez faire ici :\n" +
            "  • Double-cliquer sur une icône pour l'ouvrir.\n" +
            "  • Déplacer les icônes et les fenêtres avec la souris (ou le doigt).\n" +
            "  • Faire un clic droit (ou un appui long sur écran tactile) pour ouvrir un menu.\n" +
            "  • Créer, renommer, déplacer, copier et supprimer des fichiers dans l'Explorateur.\n" +
            "  • Restaurer un élément depuis la Corbeille.\n" +
            "  • Écrire dans le Bloc-notes, puis enregistrer votre document.\n" +
            "  • Essayer les commandes du Terminal pédagogique (tapez « help »).\n" +
            "  • Visiter des sites fictifs dans le Navigateur : eitt.local, technews.local…\n\n" +
            "Important : tout ce que vous faites reste dans votre navigateur. Les fichiers créés ici\n" +
            "ne sont PAS de vrais fichiers de votre ordinateur, et rien n'est envoyé sur Internet.\n"
        },
        {
          type: "file",
          name: "Aide-rapide.txt",
          content:
            "AIDE RAPIDE\n===========\n\n" +
            "Menu Démarrer ........ bouton EITT en bas à gauche\n" +
            "Verrouiller .......... menu Démarrer > icône cadenas\n" +
            "Arrêter / Redémarrer . menu Démarrer > icône marche/arrêt (simulation uniquement)\n" +
            "Paramètres ........... fond d'écran, thème, couleur, profil, réinitialisation\n" +
            "Gestionnaire des tâches pour voir les indicateurs (réels ou simulés : c'est précisé)\n\n" +
            "Astuce : sur écran tactile, touchez une icône pour l'ouvrir et maintenez le doigt pour\n" +
            "afficher son menu.\n"
        },
        {
          type: "file",
          name: "Mission-Ransomware-Lab.txt",
          content:
            "MISSION — EITT RANSOMWARE LAB\n" +
            "=============================\n\n" +
            "Vous êtes l'utilisateur d'un petit poste de travail fictif. Votre mission :\n" +
            "  1. Préparer le poste (faire une sauvegarde, vérifier ses bonnes pratiques).\n" +
            "  2. Lire la messagerie avec prudence.\n" +
            "  3. En cas d'incident, réagir dans le bon ordre : isoler, alerter, comprendre, nettoyer, restaurer.\n\n" +
            "Ouvrez l'application « Ransomware Lab » (icône rouge et rose sur le bureau).\n\n" +
            "RAPPEL : tout est simulé. Les fichiers de cette page sont virtuels, conservés uniquement dans votre\n" +
            "navigateur. Aucun vrai fichier de votre ordinateur n'est lu, modifié ou chiffré.\n"
        }
      ]
    },
    {
      type: "folder",
      name: "Documents",
      children: [
        {
          type: "file",
          name: "Rapport-annuel.txt",
          content:
            "RAPPORT ANNUEL 2026 (document fictif)\n" +
            "=====================================\n\n" +
            "Activité : formation à l'informatique pour toutes et tous.\n" +
            "Participants accompagnés : 412 (donnée fictive).\n" +
            "Ateliers réalisés : 38.\n\n" +
            "Objectifs de l'année prochaine :\n" +
            "  - ouvrir deux nouveaux ateliers de cybersécurité,\n" +
            "  - former tous les bénévoles aux bons réflexes face au hameçonnage,\n" +
            "  - mettre en place une sauvegarde hors ligne hebdomadaire.\n"
        },
        {
          type: "file",
          name: "Projet-site-web.txt",
          content:
            "Projet : refonte du site web de l'association (fictif)\n\n" +
            "- Maquettes validées le 12 septembre.\n" +
            "- Rédaction des pages : en cours.\n" +
            "- Mise en ligne prévue : décembre.\n"
        },
        {
          type: "folder",
          name: "Comptabilité",
          children: [
            {
              type: "file",
              name: "Budget-2026.csv",
              content: "poste;prévu;réalisé\nMatériel;4200;3890\nFormation;2600;2715\nCommunication;900;640\nSécurité informatique;1200;310\n"
            },
            {
              type: "file",
              name: "Factures-clients.csv",
              content: "numéro;client;montant;statut\nF-2026-081;Association Les Lucioles;320;payée\nF-2026-082;Mairie de Valmont;1450;payée\nF-2026-083;Lycée Pasteur;780;en attente\n"
            }
          ]
        },
        {
          type: "file",
          name: "Liste de courses.txt",
          content: "Liste de courses\n- Pain\n- Lait\n- Pommes\n- Clé USB 32 Go (pour sauvegarder mes cours)\n"
        },
        {
          type: "file",
          name: "Idées de projet.txt",
          content:
            "Idées de projet\n\n" +
            "1. Monter un petit PC avec des composants récupérés.\n" +
            "2. Apprendre les bases du terminal.\n" +
            "3. Créer un site web simple.\n" +
            "4. Faire une sauvegarde régulière de mes fichiers.\n"
        },
        {
          type: "folder",
          name: "Cours EITT",
          children: [
            {
              type: "file",
              name: "Introduction au matériel.txt",
              content:
                "INTRODUCTION AU MATÉRIEL INFORMATIQUE\n\n" +
                "Un ordinateur est composé de plusieurs éléments qui travaillent ensemble :\n" +
                "- le processeur (CPU) exécute les instructions des programmes ;\n" +
                "- la mémoire vive (RAM) conserve temporairement les données en cours d'utilisation ;\n" +
                "- le stockage (SSD ou disque dur) conserve les fichiers durablement ;\n" +
                "- la carte mère relie tous ces composants ;\n" +
                "- l'alimentation fournit l'énergie.\n\n" +
                "Question : quelle différence entre la RAM et le stockage ?\n" +
                "Réponse : la RAM est rapide mais temporaire, le stockage est plus lent mais durable.\n"
            },
            {
              type: "file",
              name: "Glossaire.txt",
              content:
                "GLOSSAIRE\n\n" +
                "Fichier : un ensemble de données enregistré sous un nom.\n" +
                "Dossier : un conteneur qui range des fichiers et d'autres dossiers.\n" +
                "Chemin : l'adresse d'un fichier, par exemple /Documents/Cours EITT/Glossaire.txt\n" +
                "Corbeille : zone où vont les éléments supprimés, avant leur suppression définitive.\n" +
                "Terminal : une fenêtre où l'on pilote l'ordinateur en écrivant des commandes.\n"
            }
          ]
        }
      ]
    },
    {
      type: "folder",
      name: "Téléchargements",
      children: [
        {
          type: "file",
          name: "guide-eitt-demo.txt",
          content:
            "Guide EITT (contenu de démonstration)\n\n" +
            "Ce fichier a été « téléchargé » depuis un site fictif de la simulation.\n" +
            "Aucun fichier réel n'est jamais téléchargé depuis Internet par EITT OS.\n"
        },
        {
          type: "file",
          name: "exemple-donnees.csv",
          content: "nom;catégorie;prix\nSSD 1 To;stockage;79\nRAM 16 Go;mémoire;54\nAlimentation 650 W;énergie;69\n"
        }
      ]
    },
    {
      type: "folder",
      name: "Images",
      children: [
        { type: "file", name: "montagne.png", art: "mountain", artKind: "image", size: 1887436 },
        { type: "file", name: "circuit.png", art: "circuit", artKind: "image", size: 1258291 },
        { type: "file", name: "planete.jpg", art: "planet", artKind: "image", size: 934281 }
      ]
    },
    {
      type: "folder",
      name: "Musique",
      children: [
        { type: "file", name: "melodie-demo.mp3", art: "audio", artKind: "audio", size: 4404019 },
        { type: "file", name: "ambiance-eitt.mp3", art: "audio", artKind: "audio", size: 3355443 }
      ]
    },
    {
      type: "folder",
      name: "Vidéos",
      children: [
        { type: "file", name: "presentation-eitt.mp4", art: "eitt-video", artKind: "video", size: 38797312 }
      ]
    }
  ],

  /* Téléchargements fictifs présents au premier lancement (voir js/downloads.js). */
  downloads: [
    { name: "guide-eitt-demo.txt", size: 2048, status: "done", progress: 1, source: "cloudbox.local" },
    { name: "exemple-donnees.csv", size: 1536, status: "done", progress: 1, source: "learnit.local" },
    { name: "support-cours-materiel.txt", size: 18874368, status: "paused", progress: 0.34, source: "learnit.local" },
    { name: "fiches-composants.txt", size: 52428800, status: "paused", progress: 0.58, source: "cloudbox.local" }
  ]
};
