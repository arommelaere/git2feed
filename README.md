# git2feed

Generate `updates.txt`, `updates.json`, and `updates.rss` from Git commits at build time.

This tool helps you create and maintain update logs for your project based on Git commit history. It's particularly useful for web projects where you want to display a changelog or updates page.

## Features

- Automatic detection of framework-specific output directories
- Filtering of commits (ignores merge, chore, ci, build, refactor by default)
- Multiple output formats: text, JSON, and RSS
- Keeps track of processed commits to avoid duplicates
- Works with all major JavaScript frameworks (Next.js, Remix, Astro, etc.)
- Option to strip branch names from commit messages
- Redact or hide confidential terms from commit messages

## Install

```bash
npm i -D git2feed
yarn add -D git2feed
pnpm add -D git2feed
```

## Usage

### Basic Usage

Add this to your build script:

```bash
npx git2feed      # npm
yarn git2feed     # yarn
pnpm exec git2feed  # pnpm
```

### Development Usage

Add these scripts to your package.json for easy local development:

```json
"scripts": {
  "g2f": "pnpm exec git2feed --f --confidential 'shadcdn,daisyui,aws' --strip-branch --f",
  "updates": "pnpm exec git2feed",
  "updates:strip": "pnpm exec git2feed --strip-branch",
  "updates:recent": "pnpm exec git2feed --since \"1 week ago\"",
  "prepare": "pnpm exec  git2feed --strip-branch"
}
```

The `prepare` script will automatically run when you run `npm install` in your project, ensuring your update files are always generated before commits.

### Git Hooks Integration

git2feed automatically installs a git pre-commit hook when you install the package. This hook:

1. Runs git2feed before every commit
2. Adds the generated files to the commit

This ensures your update files are always up-to-date with your latest commits.

If you need to manually install the git hook:

```bash
npm run install-hooks   # npm
yarn install-hooks      # yarn
pnpm run install-hooks  # pnpm
```

#### Customizing Git Hook

You can customize the git hook by creating a `.git2feed` file in your project root. This is a JSON file with the following options:

```json
{
  "command": "npx git2feed --strip-branch --confidential 'secret,private'",
  "outputFiles": [
    "public/updates.txt",
    "public/updates.rss",
    "public/updates.json",
    "public/updates.index.json"
  ],
  "addToCommit": true,
  "hookMessage": "# Hook git2feed personnalisé"
}
```

Available options:

| Option        | Type     | Default                                                                                            | Description                                                |
| ------------- | -------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `command`     | string   | `"npx git2feed"`                                                                                   | The command to run before commit                           |
| `outputFiles` | string[] | `["public/updates.txt", "public/updates.rss", "public/updates.json", "public/updates.index.json"]` | Files to add to the commit                                 |
| `addToCommit` | boolean  | `true`                                                                                             | Whether to automatically add generated files to the commit |
| `hookMessage` | string   | `"# Hook généré automatiquement par git2feed"`                                                     | Comment message in the hook file                           |

After modifying the configuration, run `npm run install-hooks` to update the git hook.

Then you can run them as needed:

```bash
# Basic update generation
npm run updates

# Strip branch names from commit messages
npm run updates:strip

# Only process commits from the last week
npm run updates:recent
```

### Examples

#### Display updates from the last month

```bash
npx git2feed --since "1 month ago"     # npm
yarn git2feed --since "1 month ago"    # yarn
pnpm exec git2feed --since "1 month ago"  # pnpm
```

#### Limit to the last 10 commits

```bash
npx git2feed --max 10      # npm
yarn git2feed --max 10     # yarn
pnpm exec git2feed --max 10  # pnpm
```

#### Specify output directory

```bash
npx git2feed --out ./static/updates      # npm
yarn git2feed --out ./static/updates     # yarn
pnpm exec git2feed --out ./static/updates  # pnpm
```

#### Strip branch names from commit messages

```bash
npx git2feed --strip-branch      # npm
yarn git2feed --strip-branch     # yarn
pnpm exec git2feed --strip-branch  # pnpm
```

#### Set site URL for RSS feed

```bash
npx git2feed --site https://example.com      # npm
yarn git2feed --site https://example.com     # yarn
pnpm exec git2feed --site https://example.com  # pnpm
```

