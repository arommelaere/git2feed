# git2feed

Generate `updates.txt`, `updates.json`, and `updates.rss` from Git commits at build time.

This tool helps you create and maintain update logs for your project based on Git commit history. It's particularly useful for web projects where you want to display a changelog or updates page.

## Features

- Automatic detection of framework-specific output directories
- Filtering of commits (ignores merge, chore, ci, build, refactor by default)
- Multiple output formats: text, JSON, and RSS
- Keeps track of processed commits to avoid duplicates
- Works with all major JavaScript frameworks (Next.js, Remix, Astro, etc.)

## Install

```bash
npm i -D git2feed
```

## Usage

### Basic Usage

Add this to your build script:

```bash
npx git2feed
```

### With Options

```bash
npx git2feed --site https://example.com --max 100
```

### Programmatic Usage

```javascript
import { generateUpdates } from "git2feed";

async function main() {
  const result = await generateUpdates({
    siteUrl: "https://example.com",
    maxCount: 100,
  });

  console.log(`Generated updates in ${result.outDir}`);
}

main().catch(console.error);
```

## Options

| Option       | CLI Flag     | Description                                    | Default            |
| ------------ | ------------ | ---------------------------------------------- | ------------------ |
| Root Path    | `--root`     | Repository root path                           | Current directory  |
| Output Dir   | `--out`      | Output directory (overrides auto-detection)    | Auto-detected      |
| Site URL     | `--site`     | Site URL for RSS feed                          | Empty or from env  |
| Max Commits  | `--max`      | Maximum number of commits to process           | 2000               |
| Since        | `--since`    | Process commits since date (e.g. "1 week ago") | All commits        |
| Keep Pattern | `--keep`     | Regex pattern for keeping commits              | Non-chore/ci/build |
| Help         | `--help, -h` | Show help                                      | -                  |

## Auto-detection of output directories

git2feed automatically detects the appropriate output directory based on your project:

- **Next.js**: `public`
- **Remix**: `public`
- **Astro**: `public`
- **SvelteKit**: `static` (falls back to `public` if present)
- **Nuxt 3**: `public` (Nuxt 2: `static` if it exists)
- **Gatsby**: `static` (falls back to `public` if it exists)
- **VitePress**: `.vitepress/public`
- **Other**: picks the first existing among: `public`, `static`, `dist/public`, `build/public`, `www`, `web`, `htdocs`, `site`, `app/public`; or creates `public`.

You can override this by using the `--out` option.

## Output Files

Three files are generated in the output directory:

1. `updates.txt` - A human-readable text file with updates grouped by date
2. `updates.json` - A structured JSON file with the same information
3. `updates.rss` - An RSS feed for subscription

Plus an additional index file:

- `updates.index.json` - Tracks processed commit hashes to avoid duplicates

## License

MIT
