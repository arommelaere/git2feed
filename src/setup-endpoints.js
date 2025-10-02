/**
 * git2feed setup-endpoints - Auto-configure endpoints for various frameworks
 *
 * @author Aurélien Rommelaere <https://arommelaere.com>
 * @license MIT
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.cwd();

/**
 * Détecte le type de framework utilisé
 */
function detectFramework() {
  // Next.js
  if (
    fs.existsSync(path.join(ROOT, "next.config.js")) ||
    fs.existsSync(path.join(ROOT, "next.config.mjs")) ||
    hasPackageDependency("next")
  ) {
    // Déterminer si c'est App Router ou Pages Router
    if (fs.existsSync(path.join(ROOT, "app"))) {
      return "nextjs-app";
    }
    return "nextjs-pages";
  }

  // Express
  if (hasPackageDependency("express")) {
    return "express";
  }

  // Nuxt.js
  if (
    fs.existsSync(path.join(ROOT, "nuxt.config.js")) ||
    fs.existsSync(path.join(ROOT, "nuxt.config.ts")) ||
    hasPackageDependency("nuxt")
  ) {
    return "nuxt";
  }

  // SvelteKit
  if (
    fs.existsSync(path.join(ROOT, "svelte.config.js")) ||
    hasPackageDependency("@sveltejs/kit")
  ) {
    return "sveltekit";
  }

  // Astro
  if (
    fs.existsSync(path.join(ROOT, "astro.config.mjs")) ||
    hasPackageDependency("astro")
  ) {
    return "astro";
  }

  return "unknown";
}

/**
 * Vérifie si le projet a une dépendance spécifique
 */
function hasPackageDependency(packageName) {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(ROOT, "package.json"), "utf8")
    );
    return (
      (packageJson.dependencies && packageJson.dependencies[packageName]) ||
      (packageJson.devDependencies && packageJson.devDependencies[packageName])
    );
  } catch (error) {
    return false;
  }
}

/**
 * Écrit un fichier uniquement s'il n'existe pas déjà
 * @returns {boolean} true si le fichier a été écrit, false sinon
 */
function writeFileIfNotExists(filePath, content) {
  if (fs.existsSync(filePath)) {
    console.log(
      `ℹ️ Le fichier ${filePath} existe déjà, il ne sera pas modifié.`
    );
    return false;
  }

  try {
    // Assurer que le répertoire parent existe
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, content);
    return true;
  } catch (error) {
    console.error(
      `❌ Erreur lors de l'écriture du fichier ${filePath}:`,
      error.message
    );
    return false;
  }
}

/**
 * Configure les endpoints pour Next.js (Pages Router)
 */
function setupNextJsPages() {
  const apiDir = path.join(ROOT, "pages", "api", "git2feed");

  // Créer le dossier API s'il n'existe pas
  if (!fs.existsSync(apiDir)) {
    fs.mkdirSync(apiDir, { recursive: true });
  }

  // Créer le fichier [format].js qui ne risque pas d'écraser un fichier existant
  const handlerFile = path.join(apiDir, "[format].js");
  const handlerContent = `/**
 * git2feed dynamic endpoint - auto-generated
 * 
 * Usage:
 * - /api/git2feed/txt - Text format
 * - /api/git2feed/json - JSON format
 * - /api/git2feed/rss - RSS format
 * - Add ?refresh=true to force refresh
 */

import { createNextApiHandler } from 'git2feed/middleware';

export default createNextApiHandler({
  // Vous pouvez personnaliser les options ici
  // root: process.cwd(),
  // siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  // maxCount: 2000,
  // stripBranch: false,
});
`;

  const fileWritten = writeFileIfNotExists(handlerFile, handlerContent);

  if (fileWritten) {
    console.log(
      `✅ Endpoints Next.js (Pages Router) configurés dans: ${handlerFile}`
    );
    console.log(`   Vos updates sont maintenant disponibles sur:`);
    console.log(`   - /api/git2feed/txt`);
    console.log(`   - /api/git2feed/json`);
    console.log(`   - /api/git2feed/rss`);
  }
}

/**
 * Configure les endpoints pour Next.js (App Router)
 */
