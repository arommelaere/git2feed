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

    // Vérifier si le répertoire .git/hooks existe
    if (fs.existsSync(gitHooksDir)) {
      // Construire le contenu du hook pre-commit selon la configuration
      const preCommitLines = [
        "#!/bin/bash",
        config.hookMessage,
        "# Exécute git2feed avant le commit pour générer les fichiers d'updates",
        config.command,
      ];

      // Ajouter la commande d'ajout des fichiers au commit si configuré
      if (
        config.addToCommit &&
        Array.isArray(config.outputFiles) &&
        config.outputFiles.length > 0
      ) {
        preCommitLines.push("");
        preCommitLines.push("# Ajoute les fichiers générés au commit");
        preCommitLines.push(
          `git add ${config.outputFiles.join(" ")} 2>/dev/null`
        );
      }

      // Toujours terminer avec succès
      preCommitLines.push(
        "exit 0 # Toujours réussir même si certaines commandes échouent"
      );

      // Écrire le fichier pre-commit en joignant les lignes avec des retours à la ligne
      const preCommitPath = path.join(gitHooksDir, "pre-commit");
      fs.writeFileSync(preCommitPath, preCommitLines.join("\n") + "\n");

      // Rendre le fichier exécutable
      fs.chmodSync(preCommitPath, "0755");

      console.log("✅ Hook git pre-commit installé avec succès");

      // Afficher un résumé de la configuration utilisée
      console.log("\nConfiguration utilisée:");
      console.log(`- Commande: ${config.command}`);
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
