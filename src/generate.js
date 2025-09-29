import fs from "fs";
import path from "path";
import simpleGit from "simple-git";
import { format } from "date-fns";
import { Feed } from "feed";
import { detectOutDir } from "./detect.js";

export async function generateUpdates(options = {}) {
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

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const TXT = path.join(outDir, "updates.txt");
  const JSON_FILE = path.join(outDir, "updates.json");
  const RSS_FILE = path.join(outDir, "updates.rss");
  const INDEX_FILE = path.join(outDir, "updates.index.json");

  if (!fs.existsSync(TXT)) fs.writeFileSync(TXT, "");
  if (!fs.existsSync(INDEX_FILE))
    fs.writeFileSync(INDEX_FILE, JSON.stringify({ seen: [] }, null, 2));

  const git = simpleGit(root);
  const logOpts = { maxCount };
  if (since) logOpts.since = since;
  const log = await git.log(logOpts);

  const seen = new Set(
    JSON.parse(fs.readFileSync(INDEX_FILE, "utf8")).seen || []
  );

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

  const newCommits = log.all.filter(
    (c) => !seen.has(c.hash) && keepMsg(c.message)
  );
  let txt = fs.readFileSync(TXT, "utf8").trim();

  if (newCommits.length) {
    const grouped = {};
    for (const c of newCommits) {
      const d = format(new Date(c.date), "yyyy-MM-dd");
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(c.message.trim());
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

  const items = txt
    ? txt.split(/\n\s*\n/).map((block) => {
        const lines = block.trim().split("\n");
        return {
          date: lines[0].trim(),
          points: lines.slice(1).map((l) => l.replace(/^- /, "").trim()),
        };
      })
    : [];

  fs.writeFileSync(
    JSON_FILE,
    JSON.stringify({ updated_at: new Date().toISOString(), items }, null, 2)
  );

  const feed = new Feed({
    title: "Project Updates",
    id: siteUrl ? siteUrl + "/updates" : "updates",
    link: siteUrl ? siteUrl + "/updates" : "/updates",
  });

  for (const it of items) {
    feed.addItem({
      title: it.date,
      id: (siteUrl || "") + "/updates#" + it.date,
      link: (siteUrl || "") + "/updates",
      date: new Date(it.date + "T00:00:00Z"),
      description: it.points.map((p) => "• " + p).join("\n"),
    });
  }

  fs.writeFileSync(RSS_FILE, feed.rss2());

  return {
    outDir,
    txtPath: TXT,
    jsonPath: JSON_FILE,
    rssPath: RSS_FILE,
    indexPath: INDEX_FILE,
    items,
  };
}