function setupNextJsApp() {
  const appDir = path.join(ROOT, "app");

  // Créer les dossiers pour chaque format dans un sous-dossier git2feed
  const formats = ["txt", "json", "rss"];
  const filesWritten = [];

  for (const format of formats) {
    const formatDir = path.join(appDir, "api", "git2feed", format);

    // Créer le fichier route.js
    const routeFile = path.join(formatDir, "route.js");
    const routeContent = `/**
 * git2feed dynamic endpoint - auto-generated (${format})
 * 
 * Usage:
 * - /api/git2feed/${format} - Returns updates in ${format.toUpperCase()} format
 * - Add ?refresh=true to force refresh
 */

import { createNextAppHandler } from 'git2feed/middleware';

export const GET = createNextAppHandler({
  // Vous pouvez personnaliser les options ici
  // root: process.cwd(),
  // siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  // maxCount: 2000,
  // stripBranch: false,
});
`;

    const fileWritten = writeFileIfNotExists(routeFile, routeContent);
    if (fileWritten) {
      filesWritten.push(format);
    }
  }

  if (filesWritten.length > 0) {
    console.log(
      `✅ Endpoints Next.js (App Router) configurés dans: ${appDir}/api/git2feed/`
    );
    console.log(`   Vos updates sont maintenant disponibles sur:`);
    filesWritten.forEach((format) => {
      console.log(`   - /api/git2feed/${format}`);
    });
  }
}

/**
 * Configure les endpoints pour Express
 */
function setupExpress() {
  // Créer un fichier de middleware séparé avec un nom unique
  let middlewareFile = path.join(ROOT, "git2feed-middleware.js");

  // Vérifier si le fichier existe déjà
  if (fs.existsSync(middlewareFile)) {
    console.log(`ℹ️ Un fichier middleware existe déjà à ${middlewareFile}.`);
    console.log(
      `   Pour éviter tout conflit, nous allons créer un nouveau fichier.`
    );

    // Trouver un nom unique
    let counter = 1;
    let uniqueMiddlewareFile = path.join(
      ROOT,
      `git2feed-middleware-${counter}.js`
    );

    while (fs.existsSync(uniqueMiddlewareFile)) {
      counter++;
      uniqueMiddlewareFile = path.join(
        ROOT,
        `git2feed-middleware-${counter}.js`
      );
    }

    // Utiliser ce nom unique
    middlewareFile = uniqueMiddlewareFile;
  }

  const middlewareContent = `/**
 * git2feed Express middleware - auto-generated
 * 
 * Ajoutez ce code à votre application Express:
 * 
 * const git2feedMiddleware = require('./${path.basename(middlewareFile)}');
 * app.use('/git2feed', git2feedMiddleware);  // Les URLs seront /git2feed/updates.txt, etc.
 * 
 * Vos updates seront disponibles sur:
 * - /git2feed/updates.txt
 * - /git2feed/updates.json
 * - /git2feed/updates.rss
 */

const { createExpressMiddleware } = require('git2feed/middleware');

module.exports = createExpressMiddleware({
  // Vous pouvez personnaliser les options ici
  // root: process.cwd(),
  // maxCount: 2000,
  // stripBranch: false,
});
`;

  const fileWritten = writeFileIfNotExists(middlewareFile, middlewareContent);
  if (fileWritten) {
    console.log(`✅ Middleware Express créé dans: ${middlewareFile}`);
    console.log(`   Ajoutez-le à votre application avec:`);
    console.log(
      `   const git2feedMiddleware = require('./${path.basename(
        middlewareFile
      )}');`
    );
    console.log(`   app.use('/git2feed', git2feedMiddleware);`);
    console.log(`   Vos updates seront disponibles sur:`);
    console.log(`   - /git2feed/updates.txt`);
    console.log(`   - /git2feed/updates.json`);
    console.log(`   - /git2feed/updates.rss`);
  }
}

/**
 * Configure les endpoints pour Nuxt.js
 */