#### Only include commits containing "feature" or "fix"

```bash
npx git2feed --keep "(feature|fix)"      # npm
yarn git2feed --keep "(feature|fix)"     # yarn
pnpm exec git2feed --keep "(feature|fix)"  # pnpm
```

#### Replace confidential terms in commit messages

```bash
npx git2feed --confidential "aws,s3,daisyui,api key,secret token"      # npm
yarn git2feed --confidential "aws,s3,daisyui,api key,secret token"     # yarn
pnpm exec git2feed --confidential "aws,s3,daisyui,api key,secret token"  # pnpm
```

> Note: Spaces within terms are preserved. For example, `"api key"` will be treated as a single term.

#### Completely hide terms from commit messages

```bash
npx git2feed --hide "secret,password,key,private token"      # npm
yarn git2feed --hide "secret,password,key,private token"     # yarn
pnpm exec git2feed --hide "secret,password,key,private token"  # pnpm
```

> Note: Spaces within terms are preserved. For example, `"private token"` will be treated as a single term.

#### Completely rebuild all files (ignoring previously processed commits)

```bash
npx git2feed --force      # npm
yarn git2feed --force     # yarn
pnpm exec git2feed --f    # pnpm (using shorthand)
```

#### Combine multiple options

```bash
npx git2feed --site https://example.com --max 50 --strip-branch --since "2 weeks ago" --confidential "aws,api-key"      # npm
yarn git2feed --site https://example.com --max 50 --strip-branch --since "2 weeks ago" --confidential "aws,api-key"     # yarn
pnpm exec git2feed --site https://example.com --max 50 --strip-branch --since "2 weeks ago" --confidential "aws,api-key"  # pnpm
```

### Integration with build scripts

#### Next.js (package.json)

```json
"scripts": {
  "build": "next build && npx git2feed --strip-branch --site https://mysite.com"
}
```

#### Astro (package.json)

```json
"scripts": {
  "build": "astro build && npx git2feed --max 50 --site https://mysite.com"
}
```

### Programmatic Usage

```javascript
import { generateUpdates } from "git2feed";

async function main() {
  const result = await generateUpdates({
    siteUrl: "https://example.com",
    maxCount: 100,
    stripBranch: true,
    confidential: "aws,s3,api-key,private token,secret key",
    hide: "secret,password,internal code",
    force: false, // Set to true to rebuild all files from scratch
  });

  console.log(`Generated updates in ${result.outDir}`);
}

main().catch(console.error);
```

## Options

| Option       | CLI Flag         | Description                                               | Default            |
| ------------ | ---------------- | --------------------------------------------------------- | ------------------ |
| Root Path    | `--root`         | Repository root path                                      | Current directory  |
| Output Dir   | `--out`          | Output directory (overrides auto-detection)               | Auto-detected      |
| Site URL     | `--site`         | Site URL for RSS feed                                     | Empty or from env  |
| Max Commits  | `--max`          | Maximum number of commits to process                      | 2000               |
| Since        | `--since`        | Process commits since date (e.g. "1 week ago")            | All commits        |
| Keep Pattern | `--keep`         | Regex pattern for keeping commits                         | Non-chore/ci/build |
| Strip Branch | `--strip-branch` | Remove branch names from commit messages                  | false              |
| Confidential | `--confidential` | Replace terms with "--confidential--" (spaces preserved)  | None               |
| Hide Terms   | `--hide`         | Completely hide terms from messages (spaces preserved)    | None               |
| Force Regen  | `--force, --f`   | Force regeneration, ignoring previously processed commits | false              |
| Help         | `--help, -h`     | Show help                                                 | -                  |

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

## Running Tests

The project includes comprehensive tests to ensure all features work correctly:

```bash
# Run integration tests
npm test

# Run unit tests for text processing functionality
npm run test:unit
```

Unit tests verify:

- Confidential term replacement (with and without spaces)
- Term hiding (with and without spaces)
- Branch name stripping
- Case insensitivity
- Special character handling

## Author

Created by [Aurélien Rommelaere](https://arommelaere.com). Check out more of my projects and tools at [arommelaere.com](https://arommelaere.com).

## License

MIT
