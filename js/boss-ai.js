/*
 * EITT OS — « IA » du patron : moteur de réponses 100 % LOCAL (aucun serveur, aucun modèle distant, aucune clé d'API).
 *
 * Ce n'est PAS un vrai modèle de langage : c'est un moteur à base de connaissances (data/boss-knowledge.js). Il normalise la
 * phrase (minuscules, sans accents), cherche des mots-clés et des expressions, note chaque sujet, tient compte de la
 * conversation (mémoire du dernier sujet pour « explique », « pourquoi ? »…) et de l'état du scénario (phase de l'attaque,
 * sauvegarde, étapes déjà faites). Il ne répète pas une variante déjà utilisée tant qu'il en reste.
 * Rien de ce que vous écrivez ne quitte la page.
 */
(function () {
  "use strict";
  const DT = window.DT;
  const KB = DT.Data.bossKnowledge;

  const norm = (text) => String(text || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[’'`´]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const STAR = "zzstarzz";
  function compileKeyword(raw) {
    const parts = norm(String(raw).replace(/\*/g, STAR)).split(" ").filter(Boolean).map((p) => (p.endsWith(STAR) ? { s: p.slice(0, -STAR.length), stem: true } : { s: p, stem: false }));
    return { parts: parts, words: parts.length };
  }

  const intents = KB.intents.map((entry) => {
    const opt = entry[3] || {};
    return { id: entry[0], kws: entry[1].map(compileKeyword).filter((k) => k.words), replies: entry[2] || [], more: opt.more || [], exact: (opt.x || []).map(norm), fn: opt.fn || null, w: opt.w || 1, phases: opt.p || null, suggest: opt.s || [] };
  });
  const byId = new Map(intents.map((i) => [i.id, i]));

  const MORE_KEYWORDS = ["pourquoi", "explique*", "detaille*", "un exemple", "plus de details", "continue", "et apres", "et ensuite", "comment ca", "precise*", "raconte", "dis m en plus", "en savoir plus", "c est a dire", "ca veut dire quoi", "developpe*", "et alors", "ah bon", "vraiment"].map(compileKeyword);

  function matches(keyword, tokens) {
    const n = keyword.parts.length;
    for (let i = 0; i + n <= tokens.length; i += 1) {
      let ok = true;
      for (let j = 0; j < n; j += 1) {
        const part = keyword.parts[j];
        const token = tokens[i + j];
        if (part.stem ? !token.startsWith(part.s) : token !== part.s) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  }

  function scoreIntent(intent, text, tokens) {
    let s = 0;
    for (const kw of intent.kws) if (matches(kw, tokens)) s += kw.words * 2 + 1;
    if (intent.exact.includes(text)) s += 10;
    return s * intent.w;
  }

  /* ------------------------------ Mémoire de la conversation (sauvegardée avec le scénario) ------------------------------ */
  function memory() {
    const chat = DT.Ransom.state().chat;
    if (!chat.ai) chat.ai = { last: null, used: {} };
    return chat.ai;
  }

  function pick(list, key) {
    if (!list.length) return null;
    const mem = memory();
    let used = mem.used[key] || [];
    let free = list.map((_, i) => i).filter((i) => !used.includes(i));
    if (!free.length) { used = []; free = list.map((_, i) => i); }
    const index = free[Math.floor(Math.random() * free.length)];
    mem.used[key] = used.concat(index).slice(-12);
    return list[index];
  }

  /* ------------------------------ Réponses calculées selon l'état du scénario ------------------------------ */
  const pad2 = (n) => String(n).padStart(2, "0");
  const yesNo = (v) => (v ? "oui" : "non");

  function fnStatus() {
    const r = DT.Ransom.state();
    if (r.phase === "ready") {
      return "Pour l'instant, pas d'incident : le poste est sain. " + (r.backup ? "Ta sauvegarde est faite (" + (r.backup.kind === "offline" ? "hors ligne, bien" : "sur le même ordinateur, risqué") + ")." : "Tu n'as pas encore fait de sauvegarde : c'est l'étape « Préparer » du Lab.") + (r.mail.choice === "reported" ? " Et tu as signalé le message piégé : bravo." : "");
    }
    if (r.phase === "attacking") return "Ça va vite : " + r.locked + " fichiers sur " + r.total + " déjà verrouillés. Coupe le réseau sans attendre.";
    if (r.phase === "infected") {
      return r.locked + " fichiers sont verrouillés. Où on en est : poste isolé ? " + yesNo(r.isolated) + " · alerte envoyée ? " + yesNo(r.alerted) + " · origine identifiée ? " + yesNo(r.identified) + " · programme supprimé ? " + yesNo(r.eradicated) + " · sauvegarde utilisable ? " + yesNo(r.backup && !r.backup.lost) + ".";
    }
    const score = DT.Ransom.computeScore();
    return "Poste rétabli : " + (r.total - r.remaining) + " fichiers sur " + r.total + " récupérés. Ton score : " + score.total + "/" + score.max + ".";
  }

  function fnAdvice() {
    const r = DT.Ransom.state();
    if (r.phase === "ready") {
      if (r.chat.stage === "received") return "D'abord, réponds-moi « Bien reçu ». Ensuite le mail dont je te parlais arrive dans ta messagerie et on le regarde ensemble.";
      if (!r.mail.delivered) return "Rien d'urgent pour l'instant. Profite-en : crée une sauvegarde hors ligne (onglet « Préparer » du Lab). C'est ta meilleure assurance.";
      if (!r.mail.choice) return "Le mail « facture d'octobre impayée » t'attend dans la messagerie du Lab. Analyse-le : expéditeur, urgence, pièce jointe… et ne l'ouvre pas tant que tu n'es pas sûr(e). " + (r.backup ? "Bonne nouvelle, ta sauvegarde est faite." : "Et pense à faire une sauvegarde hors ligne avant.");
      return "Tu as évité l'attaque, bravo. Tu peux voir ce qui aurait pu se passer avec le mode démonstration, ou rejouer pour viser le meilleur score.";
    }
    if (r.phase === "attacking") return "Ça se verrouille en ce moment : coupe le réseau tout de suite (Wi-Fi, mode avion, ou « Isoler le poste » dans l'onglet Réponse). Le reste viendra juste après.";
    if (r.phase === "recovered") return "Tout est rétabli. Regarde le Bilan, puis clique sur « Terminer et revenir à ma session » ou rejoue l'exercice.";
    if (!r.isolated) return "Première chose : isoler le poste du réseau, pour que ça ne se propage pas. Onglet « Réponse » → « Isoler le poste » (ou coupe le Wi-Fi).";
    if (!r.alerted) return "Poste isolé, bien. Prochaine étape : alerter le responsable sécurité (« Envoyer l'alerte » dans l'onglet Réponse).";
    if (!r.identified) return "Alerte envoyée, parfait. Maintenant, comprends d'où ça vient : « Analyser les journaux » dans l'onglet Réponse.";
    if (!r.paid && !r.refused) return "N'oublie pas la décision sur la rançon (onglet Incident). Mon avis : on ne paie pas.";
    if (!r.eradicated) return "Avant de restaurer, supprime le programme malveillant « " + DT.Ransom.SAMPLE_NAME + " », sinon il re-verrouillera tout.";
    if (!r.backup) return "Hélas, tu n'as pas de sauvegarde : on ne peut rien restaurer. Rejoue l'exercice en en faisant une à l'étape « Préparer ».";
    if (r.backup.lost) return "Ta sauvegarde était sur le même ordinateur : elle a été verrouillée aussi, donc inutilisable. Leçon retenue ? Rejoue en la faisant hors ligne.";
    return "Tout est prêt : restaure tes fichiers depuis la sauvegarde (onglet Réponse → « Restaurer mes fichiers »).";
  }

  function fnScore() {
    const r = DT.Ransom.state();
    if (r.phase === "ready" && !r.mail.choice) return "Pas de score pour l'instant : il se calcule après un incident. Il porte sur 100 points (sauvegarde, mail piégé, isolement, rançon, alerte, analyse, nettoyage, restauration).";
    const score = DT.Ransom.computeScore();
    const weak = score.items.filter((i) => i.pts < i.max).sort((a, b) => (b.max - b.pts) - (a.max - a.pts))[0];
    return "Ton score : " + score.total + "/" + score.max + (r.phase === "recovered" ? "." : " (provisoire)." ) + (weak ? " Le point à améliorer en priorité : « " + weak.label + " » (" + weak.pts + "/" + weak.max + ")." : " Sans faute !");
  }

  function fnTime() {
    const d = new Date();
    return "Il est " + pad2(d.getHours()) + " h " + pad2(d.getMinutes()) + ".";
  }

  function fnDate() {
    return "Nous sommes le " + new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + ".";
  }

  const FUNCTIONS = { status: fnStatus, advice: fnAdvice, score: fnScore, time: fnTime, date: fnDate };

  function fill(text) {
    const r = DT.Ransom.state();
    return String(text)
      .replace(/\{n\}/g, String(intents.length))
      .replace(/\{locked\}/g, String(r.locked || 0))
      .replace(/\{total\}/g, String(r.total || 0));
  }

  /* ------------------------------ Reconnaître un simple accusé de réception (scénario) ------------------------------ */
  const ACK = /\b(bien recu|recu|ok|okay|d accord|compris|entendu|c est note|bien note|ca marche|je m en occupe|je vais|je regarde|je traite|je verifie|je le fais|tout de suite|j y vais|je gere|je coupe|j isole|j alerte|je previens|je ne paierai|je restaure)\b/;
  function isAck(text) {
    const t = norm(text);
    if (!t) return false;
    if (/\?/.test(String(text))) return false;
    if (t.split(" ").length > 14) return false;
    return ACK.test(t);
  }

  /* ------------------------------ Réponse ------------------------------ */
  function isFollowUp(tokens) {
    return tokens.length <= 6 && MORE_KEYWORDS.some((k) => matches(k, tokens));
  }

  function reply(text) {
    const raw = String(text || "");
    const t = norm(raw);
    const tokens = t.split(" ").filter(Boolean);
    const phase = DT.Ransom.state().phase;
    const mem = memory();
    let best = null;
    let bestScore = 0;
    for (const intent of intents) {
      if (intent.phases && !intent.phases.includes(phase)) continue;
      const s = scoreIntent(intent, t, tokens);
      if (s > bestScore) { best = intent; bestScore = s; }
    }
    const follow = isFollowUp(tokens);
    // « Pourquoi ? », « explique », « un exemple » sans sujet précis : on approfondit le dernier sujet traité.
    if (follow && mem.last && bestScore < 3 && byId.has(mem.last)) {
      const last = byId.get(mem.last);
      const text2 = pick(last.more, last.id + ":more") || pick(last.replies, last.id) || "Je n'ai rien de plus à ajouter sur ce point. Pose-moi une autre question, ou demande « Que dois-je faire ? ».";
      return { id: last.id, text: fill(text2), fallback: false, followUp: true };
    }
    if (best && bestScore >= 3) {
      mem.last = best.id;
      const out = best.fn ? FUNCTIONS[best.fn]() : pick(best.replies, best.id);
      return { id: best.id, text: fill(out), fallback: false, score: bestScore };
    }
    const question = /\?/.test(raw) || /^(qui|que|quoi|quel|quelle|quels|quelles|comment|pourquoi|ou|quand|combien|est ce|peux tu|sais tu)\b/.test(t);
    const pool = question ? KB.fallbackQuestion : KB.fallbackStatement;
    return { id: question ? "_question" : "_statement", text: fill(pick(pool, question ? "_q" : "_s")), fallback: true, score: bestScore };
  }

  /* ------------------------------ Suggestions de réponses rapides (selon l'état) ------------------------------ */
  function suggestions() {
    const r = DT.Ransom.state();
    const base = r.phase === "attacking" ? ["Que dois-je faire ?", "Pourquoi isoler le poste ?", "Où en est-on ?"]
      : r.phase === "infected" ? ["Que dois-je faire ?", "Faut-il payer la rançon ?", "Où en est-on ?", "Pourquoi isoler le poste ?"]
      : r.phase === "recovered" ? ["Avec plaisir !", "Qu'est-ce que j'aurais pu mieux faire ?", "Quel est mon score ?", "Comment rejouer ?"]
      : ["Où en est-on ?", "C'est quoi un rançongiciel ?", "Comment repérer un mail piégé ?", "Pourquoi une sauvegarde hors ligne ?"];
    const last = memory().last && byId.get(memory().last);
    const list = (last ? last.suggest : []).concat(base);
    return list.filter((s, i) => list.indexOf(s) === i).slice(0, 4);
  }

  function stats() {
    const keywords = intents.reduce((n, i) => n + i.kws.length, 0);
    const replies = intents.reduce((n, i) => n + i.replies.length + i.more.length, 0) + KB.fallbackQuestion.length + KB.fallbackStatement.length;
    return { intents: intents.length, keywords: keywords, replies: replies };
  }

  DT.BossAI = { reply: reply, suggestions: suggestions, isAck: isAck, stats: stats, normalize: norm };
}());
