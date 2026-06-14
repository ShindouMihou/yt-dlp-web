# ytdl4.me — YouTube Download For Me

A self-hostable, single-container web UI for [yt-dlp](https://github.com/yt-dlp/yt-dlp).
Paste a YouTube or YouTube Music link, optionally pick a format, click **Download** — the
server fetches it, shows live progress, hands you the file, and cleans up after itself.

- 🐳 **One container, one command.** Only Docker required. No database, no Redis, no setup.
- 🎚️ **Smart defaults.** One-tap *Video (best MP4)* / *Audio (MP3)* presets, optional advanced controls.
- 📡 **Live progress.** Real-time percent, speed, and ETA over Server-Sent Events.
- 🧹 **Self-cleaning.** Files auto-delete after 30–60 minutes (scaled by size).
- 🔒 **Optional password.** Off by default; turn it on to expose the instance safely.

---

## Quick start

```bash
docker compose up -d
```

Then open <http://localhost:8382>. That's it.

To run the prebuilt image directly:

```bash
docker run -d -p 8382:8382 --tmpfs /data/temp:size=10g --name ytdl4me ytdl4me:latest
```

> **Heads-up:** with no password set, anyone who can reach the port can use it. Keep it on a
> trusted LAN, or set a password (below) before exposing it to the internet.

---

## Configuration

Everything is configured via environment variables — all optional, all with safe defaults.
See [`.env.example`](./.env.example) for the full list. The most useful ones:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8382` | HTTP port |
| `YTDL_PASSWORD` | _(unset)_ | Enable the shared-password gate. Use a long, random value. |
| `YTDL_SESSION_SECRET` | _(derived)_ | Stable cookie-signing secret |
| `TRUST_PROXY` | `false` | Honor `X-Forwarded-*` (only behind a proxy you control) |
| `CONCURRENCY` | `1` | Max simultaneous downloads |
| `MAX_FILE_SIZE_MB` | `2048` | Reject downloads larger than this |
| `TEMP_BUDGET_MB` | `8192` | Total temp-dir ceiling before new jobs queue/refuse |
| `JOB_TIMEOUT_SECONDS` | `1800` | Kill a stuck job after this long |
| `COOKIES_FILE` | _(unset)_ | Path to an optional `cookies.txt` (see below) |

### Turning on the password

```yaml
# docker-compose.yml
environment:
  YTDL_PASSWORD: 'a-long-random-passphrase'
  YTDL_SESSION_SECRET: 'another-random-value'
```

When set, the login screen appears and **all** routes (probe, download, progress, file) require
the password. It's compared in constant time and throttled against brute force.

---

## "Sign in to confirm you're not a bot"

YouTube sometimes blocks downloads from a server's IP. A home/residential connection usually
works fine; datacenter IPs get blocked more often. The escape hatch is a cookies file:

1. Export a `cookies.txt` for YouTube from a browser **logged into a throwaway account**
   (read your browser's cookies directly — avoid sketchy "cookie export" extensions).
2. Mount it read-only and point the app at it:

   ```yaml
   # docker-compose.yml
   environment:
     COOKIES_FILE: /data/cookies.txt
   volumes:
     - ./cookies.txt:/data/cookies.txt:ro
   ```

> ⚠️ A `cookies.txt` is a **live credential** — it grants access to that YouTube account. Use a
> throwaway/dedicated account, mount it read-only, and never commit it. The app never logs it.

For stubborn cases, an external [PO-token provider](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide)
(e.g. `bgutil`) can be run as a sidecar — an advanced, optional add-on, not part of this image.

---

## Updating yt-dlp

The image **pins** yt-dlp for reproducibility. If YouTube changes break extraction, bump it:

```bash
docker compose build --build-arg YTDLP_VERSION=2026.05.31
docker compose up -d
```

Use `latest` to always grab the newest release at build time. The image also bundles
[Deno](https://deno.com) (pinnable with `--build-arg DENO_VERSION=...`), which yt-dlp uses as the
JavaScript runtime to solve YouTube's n-signature challenge — without it, high-resolution formats
may be unavailable.

---

## Security & operational notes

- Runs as a **non-root** user; the temp directory is the only writable location.
- yt-dlp/ffmpeg are invoked with **argument arrays** (never a shell) and a `--` end-of-options
  guard, and `--ignore-config`, so a crafted URL can't inject flags or commands.
- URLs are validated against an **exact** YouTube host allowlist (no look-alike domains).
- Downloads are served via unguessable, single-use-window tokens with `Content-Disposition:
  attachment` + `nosniff`, and removed within their TTL by a background sweeper.
- yt-dlp can reach the host's network. Run on an **isolated Docker network** (the compose file
  does) and apply the documented CPU/memory limits.
- State is intentionally **ephemeral**: restarting the container clears all temp files and jobs.

---

## Running locally without Docker

You need **Node.js 20+** and three external tools on your `PATH`:

- **yt-dlp** — `brew install yt-dlp` / `pipx install yt-dlp`, or download the standalone binary.
- **ffmpeg** — `brew install ffmpeg` (or your distro's package).
- **Deno** — `brew install deno` / `curl -fsSL https://deno.land/install.sh | sh`. Optional but
  recommended; without it, high-resolution YouTube formats may be unavailable.

If you don't want to install them globally, drop the binaries in a folder and point the server at
yt-dlp with `YTDLP_PATH=/path/to/yt-dlp` (ffmpeg and deno are found via `PATH`).

### Option A — dev servers (hot reload)

```bash
npm install
npm run dev
```

This runs Vite on <http://localhost:5173> (proxying `/api` to the backend) and the API server on
<http://localhost:8382>. Open the Vite URL.

### Option B — production build, single process

Mirrors the container: build everything, serve the SPA + API from one Node process.

```bash
npm install
npm run build          # builds web/ and server/
cp -r web/dist public  # the server serves ./public relative to its cwd
PORT=8382 TEMP_DIR=./.tmp YTDLP_PATH="$(command -v yt-dlp)" node server/dist/index.js
```

Run it from the repo root (so `./public` resolves to the built SPA) and open
<http://localhost:8382>. Override any setting from [`.env.example`](./.env.example) via environment
variables (e.g. `YTDL_PASSWORD=...` to enable the gate, `PORT=...` to change the port).

## Project layout

- `server/` — Node + TypeScript + [Hono](https://hono.dev), SSE, in-memory job queue.
- `web/` — React + Vite + Tailwind v4 + Framer Motion, single page.

The product spec lives under [`openspec/`](./openspec).

## Disclaimer

You are responsible for how you use this tool and for complying with YouTube's Terms of Service
and applicable copyright law. It is intended for personal use (e.g. content you own or that is
licensed for download).
