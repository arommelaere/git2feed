# git-updates-feed

Generate `updates.txt`, `updates.json`, and `updates.rss` from Git commits at build time.

## Install

```bash
npm i -D git-updates-feed
```

Auto-detects output dir:

Next.js: public

Remix: public

Astro: public

SvelteKit: static (falls back to public if present)

Nuxt 3: public (Nuxt 2: static if it exists)

Gatsby: static (falls back to public if it exists)

VitePress: .vitepress/public

Else: picks the first existing among public, static, dist/public, build/public, www, web, htdocs, site, app/public; or creates public.

Override anytime: --out path/to/dir.