function setupNuxt() {
  const serverDir = path.join(ROOT, "server", "api", "git2feed");

  // Créer le fichier handler pour chaque format
  const formats = ["txt", "json", "rss"];
  const filesWritten = [];

  for (const format of formats) {
    const handlerFile = path.join(serverDir, `${format}.js`);
    const handlerContent = `/**
 * git2feed dynamic endpoint for Nuxt - auto-generated (${format})
 * 
 * Endpoint: /api/git2feed/${format}
 */

import { createUpdatesHandler } from 'git2feed/middleware';

export default defineEventHandler(async (event) => {
  const handler = createUpdatesHandler();
  const query = getQuery(event);
  const result = await handler({ 
    format: '${format}',
    forceRefresh: query.refresh === 'true'
  });
  
  if (result.headers) {
    Object.entries(result.headers).forEach(([key, value]) => {
      setHeader(event, key, value);
    });
  }
  
  setResponseStatus(event, result.status);
  return result.body;
});
`;

    const fileWritten = writeFileIfNotExists(handlerFile, handlerContent);
    if (fileWritten) {
      filesWritten.push(format);
    }
  }

  if (filesWritten.length > 0) {
    console.log(`✅ Endpoints Nuxt.js configurés dans: ${serverDir}`);
    console.log(`   Vos updates sont maintenant disponibles sur:`);
    filesWritten.forEach((format) => {
      console.log(`   - /api/git2feed/${format}`);
    });
  }
}

/**
 * Configure les endpoints pour SvelteKit
 */
function setupSvelteKit() {
  const routesDir = path.join(ROOT, "src", "routes");
  const apiDir = path.join(routesDir, "api", "git2feed");

  // Créer le fichier +server.js pour chaque format
  const formats = ["txt", "json", "rss"];
  const filesWritten = [];

  for (const format of formats) {
    const handlerDir = path.join(apiDir, format);

    const handlerFile = path.join(handlerDir, "+server.js");
    const handlerContent = `/**
 * git2feed dynamic endpoint for SvelteKit - auto-generated (${format})
 * 
 * Endpoint: /api/git2feed/${format}
 */

import { createUpdatesHandler } from 'git2feed/middleware';

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function GET({ url }) {
  const handler = createUpdatesHandler();
  const result = await handler({ 
    format: '${format}',
    forceRefresh: url.searchParams.get('refresh') === 'true'
  });
  
  const headers = new Headers();
  if (result.headers) {
    Object.entries(result.headers).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }
  
  return new Response(result.body, {
    status: result.status,
    headers
  });
}
`;

    const fileWritten = writeFileIfNotExists(handlerFile, handlerContent);
    if (fileWritten) {
      filesWritten.push(format);
    }
  }

  if (filesWritten.length > 0) {
    console.log(`✅ Endpoints SvelteKit configurés dans: ${apiDir}`);
    console.log(`   Vos updates sont maintenant disponibles sur:`);
    filesWritten.forEach((format) => {
      console.log(`   - /api/git2feed/${format}`);
    });
  }
}

/**
 * Configure les endpoints pour Astro
 */
function setupAstro() {
  const pagesDir = path.join(ROOT, "src", "pages", "api", "git2feed");

  // Créer le fichier pour chaque format
  const formats = ["txt", "json", "rss"];
  const filesWritten = [];

  for (const format of formats) {
    const handlerFile = path.join(pagesDir, `${format}.js`);
    const handlerContent = `/**
 * git2feed dynamic endpoint for Astro - auto-generated (${format})
 * 
 * Endpoint: /api/git2feed/${format}
 */

import { createUpdatesHandler } from 'git2feed/middleware';

export async function get({ request }) {
  const url = new URL(request.url);
  const handler = createUpdatesHandler();
  const result = await handler({ 
    format: '${format}',
    forceRefresh: url.searchParams.get('refresh') === 'true'
  });
  
  return new Response(result.body, {
    status: result.status,
    headers: result.headers
  });
}
`;

    const fileWritten = writeFileIfNotExists(handlerFile, handlerContent);
    if (fileWritten) {
      filesWritten.push(format);
    }
  }

  if (filesWritten.length > 0) {
    console.log(`✅ Endpoints Astro configurés dans: ${pagesDir}`);
    console.log(`   Vos updates sont maintenant disponibles sur:`);
    filesWritten.forEach((format) => {
      console.log(`   - /api/git2feed/${format}`);
    });
  }
}

/**
 * Pour les frameworks non reconnus, génère un exemple générique
 */
