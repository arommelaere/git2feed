/**
 * git2feed - Generate updates.txt, JSON and RSS from git commits
 *
 * @author Aurélien Rommelaere <https://arommelaere.com>
 * @license MIT
 */

import fs from "fs";
import path from "path";
import simpleGit from "simple-git";
import { format } from "date-fns";
import { Feed } from "feed";
import { detectOutDir } from "./detect.js";

export async function generateUpdates(options = {}) {
  try {
    const root = options.root || process.cwd();
    const outDir = options.outDir || path.join(root, detectOutDir(root));
    const siteUrl =
      options.siteUrl ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      "";
    const maxCount = Number(options.maxCount || 2000);
    const since = options.since || null;
    const keepPattern = options.keep || null;
    const stripBranch = options.stripBranch || false;
    const confidentialItems = options.confidential
      ? options.confidential
          .split(",")
          .map((item) => item.toLowerCase())
          .filter(Boolean)
      : [];
    const hideItems = options.hide
      ? options.hide
          .split(",")
          .map((item) => item.toLowerCase())
          .filter(Boolean)
      : [];
    const force = options.force || false;

    // Ensure output directory exists
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const TXT = path.join(outDir, "updates.txt");
    const JSON_FILE = path.join(outDir, "updates.json");
    const RSS_FILE = path.join(outDir, "updates.rss");
    const INDEX_FILE = path.join(outDir, "updates.index.json");

    // Initialize files if they don't exist
    if (!fs.existsSync(TXT)) fs.writeFileSync(TXT, "");

    // Initialize or reset index file based on force flag
    if (!fs.existsSync(INDEX_FILE) || force) {
      fs.writeFileSync(INDEX_FILE, JSON.stringify({ seen: [] }, null, 2));

      // If force flag is set, also reset the output files
      if (force) {
        if (fs.existsSync(TXT)) fs.writeFileSync(TXT, "");
        if (fs.existsSync(JSON_FILE))
          fs.writeFileSync(
            JSON_FILE,
            JSON.stringify(
              { updated_at: new Date().toISOString(), items: [] },
              null,
              2
            )
          );
        if (fs.existsSync(RSS_FILE)) fs.writeFileSync(RSS_FILE, "");

        if (force) {
          console.log(
            "🔄 Force flag detected: Resetting all previously processed commits..."
          );
        }
      }
    }

    // Get git log
    const git = simpleGit(root);

    // Verify git repository exists
    if (!(await git.checkIsRepo())) {
      throw new Error(`No git repository found at ${root}`);
    }

    const logOpts = { maxCount };
    if (since) logOpts.since = since;
    const log = await git.log(logOpts);

    // Load previously seen commits
    let indexData;
    try {
      indexData = JSON.parse(fs.readFileSync(INDEX_FILE, "utf8"));
    } catch (err) {
      indexData = { seen: [] };
    }

    const seen = new Set(indexData.seen || []);

    // Filter commits to keep
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

    // Function to process message text
    function processMessage(msg) {
      let processed = msg;

      // Strip branch name using improved regex
      if (stripBranch) {
        // Improved regex to handle "[BranchHere]: " pattern
        processed = processed.replace(/^\s*\[[^\]]*\](?:\s*:)?\s*/, "");
      }

      // Process confidential terms
      if (confidentialItems.length > 0) {
        for (const term of confidentialItems) {
          // Escape regex special characters
          const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const confidentialRegex = new RegExp(escapedTerm, "gi");
          processed = processed.replace(confidentialRegex, "--confidential--");
        }
      }

      // Process hide terms
      if (hideItems.length > 0) {
        for (const term of hideItems) {
          // Escape regex special characters
          const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const hideRegex = new RegExp(escapedTerm, "gi");
          processed = processed.replace(hideRegex, "");
        }
      }

      return processed.trim();
    }

    // Filter commits by keeping pattern and whether they've been seen before (unless force is true)
    const newCommits = force
      ? log.all.filter((c) => keepMsg(c.message))
      : log.all.filter((c) => !seen.has(c.hash) && keepMsg(c.message));

    let txt = "";
    try {
      txt = force ? "" : fs.readFileSync(TXT, "utf8").trim();
    } catch (err) {
      // If file doesn't exist or can't be read, start with empty string
      txt = "";
    }

    // Process new commits
    if (newCommits.length) {
      const grouped = {};
      for (const c of newCommits) {
        const d = format(new Date(c.date), "yyyy-MM-dd");
        if (!grouped[d]) grouped[d] = [];
        grouped[d].push(processMessage(c.message.trim()));
      }

      const blocks = Object.entries(grouped)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([date, msgs]) =>
          [date, ...Array.from(new Set(msgs)).map((m) => `- ${m}`)].join("\n")
        )
        .join("\n\n");

      txt = blocks + (txt ? "\n\n" + txt : "");
      fs.writeFileSync(TXT, txt.trim() + "\n");

      const updatedSeen = [...seen, ...newCommits.map((c) => c.hash)];
      fs.writeFileSync(
        INDEX_FILE,
        JSON.stringify({ seen: updatedSeen }, null, 2)
      );
    }

    // Parse text file into structured data
    const items = txt
      ? txt.split(/\n\s*\n/).map((block) => {
          const lines = block.trim().split("\n");
          return {
            date: lines[0].trim(),
            points: lines.slice(1).map((l) => l.replace(/^- /, "").trim()),
          };
        })
      : [];

    // Write JSON file
    fs.writeFileSync(
      JSON_FILE,
      JSON.stringify({ updated_at: new Date().toISOString(), items }, null, 2)
    );

    // Generate RSS feed
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

    // Write RSS file
    fs.writeFileSync(RSS_FILE, feed.rss2());

    return {
      outDir,
      txtPath: TXT,
      jsonPath: JSON_FILE,
      rssPath: RSS_FILE,
      indexPath: INDEX_FILE,
      items,
    };
  } catch (error) {
    throw new Error(`Failed to generate updates: ${error.message}`);
  }
}
