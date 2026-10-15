/*
 * EITT OS — données des sites FICTIFS du navigateur simulé.
 *
 * Tous les sites, produits, articles, cours et fichiers ci-dessous sont inventés pour la démonstration.
 * Aucune marque réelle n'est utilisée, aucun prix n'est réel, et rien n'est envoyé sur Internet.
 * La liste « hosts » est la liste blanche des seules adresses que le navigateur simulé accepte d'ouvrir.
 * (Données écrites en .js plutôt qu'en .json pour fonctionner en ouvrant index.html directement.)
 */
window.DT = window.DT || {};
DT.Data = DT.Data || {};

DT.Data.websites = {
  hosts: [
    { id: "eitt", host: "eitt.local", name: "EITT Portal", tagline: "Enseignement Informatique pour Toutes et Tous", color: "#16ddf3", glyph: "E" },
    { id: "technews", host: "technews.local", name: "TechNews", tagline: "L'actualité tech, expliquée simplement", color: "#f97316", glyph: "T" },
    { id: "shoptech", host: "shoptech.local", name: "ShopTech", tagline: "Composants informatiques (boutique fictive)", color: "#22c55e", glyph: "S" },
    { id: "learnit", host: "learnit.local", name: "LearnIT", tagline: "Ressources pédagogiques pour apprendre à son rythme", color: "#8b5cf6", glyph: "L" },
    { id: "cloudbox", host: "cloudbox.local", name: "CloudBox", tagline: "Stockage en ligne (fictif)", color: "#38bdf8", glyph: "C" }
  ],

  parcours: [
    { id: "decouvrir", title: "Découvrir l'ordinateur", level: "Débutant", text: "Comprendre à quoi servent le processeur, la mémoire, le stockage et la carte mère, sans jargon.", course: "materiel" },
    { id: "securite", title: "Internet en sécurité", level: "Débutant", text: "Adresses web, mots de passe, hameçonnage, mises à jour : les bons réflexes du quotidien.", course: "internet" },
    { id: "fichiers", title: "Maîtriser ses fichiers", level: "Débutant", text: "Dossiers, chemins, extensions, corbeille et sauvegardes : s'organiser pour ne rien perdre.", course: "fichiers" }
  ],

  articles: [
    {
      id: "ssd-nvme", cat: "Matériel", date: "2026-10-02", minutes: 3, title: "Les SSD NVMe : pourquoi votre ordinateur démarre plus vite",
      summary: "Un SSD n'a aucune pièce mobile et répond bien plus vite qu'un disque dur classique.",
      body: [
        "Un disque dur à plateaux doit déplacer physiquement une tête de lecture pour retrouver une information. Un SSD, lui, stocke les données dans des puces : il n'attend donc presque jamais.",
        "Le format NVMe relie le SSD directement au processeur par un bus rapide. Résultat : démarrage du système, ouverture des applications et copie de gros dossiers deviennent nettement plus rapides.",
        "Pour un usage courant, un SSD est souvent l'amélioration la plus visible qu'on puisse apporter à un vieil ordinateur. Pensez simplement à sauvegarder vos fichiers importants avant toute intervention."
      ]
    },
    {
      id: "mots-de-passe", cat: "Sécurité", date: "2026-09-28", minutes: 4, title: "Mots de passe : cinq habitudes simples qui changent tout",
      summary: "Longueur, unicité, gestionnaire et double authentification : l'essentiel en quelques minutes.",
      body: [
        "Un mot de passe long (une phrase de plusieurs mots) est plus difficile à deviner qu'un mot court rempli de symboles. Évitez les dates de naissance et les prénoms.",
        "N'utilisez jamais le même mot de passe sur deux services : si l'un fuit, tous vos comptes sont en danger. Un gestionnaire de mots de passe retient tout à votre place.",
        "Quand c'est possible, activez la double authentification. Même si quelqu'un découvre votre mot de passe, il lui manquera le second élément de vérification."
      ]
    },
    {
      id: "wifi-7", cat: "Matériel", date: "2026-09-21", minutes: 3, title: "Wi-Fi : faut-il vraiment changer de box ?",
      summary: "Débit annoncé, portée réelle et nombre d'appareils : ce qui compte vraiment chez soi.",
      body: [
        "Les débits indiqués sur les emballages sont des maximums théoriques mesurés dans de bonnes conditions. Murs, distance et appareils connectés les réduisent beaucoup.",
        "Avant de changer de matériel, essayez de rapprocher la box du centre du logement et de la surélever. Cela règle souvent des problèmes de couverture.",
        "Si de nombreux appareils sont connectés en même temps, une norme récente gère mieux le partage de la bande passante. C'est là qu'un changement a le plus de sens."
      ]
    },
    {
      id: "ia-locale", cat: "IA", date: "2026-09-14", minutes: 5, title: "Les assistants d'IA : promesses et limites au quotidien",
      summary: "Utiles pour brouillonner ou résumer, mais toujours à relire : comprendre ce qu'ils font vraiment.",
      body: [
        "Un assistant d'IA génère des réponses plausibles à partir de ce qu'il a appris. Il peut se tromper avec aplomb : vérifiez toujours les informations importantes.",
        "Évitez de lui confier des données personnelles ou confidentielles. Relisez la politique de confidentialité du service avant de l'utiliser pour du travail sensible.",
        "Bien utilisé, c'est un excellent point de départ : reformuler un texte, proposer un plan, expliquer un concept. La décision finale reste la vôtre."
      ]
    },
    {
      id: "sauvegarde-321", cat: "Logiciel", date: "2026-09-07", minutes: 3, title: "Sauvegarde 3-2-1 : ne plus jamais perdre ses photos",
      summary: "Trois copies, deux supports différents, une copie hors de chez soi.",
      body: [
        "La règle 3-2-1 est simple : gardez trois copies de vos données, sur deux types de supports différents, dont une copie stockée ailleurs (par exemple chez un proche ou dans un service en ligne).",
        "Un seul disque externe branché en permanence ne suffit pas : un incident, un vol ou un virus peut tout emporter d'un coup.",
        "Planifiez un rappel mensuel et testez de temps en temps la restauration d'un fichier : une sauvegarde jamais testée est une sauvegarde incertaine."
      ]
    },
    {
      id: "hameconnage", cat: "Sécurité", date: "2026-08-30", minutes: 4, title: "Reconnaître un message d'hameçonnage en 30 secondes",
      summary: "Urgence, expéditeur étrange, lien suspect : trois signaux d'alerte à connaître.",
      body: [
        "Un message qui vous presse (« votre compte sera fermé aujourd'hui ») cherche à vous empêcher de réfléchir. Prenez le temps de vérifier par un autre canal.",
        "Regardez l'adresse réelle de l'expéditeur et survolez les liens sans cliquer : l'adresse affichée doit correspondre au service annoncé.",
        "En cas de doute, n'ouvrez pas la pièce jointe et ne saisissez jamais vos identifiants depuis un lien reçu : passez par le site officiel que vous tapez vous-même."
      ]
    }
  ],

  categories: ["Tout", "Matériel", "Logiciel", "Sécurité", "IA"],

  products: [
    { id: "cpu-nova-8", cat: "Processeur", name: "Processeur Nova 8 cœurs", price: 249, tone: "#22c55e", desc: "Un processeur polyvalent pour la bureautique, le multimédia et le jeu occasionnel.", specs: ["8 cœurs / 16 threads", "Fréquence jusqu'à 4,8 GHz", "Ventirad fourni"] },
    { id: "cpu-nova-12", cat: "Processeur", name: "Processeur Nova 12 cœurs", price: 389, tone: "#16a34a", desc: "Plus de cœurs pour le montage vidéo et les tâches lourdes en parallèle.", specs: ["12 cœurs / 24 threads", "Fréquence jusqu'à 5,0 GHz", "Sans ventirad"] },
    { id: "ram-16", cat: "Mémoire", name: "Barrette mémoire 16 Go DDR5", price: 79, tone: "#0ea5e9", desc: "La mémoire vive donne de la place de travail à votre ordinateur.", specs: ["16 Go", "DDR5 5600 MHz", "Garantie 5 ans (fictive)"] },
    { id: "ram-32", cat: "Mémoire", name: "Kit mémoire 32 Go (2 × 16 Go)", price: 139, tone: "#0284c7", desc: "Deux barrettes identiques pour profiter du double canal.", specs: ["2 × 16 Go", "DDR5 5600 MHz", "Dissipateur fin"] },
    { id: "ssd-1", cat: "Stockage", name: "SSD NVMe 1 To", price: 89, tone: "#f59e0b", desc: "Démarrage rapide et ouverture instantanée des applications.", specs: ["1 To", "Lecture jusqu'à 3 500 Mo/s", "Format M.2"] },
    { id: "hdd-4", cat: "Stockage", name: "Disque dur 4 To", price: 99, tone: "#d97706", desc: "Beaucoup d'espace pour archiver photos et vidéos à petit prix.", specs: ["4 To", "5 400 tr/min", "Format 3,5 pouces"] },
    { id: "gpu-pixel-8", cat: "Carte graphique", name: "Carte graphique Pixel 8 Go", price: 329, tone: "#a855f7", desc: "Pour les jeux en haute définition et l'accélération de la création graphique.", specs: ["8 Go de mémoire vidéo", "3 sorties écran", "Alimentation 8 broches"] },
    { id: "mb-atlas", cat: "Carte mère", name: "Carte mère Atlas ATX", price: 179, tone: "#ef4444", desc: "La carte mère relie tous les composants entre eux.", specs: ["Format ATX", "4 emplacements mémoire", "2 emplacements M.2"] },
    { id: "psu-650", cat: "Alimentation", name: "Alimentation 650 W certifiée Bronze", price: 69, tone: "#64748b", desc: "Elle transforme le courant de la prise en tensions adaptées aux composants.", specs: ["650 W", "Certification 80+ Bronze", "Câbles semi-modulaires"] },
    { id: "case-aero", cat: "Boîtier", name: "Boîtier moyen-tour Aéro", price: 74, tone: "#06b6d4", desc: "Un boîtier aéré avec une bonne circulation d'air et un filtre à poussière.", specs: ["Format ATX", "2 ventilateurs fournis", "Façade ajourée"] },
    { id: "fan-zephyr", cat: "Refroidissement", name: "Ventirad Zéphyr 120 mm", price: 39, tone: "#14b8a6", desc: "Garde le processeur au frais pour qu'il garde ses performances.", specs: ["Ventilateur 120 mm", "4 caloducs", "Silencieux"] }
  ],
  productCategories: ["Tout", "Processeur", "Mémoire", "Stockage", "Carte graphique", "Carte mère", "Alimentation", "Boîtier", "Refroidissement"],

  courses: [
    {
      id: "materiel", title: "Découvrir le matériel", color: "#8b5cf6", level: "Débutant", summary: "Les composants d'un ordinateur et leur rôle.",
      lessons: [
        { id: "materiel-1", title: "Les composants d'un ordinateur", text: "Un ordinateur est un assemblage : processeur (le cerveau), mémoire vive (la table de travail), stockage (l'armoire), carte mère (le réseau routier) et alimentation (le cœur)." },
        { id: "materiel-2", title: "Processeur et mémoire vive", text: "Le processeur exécute les instructions. La mémoire vive conserve temporairement ce qui est en cours d'utilisation : elle se vide quand on éteint l'ordinateur." },
        { id: "materiel-3", title: "Stockage : SSD ou disque dur ?", text: "Le SSD est rapide et silencieux ; le disque dur offre plus d'espace pour moins cher. Beaucoup d'ordinateurs combinent les deux." },
        { id: "materiel-4", title: "Carte mère et alimentation", text: "La carte mère accueille et relie les composants. L'alimentation les nourrit en électricité : elle doit être assez puissante et de bonne qualité." }
      ]
    },
    {
      id: "internet", title: "Internet en sécurité", color: "#0ea5e9", level: "Débutant", summary: "Les réflexes pour naviguer sereinement.",
      lessons: [
        { id: "internet-1", title: "Comment fonctionne une adresse web", text: "Une adresse comme http://eitt.local contient un protocole, un nom de site et un chemin. Un service (le DNS) traduit le nom en adresse numérique. Ici, le navigateur simulé le fait sans réseau." },
        { id: "internet-2", title: "Des mots de passe solides", text: "Utilisez une phrase longue et unique pour chaque service, un gestionnaire de mots de passe et la double authentification dès que possible." },
        { id: "internet-3", title: "Reconnaître l'hameçonnage", text: "Méfiez-vous de l'urgence, des fautes, des expéditeurs inattendus et des liens déguisés. En cas de doute, passez par le site officiel." },
        { id: "internet-4", title: "Mises à jour et sauvegardes", text: "Les mises à jour corrigent des failles de sécurité. Les sauvegardes vous protègent des pannes et des virus : appliquez la règle 3-2-1." }
      ]
    },
    {
      id: "fichiers", title: "Maîtriser ses fichiers", color: "#f59e0b", level: "Débutant", summary: "S'organiser pour retrouver ses documents.",
      lessons: [
        { id: "fichiers-1", title: "Dossiers et chemins", text: "Un chemin comme /Documents/Cours EITT indique où se trouve un fichier. Chaque dossier peut contenir d'autres dossiers : c'est une arborescence." },
        { id: "fichiers-2", title: "Créer, renommer, déplacer", text: "Dans l'Explorateur, clic droit puis Nouveau pour créer ; F2 pour renommer ; glisser-déposer ou couper/coller pour déplacer." },
        { id: "fichiers-3", title: "Corbeille et restauration", text: "Supprimer envoie d'abord l'élément à la corbeille. Tant qu'elle n'est pas vidée, on peut le restaurer à son emplacement d'origine." },
        { id: "fichiers-4", title: "Extensions de fichiers", text: "L'extension (.txt, .png, .csv) indique le type de contenu. Changer l'extension ne transforme pas réellement le fichier." }
      ]
    }
  ],

  resources: [
    {
      id: "r-guide", name: "guide-eitt-demo.txt", title: "Guide de démonstration EITT", size: 2048,
      content: "Guide de démonstration EITT (contenu fictif)\n\nCe fichier a été « téléchargé » depuis learnit.local, un site fictif intégré à la simulation.\nIl a été créé dans le système de fichiers virtuel : ce n'est pas un vrai fichier de votre ordinateur.\n\nRappel des bons réflexes :\n1. Sauvegardez régulièrement vos documents.\n2. Utilisez des mots de passe longs et différents.\n3. Méfiez-vous des messages qui vous pressent d'agir.\n"
    },
    {
      id: "r-glossaire", name: "glossaire-materiel.txt", title: "Glossaire du matériel", size: 1536,
      content: "Glossaire du matériel (contenu fictif de démonstration)\n\nCPU : processeur, exécute les instructions.\nRAM : mémoire vive, espace de travail temporaire.\nSSD : stockage rapide sans pièce mobile.\nHDD : disque dur à plateaux, grande capacité.\nCarte mère : relie tous les composants.\nAlimentation : fournit l'électricité aux composants.\n"
    },
    {
      id: "r-donnees", name: "exemple-donnees.csv", title: "Données d'exemple (CSV)", size: 1024,
      content: "composant,role,exemple\nprocesseur,calcule,8 coeurs\nmemoire,travail,16 Go\nstockage,archive,1 To\n"
    }
  ],

  cloudFiles: [
    { id: "cf1", name: "Notes-de-cours.txt", size: 3584, modified: "2026-10-05", content: "Notes de cours (fichier de démonstration CloudBox)\n\n- Le processeur exécute les instructions.\n- La mémoire vive est effacée à l'extinction.\n- Le stockage conserve les données.\n" },
    { id: "cf2", name: "Budget-familial.csv", size: 2048, modified: "2026-09-29", content: "mois,depenses,epargne\njanvier,1200,300\nfevrier,1100,350\nmars,1250,280\n" },
    { id: "cf3", name: "Liste-de-courses.txt", size: 512, modified: "2026-10-08", content: "Liste de courses (démonstration)\n\n- Pain\n- Fruits\n- Café\n" },
    { id: "cf4", name: "Souvenirs-vacances.txt", size: 18874, modified: "2026-08-14", content: "Souvenirs de vacances (démonstration)\n\nUn paysage de montagne, un lac et beaucoup de soleil.\n" }
  ],
  cloudCapacity: 5 * 1024 * 1024 * 1024
};