function setupGeneric() {
  const exampleDir = path.join(ROOT, ".git2feed");

  const exampleFile = path.join(exampleDir, "middleware-examples.js");
  const exampleContent = `/**
 * git2feed - Exemples d'intégration de middlewares
 * 
 * Ce fichier contient des exemples d'intégration pour différents frameworks.
 * Choisissez l'exemple qui correspond à votre framework et adaptez-le à votre projet.
 */

// =======================================================================
// Express
// =======================================================================
/**
const express = require('express');
const app = express();
const { createExpressMiddleware } = require('git2feed/middleware');

// Ajouter le middleware git2feed
// Notez que nous l'ajoutons sur un préfixe /git2feed pour éviter les conflits
app.use('/git2feed', createExpressMiddleware({
  // Personnalisation optionnelle
  // root: process.cwd(),
  // maxCount: 2000,
  // stripBranch: false,
}));

app.listen(3000, () => {
  console.log('Serveur démarré sur http://localhost:3000');
  console.log('Updates disponibles sur:');
  console.log('- http://localhost:3000/git2feed/updates.txt');
  console.log('- http://localhost:3000/git2feed/updates.json');
  console.log('- http://localhost:3000/git2feed/updates.rss');
});
*/

// =======================================================================
// Next.js (Pages Router)
// =======================================================================
/**
// pages/api/git2feed/[format].js
import { createNextApiHandler } from 'git2feed/middleware';

export default createNextApiHandler({
  // Personnalisation optionnelle
  // root: process.cwd(),
  // maxCount: 2000,
  // stripBranch: false,
});
*/

// =======================================================================
// Next.js (App Router)
// =======================================================================
/**
// app/api/git2feed/[format]/route.js
import { createNextAppHandler } from 'git2feed/middleware';

export const GET = createNextAppHandler({
  // Personnalisation optionnelle
  // root: process.cwd(),
  // maxCount: 2000,
  // stripBranch: false,
});
*/

// =======================================================================
// SvelteKit
// =======================================================================
/**
// src/routes/api/git2feed/[format]/+server.js
import { createUpdatesHandler } from 'git2feed/middleware';

export async function GET({ params, url }) {
  const handler = createUpdatesHandler();
  const result = await handler({ 
    format: params.format,
    forceRefresh: url.searchParams.get('refresh') === 'true'
  });
  
  return new Response(result.body, {
    status: result.status,
    headers: result.headers
  });
}
*/

// =======================================================================
// Utilisation directe du handler (sans framework)
// =======================================================================
/**
import { createUpdatesHandler } from 'git2feed/middleware';
import http from 'http';

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, \`http://\${req.headers.host}\`);
  
  // Gérer les routes pour /git2feed/updates.txt, /git2feed/updates.json et /git2feed/updates.rss
  const match = url.pathname.match(/\\/git2feed\\/updates\\.(txt|json|rss)$/);
  if (match) {
    const format = match[1];
    const handler = createUpdatesHandler();
    const result = await handler({ 
      format,
      forceRefresh: url.searchParams.get('refresh') === 'true'
    });
    
    res.statusCode = result.status;
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    
    res.end(result.body);
  } else {
    res.statusCode = 404;
    res.end('Not found');
  }
});

server.listen(3000, () => {
  console.log('Serveur démarré sur http://localhost:3000');
  console.log('Updates disponibles sur:');
  console.log('- http://localhost:3000/git2feed/updates.txt');
  console.log('- http://localhost:3000/git2feed/updates.json');
  console.log('- http://localhost:3000/git2feed/updates.rss');
});
*/
`;

  const fileWritten = writeFileIfNotExists(exampleFile, exampleContent);

  if (fileWritten) {
    console.log(
      `❓ Nous n'avons pas pu détecter automatiquement votre framework.`
    );
    console.log(
      `✅ Des exemples d'intégration ont été créés dans: ${exampleFile}`
    );
    console.log(
      `   Suivez les exemples pour intégrer git2feed à votre framework.`
    );
  }
}

// Exécution principale
try {
  const framework = detectFramework();
  console.log(`Framework détecté: ${framework}`);

  switch (framework) {
    case "nextjs-pages":
      setupNextJsPages();
      break;
    case "nextjs-app":
      setupNextJsApp();
      break;
    case "express":
      setupExpress();
      break;
    case "nuxt":
      setupNuxt();
      break;
    case "sveltekit":
      setupSvelteKit();
      break;
    case "astro":
      setupAstro();
      break;
    default:
      setupGeneric();
      break;
  }

  console.log(`\n✨ Installation terminée!`);
  console.log(
    `🔄 Redémarrez votre serveur pour que les changements prennent effet.`
  );
} catch (error) {
  console.error("❌ Erreur lors de la configuration des endpoints:", error);
  process.exit(1);
}
