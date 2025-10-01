#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration par défaut
const defaultConfig = {
  command: "npx git2feed",
  outputFiles: [
    "public/updates.txt",
    "public/updates.rss",
    "public/updates.json",
    "public/updates.index.json",
  ],
  addToCommit: true,
  hookMessage: "# Hook généré automatiquement par git2feed",
  verbose: true,
};

// Fonction pour lire la configuration
function readConfig() {
  const currentWorkDir = process.cwd();
  const configPath = path.join(currentWorkDir, ".git2feed");

  // Vérifier si le fichier de config existe
  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, "utf-8");
      const userConfig = JSON.parse(configContent);
      console.log("✅ Configuration .git2feed trouvée et chargée");
      return { ...defaultConfig, ...userConfig };
    } catch (error) {
      console.error(
        "⚠️ Erreur lors de la lecture du fichier .git2feed:",
        error.message
      );
      console.log("→ Utilisation de la configuration par défaut");
      return defaultConfig;
    }
  }

  return defaultConfig;
}

// Fonction pour installer les hooks git
function installGitHooks() {
  try {
    // Charger la configuration
    const config = readConfig();

    // Chemin vers le répertoire de travail actuel (où npm install est exécuté)
    const currentWorkDir = process.cwd();
    const gitDir = path.join(currentWorkDir, ".git");
    const gitHooksDir = path.join(gitDir, "hooks");

    // Vérifier si c'est un répertoire Git
    if (!fs.existsSync(gitDir)) {
      console.error("⚠️ Ce n'est pas un répertoire Git (.git non trouvé)");
      return;
    }

    // Créer le dossier hooks s'il n'existe pas
    if (!fs.existsSync(gitHooksDir)) {
      console.log("📁 Création du dossier .git/hooks");
      fs.mkdirSync(gitHooksDir, { recursive: true });
    }

    // Déterminer le chemin vers le script git2feed
    let finalCliPath = "";

    // 1. Chercher dans node_modules (installation normale)
    const nodeModulesCliPath = path.join(
      currentWorkDir,
      "node_modules",
      "git2feed",
      "src",
      "cli.js"
    );

    // 2. Chercher localement (développement)
    const localCliPath = path.join(
      path.dirname(path.dirname(__dirname)),
      "src",
      "cli.js"
    );

    // Déterminer le chemin à utiliser
    if (fs.existsSync(nodeModulesCliPath)) {
      finalCliPath = nodeModulesCliPath;
    } else if (fs.existsSync(localCliPath)) {
      finalCliPath = localCliPath;
    } else {
      // Si on ne trouve pas le fichier, on utilise la commande telle quelle
      finalCliPath = path.join(__dirname, "cli.js");
    }

    // Normaliser le chemin pour éviter les problèmes avec les backslashes sous Windows
    finalCliPath = finalCliPath.replace(/\\/g, "/");

    // Construire la commande avec le chemin absolu
    let command = config.command;
    if (command.includes("npx git2feed") || command === "git2feed") {
      // Extraire les arguments éventuels après git2feed
      let args = "";
      if (command.includes("npx git2feed")) {
        args = command.replace("npx git2feed", "").trim();
      } else if (command.includes("git2feed")) {
        args = command.replace("git2feed", "").trim();
      }

      // Remplacer la commande par le chemin absolu avec les arguments
      command = `node "${finalCliPath}"${args ? " " + args : ""}`;
    }

    // Créer un script hook Node.js qui sera universel (Windows/Mac/Linux)
    // En utilisant l'extension .cjs pour forcer CommonJS quel que soit le type de package
    const hookHelperPath = path.join(gitHooksDir, "git2feed-hook-helper.cjs");
    const hookHelperContent = `#!/usr/bin/env node

// Script helper pour git2feed hooks - Format CommonJS
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Fonction pour logger
function log(message) {
  console.log(message);
  fs.appendFileSync(logFile, message + '\\n');
}

// Répertoire de travail
const workDir = process.cwd();
const logFile = path.join(workDir, '.git2feed-hook.log');

// Créer ou vider le fichier de log
fs.writeFileSync(logFile, \`[${new Date().toLocaleString()}] git2feed hook started\\n\`);

log('=== GIT2FEED PRE-COMMIT HOOK ===');
log('[1/3] Exécution de git2feed avant le commit...');

try {
  // Exécuter git2feed
  const command = ${JSON.stringify(command)};
  log(\`Commande: \${command}\`);
  
  const output = execSync(command, { encoding: 'utf-8' });
  fs.appendFileSync(logFile, output);
  
  // Afficher la sortie condensée
  const outputLines = output.split('\\n').filter(line => line.trim());
  if (outputLines.length > 0) {
    log(\`✅ \${outputLines[outputLines.length - 1]}\`);
  }
  
  log('[2/3] Génération des fichiers terminée avec succès.');

  // Ajouter les fichiers générés au commit si nécessaire
  const outputFiles = ${JSON.stringify(config.outputFiles)};
  const addToCommit = ${config.addToCommit};
  
  if (addToCommit && outputFiles && outputFiles.length > 0) {
    log('[3/3] Ajout des fichiers générés au commit...');
    
    try {
      const gitAddCmd = \`git add \${outputFiles.join(' ')}\`;
      execSync(gitAddCmd, { encoding: 'utf-8' });
      log('✅ Fichiers ajoutés au commit');
    } catch (addError) {
      log(\`⚠️ Certains fichiers n'ont pas pu être ajoutés: \${addError.message}\`);
    }
  } else {
    log('[3/3] Pas de fichiers à ajouter (désactivé dans la configuration).');
  }
  
  log('=== GIT2FEED HOOK TERMINÉ ===');
  process.exit(0);
} catch (error) {
  log(\`❌ ERREUR: \${error.message}\`);
  log('=== GIT2FEED HOOK TERMINÉ AVEC ERREUR ===');
  process.exit(1);
}
`;

    fs.writeFileSync(hookHelperPath, hookHelperContent);
    fs.chmodSync(hookHelperPath, "0755");

    // Déterminer si on est sur Windows
    const isWin = process.platform === "win32";

    // Créer un hook pre-commit identique pour tous les OS
    // Les hooks sont toujours exécutés avec sh même sur Windows (via Git Bash)
    const preCommitContent = `#!/bin/sh
node "${hookHelperPath.replace(/\\/g, "/")}"
`;

    const preCommitPath = path.join(gitHooksDir, "pre-commit");
    fs.writeFileSync(preCommitPath, preCommitContent);
    fs.chmodSync(preCommitPath, "0755");

    // Vérifier si Git respecte bien les hooks
    try {
      console.log("🔍 Vérification de la configuration Git pour les hooks...");
      const hooksPath = execSync("git config core.hooksPath", {
        encoding: "utf8",
      }).trim();
      if (hooksPath && hooksPath !== ".git/hooks") {
        console.warn(
          `⚠️ Attention: Git est configuré pour utiliser les hooks depuis: ${hooksPath}`
        );
        console.warn(
          `⚠️ Les hooks installés dans .git/hooks pourraient ne pas être exécutés!`
        );
      } else {
        console.log("✅ Configuration Git pour les hooks vérifiée");
      }
    } catch (error) {
      // Si la commande échoue, c'est probablement que core.hooksPath n'est pas configuré (donc valeur par défaut)
      console.log(
        "✅ Configuration Git pour les hooks vérifiée (valeur par défaut)"
      );
    }

    console.log("\n✅ Hooks Git installés avec succès");
    console.log(`📋 Hooks installés: pre-commit`);
    console.log(`📄 Script helper Node.js: ${hookHelperPath}`);

    // Afficher un résumé de la configuration utilisée
    console.log("\nConfiguration utilisée:");
    console.log(`- Commande: ${command}`);
    console.log(`- Fichiers: ${config.outputFiles.join(", ")}`);
    console.log(
      `- Ajout auto au commit: ${config.addToCommit ? "Oui" : "Non"}`
    );

    console.log(
      "\nLes hooks généreront un fichier de log ici: " +
        path.join(currentWorkDir, ".git2feed-hook.log")
    );
  } catch (error) {
    console.error(
      "❌ Erreur lors de l'installation des hooks git:",
      error.message
    );
  }
}

// Exécuter l'installation
installGitHooks();
