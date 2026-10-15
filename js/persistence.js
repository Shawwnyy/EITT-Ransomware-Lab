/*
 * EITT OS — sauvegarde locale (localStorage).
 *
 * TOUT l'état de la simulation est conservé ici : profils, fichiers et dossiers virtuels, corbeille,
 * paramètres, téléchargements fictifs, progression des sites fictifs. Rien n'est envoyé sur Internet,
 * et ces données ne sont PAS de vrais fichiers du système d'exploitation.
 *
 *   DT.Store.state            objet d'état unique (mutable)
 *   DT.Store.touch()          à appeler après une modification : sauvegarde différée
 *   DT.Store.flush()          sauvegarde immédiate
 *   DT.Store.resetAndReload() efface la simulation puis recharge la page
 */
(function () {
  "use strict";
  const DT = window.DT;

  const KEY = "eitt-ransomware-lab:v1";
  const VERSION = 1;

  function defaultProfiles() {
    return [
      { id: "utilisateur", name: "Utilisateur", avatar: "a1" },
      { id: "utilisatrice", name: "Utilisatrice", avatar: "a4" }
    ];
  }

  function defaultSettings() {
    return {
      wallpaper: "eitt-blue",
      theme: "dark",
      accent: "#16DDF3",
      iconSize: "medium",
      shownIcons: ["ransomlab", "chat", "explorer", "trash", "browser", "notepad", "dashboard"],
      showDesktopFiles: true,
      iconPositions: {},
      pinned: ["ransomlab", "chat", "explorer", "browser", "notepad", "terminal", "settings"],
      explorerView: "grid",
      explorerSort: { key: "name", dir: "asc" }
    };
  }

  function defaultDownloads() {
    const now = Date.now();
    return DT.Data.initialFiles.downloads.map((item, index) => ({
      id: DT.u.uid("dl"),
      name: item.name,
      size: item.size,
      status: item.status,
      progress: item.progress,
      source: item.source,
      createdAt: now - (index + 1) * 36e5
    }));
  }

  /** Version de la mise à niveau : 2 = comptes Utilisateur/Utilisatrice + application EITT Chat. */
  const MIGRATION = 2;

  /**
   * Met à niveau une sauvegarde créée par une version précédente (nouveaux comptes, EITT Chat épinglé et sur le bureau).
   * Le numéro `meta.migrated` n'est JAMAIS repris des valeurs par défaut : il n'existe que si la mise à niveau a vraiment eu lieu.
   */
  function migrate(state) {
    const have = new Set(state.profiles.map((p) => p.id));
    defaultProfiles().forEach((p) => { if (!have.has(p.id)) state.profiles.push(p); });
    if ((state.meta.migrated || 0) < MIGRATION) {
      const st = state.settings;
      if (Array.isArray(st.shownIcons) && !st.shownIcons.includes("chat")) st.shownIcons.splice(Math.min(1, st.shownIcons.length), 0, "chat");
      if (Array.isArray(st.pinned) && !st.pinned.includes("chat")) st.pinned.splice(Math.min(1, st.pinned.length), 0, "chat");
      state.meta.migrated = MIGRATION;
    }
  }

  function defaults() {
    return {
      version: VERSION,
      profiles: defaultProfiles(),
      activeProfile: "utilisateur",
      settings: defaultSettings(),
      fs: DT.FS.buildInitial(),
      downloads: defaultDownloads(),
      sites: { shoptech: { cart: [] }, learnit: { done: {} }, cloudbox: { files: null }, technews: { likes: {} } },
      meta: { created: Date.now(), launches: 0, migrated: MIGRATION },
      ransom: null
    };
  }

  const Store = {
    key: KEY,
    available: true,
    state: null,
    recovered: false,
    _errorReported: false,

    /** Charge l'état sauvegardé, ou crée l'état initial. */
    load() {
      let loaded = null;
      try {
        const raw = window.localStorage.getItem(KEY);
        if (raw) loaded = JSON.parse(raw);
      } catch (error) {
        this.available = false;
        if (window.console) console.warn("[EITT] localStorage indisponible ou illisible :", error);
      }

      const base = defaults();
      if (loaded && loaded.version === VERSION && loaded.fs && DT.FS.validate(loaded.fs)) {
        const settings = Object.assign({}, base.settings, loaded.settings || {});
        settings.explorerSort = Object.assign({}, base.settings.explorerSort, (loaded.settings || {}).explorerSort || {});
        settings.iconPositions = Object.assign({}, (loaded.settings || {}).iconPositions || {});
        if (!Array.isArray(settings.shownIcons)) settings.shownIcons = base.settings.shownIcons;
        if (!Array.isArray(settings.pinned)) settings.pinned = base.settings.pinned;
        const profiles = Array.isArray(loaded.profiles) && loaded.profiles.length ? loaded.profiles : base.profiles;
        this.state = {
          version: VERSION,
          profiles: profiles,
          activeProfile: profiles.some((p) => p.id === loaded.activeProfile) ? loaded.activeProfile : profiles[0].id,
          settings: settings,
          fs: loaded.fs,
          downloads: Array.isArray(loaded.downloads) ? loaded.downloads : base.downloads,
          sites: Object.assign({}, base.sites, loaded.sites || {}),
          meta: Object.assign({ created: base.meta.created, launches: 0 }, loaded.meta || {}),
          ransom: loaded.ransom && typeof loaded.ransom === "object" ? loaded.ransom : null
        };
      } else {
        this.recovered = Boolean(loaded);
        this.state = base;
      }
      migrate(this.state);
      this.state.meta.launches = (this.state.meta.launches || 0) + 1;
      this.flush();
      return this.state;
    },

    /** Marque l'état comme modifié : l'écriture est regroupée pour éviter de solliciter le stockage. */
    touch() {
      this._save();
    },

    flush() {
      this._save.flush();
    },

    _write() {
      if (!this.state) return;
      try {
        window.localStorage.setItem(KEY, JSON.stringify(this.state));
        this.available = true;
        this._errorReported = false;
      } catch (error) {
        this.available = false;
        if (!this._errorReported) {
          this._errorReported = true;
          DT.bus.emit("store:error", error);
        }
      }
    },

    approxBytes() {
      try {
        return JSON.stringify(this.state).length;
      } catch (error) {
        return 0;
      }
    },

    resetAndReload() {
      try {
        window.localStorage.removeItem(KEY);
      } catch (error) {
        /* rien à effacer */
      }
      this.state = null;
      this._save = () => {};
      this._save.flush = () => {};
      window.location.reload();
    }
  };

  Store._save = DT.u.debounce(() => Store._write(), 160);
  window.addEventListener("pagehide", () => Store.flush());
  window.addEventListener("beforeunload", () => Store.flush());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") Store.flush();
  });

  DT.Store = Store;
}());
