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
    const gitHooksDir = path.join(currentWorkDir, ".git", "hooks");
    const gitDir = path.join(currentWorkDir, ".git");

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

    // Créer un script shell séparé qui sera appelé par les hooks
    const gitHelperScript = path.join(gitHooksDir, "git2feed-helper.sh");

    // Contenu du script helper
    const helperContent = [
      "#!/bin/bash",
      "",
      "# Script utilitaire git2feed",
      "HOOK_NAME=$1",
      'LOG_FILE="$(pwd)/.git2feed-hook.log"',
      "",
      "# Créer ou vider le fichier de log",
      'echo "[$(date)] git2feed hook ($HOOK_NAME) started" > "$LOG_FILE"',
      "",
      "# Fonction pour logger",
      "log() {",
      '  echo "$@" >> "$LOG_FILE"',
      '  echo "$@"',
      "}",
      "",
      "# Bannière",
      'log "=== GIT2FEED HOOK ($HOOK_NAME) ==="',
      'log "[1/3] Exécution de git2feed..."',
      "",
      "# Exécuter git2feed",
      `${command} >> "$LOG_FILE" 2>&1`,
      "",
      "# Vérifier le résultat",
      "if [ $? -ne 0 ]; then",
      '  log "[!] ERREUR: git2feed a échoué. Voir $LOG_FILE pour plus de détails."',
      '  log "=== HOOK TERMINÉ (ERREUR) ==="',
      "  exit 1",
      "fi",
      "",
      'log "[2/3] Génération des fichiers terminée avec succès."',
      "",
    ];

    // Ajouter la partie pour l'ajout des fichiers au commit si configuré
    if (
      config.addToCommit &&
      Array.isArray(config.outputFiles) &&
      config.outputFiles.length > 0
    ) {
      helperContent.push("# Ajouter les fichiers générés au commit");
      helperContent.push('log "[3/3] Ajout des fichiers générés au commit..."');
      helperContent.push(
        `git add ${config.outputFiles.join(" ")} >> "$LOG_FILE" 2>&1`
      );
    } else {
      helperContent.push(
        'log "[3/3] Pas de fichiers à ajouter (désactivé dans la configuration)."'
      );
    }

    helperContent.push('log "=== GIT2FEED HOOK TERMINÉ ==="');
    helperContent.push("");
    helperContent.push("exit 0");

    // Écrire le fichier helper et le rendre exécutable
    fs.writeFileSync(gitHelperScript, helperContent.join("\n") + "\n");
    fs.chmodSync(gitHelperScript, "0755");

    // Créer un hook pre-commit simple qui appelle le helper
    const preCommitContent = [
      "#!/bin/bash",
      "",
      "# Hook pre-commit qui appelle git2feed-helper.sh",
      `HELPER="$(pwd)/.git/hooks/git2feed-helper.sh"`,
      "",
      'if [ -f "$HELPER" ]; then',
      '  bash "$HELPER" pre-commit',
      "fi",
      "",
      "exit 0",
    ];

    // Écrire le hook pre-commit et le rendre exécutable
    const preCommitPath = path.join(gitHooksDir, "pre-commit");
    fs.writeFileSync(preCommitPath, preCommitContent.join("\n") + "\n");
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
    console.log(`📄 Script helper: ${gitHelperScript}`);

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
