/**
 * git2feed middleware - Dynamic endpoints for updates.txt, JSON and RSS
 *
 * @author Aurélien Rommelaere <https://arommelaere.com>
 * @license MIT
 */

import fs from "fs";
import path from "path";
import simpleGit from "simple-git";
import { format } from "date-fns";
import { Feed } from "feed";
import os from "os";
import https from "https";

// Configuration du cache
const CACHE_DIR = path.join(os.tmpdir(), "git2feed-cache");
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000; // 24 heures par défaut

// Assurez-vous que le répertoire de cache existe
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Gestionnaire principal pour les endpoints updates.*
 * @param {Object} options - Options de configuration
 * @returns {Promise<Object>} - Résultat avec status, body et headers
 */
export async function createUpdatesHandler(options = {}) {
  return async (req) => {
    const format = req.format || "txt";
    const repoRoot = options.root || process.cwd();
    const forceRefresh = req.forceRefresh || false;

    if (!["txt", "json", "rss"].includes(format)) {
      return {
        status: 400,
        body: "Format non supporté. Utilisez txt, json ou rss.",
      };
    }

    const cacheFile = path.join(CACHE_DIR, `updates.${format}`);
    const cacheMetaFile = path.join(CACHE_DIR, `updates-meta.json`);

    // Vérifier si le cache est valide
    if (
      !forceRefresh &&
      fs.existsSync(cacheFile) &&
      fs.existsSync(cacheMetaFile)
    ) {
      try {
        const meta = JSON.parse(fs.readFileSync(cacheMetaFile, "utf8"));
        if (
          Date.now() - meta.timestamp <
          (options.cacheExpiration || CACHE_EXPIRATION)
        ) {
          // Cache valide, retourner le fichier mis en cache
          return {
            status: 200,
            body: fs.readFileSync(cacheFile, "utf8"),
            headers: {
              "Content-Type": getContentType(format),
            },
          };
        }
      } catch (err) {
        // Si erreur lors de la lecture du cache, régénérer
        console.warn("Erreur lors de la lecture du cache:", err.message);
      }
    }

    // Cache invalide ou inexistant, générer de nouvelles données
    try {
      let commits;

      // Essayer d'utiliser l'API GitHub si une clé est fournie
      const githubToken = options.githubToken || process.env.GITHUB_TOKEN;
      const githubOwner = options.githubOwner || process.env.GITHUB_OWNER;
      const githubRepo = options.githubRepo || process.env.GITHUB_REPO;

      if (githubToken && githubOwner && githubRepo) {
        console.log(
          `Récupération des commits depuis l'API GitHub pour ${githubOwner}/${githubRepo}`
        );
        commits = await fetchGithubCommits(
          githubToken,
          githubOwner,
          githubRepo,
          options.maxCount || 100
        );
      } else {
        // Fallback au dépôt Git local
        console.log("Utilisation du dépôt Git local");
        // Utiliser simple-git pour récupérer les commits
        const git = simpleGit(repoRoot);

        // Vérifier si c'est un dépôt git
        if (!(await git.checkIsRepo())) {
          return {
            status: 404,
            body: "Aucun dépôt Git trouvé. Veuillez initialiser un dépôt Git, spécifier un chemin valide, ou configurer l'accès GitHub.",
          };
        }

        // Récupérer les commits
        const logOpts = { maxCount: options.maxCount || 2000 };
        if (options.since) logOpts.since = options.since;
        const log = await git.log(logOpts);
        commits = log.all;
      }

      // Traiter les commits pour générer les données
      const items = processCommits(commits, options);

      // Générer le contenu selon le format demandé
      let content;
      if (format === "json") {
        content = generateJSON(items);
      } else if (format === "rss") {
        content = generateRSS(items, options.siteUrl);
      } else {
        content = generateTxt(items);
      }

      // Mettre en cache
      fs.writeFileSync(cacheFile, content);
      fs.writeFileSync(
        cacheMetaFile,
        JSON.stringify({
          timestamp: Date.now(),
        })
      );

      return {
        status: 200,
        body: content,
        headers: {
          "Content-Type": getContentType(format),
          "Cache-Control": "public, max-age=3600", // 1h de cache côté client
        },
      };
    } catch (error) {
      console.error("Erreur lors de la génération des mises à jour:", error);
      return {
        status: 500,
        body: `Erreur lors de la génération des mises à jour: ${error.message}`,
      };
    }
  };
}

/**
 * Récupère les commits depuis l'API GitHub
 * @param {string} token - Token d'accès GitHub
 * @param {string} owner - Propriétaire du dépôt
 * @param {string} repo - Nom du dépôt
 * @param {number} maxCount - Nombre maximum de commits à récupérer
 * @returns {Promise<Array>} - Liste des commits
 */
