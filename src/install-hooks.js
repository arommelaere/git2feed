#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

    // Vérifier si le répertoire .git/hooks existe
    if (fs.existsSync(gitHooksDir)) {
      // Construire le contenu du hook pre-commit selon la configuration
      const preCommitLines = [
        "#!/bin/bash",
        config.hookMessage,
        "",
        "# Affichage en couleur pour plus de lisibilité",
        'GREEN="\\033[0;32m"',
        'YELLOW="\\033[0;33m"',
        'RED="\\033[0;31m"',
        'NC="\\033[0m" # No Color',
        "",
        'echo -e "${YELLOW}🔄 git2feed: Exécution automatique avant commit...${NC}"',
        "",
        "# S'assurer que Node.js est disponible dans le PATH",
        'export PATH="$PATH:$(dirname $(which node))"',
        "",
        "# Chemin du répertoire de travail actuel",
        "CURRENT_DIR=$(pwd)",
        "",
        "# Exécuter git2feed",
        'echo -e "${YELLOW}▶ Exécution: ' +
          command.replace(/"/g, '\\"') +
          '${NC}"',
        command,
        "",
        "# Vérifier si l'exécution a réussi",
        "if [ $? -ne 0 ]; then",
        '  echo -e "${RED}❌ Erreur lors de l\'exécution de git2feed${NC}"',
        "  exit 1",
        "fi",
      ];

      // Ajouter la commande d'ajout des fichiers au commit si configuré
      if (
        config.addToCommit &&
        Array.isArray(config.outputFiles) &&
        config.outputFiles.length > 0
      ) {
        preCommitLines.push("");
        preCommitLines.push("# Ajouter les fichiers générés au commit");
        preCommitLines.push(
          'echo -e "${YELLOW}▶ Ajout des fichiers générés au commit${NC}"'
        );

        // Construire la commande git add
        const gitAddCmd = `git add ${config.outputFiles.join(" ")} 2>/dev/null`;
        preCommitLines.push(gitAddCmd);

        // Vérifier le résultat
        preCommitLines.push("if [ $? -ne 0 ]; then");
        preCommitLines.push(
          '  echo -e "${YELLOW}⚠️ Certains fichiers n\'ont pas pu être ajoutés${NC}"'
        );
        preCommitLines.push("fi");
      }

      // Toujours terminer avec succès
      preCommitLines.push("");
      preCommitLines.push("# Fin du hook pre-commit");
      preCommitLines.push(
        'echo -e "${GREEN}✅ git2feed: Génération des fichiers terminée${NC}"'
      );
      preCommitLines.push("exit 0 # Toujours réussir");

      // Écrire le fichier pre-commit en joignant les lignes avec des retours à la ligne
      const preCommitPath = path.join(gitHooksDir, "pre-commit");
      fs.writeFileSync(preCommitPath, preCommitLines.join("\n") + "\n");

      // Rendre le fichier exécutable
      fs.chmodSync(preCommitPath, "0755");

      console.log("✅ Hook git pre-commit installé avec succès");

      // Afficher un résumé de la configuration utilisée
      console.log("\nConfiguration utilisée:");
      console.log(`- Commande: ${command}`);
      console.log(`- Fichiers: ${config.outputFiles.join(", ")}`);
      console.log(
        `- Ajout auto au commit: ${config.addToCommit ? "Oui" : "Non"}`
      );
    } else {
      console.log(
        "⚠️ Répertoire .git/hooks non trouvé - le hook pre-commit n'a pas été installé"
      );
    }
  } catch (error) {
    console.error(
      "❌ Erreur lors de l'installation du hook git:",
      error.message
    );
  }
}

// Exécuter l'installation
installGitHooks();
