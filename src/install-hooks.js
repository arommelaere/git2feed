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
  hookTypes: ["pre-commit", "post-commit", "pre-push"], // Ajout de pre-push pour attraper plus de workflows
  debug: true, // Mode debug activé par défaut
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

    // Créer un fichier de lock pour éviter les exécutions multiples
    const lockFile = path.join(currentWorkDir, ".git2feed-lock");

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

    // Créer un script de diagnostic que l'utilisateur peut exécuter pour déboguer
    const diagnosticPath = path.join(currentWorkDir, "git2feed-diagnostic.js");
    const diagnosticContent = `#!/usr/bin/env node
// Script de diagnostic pour git2feed hooks
// Exécutez ce script avec: node git2feed-diagnostic.js

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const workDir = process.cwd();
const diagFile = path.join(workDir, '.git2feed-diagnostic.log');

// Fonction pour logger
function log(message) {
  console.log(message);
  fs.appendFileSync(diagFile, message + '\\n');
}

function runCommand(cmd, ignoreErrors = false) {
  try {
    const result = execSync(cmd, { encoding: 'utf8' });
    return result.trim();
  } catch (error) {
    if (!ignoreErrors) {
      log(\`Erreur lors de l'exécution de la commande \${cmd}:\\n\${error.message}\`);
    }
    return \`[ERREUR: \${error.message}]\`;
  }
}

// Initialiser le fichier de diagnostic
fs.writeFileSync(diagFile, \`Diagnostic git2feed - \${new Date().toLocaleString()}\\n\\n\`);

log('== DIAGNOSTIC GIT2FEED ==');
log(\`Répertoire de travail: \${workDir}\`);
log(\`Node.js version: \${process.version}\`);

// Vérifier si .git existe
const gitDir = path.join(workDir, '.git');
log(\`Répertoire .git: \${fs.existsSync(gitDir) ? 'Trouvé ✅' : 'Non trouvé ❌'}\`);

// Vérifier les hooks
const gitHooksDir = path.join(gitDir, 'hooks');
log(\`Répertoire .git/hooks: \${fs.existsSync(gitHooksDir) ? 'Trouvé ✅' : 'Non trouvé ❌'}\`);

const hookTypes = ['pre-commit', 'post-commit', 'pre-push'];
hookTypes.forEach(hookType => {
  const hookPath = path.join(gitHooksDir, hookType);
  const exists = fs.existsSync(hookPath);
  log(\`Hook \${hookType}: \${exists ? 'Trouvé ✅' : 'Non trouvé ❌'}\`);
  
  if (exists) {
    const content = fs.readFileSync(hookPath, 'utf8');
    const isGit2feed = content.includes('git2feed');
    log(\`  - Contenu git2feed: \${isGit2feed ? 'Oui ✅' : 'Non ❌'}\`);
    log(\`  - Exécutable: \${fs.statSync(hookPath).mode & 0o111 ? 'Oui ✅' : 'Non ❌'}\`);
  }
});

// Vérifier le script helper
const helperPath = path.join(gitHooksDir, 'git2feed-hook-helper.cjs');
log(\`Script helper: \${fs.existsSync(helperPath) ? 'Trouvé ✅' : 'Non trouvé ❌'}\`);

// Vérifier la configuration Git pour les hooks
log('\\nConfiguration Git:');
log(\`core.hooksPath: \${runCommand('git config core.hooksPath', true) || '[non configuré]'}\`);
log(\`core.hookspath (lowercase): \${runCommand('git config core.hookspath', true) || '[non configuré]'}\`);

// Vérifier si git2feed est installé
log('\\nInstallation de git2feed:');
const nodeModulesPath = path.join(workDir, 'node_modules', 'git2feed');
log(\`git2feed dans node_modules: \${fs.existsSync(nodeModulesPath) ? 'Trouvé ✅' : 'Non trouvé ❌'}\`);

// Vérifier si npx peut trouver git2feed
log('\\nTest de commande:');
log(\`npx git2feed --version: \${runCommand('npx git2feed --version', true) || '[échec]'}\`);

// Afficher les logs d'exécution précédents s'ils existent
const hookLogFile = path.join(workDir, '.git2feed-hook.log');
if (fs.existsSync(hookLogFile)) {
  log('\\nDernier log d\\'exécution:');
  log(fs.readFileSync(hookLogFile, 'utf8'));
} else {
  log('\\nPas de logs d\\'exécution trouvés (.git2feed-hook.log)');
}

log('\\n== DIAGNOSTIC TERMINÉ ==');
log(\`Un fichier de diagnostic complet a été créé à: \${diagFile}\`);

console.log(\`\\n✅ Diagnostic terminé! Veuillez vérifier le fichier \${diagFile}\`);
`;

    fs.writeFileSync(diagnosticPath, diagnosticContent);
    fs.chmodSync(diagnosticPath, "0755");

    // Créer un script hook Node.js qui sera universel (Windows/Mac/Linux)
    // En utilisant l'extension .cjs pour forcer CommonJS quel que soit le type de package
    const hookHelperPath = path.join(gitHooksDir, "git2feed-hook-helper.cjs");
    const hookHelperContent = `#!/usr/bin/env node

// Script helper pour git2feed hooks - Format CommonJS
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

// Mode debug
const DEBUG = ${config.debug};

// Fonction pour logger le debug
function debug(message) {
  if (DEBUG) {
    const debugLogFile = path.join(process.cwd(), '.git2feed-debug.log');
    fs.appendFileSync(debugLogFile, \`[\${new Date().toISOString()}] \${message}\\n\`);
    
    // On n'affiche pas les messages de debug dans la console
    // console.log(\`[DEBUG] \${message}\`);
  }
}

// Début du log de debug
debug('========== DÉBUT EXÉCUTION HOOK ==========');
debug(\`Hook appelé: \${process.argv[2] || 'unknown'}\`);
debug(\`Commande complète: \${process.argv.join(' ')}\`);
debug(\`Répertoire de travail: \${process.cwd()}\`);

try {
  // Générer un ID de commit unique pour suivre quelle opération a déjà été exécutée
  // Cela permet d'éviter de re-exécuter git2feed plusieurs fois pour un même commit
  let commitId = "";
  try {
    // Essayer de récupérer le hash du commit en cours ou du dernier commit
    commitId = execSync('git rev-parse HEAD 2>/dev/null || git rev-parse --verify HEAD~0 2>/dev/null || echo "unknown"', { encoding: 'utf8' }).trim();
    debug(\`Commit ID détecté: \${commitId}\`);
  } catch (e) {
    commitId = crypto.randomBytes(8).toString('hex');
    debug(\`Erreur lors de la détection du commit ID: \${e.message}\`);
    debug(\`ID généré aléatoirement: \${commitId}\`);
  }
  
  // Répertoire de travail et fichiers
  const workDir = process.cwd();
  const logFile = path.join(workDir, '.git2feed-hook.log');
  const lockFile = path.join(workDir, '.git2feed-lock');
  const commitTrackingFile = path.join(workDir, '.git2feed-last-commit');
  
  // Fonction pour logger
  function log(message) {
    try {
      console.log(message);
      fs.appendFileSync(logFile, message + '\\n');
      debug(\`LOG: \${message}\`);
    } catch (e) {
      debug(\`Erreur lors du log: \${e.message}\`);
    }
  }
  
  // Type de hook (pre-commit, post-commit, etc.)
  const hookType = process.argv[2] || 'unknown';
  debug(\`Type de hook: \${hookType}\`);
  
  // Vérifier si on a déjà traité ce commit
  if (fs.existsSync(commitTrackingFile)) {
    try {
      const lastCommitData = fs.readFileSync(commitTrackingFile, 'utf-8').trim().split(':');
      const lastCommitId = lastCommitData[0];
      const lastTimestamp = parseInt(lastCommitData[1] || '0', 10);
      const now = Date.now();
      
      debug(\`Dernier commit traité: \${lastCommitId} il y a \${Math.round((now - lastTimestamp)/1000)}s\`);
      
      // Si même commit dans les 60 dernières secondes, on saute l'exécution
      if (lastCommitId === commitId && (now - lastTimestamp) < 60000) {
        console.log(\`git2feed: Déjà exécuté pour ce commit il y a \${Math.round((now - lastTimestamp)/1000)}s\`);
        debug('Commit déjà traité récemment, sortie');
        process.exit(0);
      }
    } catch (e) {
      debug(\`Erreur lors de la lecture du fichier de tracking: \${e.message}\`);
    }
  }
  
  // Écrire le commit actuel dans le fichier de tracking
  try {
    fs.writeFileSync(commitTrackingFile, \`\${commitId}:\${Date.now()}\`);
    debug('Fichier de tracking mis à jour');
  } catch (e) {
    debug(\`Erreur lors de l'écriture du fichier de tracking: \${e.message}\`);
  }
  
  // Vérifier si le hook est déjà en cours d'exécution
  if (fs.existsSync(lockFile)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(lockFile, 'utf-8'));
      const now = Date.now();
      
      debug(\`Lock existant: PID \${lockData.pid}, âge \${Math.round((now - lockData.timestamp)/1000)}s\`);
      
      // Si le lock existe depuis moins de 30 secondes, on n'exécute pas
      if ((now - lockData.timestamp) < 30000) {
        console.log(\`git2feed: Opération déjà en cours (pid \${lockData.pid}, \${Math.round((now - lockData.timestamp)/1000)}s)\`);
        debug('Lock récent, sortie');
        process.exit(0);
      } else {
        // Le lock est ancien, on le remplace
        fs.unlinkSync(lockFile);
        debug('Lock ancien supprimé');
      }
    } catch (e) {
      debug(\`Erreur lors de la gestion du lock: \${e.message}\`);
    }
  }
  
  // Créer un lock
  try {
    fs.writeFileSync(lockFile, JSON.stringify({
      pid: process.pid,
      timestamp: Date.now(),
      hook: hookType,
      commit: commitId
    }));
    debug('Lock créé');
  } catch (e) {
    debug(\`Erreur lors de la création du lock: \${e.message}\`);
  }
  
  // Initialiser le log
  try {
    fs.writeFileSync(logFile, \`[${new Date().toLocaleString()}] git2feed hook (\${hookType}) started for commit \${commitId}\\n\`);
    debug('Fichier de log initialisé');
  } catch (e) {
    debug(\`Erreur lors de l'initialisation du log: \${e.message}\`);
  }
  
  // Exécuter git2feed
  try {
    log(\`=== GIT2FEED HOOK (\${hookType}) ===\`);
    log('[1/3] Exécution de git2feed...');
    
    // Exécuter git2feed
    const command = ${JSON.stringify(command)};
    log(\`Commande: \${command}\`);
    debug(\`Exécution de la commande: \${command}\`);
    
    const output = execSync(command, { encoding: 'utf-8' });
    fs.appendFileSync(logFile, output);
    debug('Commande exécutée avec succès');
    
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
        debug('Fichiers ajoutés au commit avec succès');
      } catch (addError) {
        log(\`⚠️ Certains fichiers n'ont pas pu être ajoutés: \${addError.message}\`);
        debug(\`Erreur lors de l'ajout des fichiers: \${addError.message}\`);
      }
    } else {
      log('[3/3] Pas de fichiers à ajouter (désactivé dans la configuration).');
      debug('Ajout des fichiers désactivé ou aucun fichier spécifié');
    }
    
    log('=== GIT2FEED HOOK TERMINÉ ===');
    debug('Exécution terminée avec succès');
  } catch (error) {
    log(\`❌ ERREUR: \${error.message}\`);
    log('=== GIT2FEED HOOK TERMINÉ AVEC ERREUR ===');
    debug(\`Erreur lors de l'exécution: \${error.stack || error.message}\`);
  } finally {
    // Supprimer le lock
    try {
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
        debug('Lock supprimé');
      }
    } catch (e) {
      debug(\`Erreur lors de la suppression du lock: \${e.message}\`);
    }
  }
} catch (globalError) {
  // Capturer toute erreur globale qui pourrait survenir
  debug(\`ERREUR GLOBALE: \${globalError.stack || globalError.message}\`);
}

debug('========== FIN EXÉCUTION HOOK ==========\\n');

// Toujours sortir avec succès pour ne pas bloquer le commit
process.exit(0);
`;

    fs.writeFileSync(hookHelperPath, hookHelperContent);
    fs.chmodSync(hookHelperPath, "0755");

    // Installer chaque type de hook
    const hookTypes = config.hookTypes || defaultConfig.hookTypes;
    const installedHooks = [];

    for (const hookType of hookTypes) {
      // Créer un hook qui affiche toujours un message visible
      // Les hooks sont toujours exécutés avec sh même sur Windows (via Git Bash)
      const hookContent = `#!/bin/sh
# Hook git2feed pour ${hookType}
echo ">> git2feed: Hook ${hookType} en cours d'exécution"
node "${hookHelperPath.replace(/\\/g, "/")}" ${hookType} "$@"
echo "<< git2feed: Hook ${hookType} terminé"
`;

      const hookPath = path.join(gitHooksDir, hookType);
      fs.writeFileSync(hookPath, hookContent);
      fs.chmodSync(hookPath, "0755");
      installedHooks.push(hookType);
    }

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
    console.log(`📋 Hooks installés: ${installedHooks.join(", ")}`);
    console.log(`📄 Script helper Node.js: ${hookHelperPath}`);

    // Afficher un résumé de la configuration utilisée
    console.log("\nConfiguration utilisée:");
    console.log(`- Commande: ${command}`);
    console.log(`- Fichiers: ${config.outputFiles.join(", ")}`);
    console.log(
      `- Ajout auto au commit: ${config.addToCommit ? "Oui" : "Non"}`
    );
    console.log(`- Debug: ${config.debug ? "Activé" : "Désactivé"}`);

    console.log(
      "\nLes hooks généreront un fichier de log ici: " +
        path.join(currentWorkDir, ".git2feed-hook.log")
    );

    console.log(
      "\n📊 Diagnostic: Si vous rencontrez des problèmes, exécutez:" +
        "\n   node git2feed-diagnostic.js" +
        "\npour générer un rapport complet."
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