async function fetchGithubCommits(token, owner, repo, maxCount = 100) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: `/repos/${owner}/${repo}/commits?per_page=${maxCount}`,
      method: "GET",
      headers: {
        "User-Agent": "git2feed",
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            const commits = JSON.parse(data);
            // Convertir au même format que simple-git
            const formattedCommits = commits.map((commit) => ({
              hash: commit.sha,
              date: commit.commit.author.date,
              message: commit.commit.message,
              refs: "",
              body: commit.commit.message,
              author_name: commit.commit.author.name,
            }));
            resolve(formattedCommits);
          } catch (error) {
            reject(
              new Error(
                `Erreur lors du parsing des commits GitHub: ${error.message}`
              )
            );
          }
        } else {
          reject(
            new Error(
              `GitHub API a retourné le statut ${res.statusCode}: ${data}`
            )
          );
        }
      });
    });

    req.on("error", (error) => {
      reject(
        new Error(`Erreur lors de la requête à GitHub API: ${error.message}`)
      );
    });

    req.end();
  });
}

/**
 * Traite les commits pour les convertir en items structurés
 */
function processCommits(commits, options = {}) {
  const stripBranch = options.stripBranch || false;
  const keepPattern = options.keep || null;

  // Fonction de filtrage des commits
  function defaultKeep(m) {
    const s = m.toLowerCase();
    if (s.startsWith("merge")) return false;
    if (/^(chore|ci|build|refactor)\b/.test(s)) return false;
    return true;
  }

  const userKeep = keepPattern ? new RegExp(keepPattern, "i") : null;

  function keepMsg(m) {
    if (userKeep) return userKeep.test(m);
    return defaultKeep(m);
  }

  // Fonction de traitement des messages
  function processMessage(msg) {
    let processed = msg;

    // Strip branch name using improved regex
    if (stripBranch) {
      processed = processed.replace(/^\s*\[[^\]]*\](?:\s*:)?\s*/, "");
    }

    return processed.trim();
  }

  // Filtrer et grouper les commits
  const filteredCommits = commits.filter((c) => keepMsg(c.message));
  const grouped = {};

  for (const commit of filteredCommits) {
    const date = format(new Date(commit.date), "yyyy-MM-dd");
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(processMessage(commit.message.trim()));
  }

  // Structurer les données
  return Object.entries(grouped)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, messages]) => ({
      date,
      points: Array.from(new Set(messages)),
    }));
}

/**
 * Génère le contenu au format texte
 */
function generateTxt(items) {
  return (
    items
      .map((item) => {
        return [item.date, ...item.points.map((point) => `- ${point}`)].join(
          "\n"
        );
      })
      .join("\n\n") + "\n"
  );
}

/**
 * Génère le contenu au format JSON
 */
function generateJSON(items) {
  return JSON.stringify(
    {
      updated_at: new Date().toISOString(),
      items,
    },
    null,
    2
  );
}

/**
 * Génère le contenu au format RSS
 */
function generateRSS(items, siteUrl = "") {
  const feed = new Feed({
    title: "Project Updates",
    id: siteUrl ? `${siteUrl}/updates` : "updates",
    link: siteUrl ? `${siteUrl}/updates` : "/updates",
    updated: new Date(),
    generator: "git2feed by Aurélien Rommelaere (https://arommelaere.com)",
  });

  for (const it of items) {
    try {
      feed.addItem({
        title: it.date,
        id: `${siteUrl || ""}/updates#${it.date}`,
        link: `${siteUrl || ""}/updates`,
        date: new Date(`${it.date}T00:00:00Z`),
        description: it.points.map((p) => "• " + p).join("\n"),
      });
    } catch (err) {
      console.warn(
        `Warning: Couldn't add RSS item for ${it.date}:`,
        err.message
      );
    }
  }

  return feed.rss2();
}

/**
 * Renvoie le Content-Type approprié selon le format
 */
function getContentType(format) {
  switch (format) {
    case "json":
      return "application/json";
    case "rss":
      return "application/rss+xml";
    default:
      return "text/plain";
  }
}

/**
 * Créer un middleware Express
 */
export function createExpressMiddleware(options = {}) {
  const handler = createUpdatesHandler(options);

  return async (req, res, next) => {
    const match = req.path.match(/\/updates\.(txt|json|rss)$/);
    if (match) {
      const format = match[1];
      const result = await handler({
        format,
        forceRefresh: req.query.refresh === "true",
      });

      res.status(result.status);
      if (result.headers) {
        Object.entries(result.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }

      res.send(result.body);
    } else {
      next();
    }
  };
}

/**
 * Créer un handler Next.js API Route
 */
export function createNextApiHandler(options = {}) {
  const handler = createUpdatesHandler(options);

  return async (req, res) => {
    const format = req.query.format || "txt";
    const result = await handler({
      format,
      forceRefresh: req.query.refresh === "true",
    });

    res.status(result.status);
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }

    res.send(result.body);
  };
}

/**
 * Créer un handler Next.js App Router
 */
export function createNextAppHandler(options = {}) {
  const handler = createUpdatesHandler(options);

  return async (req, context) => {
    const format = context.params.format || "txt";
    const searchParams = new URL(req.url).searchParams;

    const result = await handler({
      format,
      forceRefresh: searchParams.get("refresh") === "true",
    });

    const headers = new Headers();
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        headers.set(key, value);
      });
    }

    return new Response(result.body, {
      status: result.status,
      headers,
    });
  };
}
